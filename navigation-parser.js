/**
 * Navigation Parser for SF Tabs
 * Parses Object Manager left navigation to create dropdown menu items
 */

/**
 * Parse the Object Manager navigation from the current page
 * @returns {Promise<Array>} Array of navigation items with label and url
 */
function parseObjectManagerNavigation() {
  return new Promise((resolve, reject) => {
    try {
      // Find the navigation container
      const navContainer = document.querySelector('.objectManagerLeftNav ul[role="tablist"]');

      if (!navContainer) {
        reject(new Error('Navigation container not found'));
        return;
      }

      const navigationItems = [];
      const navLinks = navContainer.querySelectorAll('li[role="presentation"] a.slds-nav-vertical__action');

      navLinks.forEach((link, index) => {
        const label = link.textContent.trim();
        const href = link.getAttribute('href');
        const dataList = link.getAttribute('data-list');
        const isActive = link.getAttribute('aria-selected') === 'true';

        // Convert old URL format to Lightning format
        // From: /one/one.app#/setup/ObjectManager/Account/Details/view
        // To: /lightning/setup/ObjectManager/Account/Details/view
        let lightningUrl = href;
        if (href && href.includes('/one/one.app#/setup/')) {
          lightningUrl = href.replace('/one/one.app#/setup/', '/lightning/setup/');
        }

        // Get the base URL from current page
        const baseUrl = window.location.origin;
        const fullUrl = baseUrl + lightningUrl;

        navigationItems.push({
          id: `nav_${index}`,
          label: label,
          url: fullUrl,
          path: lightningUrl,
          dataList: dataList,
          isActive: isActive,
          order: index
        });
      });

      resolve(navigationItems);

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Parse navigation with retry logic for dynamically loaded content
 * @param {number} maxRetries Maximum number of retry attempts
 * @param {number} retryDelay Delay between retries in milliseconds
 * @returns {Promise<Array>} Array of navigation items
 */
function parseObjectManagerNavigationWithRetry(maxRetries = 3, retryDelay = 1000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    function attemptParse() {
      attempts++;

      parseObjectManagerNavigation()
        .then(items => {
          if (items && items.length > 0) {
            resolve(items);
          } else if (attempts < maxRetries) {
            setTimeout(attemptParse, retryDelay);
          } else {
            reject(new Error('Navigation items not found after maximum retries'));
          }
        })
        .catch(error => {
          if (attempts < maxRetries) {
            setTimeout(attemptParse, retryDelay);
          } else {
            reject(error);
          }
        });
    }

    attemptParse();
  });
}

/**
 * Check if the current page is an Object Manager page
 * @returns {boolean} True if on an Object Manager page
 */
function isObjectManagerPage() {
  const url = window.location.href;
  return url.includes('/lightning/setup/ObjectManager/') ||
         url.includes('/one/one.app#/setup/ObjectManager/');
}

/**
 * Extract the object name from the current URL
 * @returns {string|null} Object name (e.g., "Account") or null if not found
 */
function getObjectNameFromUrl() {
  const url = window.location.href;

  // Match pattern: /ObjectManager/{ObjectName}/
  const match = url.match(/\/ObjectManager\/([^/]+)\//);

  if (match && match[1]) {
    return match[1];
  }

  return null;
}

// Export functions for use in content script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseObjectManagerNavigation,
    parseObjectManagerNavigationWithRetry,
    isObjectManagerPage,
    getObjectNameFromUrl
  };
}
