// content/content-main.js
// Main content script entry point for Salesforce integration

// Browser compatibility layer - add this at the very top
(function() {
  'use strict';
  
  if (typeof browser === 'undefined' && typeof chrome !== 'undefined' && chrome.runtime) {
    window.browser = {
      runtime: {
        getURL: chrome.runtime.getURL.bind(chrome.runtime),
        onMessage: chrome.runtime.onMessage,
        // Needed to hand work to the background worker — the menu-bar "+" asks
        // it to write the captured tab, since it owns the chunk-aware writer.
        sendMessage: chrome.runtime.sendMessage.bind(chrome.runtime),
        lastError: chrome.runtime.lastError
      },
      storage: {
        onChanged: chrome.storage.onChanged,
        sync: {
          get: function(keys) {
            return new Promise((resolve, reject) => {
              chrome.storage.local.get(keys, (result) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve(result);
                }
              });
            });
          },
          set: function(items) {
            return new Promise((resolve, reject) => {
              chrome.storage.local.set(items, () => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve();
                }
              });
            });
          }
        }
      },
      tabs: {
        query: function(queryInfo) {
          return new Promise((resolve, reject) => {
            chrome.tabs.query(queryInfo, (tabs) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(tabs);
              }
            });
          });
        },
        sendMessage: function(tabId, message, options) {
          return new Promise((resolve) => {
            const callback = (response) => {
              if (chrome.runtime.lastError) {
                resolve(null);
              } else {
                resolve(response);
              }
            };
            
            if (options) {
              chrome.tabs.sendMessage(tabId, message, options, callback);
            } else {
              chrome.tabs.sendMessage(tabId, message, callback);
            }
          });
        }
      }
    };
  }
})();

// Inject the Lightning navigation script
(function() {
  const script = document.createElement("script");
  script.src = browser.runtime.getURL("content/inject.js");
  script.onload = function() {
    window.postMessage({type: 'SF_TABS_INJECT_LOADED'}, window.location.origin);
  };
  script.onerror = function() {
    // Failed to load inject.js
  };
  
  if (document.head) {
    document.head.appendChild(script);
  } else if (document.documentElement) {
    document.documentElement.appendChild(script);
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      (document.head || document.documentElement).appendChild(script);
    });
  }
})();

// State tracking
const maxLoadAttempts = 5;
let tabsInitialized = false;
let handlerReady = false;

/**
 * The tabs that apply to this page.
 *
 * The rule lives in shared utils now. Three surfaces each had their own copy
 * and disagreed on which storage area to read — content-main took the
 * preference from local, where the device-specific value actually lives, while
 * floating-button took it from sync, which does not hold it. A user on local
 * storage therefore saw tabs in the Setup bar and an empty floating panel on
 * the same page.
 */
async function getTabsFromStorage() {
  try {
    return (await window.SFTabs.utils.loadTabsForUrl(window.location.href)).tabs;
  } catch (error) {
    return [];   // a torn chunk read; an empty bar beats a wrong one
  }
}

/**
 * Lightning navigation function that tries multiple approaches - FROM ORIGINAL
 */
function lightningNavigate(details, fallbackURL) {
  if (!isLightningNavigationEnabled()) {
    window.location.href = fallbackURL;
    return;
  }

  // Try inject.js window function approach first (most reliable)
  if (window.sfTabsLightningNav) {
    const success = window.sfTabsLightningNav({
      navigationType: details.navigationType || "url",
      url: details.url || fallbackURL,
      recordId: details.recordId || null
    });

    if (success) {
      return; // Navigation successful, no fallback needed
    }
  }

  // Try postMessage approach as fallback
  if (handlerReady) {
    const messageData = {
      type: 'SF_TABS_LIGHTNING_NAVIGATE',
      navigationType: details.navigationType || "url",
      url: details.url || fallbackURL,
      recordId: details.recordId || null,
      fallbackURL: fallbackURL
    };

    window.postMessage(messageData, window.location.origin);
    return;
  }

  // Final fallback - only if no handlers are available
  window.location.href = fallbackURL;
}

// Expose lightningNavigate to window for use by floating modal
window.lightningNavigate = lightningNavigate;

/**
 * Main initialization function
 */
async function initializeContentScript() {
  try {
    // Wait for other modules to be available
    if (typeof SFTabsContent === 'undefined') {
      window.SFTabsContent = {};
    }

    // Start the tab loading process
    setTimeout(() => {
      delayLoadTabs(0);
    }, 2000);

    // Setup message listeners
    setupMessageListeners();

    // Setup storage change listeners
    setupStorageListeners();

    // Setup URL change detection
    setupUrlChangeDetection();

    // Setup DOM mutation observer for dynamic loading
    setupMutationObserver();

    // Setup dropdown click handlers
    setupDropdownEventHandlers();

  } catch (error) {
    // Error during content script initialization
  }
}

/**
 * Function to try loading tabs with delay and retries
 */
function delayLoadTabs(attemptCount) {
  // Check if tabs are already initialized
  if (tabsInitialized) {
    return;
  }

  const tabContainer = document.querySelector('.tabBarItems.slds-grid');
  attemptCount++;

  if (attemptCount > maxLoadAttempts) {
    return;
  }

  if (!tabContainer) {
    setTimeout(() => {
      delayLoadTabs(attemptCount);
    }, 2000);
  } else {
    // Set flag immediately to prevent race conditions
    tabsInitialized = true;
    window.SFTabsContent.tabRenderer.initTabs(tabContainer);
  }
}



// Note: The following functions are now used from tab-renderer.js to avoid code duplication:
// - createInlineDropdownMenu(tab)
// - toggleInlineDropdown(dropdown, dropdownArrow)
// - navigateToMainTab(tab)

/**
 * Navigate to a navigation item from dropdown
 */
function navigateToNavigationItem(navItem, parentTab) {
  // Nav items carry their destination in `path` or `url` depending on whether
  // they were configured by hand or scraped from Salesforce's own menu.
  const fullUrl = window.SFTabs.utils.tabDestinationUrl(
    { ...navItem, path: navItem.path || navItem.url || '' });
  if (!fullUrl) return;

  if (parentTab.openInNewTab) {
    window.open(fullUrl, '_blank');
  } else {
    const lightningEnabled = isLightningNavigationEnabled();
    if (lightningEnabled) {
      lightningNavigate({
        navigationType: "url",
        url: fullUrl
      }, fullUrl);
    } else {
      window.location.href = fullUrl;
    }
  }
}

// Debounce tracking for highlightActiveTab to prevent duplicate calls
let lastHighlightTime = 0;
const HIGHLIGHT_DEBOUNCE_MS = 1000; // Increased to 1 second to catch re-initialization
let pendingHighlightTimeout = null;


/**
 * Setup dropdown event handlers
 */
function setupDropdownEventHandlers() {
  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    // Only close our custom dropdowns when clicking outside
    // Don't close if clicking inside:
    // - .sf-tabs-custom-tab (the tab itself)
    // - .sftabs-custom-dropdown (main dropdown menu)
    // - .submenu-container (nested submenus)
    // - .submenu-bridge (invisible bridge between menu and submenu)
    if (!e.target.closest('.sf-tabs-custom-tab') &&
        !e.target.closest('.sftabs-custom-dropdown') &&
        !e.target.closest('.submenu-container') &&
        !e.target.closest('.submenu-bridge')) {
      document.querySelectorAll('.sftabs-custom-dropdown').forEach(dropdown => {
        dropdown.classList.remove('visible');
        dropdown.style.display = 'none';
      });
      // Also close any open submenus
      document.querySelectorAll('.submenu-container').forEach(submenu => {
        submenu.style.display = 'none';
      });
    }
  });
}

/**
 * Setup message listeners
 */
function setupMessageListeners() {
  // Listen for handler ready signals - FROM ORIGINAL
  window.addEventListener("message", function(event) {
    if (event.origin === window.location.origin) {
      if (event.data && event.data.type === 'SF_TABS_INJECT_LOADED') {
        handlerReady = true;
      } else if (event.data && event.data.type === 'SF_TABS_NAVIGATION_COMPLETE') {
        // After Lightning navigation completes, highlight the active tab
        // Use a delay to ensure Salesforce has updated the DOM
        // Clear any pending highlight calls to avoid duplicates
        if (pendingHighlightTimeout) {
          clearTimeout(pendingHighlightTimeout);
        }
        pendingHighlightTimeout = setTimeout(() => {
          window.SFTabsContent.tabRenderer.highlightActiveTab();
          pendingHighlightTimeout = null;
        }, 500);
      }
    }
  });

  // Listen for messages from popup
  if (browser.runtime && browser.runtime.onMessage) {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.action) {
        case 'refresh_tabs':
          handleRefreshTabs(sendResponse);
          break;

        case 'navigate_to_url':
          handleNavigateToUrl(message, sendResponse);
          break;

        case 'lightning_navigate':
          handleLightningNavigate(message, sendResponse);
          break;

        case 'parse_navigation':
          handleParseNavigation(sendResponse);
          break;

        case 'navigate_to_tab':
          handleNavigateToTab(message, sendResponse);
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }

      return true;
    });
  }
}

/**
 * Rebuild the injected tab bar, at most once per burst.
 *
 * Two things ask for this and they routinely arrive together: a refresh_tabs
 * message, and the storage change that prompted it. Each rebuild clears every
 * custom tab and re-adds it, so answering both produced a visible add, clear,
 * add — most obvious on the menu-bar "+", where the write and the broadcast are
 * milliseconds apart.
 *
 * The window is short enough that a message-driven refresh still reads as
 * immediate, and long enough to swallow the storage event that follows it.
 */
const refreshTabsSoon = debounce(() => {
  const tabContainer = document.querySelector('.tabBarItems.slds-grid');
  if (!tabContainer) return;
  window.SFTabsContent.tabRenderer.initTabs(tabContainer);
}, 120);

/**
 * Handle refresh tabs request
 */
function handleRefreshTabs(sendResponse) {
  const tabContainer = document.querySelector('.tabBarItems.slds-grid');
  if (!tabContainer) {
    sendResponse({ success: false, error: "Tab container not found" });
    return;
  }
  refreshTabsSoon();
  sendResponse({ success: true });
}

/**
 * Handle navigation to URL - WITH Lightning Navigation
 */
function handleNavigateToUrl(message, sendResponse) {
  const { url, useLightning } = message;

  if (useLightning && isLightningNavigationEnabled()) {
    lightningNavigate({
      navigationType: "url",
      url: url
    }, url);
    sendResponse({ success: true, method: 'lightning' });
  } else {
    window.location.href = url;
    sendResponse({ success: true, method: 'regular' });
  }
}

/**
 * Handle Lightning navigation request
 */
function handleLightningNavigate(message, sendResponse) {
  const { details, fallbackURL } = message;
  
  lightningNavigate(details, fallbackURL);
  sendResponse({ success: true, method: 'lightning' });
}

/**
 * Handle parse navigation request
 */
/**
 * Read Object Manager's own left-hand nav so the popup can turn it into
 * sub-items.
 *
 * There were two listeners answering this, in two files. Both called
 * sendResponse; this one answered synchronously, so it always won, and the
 * richer reply from navigation-parser.js — the one carrying objectName — was
 * discarded. That silently disabled the popup's guard against pulling
 * Contact's navigation into an Account tab.
 *
 * One endpoint now, with the better behaviour: the retrying async parse, and
 * every field the popup reads.
 */
function handleParseNavigation(sendResponse) {
  const parser = window.SFTabsContent && window.SFTabsContent.navigationParser;
  if (!parser) {
    sendResponse({ success: false, error: 'Navigation parser not available' });
    return;
  }

  if (!parser.isObjectManagerPage()) {
    const objectName = parser.getObjectNameFromUrl() || 'the object';
    sendResponse({ success: false, error: `Go to ${objectName} in Setup to refresh the list` });
    return;
  }

  parser.parseObjectManagerNavigation()
    .then(navigation => sendResponse({
      success: true,
      items: navigation,        // what the popup reads first
      navigation: navigation,   // kept for older callers
      objectName: parser.getObjectNameFromUrl(),
      pageInfo: parser.getCurrentPageInfo(),
      currentUrl: window.location.href
    }))
    .catch(error => sendResponse({ success: false, error: error.message }));
}

/**
 * Handle navigate to tab request (from keyboard shortcut)
 */
function handleNavigateToTab(message, sendResponse) {
  const { tab } = message;

  if (!tab) {
    sendResponse({ success: false, error: 'No tab provided' });
    return;
  }

  // A folder tab is a container, not a destination — it has no path to go to.
  // Every sibling URL builder guards this; without it `tab.path.includes` threw
  // and sendResponse never fired, leaving the caller's promise hanging. Report
  // it as handled-but-nowhere-to-go so a shortcut aimed at a folder is simply
  // ignored. Folder tabs are documented as not shortcut-targetable.
  if (!tab.path || !tab.path.trim()) {
    sendResponse({ success: false, error: 'Folder tabs have no destination' });
    return;
  }

  const fullUrl = window.SFTabs.utils.tabDestinationUrl(tab);

  // Navigate based on tab settings
  if (tab.openInNewTab) {
    window.open(fullUrl, '_blank');
    sendResponse({ success: true, method: 'new_tab' });
  } else {
    const lightningEnabled = isLightningNavigationEnabled();
    if (lightningEnabled) {
      lightningNavigate({
        navigationType: "url",
        url: fullUrl
      }, fullUrl);
      sendResponse({ success: true, method: 'lightning' });
    } else {
      window.location.href = fullUrl;
      sendResponse({ success: true, method: 'regular' });
    }
  }
}

/**
 * Setup storage change listeners
 */
function setupStorageListeners() {
  if (browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener((changes, area) => {
      // Two reasons to redraw: the tabs changed, or a setting that governs how
      // they are drawn changed. The second was missing, so turning tab colours
      // off left them coloured and switching dot/fill did nothing until the
      // page was reloaded — the settings live in userSettings, which the tab
      // predicate does not cover, and only the quick-add toggle happened to
      // broadcast a refresh of its own.
      const utils = window.SFTabs?.utils;
      const redraw = utils && (utils.tabStorageChanged(changes) ||
                               utils.settingsAffectTabBar(changes.userSettings));

      if ((area === 'local' || area === 'sync') && redraw) {
        // Shares the timer with the message path, so a write and the broadcast
        // that follows it collapse into a single rebuild
        refreshTabsSoon();
      }
    });
  }
}

/**
 * Handle URL changes and refresh tabs
 */
function handleUrlChange() {
  // Cancel any pending highlights from navigation complete
  // The re-initialization will schedule its own highlight
  if (pendingHighlightTimeout) {
    clearTimeout(pendingHighlightTimeout);
    pendingHighlightTimeout = null;
  }

  setTimeout(() => {
    const tabContainer = document.querySelector('.tabBarItems.slds-grid');
    if (tabContainer) {
      window.SFTabsContent.tabRenderer.initTabs(tabContainer);
    }
  }, 500);
}

/**
 * Setup URL change detection using modern event-based approach
 */
function setupUrlChangeDetection() {
  let lastUrl = location.href;

  // Debounced handler to prevent rapid successive calls
  const debouncedHandleUrlChange = debounce(handleUrlChange, 300);

  // Listen for browser navigation events (back/forward buttons)
  window.addEventListener('popstate', () => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      debouncedHandleUrlChange();
    }
  });

  // Listen for Salesforce Lightning navigation events via mutation observer
  // This catches SPA navigation that doesn't trigger popstate
  const urlObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      debouncedHandleUrlChange();
    }
  });

  // Observe changes to the document title and body (Lightning updates these during navigation)
  if (document.querySelector('title')) {
    urlObserver.observe(document.querySelector('title'), { childList: true, subtree: true });
  }

  // Also observe the main content area for Lightning navigation
  const mainContent = document.querySelector('div.oneAlohaPage, div.slds-template__container');
  if (mainContent) {
    urlObserver.observe(mainContent, { childList: true, subtree: true });
  }
}

/**
 * Setup mutation observer for dynamic content loading
 */
function setupMutationObserver() {
  const observer = new MutationObserver(() => {
    const tabContainer = document.querySelector('.tabBarItems.slds-grid');

    if (tabContainer && !tabsInitialized) {
      observer.disconnect();

      // Set flag immediately to prevent race conditions
      tabsInitialized = true;
      window.SFTabsContent.tabRenderer.initTabs(tabContainer);

      // Re-highlight the active tab
      setTimeout(() => {
        window.SFTabsContent.tabRenderer.highlightActiveTab();
      }, 500);
    }
  });

  // Target the navigation bar specifically instead of entire document.body
  // This reduces observer callbacks by 10-100x during page load
  const targetElement = document.querySelector('.slds-context-bar')
    || document.querySelector('.oneConsoleTab')
    || document.body; // Fallback to body if specific selectors not found

  if (targetElement) {
    // Use subtree: false if we found the navigation bar (only watch immediate children)
    const useSubtree = targetElement === document.body;
    observer.observe(targetElement, {
      childList: true,
      subtree: useSubtree
    });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      const targetEl = document.querySelector('.slds-context-bar')
        || document.querySelector('.oneConsoleTab')
        || document.body;
      const useSubtree = targetEl === document.body;
      observer.observe(targetEl, {
        childList: true,
        subtree: useSubtree
      });
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
  initializeContentScript();
}

// Export for use by other modules
window.SFTabsContent = window.SFTabsContent || {};
window.SFTabsContent.main = {
  initializeContentScript,
  delayLoadTabs,
  handleRefreshTabs,
  handleNavigateToUrl,
  handleLightningNavigate,
  handleParseNavigation,
  lightningNavigate,
  isLightningNavigationEnabled,
  navigateToNavigationItem
  // navigateToMainTab - removed, use window.SFTabsContent.tabRenderer.navigateToMainTab instead
  // toggleInlineDropdown - removed, internal function only
};