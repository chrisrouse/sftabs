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
  // Returned so a caller can act once the tab exists — the v2 popup fans it out
  // to other profiles. Ignoring the value behaves exactly as before.
  return ensureBrowserAPI()
    .then(browserAPI => {
      return browserAPI.tabs.query({ active: true, currentWindow: true });
    })
    .then(tabs => {
      if (tabs.length > 0) {
        const currentUrl = tabs[0].url;
        const pageTitle = tabs[0].title;

        // Parsing lives in shared utils so this and the "+" in the Salesforce
        // menu bar capture a page identically. It returns null for a page it
        // cannot use; the two reasons are told apart here.
        const parsed = SFTabs.utils.parsePageToTab(currentUrl, pageTitle);
        if (!parsed) {
          const isSalesforcePage = currentUrl.includes('salesforce') || currentUrl.includes('.force.com');
          SFTabs.main.showStatus(chrome.i18n.getMessage(
            isSalesforcePage ? 'notSalesforceSetupPage' : 'notSalesforcePage'), true);
          return;
        }
        const { path, isObject, isCustomUrl, isSetupObject } = parsed;

        const name = parsed.label;

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
          position: existingTabs.length
        };

        // Add the tab and save immediately
        existingTabs.push(newTab);
        SFTabs.storage.saveTabs(existingTabs);
        
        let pageType = isObject ? 'object' : (isCustomUrl ? 'custom' : 'setup');
        SFTabs.main.showStatus(chrome.i18n.getMessage('tabAdded', [pageType, name]), false);
      }
    })
    .catch(error => {
      SFTabs.main.showStatus(chrome.i18n.getMessage('errorAccessingTab', [error.message]), true);
    });
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
    dropdownItems: tabData.dropdownItems || [], // Support dropdown items on creation
    position: tabs.length
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
  // Check if the action panel is open for the tab being deleted
  const currentActionPanelTab = SFTabs.main.getCurrentActionPanelTab();
  const isDeletedTabOpen = currentActionPanelTab && currentActionPanelTab.id === tabId;

  // FIRST: Close the action panel if it's open for this tab - do this BEFORE modifying tabs
  if (isDeletedTabOpen && SFTabs.main.closeActionPanel) {
    SFTabs.main.closeActionPanel();
  }

  // THEN: Delete the tab from the list
  const tabs = SFTabs.main.getTabs();
  const updatedTabs = tabs.filter(tab => tab.id !== tabId);

  SFTabs.storage.saveTabs(updatedTabs).then(() => {
    SFTabs.main.showStatus(chrome.i18n.getMessage('tabRemoved'), false);
  });
}

/**
 * Show delete confirmation modal
 */
function showDeleteConfirmModal(tabId) {
  
  const domElements = SFTabs.main.getDOMElements();
  const modal = domElements.deleteConfirmModal;
  const cancelBtn = document.getElementById('delete-modal-cancel-button');
  const confirmBtn = document.getElementById('delete-modal-confirm-button');
  
  if (!modal) {
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
  const defaultTabs = JSON.parse(JSON.stringify(SFTabs.constants.DEFAULT_TABS));
  
  SFTabs.storage.saveTabs(defaultTabs).then(() => {
    SFTabs.main.showStatus(chrome.i18n.getMessage('resetToDefaultTabsStatus'), false);
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
    SFTabs.main.showStatus(chrome.i18n.getMessage('tabNotFound'), true);
    return;
  }

  const tabs = SFTabs.main.getTabs();
  const duplicatedTab = {
    ...originalTab,
    id: generateId(),
    label: `${originalTab.label} (Copy)`,
    position: tabs.length
  };
  
  tabs.push(duplicatedTab);
  SFTabs.storage.saveTabs(tabs).then(() => {
    SFTabs.main.showStatus(chrome.i18n.getMessage('tabDuplicated', [originalTab.label]), false);
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
      enhancedAddTabForCurrentPage();
    });
  }
  
  // Add tab button - opens action panel for new tab creation
  if (domElements.addTabButton) {
    domElements.addTabButton.addEventListener('click', () => {
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