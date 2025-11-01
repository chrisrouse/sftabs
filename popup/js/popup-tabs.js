// popup/js/popup-tabs.js
// Tab CRUD operations and Quick Add functionality

/**
 * Ensure browser API is available and properly initialized
 */
function ensureBrowserAPI() {
  return new Promise((resolve, reject) => {
    // Check if browser API exists
    if (typeof browser !== 'undefined' && browser.tabs && browser.tabs.query) {
      resolve(browser);
      return;
    }
    
    // Check if chrome API exists and create browser wrapper
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      if (typeof browser === 'undefined') {
        window.browser = {
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
            sendMessage: function(tabId, message) {
              return new Promise((resolve) => {
                chrome.tabs.sendMessage(tabId, message, (response) => {
                  if (chrome.runtime.lastError) {
                    resolve(null);
                  } else {
                    resolve(response);
                  }
                });
              });
            }
          }
        };
      }
      resolve(browser);
      return;
    }
    
    // Wait a bit and try again
    setTimeout(() => {
      ensureBrowserAPI().then(resolve).catch(reject);
    }, 100);
  });
}

/**
 * Enhanced Quick Add functionality with navigation caching
 */
function enhancedAddTabForCurrentPage() {
  console.log('Quick Add button clicked - ensuring browser API is available');
  
  ensureBrowserAPI()
    .then(browserAPI => {
      console.log('Browser API ready, proceeding with Quick Add');
      return browserAPI.tabs.query({ active: true, currentWindow: true });
    })
    .then(tabs => {
      if (tabs.length > 0) {
        const currentUrl = tabs[0].url;
        const pageTitle = tabs[0].title;
        console.log('Current URL:', currentUrl);
        console.log('Page title:', pageTitle);
        
        // Check if this is a Salesforce page we can work with
        const isSalesforcePage = currentUrl.includes('salesforce') || currentUrl.includes('.force.com');
        if (!isSalesforcePage) {
          SFTabs.main.showStatus('Not a Salesforce page', true);
          return;
        }
        
        let isObject = false;
        let isCustomUrl = false;
        let isSetupObject = false;
        let path = '';
        let urlBase = '';

        // Check if on ObjectManager page
        if (currentUrl.includes('/lightning/setup/')) {
          const urlParts = currentUrl.split('/lightning/setup/');
          if (urlParts.length > 1) {
            const fullPath = urlParts[1].split('?')[0]; 
            
            // Special case for ObjectManager: keep the full path and mark as setup object
            if (fullPath.startsWith('ObjectManager/')) {
              path = fullPath;
              isObject = false;
              isSetupObject = true; // Mark as setup object for dropdown
              urlBase = '/lightning/setup/';
            } else {
              // For other setup pages, remove trailing '/home' or '/view' if present
              path = fullPath.replace(/\/(home|view)$/, '');
              urlBase = '/lightning/setup/';
            }
          }
        } 
        // Check if this is a Salesforce object page
        else if (currentUrl.includes('/lightning/o/')) {
          isObject = true;
          const urlParts = currentUrl.split('/lightning/o/');
          if (urlParts.length > 1) {
            const fullPath = urlParts[1].split('?')[0];
            path = fullPath;
            urlBase = '/lightning/o/';
          }
        }
        // Handle custom URLs (any other Salesforce URL pattern)
        else if (currentUrl.includes('.lightning.force.com/') || currentUrl.includes('.salesforce.com/')) {
          isCustomUrl = true;
          const urlParts = currentUrl.split('.com/');
          if (urlParts.length > 1) {
            path = urlParts[1].split('?')[0];
            console.log('Detected custom URL path:', path);
          }
        }
        
        // If no valid path was found, show an error
        if (!path) {
          SFTabs.main.showStatus('Not a recognized Salesforce setup or object page', true);
          return;
        }

        // Determine an appropriate name for the tab
        let name = generateTabName(path, pageTitle, isObject, isCustomUrl, isSetupObject);

        // Create a new tab object with ALL properties
        const existingTabs = SFTabs.main.getTabs();
        const newTab = {
          id: generateId(),
          label: name,
          path: path,
          openInNewTab: false,
          isObject: isObject,
          isCustomUrl: isCustomUrl,
          isSetupObject: isSetupObject,
          hasDropdown: isSetupObject, // Auto-enable dropdown for setup objects
          autoSetupDropdown: isSetupObject,
          children: [],
          parentId: null,
          position: existingTabs.length,
          isExpanded: false,
          cachedNavigation: [],
          navigationLastUpdated: null,
          needsNavigationRefresh: false
        };

        // Add the tab and save immediately
        existingTabs.push(newTab);
        SFTabs.storage.saveTabs(existingTabs);
        
        let pageType = isObject ? 'object' : (isCustomUrl ? 'custom' : 'setup');
        SFTabs.main.showStatus(`Added ${pageType} tab for "${name}"`, false);

        // If it's a setup object, try to get navigation from content script (async)
        if (isSetupObject) {
          ensureBrowserAPI()
            .then(browserAPI => browserAPI.tabs.sendMessage(tabs[0].id, {action: 'parse_navigation'}))
            .then(response => {
              if (response && response.success && response.navigation && response.navigation.length > 0) {
                newTab.cachedNavigation = response.navigation;
                newTab.navigationLastUpdated = Date.now();
                console.log('Cached navigation data:', response.navigation);
                
                // Update the tab with navigation data
                const updatedTabs = SFTabs.main.getTabs();
                const tabIndex = updatedTabs.findIndex(t => t.id === newTab.id);
                if (tabIndex >= 0) {
                  updatedTabs[tabIndex] = newTab;
                  SFTabs.storage.saveTabs(updatedTabs);
                }
                
                SFTabs.main.showStatus(`Added setup object tab "${name}" with ${response.navigation.length} navigation items`, false);
              }
            })
            .catch(error => {
              console.log('Could not get navigation data:', error);
            });
        }
      }
    })
    .catch(error => {
      console.error('Error in Quick Add:', error);
      SFTabs.main.showStatus('Error accessing current tab: ' + error.message, true);
    });
}

/**
 * Generate tab name based on various inputs
 */
function generateTabName(path, pageTitle, isObject, isCustomUrl, isSetupObject) {
  let name = '';
  
  if (isCustomUrl) {
    if (pageTitle) {
      let cleanTitle = pageTitle.split(' | ')[0];
      name = cleanTitle;
    }
    
    if (!name || name.length === 0) {
      const pathSegments = path.split('/');
      for (const segment of pathSegments) {
        if (segment && segment.length > 0 && segment !== 'apex' && segment !== 'lightning') {
          name = segment
            .replace(/([A-Z])/g, ' $1')
            .replace(/\.(app|jsp|page)$/, '')
            .replace(/^./, str => str.toUpperCase())
            .trim();
          break;
        }
      }
      
      if (!name || name.length === 0) {
        name = 'Custom Page';
      }
    }
  } else if (isObject) {
    const pathSegments = path.split('/');
    if (pathSegments.length > 0) {
      const objectName = formatObjectNameFromURL(pathSegments[0]);
      let viewType = '';
      if (pathSegments.length > 1) {
        viewType = pathSegments[1].charAt(0).toUpperCase() + pathSegments[1].slice(1);
      }
      name = viewType ? `${objectName} ${viewType}` : objectName;
    }
  } else if (path.startsWith('ObjectManager/')) {
    const pathSegments = path.split('/').filter(segment => segment.length > 0);
    
    let objectName = "";
    if (pathSegments.length >= 2) {
      objectName = formatObjectNameFromURL(pathSegments[1]);
    } else {
      objectName = "Object Manager";
    }
    
    let sectionName = "";
    if (pathSegments.length >= 3) {
      let pathSection = pathSegments[2];
      sectionName = pathSection.replace(/([A-Z])/g, ' $1').trim();
    }
    
    if (sectionName) {
      name = `${objectName} - ${sectionName}`;
    } else {
      name = objectName;
    }
  } else {
    if (pageTitle) {
      let titleParts = pageTitle.split(' | ');
      let cleanTitle = titleParts[0];
      
      if (cleanTitle.includes('Setup')) {
        const setupParts = cleanTitle.split('Setup: ');
        if (setupParts.length > 1) {
          cleanTitle = setupParts[1];
        }
      }

      if (cleanTitle && cleanTitle.length > 0) {
        name = cleanTitle;
      }
    }
    
    if (!name || name.length === 0) {
      if (path && path.length > 0) {
        const pathSegments = path.split('/').filter(segment => segment.length > 0);
        
        if (pathSegments.length > 0) {
          let lastSegment = pathSegments[pathSegments.length - 1];
          name = lastSegment
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
          
          if (!name.trim()) {
            name = path
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase())
              .trim();
          }
        }
      }
      
      if (!name || !name.trim()) {
        name = 'Setup: ' + path;
      }
    }
  }
  
  return name;
}

/**
 * Fallback function to format object names if utils not available
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
 * Generate a unique ID for tabs
 */
function generateId() {
  return 'tab_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
}

/**
 * Create a new tab
 */
function createTab(tabData) {
  const tabs = SFTabs.main.getTabs();

  const newTab = {
    id: generateId(),
    label: tabData.label || '',
    path: tabData.path || '', // Empty path is allowed for folder-style tabs
    openInNewTab: tabData.openInNewTab || false,
    isObject: tabData.isObject || false,
    isCustomUrl: tabData.isCustomUrl || false,
    isSetupObject: tabData.isSetupObject || false,
    hasDropdown: tabData.hasDropdown || false,
    dropdownItems: tabData.dropdownItems || [], // Support dropdown items on creation
    autoSetupDropdown: tabData.autoSetupDropdown || false,
    children: [],
    parentId: tabData.parentId || null,
    position: tabs.length,
    isExpanded: false,
    cachedNavigation: [],
    navigationLastUpdated: null,
    needsNavigationRefresh: tabData.isSetupObject && tabData.autoSetupDropdown
  };

  tabs.push(newTab);
  return SFTabs.storage.saveTabs(tabs);
}

/**
 * Update an existing tab
 */
function updateTab(tabId, updates) {
  const tabs = SFTabs.main.getTabs();
  const tabIndex = tabs.findIndex(t => t.id === tabId);
  
  if (tabIndex === -1) {
    throw new Error(`Tab with ID ${tabId} not found`);
  }
  
  // Apply updates
  const tab = tabs[tabIndex];
  Object.assign(tab, updates);
  
  // If setup object settings changed, mark for navigation refresh
  if (updates.isSetupObject && updates.autoSetupDropdown && !tab.cachedNavigation.length) {
    tab.needsNavigationRefresh = true;
  }
  
  return SFTabs.storage.saveTabs(tabs);
}

/**
 * Delete a tab
 */
function deleteTab(tabId) {
  const settings = SFTabs.main.getUserSettings();
  
  if (settings.skipDeleteConfirmation) {
    // Directly delete the tab without confirmation
    performTabDeletion(tabId);
  } else {
    // Show confirmation dialog
    showDeleteConfirmModal(tabId);
  }
}

/**
 * Perform the actual tab deletion
 */
function performTabDeletion(tabId) {
  const tabs = SFTabs.main.getTabs();
  const updatedTabs = tabs.filter(tab => tab.id !== tabId);
  
  SFTabs.storage.saveTabs(updatedTabs).then(() => {
    SFTabs.main.showStatus('Tab removed', false);
  });
}

/**
 * Show delete confirmation modal
 */
function showDeleteConfirmModal(tabId) {
  console.log('Showing delete confirm modal for tab', tabId);
  
  const domElements = SFTabs.main.getDOMElements();
  const modal = domElements.deleteConfirmModal;
  const cancelBtn = document.getElementById('delete-modal-cancel-button');
  const confirmBtn = document.getElementById('delete-modal-confirm-button');
  
  if (!modal) {
    console.error('Delete modal element not found');
    return;
  }
  
  // Ensure modal is properly positioned
  modal.style.position = 'fixed';
  modal.style.zIndex = '2000';
  
  // Make sure modal is a direct child of body
  if (modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }
  
  SFTabs.main.showModal(modal, cancelBtn, confirmBtn, () => {
    performTabDeletion(tabId);
  });
}

/**
 * Reset to default tabs
 */
function resetToDefaults() {
  console.log('Resetting to default tabs');
  const defaultTabs = JSON.parse(JSON.stringify(SFTabs.constants.DEFAULT_TABS));
  
  SFTabs.storage.saveTabs(defaultTabs).then(() => {
    SFTabs.main.showStatus('Reset to default tabs', false);
  });
}

/**
 * Update tab positions after drag and drop
 */
function updateTabPositions() {
  const domElements = SFTabs.main.getDOMElements();
  const tabItems = domElements.tabList.querySelectorAll('.tab-item');
  const tabs = SFTabs.main.getTabs();
  
  tabItems.forEach((item, index) => {
    const tabId = item.dataset.id;
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      tab.position = index;
    }
  });
  
  SFTabs.storage.saveTabs(tabs);
}

/**
 * Get a tab by ID
 */
function getTabById(tabId) {
  const tabs = SFTabs.main.getTabs();
  return tabs.find(t => t.id === tabId);
}

/**
 * Duplicate a tab
 */
function duplicateTab(tabId) {
  const originalTab = getTabById(tabId);
  if (!originalTab) {
    SFTabs.main.showStatus('Tab not found', true);
    return;
  }
  
  const tabs = SFTabs.main.getTabs();
  const duplicatedTab = {
    ...originalTab,
    id: generateId(),
    label: `${originalTab.label} (Copy)`,
    position: tabs.length,
    children: [], // Don't duplicate children
    parentId: null, // Reset parent relationship
    cachedNavigation: [...(originalTab.cachedNavigation || [])], // Copy navigation if present
    needsNavigationRefresh: originalTab.isSetupObject && originalTab.autoSetupDropdown
  };
  
  tabs.push(duplicatedTab);
  SFTabs.storage.saveTabs(tabs).then(() => {
    SFTabs.main.showStatus(`Duplicated tab "${originalTab.label}"`, false);
  });
}

/**
 * Toggle new tab setting for a tab
 */
function toggleNewTabSetting(tabId) {
  const tab = getTabById(tabId);
  if (!tab) return;
  
  updateTab(tabId, { openInNewTab: !tab.openInNewTab }).then(() => {
    const status = tab.openInNewTab ? 'disabled' : 'enabled';
    console.log(`New tab setting ${status} for "${tab.label}"`);
  });
}

/**
 * Setup tab-related event listeners
 */
function setupEventListeners() {
  const domElements = SFTabs.main.getDOMElements();
  
  // Quick add button
  if (domElements.quickAddButton) {
    domElements.quickAddButton.addEventListener('click', () => {
      console.log('Enhanced quick add button clicked');
      enhancedAddTabForCurrentPage();
    });
  }
  
  // Add tab button - opens action panel for new tab creation
  if (domElements.addTabButton) {
    domElements.addTabButton.addEventListener('click', () => {
      console.log('Add tab button clicked');
      // Create a temporary new tab object for the action panel
      const newTab = {
        id: null, // null ID indicates this is a new tab, not an edit
        label: '',
        path: '',
        openInNewTab: false,
        isObject: false,
        isCustomUrl: false,
        isSetupObject: false
      };

      // Open the action panel with the new tab
      if (SFTabs.main && SFTabs.main.showActionPanel) {
        SFTabs.main.showActionPanel(newTab);
      }
    });
  }
  
  console.log('Tab event listeners setup complete');
}

// Export tab functions
window.SFTabs = window.SFTabs || {};
window.SFTabs.tabs = {
  enhancedAddTabForCurrentPage,
  createTab,
  updateTab,
  deleteTab,
  performTabDeletion,
  showDeleteConfirmModal,
  resetToDefaults,
  updateTabPositions,
  getTabById,
  duplicateTab,
  toggleNewTabSetting,
  setupEventListeners
};