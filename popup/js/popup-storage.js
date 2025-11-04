// popup/js/popup-storage.js
// Storage operations for tabs and settings

/**
 * Get tabs from browser storage
 * Reads from local storage (migration from sync is handled automatically by background script)
 */
async function getTabs() {
  try {
    // Simply read from local storage - migration is handled by background script
    const localResult = await browser.storage.local.get(['customTabs', 'extensionVersion']);

    console.log('📦 Local storage query result:', {
      hasCustomTabs: !!localResult.customTabs,
      tabCount: localResult.customTabs?.length || 0,
      extensionVersion: localResult.extensionVersion || 'none'
    });

    // Return tabs from local storage (background script ensures migration is complete)
    if (localResult.customTabs && localResult.customTabs.length > 0) {
      const customCount = localResult.customTabs.filter(t => !t.id?.startsWith('default_tab_')).length;
      console.log('✅ Found', localResult.customTabs.length, 'tabs in local storage (', customCount, 'custom)');
      return localResult.customTabs;
    }

    // No tabs found
    console.log('⚠️  No tabs found in local storage');
    return [];
  } catch (error) {
    console.error('Error getting tabs from storage:', error);
    throw error;
  }
}

/**
 * Clean temporary UI state fields from a tab before saving
 * Removes fields that should not be persisted to storage
 */
function cleanTabForStorage(tab) {
  const cleanedTab = { ...tab };

  // Remove temporary staging fields (used only during edit sessions)
  delete cleanedTab.stagedDropdownItems;
  delete cleanedTab.stagedPromotions;
  delete cleanedTab.pendingDropdownItems;

  // Remove legacy fields from old dropdown implementation
  delete cleanedTab.autoSetupDropdown;
  delete cleanedTab.children;
  delete cleanedTab.parentId;
  delete cleanedTab.isExpanded;
  delete cleanedTab.cachedNavigation;
  delete cleanedTab.navigationLastUpdated;
  delete cleanedTab.needsNavigationRefresh;

  // Clean nested dropdown items (remove _expanded UI state)
  if (cleanedTab.dropdownItems && Array.isArray(cleanedTab.dropdownItems)) {
    cleanedTab.dropdownItems = cleanedTab.dropdownItems.map(item => {
      const cleanedItem = { ...item };
      delete cleanedItem._expanded;

      // Recursively clean nested dropdown items
      if (cleanedItem.dropdownItems && Array.isArray(cleanedItem.dropdownItems)) {
        cleanedItem.dropdownItems = cleanedItem.dropdownItems.map(nestedItem => {
          const cleanedNested = { ...nestedItem };
          delete cleanedNested._expanded;
          return cleanedNested;
        });
      }

      return cleanedItem;
    });
  }

  return cleanedTab;
}

/**
 * Save tabs to browser storage
 */
async function saveTabs(tabs) {
  try {
    // Sort tabs by position before saving
    const sortedTabs = [...tabs].sort((a, b) => a.position - b.position);

    // Clean temporary fields from each tab before saving
    const cleanedTabs = sortedTabs.map(tab => cleanTabForStorage(tab));

    // Save tabs and update extension version marker
    await browser.storage.local.set({
      customTabs: cleanedTabs,
      extensionVersion: '1.4.0'
    });
    console.log('Tabs saved successfully to storage (cleaned', cleanedTabs.length, 'tabs)');

    // Update the main state with cleaned tabs
    SFTabs.main.setTabs(cleanedTabs);

    // Re-render the UI
    SFTabs.ui.renderTabList();

    // Show success message
    SFTabs.main.showStatus('Settings saved', false);

    return sortedTabs;
  } catch (error) {
    console.error('Error saving tabs to storage:', error);
    SFTabs.main.showStatus('Error saving tabs: ' + error.message, true);
    throw error;
  }
}

/**
 * Get user settings from browser storage
 */
async function getUserSettings() {
  try {
    const result = await browser.storage.local.get('userSettings');
    
    if (result.userSettings) {
      // Merge with defaults to ensure all properties exist
      return { ...SFTabs.constants.DEFAULT_SETTINGS, ...result.userSettings };
    } else {
      // Return defaults and save them
      await saveUserSettings(SFTabs.constants.DEFAULT_SETTINGS);
      return { ...SFTabs.constants.DEFAULT_SETTINGS };
    }
  } catch (error) {
    console.error('Error getting user settings from storage:', error);
    throw error;
  }
}

/**
 * Save user settings to browser storage
 */
async function saveUserSettings(settings) {
  try {
    await browser.storage.local.set({ userSettings: settings });
    console.log('User settings saved successfully to storage');
    
    // Update the main state
    SFTabs.main.setUserSettings(settings);
    
    // Apply theme changes immediately
    SFTabs.settings.applyTheme();
    
    // Show success message
    SFTabs.main.showStatus('Settings saved', false);
    
    return settings;
  } catch (error) {
    console.error('Error saving user settings to storage:', error);
    SFTabs.main.showStatus('Error saving settings: ' + error.message, true);
    throw error;
  }
}

/**
 * Clear all storage (reset to defaults)
 */
async function clearAllStorage() {
  try {
    await browser.storage.local.clear();
    console.log('All storage cleared successfully');
    
    // Reset main state
    SFTabs.main.setTabs([]);
    SFTabs.main.setUserSettings({ ...SFTabs.constants.DEFAULT_SETTINGS });
    
    return true;
  } catch (error) {
    console.error('Error clearing storage:', error);
    throw error;
  }
}

/**
 * Export configuration to JSON
 */
function exportConfiguration() {
  const tabs = SFTabs.main.getTabs();
  const settings = SFTabs.main.getUserSettings();

  // Clean temporary fields from tabs before export
  const cleanedTabs = tabs.map(tab => cleanTabForStorage(tab));

  const config = {
    customTabs: cleanedTabs,
    userSettings: settings,
    exportedAt: new Date().toISOString(),
    version: '1.4.0'
  };

  return config;
}

/**
 * Import configuration from JSON
 */
async function importConfiguration(configData) {
  try {
    // Validate configuration
    if (!configData.customTabs || !Array.isArray(configData.customTabs)) {
      throw new Error('Invalid configuration format: missing customTabs array');
    }

    console.log('📥 Importing configuration with', configData.customTabs.length, 'tabs');

    // Clear existing data
    await clearAllStorage();

    // Import tabs (saveTabs will handle migration internally)
    if (configData.customTabs.length > 0) {
      await saveTabs(configData.customTabs);
    } else {
      // Even with no tabs, mark as installed so we don't reset to defaults
      await browser.storage.local.set({ extensionVersion: '1.4.0' });
    }

    // Import settings
    if (configData.userSettings) {
      await saveUserSettings({ ...SFTabs.constants.DEFAULT_SETTINGS, ...configData.userSettings });
    }

    console.log('✅ Configuration imported successfully');
    SFTabs.main.showStatus('Configuration imported successfully. Extension will reload.', false);

    // Reload the popup to reflect changes
    setTimeout(() => {
      window.location.reload();
    }, 1500);

    return true;
  } catch (error) {
    console.error('Error importing configuration:', error);
    SFTabs.main.showStatus('Error importing configuration: ' + error.message, true);
    throw error;
  }
}

/**
 * Listen for storage changes from other parts of the extension
 */
function setupStorageListeners() {
  if (browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener((changes, area) => {
      console.log('🔔 Storage changed:', { area, changes: Object.keys(changes) });

      if (area === 'local') {
        if (changes.customTabs) {
          console.log('✅ Tabs changed in storage - updating UI', changes.customTabs);
          const newTabs = changes.customTabs.newValue || [];
          SFTabs.main.setTabs(newTabs);
          SFTabs.ui.renderTabList();
        }

        if (changes.userSettings) {
          console.log('✅ Settings changed in storage - updating UI', changes.userSettings);
          const newSettings = changes.userSettings.newValue || SFTabs.constants.DEFAULT_SETTINGS;
          SFTabs.main.setUserSettings(newSettings);
          SFTabs.settings.updateSettingsUI();
          SFTabs.settings.applyTheme();
        }
      } else {
        console.log('ℹ️ Storage change ignored - area is not local:', area);
      }
    });

    console.log('Storage change listeners setup complete');
  } else {
    console.warn('⚠️ browser.storage.onChanged not available');
  }
}

// Initialize storage listeners when this module loads
setupStorageListeners();

// Export functions for use by other modules
window.SFTabs = window.SFTabs || {};
window.SFTabs.storage = {
  getTabs,
  saveTabs,
  getUserSettings,
  saveUserSettings,
  clearAllStorage,
  exportConfiguration,
  importConfiguration,
  setupStorageListeners
};