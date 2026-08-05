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

// Export tab functions
window.SFTabs = window.SFTabs || {};
window.SFTabs.tabs = {
  enhancedAddTabForCurrentPage,
};