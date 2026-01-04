// popup/js/popup-main.js
// Main entry point for popup functionality - Critical fixes

// Global state
let customTabs = [];
let editingTabId = null;
let currentActionPanelTab = null;
let userSettings = { ...SFTabs.constants.DEFAULT_SETTINGS };

// DOM elements - will be initialized in DOMContentLoaded
let domElements = {};

/**
 * Apply theme based on current settings
 */
function applyTheme() {
  const settings = userSettings;

  if (settings.themeMode === 'system') {
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }

    // Listen for changes in system theme
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      const newTheme = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
    });
  } else {
    // Apply user selected theme
    document.documentElement.setAttribute('data-theme', settings.themeMode);
  }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {

  // Initialize DOM element references
  initializeDOMElements();

  // Don't show main content yet - wait for migration check
  // showMainContent();

  // Initialize popup with sequential async/await to avoid race conditions
  (async function init() {
    try {
      // Check for first-launch BEFORE loading settings (which would create defaults)
      if (SFTabs.firstLaunch && SFTabs.firstLaunch.checkFirstLaunch) {
        const firstLaunchStatus = await SFTabs.firstLaunch.checkFirstLaunch();

        if (firstLaunchStatus.shouldShowWizard) {
          // Initialize first-launch modal event listeners (now async to check sync availability)
          if (SFTabs.firstLaunch.initFirstLaunchModal) {
            await SFTabs.firstLaunch.initFirstLaunchModal();
          }

          // Show first-launch modal and stop further initialization
          if (SFTabs.firstLaunch.showFirstLaunchModal) {
            await SFTabs.firstLaunch.showFirstLaunchModal();
          }

          // Don't proceed with normal initialization - let user complete first-launch setup
          return;
        }
      }

      // Load user settings (safe to do after first-launch check)
      await loadUserSettings();

      // Apply theme early
      applyTheme();

      // Check for pending migration before loading tabs
      if (SFTabs.migration && SFTabs.migration.checkMigrationStatus) {
        const migrationStatus = await SFTabs.migration.checkMigrationStatus();

        if (migrationStatus.migrationPending || (migrationStatus.needsMigration && !migrationStatus.migrationCompleted)) {

          // Initialize migration modal event listeners
          if (SFTabs.migration.initMigrationModal) {
            SFTabs.migration.initMigrationModal();
          }

          // Show migration modal and stop further initialization
          if (SFTabs.migration.showMigrationModal) {
            await SFTabs.migration.showMigrationModal();
          }

          // Don't proceed with normal initialization - let user complete migration
          return;
        }
      }

      // No migration needed - show main content now
      showMainContent();

      // IMPORTANT: Wait for tabs to load before setting up event listeners
      // This prevents race conditions with profile migration
      await loadTabsFromStorage();

      // Now it's safe to setup profile listeners
      setupAllEventListeners();

      // Render tabs
      if (SFTabs.ui && SFTabs.ui.renderTabList) {
        SFTabs.ui.renderTabList();
      }

    } catch (error) {
      showStatus('Error initializing popup: ' + error.message, true);
    }
  })();

  // Listen for reload messages from import/export
  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'reload_popup') {
      loadUserSettings()
        .then(() => loadTabsFromStorage())
        .then(() => {
          applyTheme();
          if (SFTabs.ui && SFTabs.ui.renderTabList) {
            SFTabs.ui.renderTabList();
          }
        })
        .catch(error => {
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
  
  // Buttons
  domElements.addTabButton = document.querySelector('#add-tab-button');
  domElements.quickAddButton = document.querySelector('#quick-add-button');
  domElements.saveButton = document.querySelector('#save-button');
  domElements.cancelButton = document.querySelector('#cancel-button');
  domElements.settingsButton = document.querySelector('#settings-button');

  // Modals
  domElements.confirmModal = document.querySelector('#confirm-modal');
  domElements.deleteConfirmModal = document.querySelector('#delete-confirm-modal');
  
  // Settings elements
  domElements.compactModeCheckbox = document.querySelector('#compact-mode');
  domElements.skipDeleteConfirmationCheckbox = document.querySelector('#skip-delete-confirmation');
  domElements.settingsResetButton = document.querySelector('#settings-reset-button');

  // Action panel elements
  domElements.actionPanelCloseButton = document.querySelector('#action-panel-close-button');
  domElements.actionPanelSaveButton = document.querySelector('#action-panel-save-button');
  domElements.actionTabNameInput = document.querySelector('#action-tab-name');
  domElements.actionTabNameCounter = document.querySelector('#action-tab-name-counter');
  domElements.actionTabPathInput = document.querySelector('#action-tab-path');
  domElements.actionPanelTabNameDisplay = document.querySelector('#action-panel-tab-name-display');
  domElements.actionIsObjectCheckbox = document.querySelector('#action-is-object');
  domElements.actionIsCustomUrlCheckbox = document.querySelector('#action-is-custom-url');

  // Manage dropdown panel sections (in tab-form)
  domElements.objectDropdownSection = document.querySelector('#object-dropdown-section');
  domElements.manualDropdownSection = document.querySelector('#manual-dropdown-section');
  domElements.manageDropdownPreview = document.querySelector('#manage-dropdown-preview');
  domElements.manageDropdownList = document.querySelector('#manage-dropdown-list');
  domElements.manageDropdownCount = document.querySelector('#manage-dropdown-count');

  // Form groups
  domElements.hasDropdownGroup = document.querySelector('.has-dropdown-group');

  // Validate critical elements
  const criticalElements = [
    'tabList', 'emptyState', 'mainContent', 'actionPanel',
    'addTabButton', 'quickAddButton', 'actionTabNameInput', 'actionTabPathInput'
  ];
  
  let missingElements = 0;
  for (const elementName of criticalElements) {
    if (!domElements[elementName]) {
      missingElements++;
    }
  }
  
  if (missingElements > 0) {
  }
  
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

  // Dropdown listeners
  if (SFTabs.dropdowns && SFTabs.dropdowns.setupEventListeners) {
    SFTabs.dropdowns.setupEventListeners();
  }

  // Action Panel listeners
  if (domElements.actionPanelSaveButton) {
    domElements.actionPanelSaveButton.addEventListener('click', saveActionPanelChanges);
  }

  if (domElements.actionPanelCloseButton) {
    domElements.actionPanelCloseButton.addEventListener('click', closeActionPanel);
  }

}

/**
 * Load user settings from storage
 */
function loadUserSettings() {
  return SFTabs.storage.getUserSettings()
    .then((loadedSettings) => {
      userSettings = loadedSettings;
      return userSettings;
    })
    .catch((error) => {
      showStatus('Error loading settings: ' + error.message, true);
      return SFTabs.constants.DEFAULT_SETTINGS;
    });
}

/**
 * Load tabs from storage
 */
async function loadTabsFromStorage() {

  try {
    // Always load from profile storage (profiles are used internally even if UI is disabled)
    if (!userSettings.activeProfileId) {
      customTabs = [];
      return customTabs;
    }

    let loadedTabs = await SFTabs.storage.getProfileTabs(userSettings.activeProfileId);

    if (loadedTabs && loadedTabs.length > 0) {

      // Migrate tabs to new structure if needed
      customTabs = migrateTabsToNewStructure(loadedTabs);

      // Check if migration actually changed anything by comparing structures
      const needsSave = hasStructuralChanges(loadedTabs, customTabs);

      if (needsSave) {
        await SFTabs.storage.saveProfileTabs(userSettings.activeProfileId, customTabs);
      } else {
      }
    } else {
      // Profile has no tabs - this is valid (empty profile or user initialization)
      customTabs = [];
    }

    if (customTabs.length > 0) {
      const customCount = customTabs.filter(t => !t.id.startsWith('default_tab_')).length;
    }
    return customTabs;
  } catch (error) {
    showStatus('Error loading tabs: ' + error.message, true);

    // Don't automatically use defaults on error - might overwrite user data
    customTabs = [];
    return customTabs;
  }
}

/**
 * Check if migration made structural changes (not just adding default fields)
 */
function hasStructuralChanges(original, migrated) {
  if (original.length !== migrated.length) return true;

  for (let i = 0; i < original.length; i++) {
    const orig = original[i];
    const mig = migrated[i];

    // Check if core properties are different
    if (orig.id !== mig.id ||
        orig.label !== mig.label ||
        orig.path !== mig.path ||
        orig.position !== mig.position) {
      return true;
    }

    // Check if any new required fields were added
    if (mig.hasDropdown !== undefined && orig.hasDropdown === undefined) {
      return true;
    }
  }

  return false;
}

/**
 * Migrate tabs to new structure if needed
 * This function ensures backward compatibility when upgrading from older versions
 */
function migrateTabsToNewStructure(existingTabs) {

  const migratedTabs = existingTabs.map((tab, index) => {
    // Start with all existing properties
    const migratedTab = { ...tab };
    const addedFields = [];

    // Ensure required fields exist with proper defaults
    if (migratedTab.isObject === undefined) {
      migratedTab.isObject = false;
      addedFields.push('isObject');
    }

    if (migratedTab.isCustomUrl === undefined) {
      migratedTab.isCustomUrl = false;
      addedFields.push('isCustomUrl');
    }

    if (migratedTab.isSetupObject === undefined) {
      migratedTab.isSetupObject = false;
      addedFields.push('isSetupObject');
    }

    if (migratedTab.openInNewTab === undefined) {
      migratedTab.openInNewTab = false;
      addedFields.push('openInNewTab');
    }

    // Handle dropdown-related fields
    // If tab has dropdownItems (new format), preserve them
    if (tab.dropdownItems && Array.isArray(tab.dropdownItems)) {
      migratedTab.hasDropdown = true;
      migratedTab.dropdownItems = tab.dropdownItems;
    } else if (tab.hasDropdown === undefined) {
      migratedTab.hasDropdown = tab.isSetupObject || false;
      addedFields.push('hasDropdown');
    }

    // Legacy dropdown fields are no longer migrated - they will be stripped on save

    // Ensure position is set
    if (migratedTab.position === undefined) {
      migratedTab.position = index;
      addedFields.push('position');
    }

    if (addedFields.length > 0) {
    } else {
    }

    return migratedTab;
  });

  return migratedTabs;
}

/**
 * Show main content panel
 */
function showMainContent() {
  // Clear the action panel tab reference since we're closing it
  currentActionPanelTab = null;
  domElements.mainContent.classList.add('active');
  domElements.mainContent.style.display = 'block';
  domElements.actionPanel.classList.remove('active');
  domElements.actionPanel.style.display = 'none';

  // Hide the tab-form if it's visible
  const tabForm = document.getElementById('tab-form');
  if (tabForm) {
    tabForm.style.display = 'none';
  }
  const oldObjectDropdownSection = document.getElementById('object-dropdown-section');
  if (oldObjectDropdownSection) {
    oldObjectDropdownSection.style.display = 'none';
  }
}

/**
 * Close action panel and return to main content
 */
function closeActionPanel() {
  showMainContent();
}

/**
 * Show action panel for a specific tab
 */
function showActionPanel(tab) {

  if (!tab) {
    return;
  }

  // Store the current tab context
  currentActionPanelTab = tab;

  // Initialize staged dropdown items for editing
  // This allows users to delete/modify dropdown items without saving until they click Save
  if (!tab._isDropdownItemEdit) {
    // Only create staged items for main tab editing, not dropdown item editing
    if (tab.dropdownItems && tab.dropdownItems.length > 0) {
      tab.stagedDropdownItems = JSON.parse(JSON.stringify(tab.dropdownItems));
    } else {
      tab.stagedDropdownItems = [];
    }
  }

  // Update the panel content with tab information
  updateActionPanelContent(tab);

  // Show the panel
  domElements.mainContent.classList.remove('active');
  domElements.mainContent.style.display = 'none';
  domElements.actionPanel.classList.add('active');
  domElements.actionPanel.style.display = 'block';

}

/**
 * Update action panel content with tab data
 */
function updateActionPanelContent(tab) {
  if (!tab) {
    return;
  }


  // Check if this is a new tab, dropdown item edit, or existing tab edit
  const isNewTab = !tab.id;
  const isDropdownItemEdit = tab._isDropdownItemEdit;

  // Update tab name display at the top
  if (domElements.actionPanelTabNameDisplay) {
    if (isDropdownItemEdit) {
      domElements.actionPanelTabNameDisplay.textContent = 'Edit Dropdown Item';
    } else if (isNewTab) {
      domElements.actionPanelTabNameDisplay.textContent = 'New Tab';
    } else {
      domElements.actionPanelTabNameDisplay.textContent = tab.label;
    }
  }

  // Populate the input fields with current tab data
  if (domElements.actionTabNameInput) {
    domElements.actionTabNameInput.value = tab.label || '';

    // Update character counter
    if (domElements.actionTabNameCounter) {
      domElements.actionTabNameCounter.textContent = domElements.actionTabNameInput.value.length;
    }
  }

  if (domElements.actionTabPathInput) {
    domElements.actionTabPathInput.value = tab.path || '';
  }

  // Populate checkbox fields
  if (domElements.actionIsObjectCheckbox) {
    domElements.actionIsObjectCheckbox.checked = tab.isObject || false;
  }

  if (domElements.actionIsCustomUrlCheckbox) {
    domElements.actionIsCustomUrlCheckbox.checked = tab.isCustomUrl || false;
  }

  // Dropdown management is handled in tab-form, not action panel
}

/**
 * Show manual dropdown items in the action panel
 */
function showManualDropdownItems(tab) {
  if (!domElements.manualDropdownItemsPreview || !domElements.manualDropdownItemsList || !domElements.manualDropdownCount) {
    return;
  }

  // Check if there are any dropdown items
  const items = tab.dropdownItems || [];

  if (items.length === 0) {
    domElements.manualDropdownItemsPreview.style.display = 'none';
    return;
  }

  // Update count
  domElements.manualDropdownCount.textContent = items.length;

  // Clear existing items
  domElements.manualDropdownItemsList.innerHTML = '';

  // Add items with action buttons
  items.forEach((item, index) => {
    const itemDiv = document.createElement('div');
    itemDiv.style.padding = '4px 0';
    itemDiv.style.borderBottom = index < items.length - 1 ? '1px solid #dddbda' : 'none';
    itemDiv.style.display = 'flex';
    itemDiv.style.justifyContent = 'space-between';
    itemDiv.style.alignItems = 'center';

    const labelSpan = document.createElement('span');
    labelSpan.textContent = `${index + 1}. ${item.label}`;
    labelSpan.style.flex = '1';

    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.display = 'flex';
    buttonsContainer.style.gap = '4px';

    // Edit button
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = 'Edit';
    editButton.style.fontSize = '11px';
    editButton.style.padding = '2px 6px';
    editButton.style.background = '#0176d3';
    editButton.style.color = 'white';
    editButton.style.border = 'none';
    editButton.style.borderRadius = '3px';
    editButton.style.cursor = 'pointer';
    editButton.title = 'Edit this dropdown item';
    editButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (SFTabs.ui && SFTabs.ui.editDropdownItem) {
        SFTabs.ui.editDropdownItem(tab, index);
      }
    });

    // Promote button
    const promoteButton = document.createElement('button');
    promoteButton.type = 'button';
    promoteButton.textContent = '↑';
    promoteButton.style.fontSize = '14px';
    promoteButton.style.padding = '2px 6px';
    promoteButton.style.background = '#0c9';
    promoteButton.style.color = 'white';
    promoteButton.style.border = 'none';
    promoteButton.style.borderRadius = '3px';
    promoteButton.style.cursor = 'pointer';
    promoteButton.title = 'Promote to main tab list';
    promoteButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (SFTabs.ui && SFTabs.ui.promoteDropdownItem) {
        SFTabs.ui.promoteDropdownItem(tab, index);
      }
    });

    buttonsContainer.appendChild(editButton);
    buttonsContainer.appendChild(promoteButton);

    itemDiv.appendChild(labelSpan);
    itemDiv.appendChild(buttonsContainer);
    domElements.manualDropdownItemsList.appendChild(itemDiv);
  });

  // Show preview
  domElements.manualDropdownItemsPreview.style.display = 'block';
}

/**
 * Save action panel changes
 */
function saveActionPanelChanges() {

  const tab = currentActionPanelTab;

  if (!tab) {
    showStatus('No tab selected', true);
    return;
  }

  // Get values from inputs
  const name = domElements.actionTabNameInput.value.trim();
  const path = domElements.actionTabPathInput.value.trim();

  // Validation - name is required, but path is optional (for folder-style tabs)
  if (!name) {
    showStatus('Tab name is required', true);
    return;
  }

  // Get checkbox values
  const isObject = domElements.actionIsObjectCheckbox ? domElements.actionIsObjectCheckbox.checked : tab.isObject;
  const isCustomUrl = domElements.actionIsCustomUrlCheckbox ? domElements.actionIsCustomUrlCheckbox.checked : tab.isCustomUrl;

  // Validation for conflicting options
  if (isObject && isCustomUrl) {
    showStatus('Tab cannot be both Object and Custom URL', true);
    return;
  }

  // Prepare tab data
  const tabData = {
    label: name,
    path: path,
    openInNewTab: tab.openInNewTab || false, // Preserve existing value from tab
    isObject: isObject,
    isCustomUrl: isCustomUrl
  };

  // Apply dropdown items in priority order:
  // 1. stagedDropdownItems (manual edits/deletions) - highest priority
  // 2. pendingDropdownItems (from Object Dropdown setup)
  // 3. existing dropdownItems (no changes)
  if (tab.stagedDropdownItems !== undefined) {
    // Staged items from manual edits (removing, reordering) take precedence
    tabData.dropdownItems = tab.stagedDropdownItems;
    tabData.hasDropdown = tab.stagedDropdownItems.length > 0;
  } else if (tab.pendingDropdownItems && tab.pendingDropdownItems.length > 0) {
    // Pending items from Object Dropdown setup
    tabData.hasDropdown = true;
    tabData.dropdownItems = tab.pendingDropdownItems;
  } else if (tab.dropdownItems) {
    // No changes, preserve existing dropdown items
    tabData.dropdownItems = tab.dropdownItems;
    tabData.hasDropdown = tab.dropdownItems.length > 0;
  }

  // Check if this is editing a dropdown item
  const isDropdownItemEdit = tab._isDropdownItemEdit;

  if (isDropdownItemEdit) {
    // Handle dropdown item edit
    const parentTabId = tab._parentTabId;
    const itemPath = tab._dropdownItemPath || [tab._dropdownItemIndex]; // Support both new path and old index formats

    const tabs = SFTabs.main.getTabs();
    const parentTab = tabs.find(t => t.id === parentTabId);

    if (!parentTab || !parentTab.dropdownItems) {
      showStatus('Parent tab not found', true);
      return;
    }

    // Navigate to the item using the path
    const item = SFTabs.ui.getItemByPath(parentTab.dropdownItems, itemPath);
    if (!item) {
      showStatus('Dropdown item not found', true);
      return;
    }

    // Update the dropdown item in place (preserving any nested dropdownItems)
    item.label = name;
    item.path = path;
    item.url = isCustomUrl ? path : null;
    item.isObject = isObject;
    item.isCustomUrl = isCustomUrl;

    // Save and refresh
    SFTabs.storage.saveTabs(tabs).then(() => {
      showStatus('Dropdown item updated successfully', false);

      // Reload tabs from storage
      return loadTabsFromStorage();
    }).then(() => {
      // Re-render the tab list
      if (SFTabs.ui && SFTabs.ui.renderTabList) {
        SFTabs.ui.renderTabList();
      }

      // Close panel and return to main content
      setTimeout(() => {
        showMainContent();
      }, 800);
    }).catch(error => {
      showStatus('Error updating dropdown item: ' + error.message, true);
    });

    return;
  }

  // Check if this is a new tab (id is null) or an existing tab update
  const isNewTab = !tab.id;

  if (isNewTab) {
    // Create new tab
    if (SFTabs.tabs && SFTabs.tabs.createTab) {
      SFTabs.tabs.createTab(tabData).then(() => {

        // Reload tabs from storage to ensure we have the latest data
        return loadTabsFromStorage();
      }).then(() => {
        // Explicitly re-render the tab list
        if (SFTabs.ui && SFTabs.ui.renderTabList) {
          SFTabs.ui.renderTabList();
        }

        showStatus('Tab created successfully', false);

        // Close panel and return to main content
        setTimeout(() => {
          showMainContent();
        }, 800);
      }).catch(error => {
        showStatus('Error creating tab: ' + error.message, true);
      });
    } else {
      showStatus('Error: Create function not available', true);
    }
  } else {
    // Update existing tab
    if (SFTabs.tabs && SFTabs.tabs.updateTab) {
      SFTabs.tabs.updateTab(tab.id, tabData).then(() => {

        // Clear pending dropdown items after successful save
        if (tab.pendingDropdownItems) {
          delete tab.pendingDropdownItems;
        }

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
          SFTabs.ui.renderTabList();
        }

        showStatus('Tab updated successfully', false);

        // Close panel and return to main content
        setTimeout(() => {
          showMainContent();
        }, 800);
      }).catch(error => {
        showStatus('Error updating tab: ' + error.message, true);
      });
    } else {
      showStatus('Error: Update function not available', true);
    }
  }
}

/**
 * Show status message (now uses toast notifications)
 */
function showStatus(message, isError = false) {
  showToast(message, isError);
}

/**
 * Generic modal display function
 */
function showModal(modalElement, cancelButton, confirmButton, onConfirm) {

  if (!modalElement) {
    return;
  }

  // Show the modal
  modalElement.classList.add('show');

  // Handle Cancel button
  const handleCancel = () => {
    modalElement.classList.remove('show');
    cleanup();
  };

  // Handle Confirm button
  const handleConfirm = () => {
    modalElement.classList.remove('show');
    if (typeof onConfirm === 'function') {
      onConfirm();
    }
    cleanup();
  };

  // Handle outside click
  const handleOutsideClick = (event) => {
    if (event.target === modalElement) {
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
  applyTheme,
  showMainContent,
  closeActionPanel,
  showActionPanel,
  updateActionPanelContent,
  saveActionPanelChanges,
  showStatus,
  showModal,
  loadUserSettings,
  loadTabsFromStorage,

  // Controlled state setters
  setTabs: (tabs) => {
    // If there's a current action panel tab being edited, preserve its temporary editing state
    // This is critical because cleanTabForStorage creates new tab objects, breaking references
    if (currentActionPanelTab) {
      const oldTab = currentActionPanelTab;
      const newTab = tabs.find(t => t.id === oldTab.id);
      if (newTab) {
        // Preserve temporary editing properties that haven't been saved yet
        if (oldTab.pendingDropdownItems !== undefined) {
          newTab.pendingDropdownItems = oldTab.pendingDropdownItems;
        }
        if (oldTab.stagedDropdownItems !== undefined) {
          newTab.stagedDropdownItems = oldTab.stagedDropdownItems;
        }
        if (oldTab.stagedPromotions !== undefined) {
          newTab.stagedPromotions = oldTab.stagedPromotions;
        }
        // Update the reference to point to the new tab object
        currentActionPanelTab = newTab;
      }
    }
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