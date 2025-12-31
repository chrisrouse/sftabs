// content/navigation-parser.js
// ObjectManager navigation parsing for content script

/**
 * Parse ObjectManager navigation from current page
 */
function parseCurrentObjectManagerNavigation() {
  // Get navigation selectors from constants if available, otherwise use fallback
  const NAVIGATION_SELECTORS = window.SFTabs?.constants?.NAVIGATION_SELECTORS || [
    '.objectManagerLeftNav',
    '.slds-navigation-list--vertical',
    '[role="tabpanel"] ul[role="tablist"]'
  ];

  // Look for the navigation container using multiple selectors
  let container = null;
  for (const selector of NAVIGATION_SELECTORS) {
    container = document.querySelector(selector);
    if (container) {
      break;
    }
  }

  if (!container) {
    return [];
  }

  const navItems = [];
  const links = container.querySelectorAll('li a.slds-nav-vertical__action');

  links.forEach((link, index) => {
    const label = link.textContent?.trim();
    let href = link.getAttribute('href');
    const dataList = link.getAttribute('data-list');
    const isActive = link.getAttribute('aria-selected') === 'true';

    if (label && href) {
      // Convert URL format from /one/one.app#/setup/ to /lightning/setup/
      if (href.includes('/one/one.app#/setup/')) {
        href = href.replace('/one/one.app#/setup/', '/lightning/setup/');
      }

      // Make URL relative
      if (href.startsWith(window.location.origin)) {
        href = href.substring(window.location.origin.length);
      }

      const navItem = {
        id: `nav_${index}`,
        label: label,
        path: href,
        url: href,
        dataList: dataList || label,
        isActive: isActive,
        order: index
      };

      navItems.push(navItem);
    }
  });

  return navItems;
}

/**
 * Get current page information for context
 */
function getCurrentPageInfo() {
  const currentUrl = window.location.href;
  
  // Check if on ObjectManager page
  const objectManagerMatch = currentUrl.match(/\/lightning\/setup\/ObjectManager\/([^\/]+)/);
  if (objectManagerMatch) {
    return {
      type: 'objectManager',
      objectName: objectManagerMatch[1],
      fullPath: currentUrl.split('/lightning/setup/')[1]?.split('?')[0]
    };
  }
  
  // Check if on general setup page
  const setupMatch = currentUrl.match(/\/lightning\/setup\/([^\/]+)/);
  if (setupMatch) {
    return {
      type: 'setup',
      setupPage: setupMatch[1],
      fullPath: currentUrl.split('/lightning/setup/')[1]?.split('?')[0]
    };
  }
  
  return null;
}

/**
 * Enhanced navigation parser with retry logic for dynamic loading
 */
async function parseNavigationWithRetry(maxRetries = 3, delayMs = 1000) {
  let items = [];
  let retryCount = 0;

  while (items.length === 0 && retryCount < maxRetries) {
    items = parseCurrentObjectManagerNavigation();

    if (items.length === 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      retryCount++;
    }
  }

  return items;
}

/**
 * Specialized parser for Object Manager navigation with fallback patterns
 */
function parseObjectManagerNavigationAdvanced(objectName) {
  const items = [];

  // Strategy 1: Use the standard parser first
  const standardItems = parseCurrentObjectManagerNavigation();
  if (standardItems.length > 0) {
    return standardItems;
  }
  
  // Strategy 2: Look for navigation by scanning all Object Manager links
  const objectManagerLinks = document.querySelectorAll(
    `a[href*="/lightning/setup/ObjectManager/${objectName}/"], a[href*="/one/one.app#/setup/ObjectManager/${objectName}/"]`
  );
  
  const seenUrls = new Set();
  objectManagerLinks.forEach((link, index) => {
    let url = link.getAttribute('href');
    const label = link.textContent?.trim();
    
    if (url && label && !seenUrls.has(url)) {
      // Convert URL format
      if (url.includes('/one/one.app#/setup/')) {
        url = url.replace('/one/one.app#/setup/', '/lightning/setup/');
      }
      
      // Make relative
      if (url.startsWith(window.location.origin)) {
        url = url.substring(window.location.origin.length);
      }
      
      seenUrls.add(url);
      
      items.push({
        id: `nav_${index}`,
        label: label,
        path: url,
        url: url,
        dataList: label,
        isActive: false,
        order: index
      });
    }
  });
  
  // Sort items by common Object Manager order
  return sortObjectManagerItems(items);
}

/**
 * Sort items in typical Object Manager order
 */
function sortObjectManagerItems(items) {
  const orderMap = {
    'Details': 1,
    'Fields & Relationships': 2,
    'Page Layouts': 3,
    'Lightning Record Pages': 4,
    'Compact Layouts': 5,
    'Record Types': 6,
    'Buttons, Links, and Actions': 7,
    'Field Sets': 8,
    'Validation Rules': 9,
    'Triggers': 10,
    'Flow Triggers': 11,
    'Object Limits': 12,
    'Search Layouts': 13,
    'List View Button Layout': 14,
    'Hierarchy Columns': 15,
    'Scoping Rules': 16,
    'Object Access': 17,
    'Related Lookup Filters': 18,
    'URL Slugs': 19,
    'Conditional Field Formatting': 20
  };
  
  return items.sort((a, b) => {
    const orderA = orderMap[a.label] || 999;
    const orderB = orderMap[b.label] || 999;
    
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    
    // If not in orderMap, sort alphabetically
    return a.label.localeCompare(b.label);
  });
}

/**
 * Check if current page is an Object Manager page
 */
function isObjectManagerPage() {
  const currentUrl = window.location.href;
  return currentUrl.includes('/lightning/setup/ObjectManager/');
}

/**
 * Get object name from current URL
 */
function getObjectNameFromUrl() {
  const currentPageInfo = getCurrentPageInfo();
  return currentPageInfo?.type === 'objectManager' ? currentPageInfo.objectName : null;
}

/**
 * Monitor page changes and notify when navigation is available
 */
function monitorNavigationChanges(callback) {
  let lastNavigationCount = 0;
  
  const checkNavigation = () => {
    const navigation = parseCurrentObjectManagerNavigation();
    if (navigation.length !== lastNavigationCount) {
      lastNavigationCount = navigation.length;
      callback(navigation);
    }
  };
  
  // Check initially
  checkNavigation();
  
  // Set up observer for navigation changes
  const observer = new MutationObserver(checkNavigation);
  
  // Observe the area where navigation typically appears
  const observeTargets = [
    document.querySelector('.forceEntityManagerPageContainer'),
    document.querySelector('.setupEntityContainer'),
    document.body
  ].filter(Boolean);
  
  observeTargets.forEach(target => {
    observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-selected', 'href']
    });
  });
  
  return observer;
}

/**
 * Main function to parse navigation for popup requests
 */
async function parseObjectManagerNavigation() {
  if (!isObjectManagerPage()) {
    return [];
  }

  const objectName = getObjectNameFromUrl();
  if (!objectName) {
    return [];
  }

  // Try advanced parsing with retry logic
  let navigation = await parseNavigationWithRetry(5, 500);

  if (navigation.length === 0) {
    navigation = parseObjectManagerNavigationAdvanced(objectName);
  }

  return navigation;
}

/**
 * Message handler for navigation parsing requests
 */
function handleNavigationMessage(request, sender, sendResponse) {
  if (request.action === 'parse_navigation') {
    if (isObjectManagerPage()) {
      parseObjectManagerNavigation()
        .then(navigation => {
          const objectName = getObjectNameFromUrl();

          sendResponse({
            success: true,
            items: navigation,  // Changed from 'navigation' to 'items' for backward compatibility
            navigation: navigation,  // Keep both for compatibility
            objectName: objectName,
            currentUrl: window.location.href
          });
        })
        .catch(error => {
          sendResponse({
            success: false,
            error: error.message
          });
        });

      return true; // Keep message channel open for async response
    } else {
      const objectName = getObjectNameFromUrl() || 'the object';
      sendResponse({
        success: false,
        error: `Go to ${objectName} in Setup to refresh the list`
      });
    }
  } else if (request.action === 'navigate_to_url') {
    // Handle navigation requests
    if (request.useLightning && typeof sforce !== 'undefined' && sforce.one) {
      // Use Lightning navigation if available
      sforce.one.navigateToURL(request.url);
    } else {
      // Fallback to regular navigation
      window.location.href = request.url;
    }
    sendResponse({ success: true });
  } else if (request.action === 'refresh_tabs') {
    // Handle tab refresh requests
    sendResponse({ success: true });
  }
}

// Set up message listener
if (typeof browser !== 'undefined' && browser.runtime) {
  browser.runtime.onMessage.addListener(handleNavigationMessage);
} else if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener(handleNavigationMessage);
}

// Export navigation parser functions
window.SFTabsContent = window.SFTabsContent || {};
window.SFTabsContent.navigationParser = {
  parseCurrentObjectManagerNavigation,
  getCurrentPageInfo,
  parseNavigationWithRetry,
  parseObjectManagerNavigationAdvanced,
  sortObjectManagerItems,
  isObjectManagerPage,
  getObjectNameFromUrl,
  monitorNavigationChanges,
  parseObjectManagerNavigation
};