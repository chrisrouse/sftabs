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

// Export for use in other modules
/**
 * Extract the Salesforce org identifier from a URL — the subdomain label that
 * identifies the org, e.g. "amplify--dev1" from
 * amplify--dev1.sandbox.my.salesforce-setup.com.
 *
 * This is what profile URL patterns are compared against, by exact
 * case-insensitive equality (checkAndSwitchProfile in background.js). A pattern
 * holding a full hostname therefore never matches, which is why the profile
 * form captures this rather than letting it be typed.
 *
 * NOTE: background.js carries its own copy, because a service worker cannot
 * load these popup scripts. Keep the two in step.
 *
 * @param {string} url
 * @returns {string|null} the identifier, or null for a non-Salesforce host
 */
function extractOrgIdentifier(url) {
  try {
    const hostname = new URL(url).hostname;
    const patterns = [
      /^([^.]+)\.sandbox\.my\.salesforce-setup\.com$/i,
      /^([^.]+)\.sandbox\.my\.salesforce\.com$/i,
      /^([^.]+)\.sandbox\.lightning\.force\.com$/i,
      /^([^.]+)\.develop\.my\.salesforce-setup\.com$/i,
      /^([^.]+)\.develop\.lightning\.force\.com$/i,
      /^([^.]+)\.lightning\.force\.com$/i,
      /^([^.]+)\.my\.salesforce\.com$/i,
      /^([^.]+)\.my\.salesforce-setup\.com$/i,
      /^([^.]+)\.salesforce\.com$/i
    ];
    for (const re of patterns) {
      const m = hostname.match(re);
      if (m) return m[1];
    }
    return null;
  } catch {
    return null;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateId,
    extractOrgIdentifier,
    formatObjectNameFromURL,
    extractNameFromTitle,
    formatPathToName,
    getCurrentPageInfo,
    buildFullUrl,
    canHaveDropdown,
    isCurrentPageMatchingTab,
    isLightningNavigationEnabled,
    debounce,
    deepClone
  };
} else {
  // Browser environment
  window.SFTabs = window.SFTabs || {};
  window.SFTabs.utils = {
    generateId,
    extractOrgIdentifier,
    formatObjectNameFromURL,
    extractNameFromTitle,
    formatPathToName,
    getCurrentPageInfo,
    buildFullUrl,
    canHaveDropdown,
    isCurrentPageMatchingTab,
    isLightningNavigationEnabled,
    debounce,
    deepClone
  };
}