// popup/js/popup-storage.js
// Storage operations for tabs and settings

/**
 * Get storage preference from user settings
 * @returns {Promise<boolean>} true for sync storage, false for local
 */
async function getStoragePreference() {
  try {
    // Settings are always in sync storage (they're small)
    const result = await browser.storage.sync.get('userSettings');
    if (result.userSettings && typeof result.userSettings.useSyncStorage === 'boolean') {
      return result.userSettings.useSyncStorage;
    }
    // Default to sync storage
    return true;
  } catch (error) {
    console.warn('⚠️ Could not read storage preference, defaulting to sync:', error);
    return true;
  }
}

/**
 * Get tabs from browser storage
 * Reads from sync (with chunking) or local storage based on user preference
 */
async function getTabs() {
  try {
    const useSyncStorage = await getStoragePreference();

    if (useSyncStorage) {
      // Read from sync storage with chunking support
      console.log('📦 Reading tabs from sync storage (with chunking)');
      const tabs = await SFTabs.storageChunking.readChunkedSync('customTabs');

      if (tabs && tabs.length > 0) {
        const customCount = tabs.filter(t => !t.id?.startsWith('default_tab_')).length;
        console.log('✅ Found', tabs.length, 'tabs in sync storage (', customCount, 'custom)');
        return tabs;
      }

      console.log('⚠️ No tabs found in sync storage');
      return [];
    } else {
      // Read from local storage
      console.log('📦 Reading tabs from local storage');
      const localResult = await browser.storage.local.get('customTabs');

      if (localResult.customTabs && localResult.customTabs.length > 0) {
        const customCount = localResult.customTabs.filter(t => !t.id?.startsWith('default_tab_')).length;
        console.log('✅ Found', localResult.customTabs.length, 'tabs in local storage (', customCount, 'custom)');
        return localResult.customTabs;
      }

      console.log('⚠️ No tabs found in local storage');
      return [];
    }
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
 * Saves to sync (with chunking) or local storage based on user preference
 */
async function saveTabs(tabs) {
  try {
    // Sort tabs by position before saving
    const sortedTabs = [...tabs].sort((a, b) => a.position - b.position);

    // Clean temporary fields from each tab before saving
    const cleanedTabs = sortedTabs.map(tab => cleanTabForStorage(tab));

    const useSyncStorage = await getStoragePreference();

    if (useSyncStorage) {
      // Save to sync storage with chunking support
      console.log('💾 Saving tabs to sync storage (with chunking)');
      await SFTabs.storageChunking.saveChunkedSync('customTabs', cleanedTabs);
      console.log('✅ Tabs saved successfully to sync storage (cleaned', cleanedTabs.length, 'tabs)');
    } else {
      // Save to local storage
      console.log('💾 Saving tabs to local storage');
      await browser.storage.local.set({
        customTabs: cleanedTabs,
        extensionVersion: '1.5.0'
      });
      console.log('✅ Tabs saved successfully to local storage (cleaned', cleanedTabs.length, 'tabs)');
    }

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
 * Settings are always stored in sync storage (they're small and benefit from cross-device sync)
 */
async function getUserSettings() {
  try {
    // Settings are always in sync storage (small, no chunking needed)
    const result = await browser.storage.sync.get('userSettings');

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
 * Settings are always stored in sync storage (they're small and benefit from cross-device sync)
 */
async function saveUserSettings(settings, skipMigration = false) {
  try {
    // Check if useSyncStorage preference changed and migration is needed
    if (!skipMigration && SFTabs.main && SFTabs.main.getUserSettings) {
      const currentSettings = SFTabs.main.getUserSettings();
      if (currentSettings.useSyncStorage !== settings.useSyncStorage) {
        // Storage preference changed - migrate tabs
        console.log('🔄 Storage preference changed, migrating tabs...');
        await migrateBetweenStorageTypes(currentSettings.useSyncStorage, settings.useSyncStorage);
      }
    }

    // Settings are always in sync storage (small, no chunking needed)
    await browser.storage.sync.set({ userSettings: settings });
    console.log('✅ User settings saved successfully to sync storage');

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
    version: '1.5.0'
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

    // Import tabs (saveTabs will handle routing to correct storage)
    if (configData.customTabs.length > 0) {
      await saveTabs(configData.customTabs);
    } else {
      // Even with no tabs, mark as installed so we don't reset to defaults
      const useSyncStorage = await getStoragePreference();
      if (!useSyncStorage) {
        await browser.storage.local.set({ extensionVersion: '1.5.0' });
      }
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
 * Migrate tabs between storage types when user changes preference
 * @param {boolean} fromSync - true if migrating from sync, false if from local
 * @param {boolean} toSync - true if migrating to sync, false if to local
 */
async function migrateBetweenStorageTypes(fromSync, toSync) {
  try {
    console.log(`🔄 Starting migration: ${fromSync ? 'sync' : 'local'} → ${toSync ? 'sync' : 'local'}`);

    // Read tabs from source storage
    let tabs = [];
    if (fromSync) {
      // Read from sync storage
      tabs = await SFTabs.storageChunking.readChunkedSync('customTabs');
    } else {
      // Read from local storage
      const localResult = await browser.storage.local.get('customTabs');
      tabs = localResult.customTabs || [];
    }

    console.log(`📦 Found ${tabs.length} tabs to migrate`);

    if (tabs.length === 0) {
      console.log('ℹ️ No tabs to migrate');
      return;
    }

    // Save tabs to destination storage
    if (toSync) {
      // Save to sync storage with chunking
      await SFTabs.storageChunking.saveChunkedSync('customTabs', tabs);
      console.log('✅ Tabs migrated to sync storage');

      // Clear old local storage
      await browser.storage.local.remove(['customTabs', 'extensionVersion']);
      console.log('🗑️ Cleared old local storage');
    } else {
      // Save to local storage
      await browser.storage.local.set({
        customTabs: tabs,
        extensionVersion: '1.5.0'
      });
      console.log('✅ Tabs migrated to local storage');

      // Clear old sync storage
      await SFTabs.storageChunking.clearChunkedSync('customTabs');
      console.log('🗑️ Cleared old sync storage');
    }

    console.log('✅ Migration complete');
  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw new Error(`Failed to migrate tabs: ${error.message}`);
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
          console.log('✅ Tabs changed in local storage - updating UI');
          const newTabs = changes.customTabs.newValue || [];
          SFTabs.main.setTabs(newTabs);
          SFTabs.ui.renderTabList();
        }
      } else if (area === 'sync') {
        // Handle sync storage changes
        if (changes.userSettings) {
          console.log('✅ Settings changed in sync storage - updating UI');
          const newSettings = changes.userSettings.newValue || SFTabs.constants.DEFAULT_SETTINGS;
          SFTabs.main.setUserSettings(newSettings);
          SFTabs.settings.updateSettingsUI();
          SFTabs.settings.applyTheme();
        }

        // Handle chunked tabs changes (check for metadata changes)
        if (changes.customTabs_metadata || changes.customTabs) {
          console.log('✅ Tabs changed in sync storage - updating UI');
          // Re-read tabs from sync storage
          SFTabs.storageChunking.readChunkedSync('customTabs').then(tabs => {
            if (tabs) {
              SFTabs.main.setTabs(tabs);
              SFTabs.ui.renderTabList();
            }
          }).catch(err => {
            console.error('Error re-reading tabs after sync change:', err);
          });
        }
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
  getStoragePreference,
  getTabs,
  saveTabs,
  getUserSettings,
  saveUserSettings,
  clearAllStorage,
  exportConfiguration,
  importConfiguration,
  migrateBetweenStorageTypes,
  setupStorageListeners
};