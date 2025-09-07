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
 * Get top-level tabs only (no parents)
 */
function getTopLevelTabs(allTabs) {
  return allTabs.filter(tab => !tab.parentId).sort((a, b) => a.position - b.position);
}

/**
 * Get children of a specific tab
 */
function getChildTabs(allTabs, parentId) {
  return allTabs.filter(tab => tab.parentId === parentId).sort((a, b) => a.position - b.position);
}

/**
 * Check if tab can have dropdown
 */
function canHaveDropdown(tab) {
  // Any tab can have manual dropdowns
  return true;
}

/**
 * Check if tab can have auto setup dropdown
 */
function canHaveAutoSetupDropdown(tab) {
  return tab.isSetupObject || (tab.path && tab.path.startsWith('ObjectManager/'));
}

/**
 * Migrate existing tabs to new structure
 */
function migrateTabsToNewStructure(existingTabs) {
  return existingTabs.map(tab => ({
    ...tab,
    hasDropdown: tab.isSetupObject || false,
    autoSetupDropdown: tab.isSetupObject || false,
    children: tab.children || [],
    parentId: tab.parentId || null,
    isExpanded: tab.isExpanded || false,
    cachedNavigation: tab.cachedNavigation || [],
    navigationLastUpdated: tab.navigationLastUpdated || null,
    needsNavigationRefresh: tab.needsNavigationRefresh || false
  }));
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
 * Get badge information for a tab
 */
function getTabBadgeInfo(tab) {
  let badgeText = 'Setup';
  let badgeClass = 'setup';
  
  if (tab.isCustomUrl) {
    badgeText = 'Custom';
    badgeClass = 'custom';
  } else if (tab.isObject) {
    badgeText = 'Object';
    badgeClass = 'object';
  } else if (tab.isSetupObject) {
    badgeText = 'Setup';
    badgeClass = 'setup';
  }
  
  return { text: badgeText, class: badgeClass };
}

/**
 * Check if Lightning Navigation is enabled
 */
function isLightningNavigationEnabled() {
  // Check localStorage first (for immediate response)
  const localStorageValue = localStorage.getItem("lightningNavigation");
  if (localStorageValue !== null) {
    return JSON.parse(localStorageValue);
  }
  // Default to true if not set
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
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateId,
    formatObjectNameFromURL,
    extractNameFromTitle,
    formatPathToName,
    getCurrentPageInfo,
    buildFullUrl,
    getTopLevelTabs,
    getChildTabs,
    canHaveDropdown,
    canHaveAutoSetupDropdown,
    migrateTabsToNewStructure,
    isCurrentPageMatchingTab,
    getTabBadgeInfo,
    isLightningNavigationEnabled,
    debounce,
    deepClone
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
    getTopLevelTabs,
    getChildTabs,
    canHaveDropdown,
    canHaveAutoSetupDropdown,
    migrateTabsToNewStructure,
    isCurrentPageMatchingTab,
    getTabBadgeInfo,
    isLightningNavigationEnabled,
    debounce,
    deepClone
  };
}