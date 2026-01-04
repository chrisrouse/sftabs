// popup/js/shared/utils.js
// Shared utility functions

/**
 * Generate a unique ID for tabs
 */
function generateId() {
  return 'tab_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
}

/**
 * Format a Salesforce object name from URL format
 * Examples: 
 * - "Study_Group__c" becomes "Study Group"
 * - "Campaign" stays "Campaign"
 * - "ProductTransfer" becomes "Product Transfer"
 */
function formatObjectNameFromURL(objectNameFromURL) {
  if (!objectNameFromURL) {
    return 'Object';
  }
  
  // Remove any __c or similar custom object suffix
  let cleanName = objectNameFromURL.replace(/__c$/g, '');
  
  // Replace underscores with spaces
  cleanName = cleanName.replace(/_/g, ' ');
  
  // Insert spaces between camelCase words
  cleanName = cleanName.replace(/([a-z])([A-Z])/g, '$1 $2');
  
  // Ensure proper capitalization
  cleanName = cleanName.replace(/\b\w/g, letter => letter.toUpperCase());
  
  return cleanName;
}

/**
 * Extract name from page title
 */
function extractNameFromTitle(pageTitle) {
  if (!pageTitle) return '';
  
  // Remove " | Salesforce" suffix and other common suffixes
  let cleanTitle = pageTitle.split(' | ')[0];
  
  // Remove "Setup: " prefix
  if (cleanTitle.startsWith('Setup: ')) {
    cleanTitle = cleanTitle.substring(7);
  }
  
  return cleanTitle.trim();
}

/**
 * Format path segment to readable name
 */
function formatPathToName(pathSegment) {
  return pathSegment
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

/**
 * Get current page information
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
 * Build full URL from tab path and optional sub-path
 */
function buildFullUrl(tab, subPath = '') {
  const baseUrl = window.location.origin;
  
  if (tab.isCustomUrl) {
    let formattedPath = tab.path;
    if (!formattedPath.startsWith('/')) {
      formattedPath = '/' + formattedPath;
    }
    return `${baseUrl}${formattedPath}`;
  } else if (tab.isObject) {
    return `${baseUrl}/lightning/o/${tab.path}`;
  } else {
    // Setup pages
    let fullPath;
    if (subPath) {
      // For dropdown navigation items, use the subPath as-is
      if (subPath.startsWith('/lightning/setup/')) {
        return `${baseUrl}${subPath}`;
      } else {
        fullPath = `${tab.path}/${subPath}`;
      }
    } else {
      // For main tab navigation
      if (tab.path.includes('ObjectManager/')) {
        // ObjectManager URLs don't need /home
        fullPath = tab.path;
      } else {
        // Other setup URLs need /home
        fullPath = `${tab.path}/home`;
      }
    }
    
    return `${baseUrl}/lightning/setup/${fullPath}`;
  }
}

/**
 * Check if tab can have dropdown
 */
function canHaveDropdown(tab) {
  // Any tab can have manual dropdowns
  return true;
}

/**
 * Check if current page matches a tab's path
 */
function isCurrentPageMatchingTab(tab) {
  const currentPageInfo = getCurrentPageInfo();
  if (!currentPageInfo) return false;
  
  if (tab.isSetupObject && currentPageInfo.type === 'objectManager') {
    // Check if the tab's path starts with ObjectManager/ and matches current object
    if (tab.path.startsWith('ObjectManager/')) {
      const tabObjectName = tab.path.split('/')[1];
      return tabObjectName === currentPageInfo.objectName;
    }
  }
  
  return false;
}

/**
 * Check if Lightning Navigation is enabled
 * Always returns true as Lightning Navigation is now standard
 */
function isLightningNavigationEnabled() {
  return true;
}

/**
 * Debounce function to limit rapid function calls
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
 * Deep clone an object
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if sync storage is available and enabled
 * @returns {Promise<{available: boolean, error?: string}>}
 */
async function checkSyncStorageAvailable() {
  try {
    // Check if sync storage API exists
    if (!browser.storage || !browser.storage.sync) {
      return {
        available: false,
        error: 'Sync storage API not available in this browser'
      };
    }

    // Try to perform a test write/read operation
    const testKey = '_sftabs_sync_test_' + Date.now();
    const testValue = 'test';

    try {
      // Attempt to write to sync storage
      await browser.storage.sync.set({ [testKey]: testValue });

      // Attempt to read back
      const result = await browser.storage.sync.get(testKey);

      // Clean up test data
      await browser.storage.sync.remove(testKey);

      // Verify the test succeeded
      if (result[testKey] === testValue) {
        return { available: true };
      } else {
        return {
          available: false,
          error: 'Sync storage test failed'
        };
      }
    } catch (syncError) {
      // Common errors:
      // - User not signed into browser
      // - Sync disabled in browser settings
      // - Quota exceeded
      return {
        available: false,
        error: syncError.message || 'Sync storage not accessible'
      };
    }
  } catch (error) {
    return {
      available: false,
      error: error.message || 'Unknown error checking sync storage'
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateId,
    formatObjectNameFromURL,
    extractNameFromTitle,
    formatPathToName,
    getCurrentPageInfo,
    buildFullUrl,
    canHaveDropdown,
    isCurrentPageMatchingTab,
    isLightningNavigationEnabled,
    debounce,
    deepClone,
    checkSyncStorageAvailable
  };
} else {
  // Browser environment
  window.SFTabs = window.SFTabs || {};
  window.SFTabs.utils = {
    generateId,
    formatObjectNameFromURL,
    extractNameFromTitle,
    formatPathToName,
    getCurrentPageInfo,
    buildFullUrl,
    canHaveDropdown,
    isCurrentPageMatchingTab,
    isLightningNavigationEnabled,
    debounce,
    deepClone,
    checkSyncStorageAvailable
  };
}