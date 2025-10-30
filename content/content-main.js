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
    console.log('SF Tabs: Chrome compatibility layer loaded in content script');
  }
})();

// Inject the Lightning navigation script
(function() {
  const script = document.createElement("script");
  script.src = browser.runtime.getURL("content/inject.js");
  script.onload = function() {
    console.log("inject.js loaded successfully");
    window.postMessage({type: 'SF_TABS_INJECT_LOADED'}, window.location.origin);
  };
  script.onerror = function() {
    console.error("Failed to load inject.js");
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
 * Check if Lightning Navigation is enabled
 */
function isLightningNavigationEnabled() {
  const localStorageValue = localStorage.getItem("lightningNavigation");
  if (localStorageValue !== null) {
    return JSON.parse(localStorageValue);
  }
  return true;
}

/**
 * Lightning navigation function that tries multiple approaches - FROM ORIGINAL
 */
function lightningNavigate(details, fallbackURL) {
  if (!isLightningNavigationEnabled()) {
    console.log("Lightning Navigation disabled - using regular navigation");
    window.location.href = fallbackURL;
    return;
  }

  console.log("Attempting Lightning navigation...");
  
  // Try inject.js window function approach first (most reliable)
  if (window.sfTabsLightningNav) {
    console.log("Using inject.js window function approach");
    const success = window.sfTabsLightningNav({
      navigationType: details.navigationType || "url",
      url: details.url || fallbackURL,
      recordId: details.recordId || null
    });
    
    if (success) {
      console.log("Lightning navigation initiated successfully");
      return; // Navigation successful, no fallback needed
    }
  }
  
  // Try postMessage approach as fallback
  if (handlerReady) {
    console.log("Using postMessage approach");
    const messageData = {
      type: 'SF_TABS_LIGHTNING_NAVIGATE',
      navigationType: details.navigationType || "url",
      url: details.url || fallbackURL,
      recordId: details.recordId || null,
      fallbackURL: fallbackURL
    };
    
    window.postMessage(messageData, window.location.origin);
    
    console.log("Lightning navigation message sent - waiting for Lightning to handle");
    return;
  }
  
  // Final fallback - only if no handlers are available
  console.log("No Lightning navigation available - using regular navigation");
  window.location.href = fallbackURL;
}

/**
 * Initialize Lightning Navigation setting from browser storage
 */
async function initializeLightningNavigationSetting() {
  try {
    const result = await browser.storage.local.get('userSettings');
    if (result.userSettings && result.userSettings.hasOwnProperty('lightningNavigation')) {
      const enabled = result.userSettings.lightningNavigation;
      localStorage.setItem("lightningNavigation", JSON.stringify(enabled));
      console.log('Lightning Navigation setting initialized:', enabled);
    } else {
      localStorage.setItem("lightningNavigation", JSON.stringify(true));
      console.log('Lightning Navigation setting defaulted to true');
    }
  } catch (error) {
    console.error('Error loading Lightning Navigation setting:', error);
    localStorage.setItem("lightningNavigation", JSON.stringify(true));
  }
}

/**
 * Main initialization function
 */
async function initializeContentScript() {
  console.log('SF Tabs content script initializing...');
  
  try {
    // Initialize Lightning Navigation setting first
    await initializeLightningNavigationSetting();
    
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
    
    console.log('SF Tabs content script initialization complete');
    
  } catch (error) {
    console.error('Error during content script initialization:', error);
  }
}

/**
 * Function to try loading tabs with delay and retries
 */
function delayLoadTabs(attemptCount) {
  const tabContainer = document.querySelector('.tabBarItems.slds-grid');
  attemptCount++;
  
  console.log(`Tab loading attempt ${attemptCount}/${maxLoadAttempts}`);
  
  if (attemptCount > maxLoadAttempts) {
    console.error("SF Tabs - failed to find tab container after max attempts");
    return;
  }
  
  if (!tabContainer) {
    setTimeout(() => {
      delayLoadTabs(attemptCount);
    }, 2000);
  } else {
    console.log("Tab container found - initializing tabs");
    // Use the tab renderer if available, otherwise fall back to direct initialization
    if (window.SFTabsContent && window.SFTabsContent.tabRenderer) {
      window.SFTabsContent.tabRenderer.initTabs(tabContainer);
    } else {
      // Fallback initialization if modules aren't loaded
      initTabsWithLightningNavigation(tabContainer);
    }
    tabsInitialized = true;
  }
}

/**
 * Fallback tab initialization WITH Lightning Navigation AND Dropdown Support
 */
function initTabsWithLightningNavigation(tabContainer) {
  console.log('Using fallback tab initialization with Lightning Navigation and Dropdown Support');
  
  browser.storage.local.get(['customTabs', 'userSettings']).then(result => {
    let tabsToUse = [];
    
    if (result.customTabs && Array.isArray(result.customTabs) && result.customTabs.length > 0) {
      tabsToUse = result.customTabs;
    } else {
      // Use default tabs from constants if available
      if (window.SFTabs && window.SFTabs.constants) {
        tabsToUse = window.SFTabs.constants.DEFAULT_TABS;
      } else {
        // Hardcoded fallback
        tabsToUse = [
          { id: 'default_tab_flows', label: 'Flows', path: 'Flows', openInNewTab: false, position: 0 },
          { id: 'default_tab_users', label: 'Users', path: 'ManageUsers', openInNewTab: false, position: 1 }
        ];
      }
      browser.storage.local.set({ customTabs: tabsToUse });
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
    
    console.log("Fallback tabs with Lightning Navigation and Dropdown Support successfully added to container");
  }).catch(error => {
    console.error("Error in fallback tab initialization:", error);
  });
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
  
  const li = document.createElement('li');
  li.setAttribute('role', 'presentation');
  li.className = 'oneConsoleTabItem tabItem slds-context-bar__item borderRight navexConsoleTabItem sf-tabs-custom-tab';
  li.setAttribute('data-aura-class', 'navexConsoleTabItem');
  li.setAttribute('data-tab-id', tab.id);
  li.setAttribute('data-url', fullUrl);
  
  // Add dropdown indicator classes if tab has dropdown functionality
  if (tab.hasDropdown || tab.autoSetupDropdown || (tab.cachedNavigation && tab.cachedNavigation.length > 0)) {
    li.classList.add('has-dropdown');
    
    // Add navigation count if available
    if (tab.cachedNavigation && tab.cachedNavigation.length > 0) {
      li.setAttribute('data-nav-count', tab.cachedNavigation.length);
    }
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
  
  // Add dropdown arrow if tab has dropdown functionality
if (tab.hasDropdown || tab.autoSetupDropdown || (tab.cachedNavigation && tab.cachedNavigation.length > 0) || (tab.dropdownItems && tab.dropdownItems.length > 0)) {
    // Create dropdown arrow with ID for positioning reference
    const dropdownArrow = document.createElement('span');
    dropdownArrow.className = 'dropdown-arrow-inline';
    dropdownArrow.setAttribute('id', `dropdown-arrow-${tab.id}`);
    dropdownArrow.innerHTML = `
    <svg focusable="false" aria-hidden="true" viewBox="0 0 520 520" class="slds-icon slds-icon_xx-small" style="width: 12px; height: 12px; fill: currentColor;">
      <path d="M476 178L271 385c-6 6-16 6-22 0L44 178c-6-6-6-16 0-22l22-22c6-6 16-6 22 0l161 163c6 6 16 6 22 0l161-162c6-6 16-6 22 0l22 22c5 6 5 15 0 21z"></path>
    </svg>
    `;
    dropdownArrow.style.cssText = `
      opacity: 0.7;
      margin-left: 4px;
      cursor: pointer;
      user-select: none;
      display: inline-flex;
      align-items: center;
    `;

    span.appendChild(dropdownArrow);

    // Create dropdown menu if navigation data exists
    if ((tab.cachedNavigation && tab.cachedNavigation.length > 0) || (tab.dropdownItems && tab.dropdownItems.length > 0)) {
      const dropdown = createInlineDropdownMenu(tab);
      li.appendChild(dropdown);

      // Add dropdown toggle handler
      dropdownArrow.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        toggleInlineDropdown(dropdown, dropdownArrow);
      });
    }
  }
  
  a.appendChild(span);
  li.appendChild(a);
  
  // Add click handler WITH Lightning Navigation - FROM ORIGINAL
  a.addEventListener('click', (event) => {
    // If clicking on dropdown arrow, don't navigate
    if (event.target.closest('.dropdown-arrow-inline')) {
      return;
    }

      // NEW: If clicking within the dropdown menu, don't navigate
    if (event.target.closest('.sftabs-custom-dropdown')) {
      return;
    }
    
    const lightningEnabled = isLightningNavigationEnabled();
    console.log('Tab clicked:', tab.label, 'Lightning Navigation enabled:', lightningEnabled, 'Open in new tab:', tab.openInNewTab);
    
    if (tab.openInNewTab) {
      // For new tab, always use window.open
      event.preventDefault();
      window.open(fullUrl, '_blank');
    } else {
      // For same tab, check if Lightning navigation is enabled
      if (lightningEnabled) {
        // Use Lightning navigation
        console.log('Using Lightning navigation for:', fullUrl);
        event.preventDefault();
        lightningNavigate({
          navigationType: "url",
          url: fullUrl
        }, fullUrl);
      } else {
        // Lightning navigation is disabled, use regular navigation
        console.log('Using regular navigation for:', fullUrl);
        event.preventDefault();
        window.location.href = fullUrl;
      }
    }
  });
  
  return li;
}

/**
 * DUPLICATE FUNCTION - Commented out to use version from tab-renderer.js
 * Create inline dropdown menu with SLDS native styling
 */
/*
function createInlineDropdownMenu(tab) {
  // Main container with SLDS classes (hidden by default - will use 'visible' class to show)
  const menu = document.createElement('div');
  menu.className = 'popupTargetContainer menu--nubbin-top uiPopupTarget uiMenuList uiMenuList--default positioned sftabs-custom-dropdown';
  menu.setAttribute('id', `dropdown-menu-${tab.id}`);
  menu.setAttribute('data-tab-id', tab.id);
  menu.setAttribute('data-aura-rendered-by', 'sftabs-dropdown');
  menu.setAttribute('data-aura-class', 'uiPopupTarget uiMenuList uiMenuList--default');

  // Add explicit display control (hidden by default, shown with 'visible' class)
  menu.style.display = 'none';
  menu.style.position = 'absolute';
  menu.style.zIndex = '9999';
  menu.style.width = '240px'; // Match Object Manager dropdown width

  // Inner menu wrapper
  const menuInner = document.createElement('div');
  menuInner.setAttribute('role', 'menu');
  menuInner.setAttribute('data-aura-rendered-by', 'sftabs-dropdown-inner');

  // Scrollable list container
  const ul = document.createElement('ul');
  ul.setAttribute('role', 'presentation');
  ul.className = 'scrollable';
  ul.setAttribute('data-aura-rendered-by', 'sftabs-dropdown-list');

  // Add navigation items (support both cachedNavigation and dropdownItems)
  const navigationItems = tab.dropdownItems || tab.cachedNavigation || [];
  navigationItems.forEach((navItem, index) => {
    const itemLi = document.createElement('li');
    itemLi.setAttribute('role', 'presentation');
    itemLi.className = 'uiMenuItem';
    itemLi.setAttribute('data-aura-rendered-by', `sftabs-item-${index}`);
    itemLi.setAttribute('data-aura-class', 'uiMenuItem');

    const link = document.createElement('a');
    link.setAttribute('role', 'menuitem');
    link.setAttribute('href', 'javascript:void(0)');
    link.setAttribute('title', navItem.label);
    link.setAttribute('data-aura-rendered-by', `sftabs-link-${index}`);

    // Create text node for label
    const labelSpan = document.createElement('span');
    labelSpan.className = 'uiOutputText';
    labelSpan.setAttribute('data-aura-rendered-by', `sftabs-text-${index}`);
    labelSpan.setAttribute('data-aura-class', 'uiOutputText');
    labelSpan.textContent = navItem.label;

    link.appendChild(labelSpan);

    // Add click handler
    link.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      navigateToNavigationItem(navItem, tab);
      menu.classList.remove('visible');
    });

    itemLi.appendChild(link);
    ul.appendChild(itemLi);
  });

  menuInner.appendChild(ul);
  menu.appendChild(menuInner);
  return menu;
}
*/
/**
 * DUPLICATE FUNCTION - Commented out to use version from tab-renderer.js
 * Toggle inline dropdown visibility using SLDS visible class
 */
/*
function toggleInlineDropdown(dropdown, dropdownArrow) {
  // Close all other SF Tabs custom dropdowns first (not native Salesforce dropdowns)
  document.querySelectorAll('.sftabs-custom-dropdown').forEach(d => {
    if (d !== dropdown) {
      d.classList.remove('visible');
      d.style.display = 'none';
    }
  });

  const isCurrentlyVisible = dropdown.classList.contains('visible');

  // Position the dropdown relative to the arrow before showing
  if (!isCurrentlyVisible && dropdownArrow) {
    // Get the arrow's position relative to the page
    const arrowRect = dropdownArrow.getBoundingClientRect();
    const parentLi = dropdown.parentElement;
    const parentRect = parentLi.getBoundingClientRect();

    // Calculate center of arrow relative to parent li
    const topOffset = arrowRect.bottom - parentRect.top + 4; // 4px gap below arrow
    const arrowCenterX = arrowRect.left + (arrowRect.width / 2) - parentRect.left;

    // Position dropdown with center aligned to arrow center (nubbin will align with arrow)
    dropdown.style.position = 'absolute';
    dropdown.style.top = `${topOffset}px`;
    dropdown.style.left = `${arrowCenterX}px`;
    dropdown.style.right = 'auto';
    dropdown.style.transform = 'translateX(-50%)'; // Center the dropdown under the arrow
    dropdown.style.display = 'block';
    dropdown.classList.add('visible');
  } else {
    dropdown.style.display = 'none';
    dropdown.classList.remove('visible');
  }
}
*/

/**
 * DUPLICATE FUNCTION - Commented out to use version from tab-renderer.js
 * Navigate to main tab
 */
/*
function navigateToMainTab(tab) {
  console.log('SF Tabs: Navigating to main tab:', tab.label);

  const currentUrl = window.location.href;
  const baseUrlSetup = currentUrl.split('/lightning/setup/')[0] + '/lightning/setup/';
  const baseUrlObject = currentUrl.split('/lightning/setup/')[0] + '/lightning/o/';
  const baseUrlRoot = currentUrl.split('/lightning/setup/')[0];

  let fullUrl = '';

  if (tab.isCustomUrl) {
    let formattedPath = tab.path;
    if (!formattedPath.startsWith('/')) {
      formattedPath = '/' + formattedPath;
    }
    fullUrl = `${baseUrlRoot}${formattedPath}`;
  } else if (tab.isObject) {
    fullUrl = `${baseUrlObject}${tab.path}`;
  } else if (tab.path.includes('ObjectManager/')) {
    fullUrl = `${baseUrlSetup}${tab.path}`;
  } else {
    fullUrl = `${baseUrlSetup}${tab.path}/home`;
  }

  if (tab.openInNewTab) {
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
*/

/**
 * Navigate to a navigation item from dropdown
 */
function navigateToNavigationItem(navItem, parentTab) {
  console.log('SF Tabs: Navigating to navigation item:', navItem.label);
    console.log('SF Tabs: Navigation item data:', navItem);
  console.log('SF Tabs: navItem.path:', navItem.path);
  console.log('SF Tabs: navItem.url:', navItem.url);

  const baseUrl = window.location.origin;
  let fullUrl = `${baseUrl}${navItem.path || navItem.url}`;
  
  // Convert old /one/one.app#/setup/ URLs to Lightning format
  if (fullUrl.includes('/one/one.app#/setup/')) {
    fullUrl = fullUrl.replace('/one/one.app#/setup/', '/lightning/setup/');
    console.log('SF Tabs: Converted URL to Lightning format:', fullUrl);
  }
  
  if (parentTab.openInNewTab) {
    window.open(fullUrl, '_blank');
  } else {
    const lightningEnabled = isLightningNavigationEnabled();
    if (lightningEnabled) {
      console.log('SF Tabs: Using Lightning navigation for:', fullUrl);
      lightningNavigate({
        navigationType: "url",
        url: fullUrl
      }, fullUrl);
    } else {
      console.log('SF Tabs: Using regular navigation for:', fullUrl);
      window.location.href = fullUrl;
    }
  }
}

/**
 * Setup dropdown event handlers
 */
function setupDropdownEventHandlers() {
  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    // Only close our custom dropdowns when clicking outside, not Salesforce native dropdowns
    if (!e.target.closest('.sf-tabs-custom-tab')) {
      document.querySelectorAll('.sftabs-custom-dropdown').forEach(dropdown => {
        dropdown.classList.remove('visible');
        dropdown.style.display = 'none';
      });
    }
  });
  
  console.log('Dropdown event handlers setup complete');
}

/**
 * Setup message listeners
 */
function setupMessageListeners() {
  // Listen for handler ready signals - FROM ORIGINAL
  window.addEventListener("message", function(event) {
    if (event.origin === window.location.origin) {
      if (event.data && event.data.type === 'SF_TABS_INJECT_LOADED') {
        console.log("inject.js file loaded");
        handlerReady = true;
      } else if (event.data && event.data.type === 'SF_TABS_WINDOW_NAV_READY') {
        console.log("Window navigation function ready (from inject.js)");
      }
    }
  });

  // Listen for messages from popup
  if (browser.runtime && browser.runtime.onMessage) {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('Content script received message:', message);
      
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
          
        default:
          console.log('Unknown message action:', message.action);
          sendResponse({ success: false, error: 'Unknown action' });
      }
      
      return true;
    });
  }
  
  console.log('Message listeners setup complete');
}

/**
 * Handle refresh tabs request
 */
function handleRefreshTabs(sendResponse) {
  console.log("Received request to refresh tabs");
  const tabContainer = document.querySelector('.tabBarItems.slds-grid');
  
  if (tabContainer) {
    if (window.SFTabsContent && window.SFTabsContent.tabRenderer) {
      window.SFTabsContent.tabRenderer.initTabs(tabContainer);
    } else {
      initTabsWithLightningNavigation(tabContainer);
    }
    sendResponse({ success: true });
  } else {
    console.warn("Could not find tab container for refresh");
    sendResponse({ success: false, error: "Tab container not found" });
  }
}

/**
 * Handle navigation to URL - WITH Lightning Navigation
 */
function handleNavigateToUrl(message, sendResponse) {
  const { url, useLightning } = message;
  
  if (useLightning && isLightningNavigationEnabled()) {
    console.log('Using Lightning navigation for message:', url);
    lightningNavigate({
      navigationType: "url",
      url: url
    }, url);
    sendResponse({ success: true, method: 'lightning' });
  } else {
    console.log('Using regular navigation for message:', url);
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
  console.log('Parsing navigation from content script');
  
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
 * Setup storage change listeners
 */
function setupStorageListeners() {
  if (browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener((changes, area) => {
      console.log('Storage changed:', { area, changes: Object.keys(changes) });

      // Check for both 'local' and 'sync' areas since we use storage.local
      if ((area === 'local' || area === 'sync') && changes.customTabs) {
        console.log("Tabs changed in storage - refreshing tabs on page");
        const tabContainer = document.querySelector('.tabBarItems.slds-grid');
        if (tabContainer) {
          if (window.SFTabsContent && window.SFTabsContent.tabRenderer) {
            window.SFTabsContent.tabRenderer.initTabs(tabContainer);
          } else {
            initTabsWithLightningNavigation(tabContainer);
          }
        }
      }

      if ((area === 'local' || area === 'sync') && changes.userSettings) {
        console.log("Settings changed in storage - updating Lightning Navigation");
        const newSettings = changes.userSettings.newValue;
        if (newSettings && newSettings.hasOwnProperty('lightningNavigation')) {
          localStorage.setItem("lightningNavigation", JSON.stringify(newSettings.lightningNavigation));
        }
      }
    });
  }
  
  // Listen for localStorage changes
  window.addEventListener('storage', (e) => {
    if (e.key === 'lightningNavigation') {
      console.log("Lightning Navigation setting changed - refreshing tabs");
      const tabContainer = document.querySelector('.tabBarItems.slds-grid');
      if (tabContainer) {
        if (window.SFTabsContent && window.SFTabsContent.tabRenderer) {
          window.SFTabsContent.tabRenderer.initTabs(tabContainer);
        } else {
          initTabsWithLightningNavigation(tabContainer);
        }
      }
    }
  });
  
  console.log('Storage listeners setup complete');
}

/**
 * Setup URL change detection
 */
function setupUrlChangeDetection() {
  let lastUrl = location.href;
  
  setInterval(() => {
    if (location.href !== lastUrl) {
      console.log("URL changed - checking for tab container");
      lastUrl = location.href;
      
      setTimeout(() => {
        const tabContainer = document.querySelector('.tabBarItems.slds-grid');
        if (tabContainer) {
          if (window.SFTabsContent && window.SFTabsContent.tabRenderer) {
            window.SFTabsContent.tabRenderer.initTabs(tabContainer);
          } else {
            initTabsWithLightningNavigation(tabContainer);
          }
        }
      }, 1000);
    }
  }, 1000);
  
  console.log('URL change detection setup complete');
}

/**
 * Setup mutation observer for dynamic content loading
 */
function setupMutationObserver() {
  const observer = new MutationObserver(() => {
    const tabContainer = document.querySelector('.tabBarItems.slds-grid');
    
    if (tabContainer && !tabsInitialized) {
      observer.disconnect();
      
      console.log("Tab container found via mutation observer");
      if (window.SFTabsContent && window.SFTabsContent.tabRenderer) {
        window.SFTabsContent.tabRenderer.initTabs(tabContainer);
      } else {
        initTabsWithLightningNavigation(tabContainer);
      }
      tabsInitialized = true;
      
      // Re-highlight the active tab
      setTimeout(() => {
        if (window.SFTabsContent && window.SFTabsContent.tabRenderer) {
          window.SFTabsContent.tabRenderer.highlightActiveTab();
        }
      }, 500);
    }
  });
  
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
  
  console.log('Mutation observer setup complete');
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