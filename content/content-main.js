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
let loadAttempts = 0;
const maxLoadAttempts = 5;
let tabsInitialized = false;
let handlerReady = false;

/**
 * Get storage preference from settings
 * @returns {Promise<boolean>} true for sync storage, false for local
 */
async function getStoragePreference() {
  try {
    const result = await browser.storage.sync.get('userSettings');
    if (result.userSettings && typeof result.userSettings.useSyncStorage === 'boolean') {
      return result.userSettings.useSyncStorage;
    }
    return true; // Default to sync
  } catch (error) {
    return true;
  }
}

/**
 * Read tabs from chunked sync storage
 */
async function readChunkedSync(baseKey) {
  try {
    const metadataKey = `${baseKey}_metadata`;
    const metadataResult = await browser.storage.sync.get(metadataKey);
    const metadata = metadataResult[metadataKey];

    if (!metadata || !metadata.chunked) {
      const directResult = await browser.storage.sync.get(baseKey);
      return directResult[baseKey] || null;
    }

    const chunkCount = metadata.chunkCount;
    const chunkKeys = [];
    for (let i = 0; i < chunkCount; i++) {
      chunkKeys.push(`${baseKey}_chunk_${i}`);
    }

    const chunksResult = await browser.storage.sync.get(chunkKeys);
    const chunks = [];
    for (let i = 0; i < chunkCount; i++) {
      const chunkKey = `${baseKey}_chunk_${i}`;
      if (!chunksResult[chunkKey]) {
        throw new Error(`Missing chunk ${i} of ${chunkCount}`);
      }
      chunks.push(chunksResult[chunkKey]);
    }

    const jsonString = chunks.join('');
    return JSON.parse(jsonString);
  } catch (error) {
    return null;
  }
}

/**
 * Get tabs from storage (sync or local based on preference)
 * Respects profile system if enabled
 */
async function getTabsFromStorage() {
  try {
    const useSyncStorage = await getStoragePreference();

    // Get user settings
    const settingsKey = 'userSettings';
    let settings;
    if (useSyncStorage) {
      const settingsData = await readChunkedSync(settingsKey);
      settings = settingsData || {};
    } else {
      const result = await browser.storage.local.get(settingsKey);
      settings = result[settingsKey] || {};
    }

    // Always load from profile storage if activeProfileId exists
    // (profiles are used internally even if UI is disabled)
    if (settings.activeProfileId) {
      const profileTabsKey = `profile_${settings.activeProfileId}_tabs`;

      if (useSyncStorage) {
        const tabs = await readChunkedSync(profileTabsKey);
        return tabs || [];
      } else {
        const result = await browser.storage.local.get(profileTabsKey);
        return result[profileTabsKey] || [];
      }
    }

    // Fallback to legacy customTabs key (for very old installations)
    if (useSyncStorage) {
      const tabs = await readChunkedSync('customTabs');
      return tabs || [];
    } else {
      const result = await browser.storage.local.get('customTabs');
      return result.customTabs || [];
    }
  } catch (error) {
    return [];
  }
}

/**
 * Check if Lightning Navigation is enabled
 * Always returns true as Lightning Navigation is now standard
 */
function isLightningNavigationEnabled() {
  return true;
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
    // Use the tab renderer if available, otherwise fall back to direct initialization
    if (window.SFTabsContent && window.SFTabsContent.tabRenderer) {
      window.SFTabsContent.tabRenderer.initTabs(tabContainer);
    } else {
      // Fallback initialization if modules aren't loaded
      initTabsWithLightningNavigation(tabContainer);
    }
  }
}

/**
 * Fallback tab initialization WITH Lightning Navigation AND Dropdown Support
 */
async function initTabsWithLightningNavigation(tabContainer) {
  try {
    let tabsToUse = await getTabsFromStorage();

    // Get user settings to check if we should use defaults
    const useSyncStorage = await getStoragePreference();
    const settingsKey = 'userSettings';
    let settings;
    if (useSyncStorage) {
      const settingsData = await readChunkedSync(settingsKey);
      settings = settingsData || {};
    } else {
      const result = await browser.storage.local.get(settingsKey);
      settings = result[settingsKey] || {};
    }

    // Check display mode - if floating-only, don't render Setup tabs
    if (settings.floatingButton && settings.floatingButton.displayMode === 'floating-only') {
      return;
    }

    if (!tabsToUse || tabsToUse.length === 0) {
      // If activeProfileId exists, respect empty profiles (don't use defaults)
      // This means profiles system is active internally even if UI is disabled
      if (settings.activeProfileId) {
        tabsToUse = [];
      } else {
        // No profile system - use default tabs from constants if available
        if (window.SFTabs && window.SFTabs.constants) {
          tabsToUse = window.SFTabs.constants.DEFAULT_TABS;
        } else {
          // Hardcoded fallback
          tabsToUse = [
            { id: 'default_tab_flows', label: 'Flows', path: 'Flows', openInNewTab: false, position: 0 },
            { id: 'default_tab_users', label: 'Users', path: 'ManageUsers', openInNewTab: false, position: 1 }
          ];
        }
      }
    }

    // Remove existing custom tabs
    const existingTabs = tabContainer.querySelectorAll('.sf-tabs-custom-tab');
    existingTabs.forEach(tab => tab.remove());

    // Sort and add tabs
    const topLevelTabs = tabsToUse.filter(tab => !tab.parentId).sort((a, b) => a.position - b.position);

    for (const tab of topLevelTabs) {
      const tabElement = createTabElementWithLightningAndDropdown(tab);
      tabContainer.appendChild(tabElement);
    }

    // Highlight active tab after rendering
    // Use a longer delay to ensure this happens after any navigation-triggered highlights
    // This will be the "final" highlight after tab re-rendering
    // Cancel any existing pending highlight
    if (pendingHighlightTimeout) {
      clearTimeout(pendingHighlightTimeout);
    }
    pendingHighlightTimeout = setTimeout(() => {
      // Force highlight by resetting debounce time
      lastHighlightTime = 0;
      highlightActiveTabStandalone();
      pendingHighlightTimeout = null;
    }, 600);
  } catch (error) {
    // Error in fallback tab initialization
  }
}

/**
 * Create tab element with Lightning Navigation AND Dropdown Support
 */
function createTabElementWithLightningAndDropdown(tab) {
  const currentUrl = window.location.href;
  const baseUrlSetup = currentUrl.split('/lightning/setup/')[0] + '/lightning/setup/';
  const baseUrlObject = currentUrl.split('/lightning/setup/')[0] + '/lightning/o/';
  const baseUrlRoot = currentUrl.split('/lightning/setup/')[0];

  let fullUrl = '';

  // Check if this is a folder-style tab (no path) first
  if (!tab.path || !tab.path.trim()) {
    // For folder tabs, return javascript:void(0) to prevent navigation
    fullUrl = 'javascript:void(0)';
  } else {
    const isObject = tab.isObject || false;
    const isCustomUrl = tab.isCustomUrl || false;

    if (isCustomUrl) {
      let formattedPath = tab.path;
      if (!formattedPath.startsWith('/')) {
        formattedPath = '/' + formattedPath;
      }
      fullUrl = `${baseUrlRoot}${formattedPath}`;
    } else if (isObject) {
      fullUrl = `${baseUrlObject}${tab.path}`;
    } else if (tab.path.includes('ObjectManager/')) {
      fullUrl = `${baseUrlSetup}${tab.path}`;
    } else {
      fullUrl = `${baseUrlSetup}${tab.path}/home`;
    }
  }
  
  const li = document.createElement('li');
  li.setAttribute('role', 'presentation');
  li.className = 'oneConsoleTabItem tabItem slds-context-bar__item borderRight navexConsoleTabItem sf-tabs-custom-tab';
  li.setAttribute('data-aura-class', 'navexConsoleTabItem');
  li.setAttribute('data-tab-id', tab.id);
  li.setAttribute('data-url', fullUrl);
  
  // Add dropdown indicator classes if tab has dropdown functionality
  if (tab.dropdownItems && tab.dropdownItems.length > 0) {
    li.classList.add('has-dropdown');
  }
  
  const a = document.createElement('a');
  a.setAttribute('role', 'tab');
  a.setAttribute('tabindex', '-1');
  a.setAttribute('title', tab.label);
  a.setAttribute('aria-selected', 'false');
  a.setAttribute('href', fullUrl);
  
  if (tab.openInNewTab) {
    a.setAttribute('target', '_blank');
  } else {
    a.setAttribute('target', '_self');
  }
  
  a.classList.add('tabHeader', 'slds-context-bar__label-action');
  
  const span = document.createElement('span');
  span.classList.add('title', 'slds-truncate');
  span.textContent = tab.label;

  // Assemble the tab label first
  a.appendChild(span);
  li.appendChild(a);

  // Add dropdown button as separate sibling element (not nested in label)
  if (tab.dropdownItems && tab.dropdownItems.length > 0) {
    // Create wrapper div matching native Salesforce structure
    const dropdownWrapper = document.createElement('div');
    dropdownWrapper.className = 'slds-context-bar__label-action slds-p-left--none uiMenu oneNavItemDropdown';
    dropdownWrapper.setAttribute('data-aura-rendered-by', `sftabs-dropdown-wrapper-${tab.id}`);
    dropdownWrapper.setAttribute('data-aura-class', 'uiMenu oneNavItemDropdown');

    // Create inner trigger wrapper
    const triggerWrapper = document.createElement('div');
    triggerWrapper.className = 'uiPopupTrigger';
    triggerWrapper.setAttribute('id', `dropdown-trigger-${tab.id}`);
    triggerWrapper.setAttribute('data-aura-rendered-by', `sftabs-trigger-${tab.id}`);
    triggerWrapper.setAttribute('data-aura-class', 'uiPopupTrigger');

    // Create dropdown button with proper ARIA attributes
    const dropdownButton = document.createElement('a');
    dropdownButton.className = 'slds-button slds-button--icon';
    dropdownButton.setAttribute('id', `dropdown-arrow-${tab.id}`);
    dropdownButton.setAttribute('role', 'button');
    dropdownButton.setAttribute('aria-disabled', 'false');
    dropdownButton.setAttribute('tabindex', '0');
    dropdownButton.setAttribute('aria-expanded', 'false');
    dropdownButton.setAttribute('aria-haspopup', 'true');
    dropdownButton.setAttribute('aria-controls', `dropdown-menu-${tab.id}`);
    dropdownButton.setAttribute('href', 'javascript:void(0)');
    dropdownButton.setAttribute('title', `${tab.label} List`);
    dropdownButton.innerHTML = `
    <svg focusable="false" aria-hidden="true" viewBox="0 0 520 520" class="slds-icon slds-icon_xx-small slds-button__icon slds-button__icon--hint">
      <path d="M476 178L271 385c-6 6-16 6-22 0L44 178c-6-6-6-16 0-22l22-22c6-6 16-6 22 0l161 163c6 6 16 6 22 0l161-162c6-6 16-6 22 0l22 22c5 6 5 15 0 21z"></path>
    </svg>
    `;

    // Assemble dropdown structure
    triggerWrapper.appendChild(dropdownButton);
    dropdownWrapper.appendChild(triggerWrapper);
    li.appendChild(dropdownWrapper);

    // Create dropdown menu if dropdown items exist
    if (tab.dropdownItems && tab.dropdownItems.length > 0) {
      const dropdown = createInlineDropdownMenu(tab);
      li.appendChild(dropdown);

      // Add dropdown toggle handler
      dropdownButton.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        toggleInlineDropdown(dropdown, dropdownButton);
      });
    }
  }
  
  // Add click handler WITH Lightning Navigation - FROM ORIGINAL
  a.addEventListener('click', (event) => {
    // FIRST: Check if this is a folder-style tab (no path)
    const hasPath = tab.path && tab.path.trim();

    if (!hasPath) {
      // Folder-style tab - prevent navigation immediately
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      // If it has a dropdown, open it
      const hasDropdown = tab.dropdownItems && tab.dropdownItems.length > 0;
      if (hasDropdown) {
        const tabElement = document.querySelector(`li[data-tab-id="${tab.id}"]`);
        const dropdown = tabElement?.querySelector('.sftabs-custom-dropdown');
        const dropdownButton = document.getElementById(`dropdown-arrow-${tab.id}`);

        if (dropdown && dropdownButton) {
          toggleInlineDropdown(dropdown, dropdownButton);
        }
      }
      return;
    }

    // If clicking on dropdown button or its wrapper, don't navigate
    if (event.target.closest('.oneNavItemDropdown') ||
        event.target.closest('.uiPopupTrigger') ||
        event.target.closest(`#dropdown-arrow-${tab.id}`)) {
      return;
    }

    // NEW: If clicking within the dropdown menu, don't navigate
    if (event.target.closest('.sftabs-custom-dropdown')) {
      return;
    }

    const lightningEnabled = isLightningNavigationEnabled();

    if (tab.openInNewTab) {
      // For new tab, always use window.open
      event.preventDefault();
      window.open(fullUrl, '_blank');
    } else {
      // For same tab, check if Lightning navigation is enabled
      if (lightningEnabled) {
        // Use Lightning navigation
        event.preventDefault();
        lightningNavigate({
          navigationType: "url",
          url: fullUrl
        }, fullUrl);
      } else {
        // Lightning navigation is disabled, use regular navigation
        event.preventDefault();
        window.location.href = fullUrl;
      }
    }
  });
  
  return li;
}

// Note: The following functions are now used from tab-renderer.js to avoid code duplication:
// - createInlineDropdownMenu(tab)
// - toggleInlineDropdown(dropdown, dropdownArrow)
// - navigateToMainTab(tab)

/**
 * Navigate to a navigation item from dropdown
 */
function navigateToNavigationItem(navItem, parentTab) {
  const baseUrl = window.location.origin;
  let fullUrl = '';
  let path = navItem.path || navItem.url || '';

  // Check if path already includes full Lightning URL (nested navigation items)
  if (path.startsWith('/lightning/')) {
    // Path already has full Lightning path, just add origin
    fullUrl = `${baseUrl}${path}`;
  } else if (navItem.isObject) {
    // Object paths: /lightning/o/{objectName}/list or /lightning/o/{objectName}/view/{recordId}
    fullUrl = `${baseUrl}/lightning/o/${path}`;
  } else if (navItem.isCustomUrl) {
    // Custom URLs: ensure leading slash
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    fullUrl = `${baseUrl}${path}`;
  } else {
    // Setup paths: /lightning/setup/{setupPath}
    fullUrl = `${baseUrl}/lightning/setup/${path}`;
  }

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
 * Standalone version of highlightActiveTab for use when tab-renderer.js isn't loaded yet
 */
async function highlightActiveTabStandalone() {
  // Debounce: skip if we just highlighted within the last 200ms
  const now = Date.now();
  if (now - lastHighlightTime < HIGHLIGHT_DEBOUNCE_MS) {
    return;
  }
  lastHighlightTime = now;

  const currentUrl = window.location.href;

  try {
    const tabs = await getTabsFromStorage();
    const topLevelTabs = tabs.filter(tab => !tab.parentId).sort((a, b) => a.position - b.position);
    let matchedTab = null;

    for (const tab of topLevelTabs) {
      const tabElement = document.querySelector(`li[data-tab-id="${tab.id}"]`);
      if (tabElement) {
        const tabUrl = tabElement.getAttribute('data-url');
        const baseTabUrl = tabUrl ? tabUrl.split('/Details')[0] : null;
        const matches = tabUrl && currentUrl.startsWith(baseTabUrl);
        if (matches) {
          matchedTab = tab;
          break;
        }
      }
    }

    if (matchedTab) {
      // Remove active state from all tabs in tabBarItems
      const allTabs = document.querySelectorAll('.tabBarItems .tabItem');
      allTabs.forEach(tabEl => {
        tabEl.classList.remove('slds-is-active');
        const anchor = tabEl.querySelector('a');
        if (anchor) anchor.setAttribute('aria-selected', 'false');
      });

      // Also remove active state from native pinned tabs (Salesforce Starter Edition)
      const pinnedTabs = document.querySelectorAll('.pinnedItems .tabItem');
      pinnedTabs.forEach(tabEl => {
        tabEl.classList.remove('slds-is-active', 'active');
        const anchor = tabEl.querySelector('a');
        if (anchor) anchor.setAttribute('aria-selected', 'false');
      });

      // Add active state to matched tab
      const activeEl = document.querySelector(`li[data-tab-id="${matchedTab.id}"]`);
      if (activeEl) {
        activeEl.classList.add('slds-is-active');
        const anchor = activeEl.querySelector('a');
        if (anchor) anchor.setAttribute('aria-selected', 'true');
      }
    }
  } catch (error) {
    // Error in highlightActiveTabStandalone
  }
}

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
          if (window.SFTabsContent && window.SFTabsContent.tabRenderer) {
            window.SFTabsContent.tabRenderer.highlightActiveTab();
          } else {
            // Fallback: call standalone version
            highlightActiveTabStandalone();
          }
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
 * Handle refresh tabs request
 */
function handleRefreshTabs(sendResponse) {
  const tabContainer = document.querySelector('.tabBarItems.slds-grid');

  if (tabContainer) {
    if (window.SFTabsContent && window.SFTabsContent.tabRenderer) {
      window.SFTabsContent.tabRenderer.initTabs(tabContainer);
    } else {
      initTabsWithLightningNavigation(tabContainer);
    }
    sendResponse({ success: true });
  } else {
    sendResponse({ success: false, error: "Tab container not found" });
  }
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
function handleParseNavigation(sendResponse) {
  if (window.SFTabsContent && window.SFTabsContent.navigationParser) {
    const navigation = window.SFTabsContent.navigationParser.parseCurrentObjectManagerNavigation();
    sendResponse({
      success: true,
      navigation: navigation,
      count: navigation.length,
      pageInfo: window.SFTabsContent.navigationParser.getCurrentPageInfo()
    });
  } else {
    sendResponse({ success: false, error: 'Navigation parser not available' });
  }
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

  // Build the full URL for the tab
  const currentUrl = window.location.href;
  const baseUrlSetup = currentUrl.split('/lightning/setup/')[0] + '/lightning/setup/';
  const baseUrlObject = currentUrl.split('/lightning/setup/')[0] + '/lightning/o/';
  const baseUrlRoot = currentUrl.split('/lightning/setup/')[0];

  let fullUrl = '';
  const isObject = tab.isObject || false;
  const isCustomUrl = tab.isCustomUrl || false;

  if (isCustomUrl) {
    let formattedPath = tab.path;
    if (!formattedPath.startsWith('/')) {
      formattedPath = '/' + formattedPath;
    }
    fullUrl = `${baseUrlRoot}${formattedPath}`;
  } else if (isObject) {
    fullUrl = `${baseUrlObject}${tab.path}`;
  } else if (tab.path.includes('ObjectManager/')) {
    fullUrl = `${baseUrlSetup}${tab.path}`;
  } else {
    fullUrl = `${baseUrlSetup}${tab.path}/home`;
  }

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
    // Debounced handler for tab refresh to prevent rapid successive calls
    const debouncedRefreshTabs = debounce(() => {
      const tabContainer = document.querySelector('.tabBarItems.slds-grid');
      if (tabContainer) {
        if (window.SFTabsContent && window.SFTabsContent.tabRenderer) {
          window.SFTabsContent.tabRenderer.initTabs(tabContainer);
        } else {
          initTabsWithLightningNavigation(tabContainer);
        }
      }
    }, 500);

    browser.storage.onChanged.addListener((changes, area) => {
      // Check for both 'local' and 'sync' areas
      // For sync storage with chunking, also check for metadata or chunk changes
      const hasCustomTabsChange = changes.customTabs ||
                                   changes.customTabs_metadata ||
                                   Object.keys(changes).some(key => key.startsWith('customTabs_chunk_'));

      // Check for profile-specific tab changes (profile_{id}_tabs)
      const hasProfileTabsChange = Object.keys(changes).some(key =>
        key.startsWith('profile_') && key.endsWith('_tabs')
      ) || Object.keys(changes).some(key =>
        key.startsWith('profile_') && (key.endsWith('_tabs_metadata') || key.includes('_tabs_chunk_'))
      );

      if ((area === 'local' || area === 'sync') && (hasCustomTabsChange || hasProfileTabsChange)) {
        debouncedRefreshTabs();
      }
    });
  }
}

/**
 * Debounce helper function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
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
      if (window.SFTabsContent && window.SFTabsContent.tabRenderer) {
        window.SFTabsContent.tabRenderer.initTabs(tabContainer);
      } else {
        initTabsWithLightningNavigation(tabContainer);
      }
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
      if (window.SFTabsContent && window.SFTabsContent.tabRenderer) {
        window.SFTabsContent.tabRenderer.initTabs(tabContainer);
      } else {
        initTabsWithLightningNavigation(tabContainer);
      }

      // Re-highlight the active tab
      setTimeout(() => {
        if (window.SFTabsContent && window.SFTabsContent.tabRenderer) {
          window.SFTabsContent.tabRenderer.highlightActiveTab();
        }
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