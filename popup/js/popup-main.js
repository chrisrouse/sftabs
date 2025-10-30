// popup/js/popup-main.js
// Main entry point for popup functionality - Critical fixes

// Global state
let customTabs = [];
let editingTabId = null;
let currentActionPanelTab = null;
let userSettings = { ...SFTabs.constants.DEFAULT_SETTINGS };

// DOM elements - will be initialized in DOMContentLoaded
let domElements = {};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  console.log('SF Tabs popup loaded - initializing...');
  
  // Initialize DOM element references
  initializeDOMElements();
  
  // Apply initial panel visibility
  showMainContent();
  
  // Load user settings first, then tabs
  loadUserSettings()
    .then(() => {
      // Apply theme early
      if (SFTabs.settings && SFTabs.settings.applyTheme) {
        SFTabs.settings.applyTheme();
      }
      
      // Load tabs from storage
      return loadTabsFromStorage();
    })
    .then(() => {
      // Setup all event listeners
      setupAllEventListeners();
      
      // Initialize components
      if (SFTabs.settings && SFTabs.settings.initThemeSelector) {
        SFTabs.settings.initThemeSelector();
      }
      
      // Render tabs
      if (SFTabs.ui && SFTabs.ui.renderTabList) {
        SFTabs.ui.renderTabList();
      }
      
      console.log('SF Tabs popup initialization complete');
    })
    .catch(error => {
      console.error('Error during popup initialization:', error);
      showStatus('Error initializing popup: ' + error.message, true);
    });

  // Listen for reload messages from import/export
  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'reload_popup') {
      console.log('Reload popup message received - reloading tabs');
      loadUserSettings()
        .then(() => loadTabsFromStorage())
        .then(() => {
          if (SFTabs.settings && SFTabs.settings.updateSettingsUI) {
            SFTabs.settings.updateSettingsUI();
          }
          if (SFTabs.settings && SFTabs.settings.applyTheme) {
            SFTabs.settings.applyTheme();
          }
          if (SFTabs.ui && SFTabs.ui.renderTabList) {
            SFTabs.ui.renderTabList();
          }
          console.log('Popup reloaded with imported configuration');
        })
        .catch(error => {
          console.error('Error reloading popup:', error);
        });
      return true;
    }
  });
});

/**
 * Initialize DOM element references
 */
function initializeDOMElements() {
  // Main containers
  domElements.tabList = document.querySelector('#tab-list');
  domElements.emptyState = document.querySelector('#empty-state');
  domElements.tabForm = document.querySelector('#tab-form');
  domElements.mainContent = document.querySelector('#main-content');
  domElements.settingsPanel = document.querySelector('#settings-panel');
  domElements.actionPanel = document.querySelector('#action-panel');
  
  // Form elements
  domElements.formTitle = document.querySelector('#form-title');
  domElements.tabNameInput = document.querySelector('#tab-name');
  domElements.tabPathInput = document.querySelector('#tab-path');
  domElements.openInNewTabCheckbox = document.querySelector('#open-in-new-tab');
  domElements.isObjectCheckbox = document.querySelector('#is-object');
  domElements.isCustomUrlCheckbox = document.querySelector('#is-custom-url');
  domElements.isSetupObjectCheckbox = document.querySelector('#is-setup-object');
  domElements.hasDropdownCheckbox = document.querySelector('#has-dropdown');
  domElements.autoSetupDropdownCheckbox = document.querySelector('#auto-setup-dropdown');
  
  // Buttons
  domElements.addTabButton = document.querySelector('#add-tab-button');
  domElements.quickAddButton = document.querySelector('#quick-add-button');
  domElements.saveButton = document.querySelector('#save-button');
  domElements.cancelButton = document.querySelector('#cancel-button');
  domElements.settingsButton = document.querySelector('#settings-button');
  domElements.refreshNavButton = document.querySelector('#refresh-nav-button');
  
  // Status and modals
  domElements.statusMessage = document.querySelector('#status-message');
  domElements.confirmModal = document.querySelector('#confirm-modal');
  domElements.deleteConfirmModal = document.querySelector('#delete-confirm-modal');
  
  // Settings elements
  domElements.compactModeCheckbox = document.querySelector('#compact-mode');
  domElements.skipDeleteConfirmationCheckbox = document.querySelector('#skip-delete-confirmation');
  domElements.lightningNavigationCheckbox = document.querySelector('#lightning-navigation');
  domElements.settingsResetButton = document.querySelector('#settings-reset-button');

  // Action panel elements
  domElements.actionPanelCloseButton = document.querySelector('#action-panel-close-button');
  domElements.actionPanelSaveButton = document.querySelector('#action-panel-save-button');
  domElements.actionTabNameInput = document.querySelector('#action-tab-name');
  domElements.actionTabPathInput = document.querySelector('#action-tab-path');
  domElements.actionPanelTabNameDisplay = document.querySelector('#action-panel-tab-name-display');
  domElements.actionOpenInNewTabCheckbox = document.querySelector('#action-open-in-new-tab');
  domElements.actionIsObjectCheckbox = document.querySelector('#action-is-object');
  domElements.actionIsCustomUrlCheckbox = document.querySelector('#action-is-custom-url');
  
  // Form groups
  domElements.hasDropdownGroup = document.querySelector('.has-dropdown-group');
  domElements.autoSetupDropdownGroup = document.querySelector('.auto-setup-dropdown-group');
  domElements.refreshNavGroup = document.querySelector('.refresh-nav-group');
  
  // Validate critical elements
  const criticalElements = [
    'tabList', 'emptyState', 'tabForm', 'mainContent', 'settingsPanel',
    'tabNameInput', 'tabPathInput', 'addTabButton', 'quickAddButton'
  ];
  
  let missingElements = 0;
  for (const elementName of criticalElements) {
    if (!domElements[elementName]) {
      console.error(`Critical DOM element not found: ${elementName}`);
      missingElements++;
    }
  }
  
  if (missingElements > 0) {
    console.error(`${missingElements} critical DOM elements missing`);
  }
  
  console.log('DOM elements initialized:', Object.keys(domElements).length, 'elements');
}

/**
 * Setup all event listeners
 */
function setupAllEventListeners() {
  // Tab management listeners
  if (SFTabs.tabs && SFTabs.tabs.setupEventListeners) {
    SFTabs.tabs.setupEventListeners();
  }
  
  // UI listeners
  if (SFTabs.ui && SFTabs.ui.setupEventListeners) {
    SFTabs.ui.setupEventListeners();
  }
  
  // Settings listeners
  if (SFTabs.settings && SFTabs.settings.setupEventListeners) {
    SFTabs.settings.setupEventListeners();
  }
  
  // Dropdown listeners
  if (SFTabs.dropdowns && SFTabs.dropdowns.setupEventListeners) {
    SFTabs.dropdowns.setupEventListeners();
  }
  
  console.log('All available event listeners setup complete');
}

/**
 * Load user settings from storage
 */
function loadUserSettings() {
  console.log('Loading user settings from storage');
  return SFTabs.storage.getUserSettings()
    .then((loadedSettings) => {
      userSettings = loadedSettings;
      if (SFTabs.settings && SFTabs.settings.updateSettingsUI) {
        SFTabs.settings.updateSettingsUI();
      }
      return userSettings;
    })
    .catch((error) => {
      console.error('Error loading user settings:', error);
      showStatus('Error loading settings: ' + error.message, true);
      return SFTabs.constants.DEFAULT_SETTINGS;
    });
}

/**
 * Load tabs from storage
 */
function loadTabsFromStorage() {
  console.log('Loading tabs from storage');
  return SFTabs.storage.getTabs()
    .then((loadedTabs) => {
      console.log('📦 Loaded tabs from storage:', loadedTabs ? loadedTabs.length : 0, 'tabs');
      if (loadedTabs && loadedTabs.length > 0) {
        console.log('First tab:', loadedTabs[0]);
        // Migrate tabs to new structure if needed
        customTabs = migrateTabsToNewStructure(loadedTabs);

        // Save migrated structure if changes were made
        const originalLength = JSON.stringify(loadedTabs).length;
        const migratedLength = JSON.stringify(customTabs).length;

        if (migratedLength !== originalLength) {
          console.log('Tabs migrated to new structure');
          return SFTabs.storage.saveTabs(customTabs);
        }
      } else {
        console.log('⚠️ No tabs found in storage, using defaults');
        customTabs = [...SFTabs.constants.DEFAULT_TABS];
        return SFTabs.storage.saveTabs(customTabs);
      }

      console.log('✅ Final customTabs:', customTabs.length, 'tabs');
      return customTabs;
    })
    .catch((error) => {
      console.error('Error loading tabs from storage:', error);
      showStatus('Error loading tabs: ' + error.message, true);
      // Fallback to default tabs
      customTabs = [...SFTabs.constants.DEFAULT_TABS];
      return customTabs;
    });
}

/**
 * Migrate tabs to new structure if needed
 */
function migrateTabsToNewStructure(existingTabs) {
  return existingTabs.map(tab => ({
    ...tab,
    hasDropdown: tab.hasDropdown || tab.isSetupObject || false,
    autoSetupDropdown: tab.autoSetupDropdown || tab.isSetupObject || false,
    children: tab.children || [],
    parentId: tab.parentId || null,
    isExpanded: tab.isExpanded || false,
    cachedNavigation: tab.cachedNavigation || [],
    navigationLastUpdated: tab.navigationLastUpdated || null,
    needsNavigationRefresh: tab.needsNavigationRefresh || false
  }));
}

/**
 * Show main content panel
 */
function showMainContent() {
  console.log('Showing main content');
  domElements.mainContent.classList.add('active');
  domElements.mainContent.style.display = 'block';
  domElements.settingsPanel.classList.remove('active');
  domElements.settingsPanel.style.display = 'none';
  domElements.actionPanel.classList.remove('active');
  domElements.actionPanel.style.display = 'none';
}

/**
 * Show settings panel
 */
function showSettingsPanel() {
  console.log('Showing settings panel');
  domElements.mainContent.classList.remove('active');
  domElements.mainContent.style.display = 'none';
  domElements.settingsPanel.classList.add('active');
  domElements.settingsPanel.style.display = 'block';
  domElements.actionPanel.classList.remove('active');
  domElements.actionPanel.style.display = 'none';
}

/**
 * Show action panel for a specific tab
 */
function showActionPanel(tab) {
  console.log('Showing action panel for tab:', tab);

  // Store the current tab context
  currentActionPanelTab = tab;

  // Update the panel content with tab information
  updateActionPanelContent(tab);

  // Show the panel
  domElements.mainContent.classList.remove('active');
  domElements.mainContent.style.display = 'none';
  domElements.settingsPanel.classList.remove('active');
  domElements.settingsPanel.style.display = 'none';
  domElements.actionPanel.classList.add('active');
  domElements.actionPanel.style.display = 'block';
}

/**
 * Update action panel content with tab data
 */
function updateActionPanelContent(tab) {
  if (!tab) {
    console.warn('No tab provided to updateActionPanelContent');
    return;
  }

  console.log('Updating action panel content for tab:', tab);

  // Update tab name display at the top
  if (domElements.actionPanelTabNameDisplay) {
    domElements.actionPanelTabNameDisplay.textContent = tab.label;
  }

  // Populate the input fields with current tab data
  if (domElements.actionTabNameInput) {
    domElements.actionTabNameInput.value = tab.label || '';
  }

  if (domElements.actionTabPathInput) {
    domElements.actionTabPathInput.value = tab.path || '';
  }

  // Populate checkbox fields
  if (domElements.actionOpenInNewTabCheckbox) {
    domElements.actionOpenInNewTabCheckbox.checked = tab.openInNewTab || false;
  }

  if (domElements.actionIsObjectCheckbox) {
    domElements.actionIsObjectCheckbox.checked = tab.isObject || false;
  }

  if (domElements.actionIsCustomUrlCheckbox) {
    domElements.actionIsCustomUrlCheckbox.checked = tab.isCustomUrl || false;
  }
}

/**
 * Save action panel changes
 */
function saveActionPanelChanges() {
  console.log('Saving action panel changes');

  const tab = currentActionPanelTab;
  if (!tab) {
    showStatus('No tab selected', true);
    return;
  }

  // Get values from inputs
  const name = domElements.actionTabNameInput.value.trim();
  const path = domElements.actionTabPathInput.value.trim();

  // Validation
  if (!name || !path) {
    showStatus('Tab name and path are required', true);
    return;
  }

  // Get checkbox values
  const openInNewTab = domElements.actionOpenInNewTabCheckbox ? domElements.actionOpenInNewTabCheckbox.checked : tab.openInNewTab;
  const isObject = domElements.actionIsObjectCheckbox ? domElements.actionIsObjectCheckbox.checked : tab.isObject;
  const isCustomUrl = domElements.actionIsCustomUrlCheckbox ? domElements.actionIsCustomUrlCheckbox.checked : tab.isCustomUrl;

  // Validation for conflicting options
  if (isObject && isCustomUrl) {
    showStatus('Tab cannot be both Object and Custom URL', true);
    return;
  }

  // Prepare update data
  const tabData = {
    label: name,
    path: path,
    openInNewTab: openInNewTab,
    isObject: isObject,
    isCustomUrl: isCustomUrl
  };

  // Update the tab using the tabs module
  if (SFTabs.tabs && SFTabs.tabs.updateTab) {
    SFTabs.tabs.updateTab(tab.id, tabData).then(() => {
      console.log('Tab updated successfully from action panel');

      // Reload tabs from storage to ensure we have the latest data
      return loadTabsFromStorage();
    }).then(() => {
      // Update the current tab reference
      currentActionPanelTab = { ...tab, ...tabData };

      // Update the display header
      if (domElements.actionPanelTabNameDisplay) {
        domElements.actionPanelTabNameDisplay.textContent = name;
      }

      // Explicitly re-render the tab list to show updated name
      if (SFTabs.ui && SFTabs.ui.renderTabList) {
        console.log('Re-rendering tab list after action panel save');
        SFTabs.ui.renderTabList();
      }

      // Close panel and return to main content
      setTimeout(() => {
        showMainContent();
      }, 800);
    }).catch(error => {
      console.error('Error updating tab:', error);
      showStatus('Error updating tab: ' + error.message, true);
    });
  } else {
    console.error('SFTabs.tabs.updateTab not available');
    showStatus('Error: Update function not available', true);
  }
}

/**
 * Show status message
 */
function showStatus(message, isError = false) {
  console.log('Showing status message', { message, isError });
  if (!domElements.statusMessage) {
    console.error('Status message element not found');
    return;
  }
  
  domElements.statusMessage.textContent = message;

  // Apply appropriate class
  domElements.statusMessage.classList.remove('success', 'error');
  if (isError) {
    domElements.statusMessage.classList.add('error');
  } else if (message) {
    domElements.statusMessage.classList.add('success');
  }

  // Clear message after a delay
  setTimeout(() => {
    domElements.statusMessage.textContent = '';
    domElements.statusMessage.classList.remove('success', 'error');
  }, 3000);
}

/**
 * Generic modal display function
 */
function showModal(modalElement, cancelButton, confirmButton, onConfirm) {
  console.log(`Showing modal: ${modalElement ? modalElement.id : 'unknown'}`);

  if (!modalElement) {
    console.error('Modal element not found!');
    return;
  }

  // Show the modal
  modalElement.classList.add('show');

  // Handle Cancel button
  const handleCancel = () => {
    console.log('Cancel button clicked');
    modalElement.classList.remove('show');
    cleanup();
  };

  // Handle Confirm button
  const handleConfirm = () => {
    console.log('Confirm button clicked');
    modalElement.classList.remove('show');
    if (typeof onConfirm === 'function') {
      onConfirm();
    }
    cleanup();
  };

  // Handle outside click
  const handleOutsideClick = (event) => {
    if (event.target === modalElement) {
      console.log('Clicked outside modal');
      modalElement.classList.remove('show');
      cleanup();
    }
  };

  // Cleanup function
  const cleanup = () => {
    if (cancelButton) cancelButton.removeEventListener('click', handleCancel);
    if (confirmButton) confirmButton.removeEventListener('click', handleConfirm);
    modalElement.removeEventListener('click', handleOutsideClick);
  };

  // Add event listeners
  if (cancelButton) cancelButton.addEventListener('click', handleCancel);
  if (confirmButton) confirmButton.addEventListener('click', handleConfirm);
  modalElement.addEventListener('click', handleOutsideClick);
}

// Export global functions and state for use by other modules
window.SFTabs = window.SFTabs || {};
window.SFTabs.main = {
  // State
  get customTabs() { return customTabs; },
  get editingTabId() { return editingTabId; },
  get currentActionPanelTab() { return currentActionPanelTab; },
  get userSettings() { return userSettings; },
  get domElements() { return domElements; },

  // Functions
  showMainContent,
  showSettingsPanel,
  showActionPanel,
  updateActionPanelContent,
  saveActionPanelChanges,
  showStatus,
  showModal,
  loadUserSettings,
  loadTabsFromStorage,

  // Controlled state setters
  setTabs: (tabs) => {
    customTabs = tabs;
  },
  setEditingTabId: (id) => {
    editingTabId = id;
  },
  setCurrentActionPanelTab: (tab) => {
    currentActionPanelTab = tab;
  },
  setUserSettings: (settings) => {
    userSettings = settings;
  },

  // Getters for backward compatibility
  getTabs: () => customTabs,
  getEditingTabId: () => editingTabId,
  getCurrentActionPanelTab: () => currentActionPanelTab,
  getUserSettings: () => userSettings,
  getDOMElements: () => domElements
};