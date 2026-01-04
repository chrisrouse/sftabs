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

    // If useSyncStorage is explicitly set, use it
    if (result.userSettings && typeof result.userSettings.useSyncStorage === 'boolean') {
      return result.userSettings.useSyncStorage;
    }

    // If userSettings exists but useSyncStorage is not set, this is an existing user
    // from before v2.1 when sync was the default - preserve that behavior
    if (result.userSettings) {
      return true;
    }

    // No userSettings at all - this is a new installation, use new default (local storage)
    return false;
  } catch (error) {
    // On error, default to local storage for privacy
    return false;
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
      const tabs = await SFTabs.storageChunking.readChunkedSync('customTabs');

      if (tabs && tabs.length > 0) {
        const customCount = tabs.filter(t => !t.id?.startsWith('default_tab_')).length;
        return tabs;
      }

      return [];
    } else {
      // Read from local storage
      const localResult = await browser.storage.local.get('customTabs');

      if (localResult.customTabs && localResult.customTabs.length > 0) {
        const customCount = localResult.customTabs.filter(t => !t.id?.startsWith('default_tab_')).length;
        return localResult.customTabs;
      }

      return [];
    }
  } catch (error) {
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
  delete cleanedTab.isExpanded;
  delete cleanedTab.cachedNavigation;
  delete cleanedTab.navigationLastUpdated;
  delete cleanedTab.needsNavigationRefresh;

  // Note: parentId is intentionally NOT removed - it's needed for nested tabs functionality

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
 * Always saves to profile-specific storage (profiles used internally even if UI disabled)
 * Saves to sync (with chunking) or local storage based on user preference
 */
async function saveTabs(tabs) {
  try {
    // Sort tabs by position before saving
    const sortedTabs = [...tabs].sort((a, b) => a.position - b.position);

    // Clean temporary fields from each tab before saving
    const cleanedTabs = sortedTabs.map(tab => cleanTabForStorage(tab));

    // Get settings for active profile ID
    const settings = await getUserSettings();

    if (!settings.activeProfileId) {
      throw new Error('No active profile ID found');
    }

    // Always save to profile-specific storage
    await saveProfileTabs(settings.activeProfileId, cleanedTabs);

    // Update the main state with cleaned tabs (only in popup context)
    if (SFTabs.main && SFTabs.main.setTabs) {
      SFTabs.main.setTabs(cleanedTabs);
    }

    // Re-render the UI (only in popup context)
    if (SFTabs.ui && SFTabs.ui.renderTabList) {
      SFTabs.ui.renderTabList();
    }

    // Show success message (only in popup context)
    if (SFTabs.main && SFTabs.main.showStatus) {
      SFTabs.main.showStatus('Settings saved', false);
    }

    return sortedTabs;
  } catch (error) {
    // Show error message (only in popup context)
    if (SFTabs.main && SFTabs.main.showStatus) {
      SFTabs.main.showStatus('Error saving tabs: ' + error.message, true);
    }
    throw error;
  }
}

/**
 * Get user settings from browser storage
 * Settings are stored based on useSyncStorage preference (local by default)
 */
async function getUserSettings() {
  try {
    // Check local storage first (new default since v2.1)
    const localResult = await browser.storage.local.get('userSettings');

    if (localResult.userSettings) {
      // Found in local storage - merge with defaults
      const mergedSettings = { ...SFTabs.constants.DEFAULT_SETTINGS, ...localResult.userSettings };
      return mergedSettings;
    }

    // Not in local storage - check sync storage for backward compatibility
    const syncResult = await browser.storage.sync.get('userSettings');

    if (syncResult.userSettings) {
      // Found in sync storage (existing user from before v2.1)
      const mergedSettings = { ...SFTabs.constants.DEFAULT_SETTINGS, ...syncResult.userSettings };

      // If useSyncStorage is not explicitly set, this is an existing user from before v2.1
      // when sync was the default - preserve that behavior
      if (typeof syncResult.userSettings.useSyncStorage !== 'boolean') {
        mergedSettings.useSyncStorage = true;
      }

      return mergedSettings;
    }

    // New installation - return defaults (don't save yet, let first-launch handle it)
    return { ...SFTabs.constants.DEFAULT_SETTINGS };

  } catch (error) {
    throw error;
  }
}

/**
 * Save user settings to browser storage
 * Settings are stored based on useSyncStorage preference (local by default)
 */
async function saveUserSettings(settings, skipMigration = false, showToast = true) {
  try {
    // Check if useSyncStorage preference changed and migration is needed
    if (!skipMigration && SFTabs.main && SFTabs.main.getUserSettings) {
      const currentSettings = SFTabs.main.getUserSettings();
      if (currentSettings.useSyncStorage !== settings.useSyncStorage) {
        // Storage preference changed - migrate tabs
        await migrateBetweenStorageTypes(currentSettings.useSyncStorage, settings.useSyncStorage);
      }
    }

    // Save settings to the appropriate storage based on user preference
    if (settings.useSyncStorage) {
      // Save to sync storage
      await browser.storage.sync.set({ userSettings: settings });
      // Also cache in local storage for quick access
      await browser.storage.local.set({ userSettings: settings });
    } else {
      // Save to local storage only
      await browser.storage.local.set({ userSettings: settings });
      // Remove from sync storage if it exists there
      try {
        await browser.storage.sync.remove('userSettings');
      } catch (e) {
        // Ignore errors removing from sync (might not exist)
      }
    }

    // Update the main state (only in popup context)
    if (SFTabs.main && SFTabs.main.setUserSettings) {
      SFTabs.main.setUserSettings(settings);
    }

    // Apply theme changes immediately
    if (SFTabs.main && SFTabs.main.applyTheme) {
      SFTabs.main.applyTheme();
    }

    // Show success message (only in popup context and if requested)
    if (showToast && SFTabs.main && SFTabs.main.showStatus) {
      SFTabs.main.showStatus('Settings saved', false);
    }

    return settings;
  } catch (error) {
    // Show error message (only in popup context)
    if (SFTabs.main && SFTabs.main.showStatus) {
      SFTabs.main.showStatus('Error saving settings: ' + error.message, true);
    }
    throw error;
  }
}

/**
 * Clear all storage (reset to defaults)
 */
async function clearAllStorage() {
  try {
    await browser.storage.local.clear();

    // Reset main state (only in popup context)
    if (SFTabs.main && SFTabs.main.setTabs) {
      SFTabs.main.setTabs([]);
    }
    if (SFTabs.main && SFTabs.main.setUserSettings) {
      SFTabs.main.setUserSettings({ ...SFTabs.constants.DEFAULT_SETTINGS });
    }

    return true;
  } catch (error) {
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
    version: '2.0.0'
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


    // Clear existing data
    await clearAllStorage();

    // Import tabs (saveTabs will handle routing to correct storage)
    if (configData.customTabs.length > 0) {
      await saveTabs(configData.customTabs);
    } else {
      // Even with no tabs, mark as installed so we don't reset to defaults
      const useSyncStorage = await getStoragePreference();
      if (!useSyncStorage) {
        await browser.storage.local.set({ extensionVersion: '2.0.0' });
      }
    }

    // Import settings (suppress toast since import shows its own success message)
    if (configData.userSettings) {
      await saveUserSettings({ ...SFTabs.constants.DEFAULT_SETTINGS, ...configData.userSettings }, false, false);
    }

    // Show success message (only in popup context)
    if (SFTabs.main && SFTabs.main.showStatus) {
      SFTabs.main.showStatus('Configuration imported successfully. Extension will reload.', false);
    }

    // Reload the popup to reflect changes
    setTimeout(() => {
      window.location.reload();
    }, 1500);

    return true;
  } catch (error) {
    // Show error message (only in popup context)
    if (SFTabs.main && SFTabs.main.showStatus) {
      SFTabs.main.showStatus('Error importing configuration: ' + error.message, true);
    }
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


    if (tabs.length === 0) {
      return;
    }

    // Save tabs to destination storage
    if (toSync) {
      // Save to sync storage with chunking
      await SFTabs.storageChunking.saveChunkedSync('customTabs', tabs);

      // Clear old local storage
      await browser.storage.local.remove(['customTabs', 'extensionVersion']);
    } else {
      // Save to local storage
      await browser.storage.local.set({
        customTabs: tabs,
        extensionVersion: '2.0.0'
      });

      // Clear old sync storage
      await SFTabs.storageChunking.clearChunkedSync('customTabs');
    }

  } catch (error) {
    throw new Error(`Failed to migrate tabs: ${error.message}`);
  }
}

/**
 * Listen for storage changes from other parts of the extension
 */
function setupStorageListeners() {
  if (browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener((changes, area) => {

      if (area === 'local') {
        if (changes.customTabs) {
          const newTabs = changes.customTabs.newValue || [];
          // Only update popup UI if we're in the popup context
          if (SFTabs.main && SFTabs.main.setTabs) {
            SFTabs.main.setTabs(newTabs);
          }
          if (SFTabs.ui && SFTabs.ui.renderTabList) {
            SFTabs.ui.renderTabList();
          }
        }
      } else if (area === 'sync') {
        // Handle sync storage changes
        if (changes.userSettings) {
          const newSettings = changes.userSettings.newValue;

          // If sync storage is being removed (newValue is undefined), don't overwrite local storage
          // This happens when user switches from Sync to Local storage mode
          if (!newSettings) {
            console.log('[Storage] Sync storage removed, skipping local cache update');
            return;
          }

          // Update local cache to keep it in sync (only if we're using sync storage)
          // Use promise chain instead of await since we can't make this callback async
          browser.storage.local.get('userSettings').then(currentSettings => {
            if (currentSettings.userSettings && currentSettings.userSettings.useSyncStorage === false) {
              console.log('[Storage] Using local storage mode, skipping sync-triggered update');
              return;
            }

            browser.storage.local.set({ userSettings: newSettings }).catch(err => {
              console.error('[Storage] Failed to update local cache:', err);
            });

            // Only update popup UI if we're in the popup context
            if (SFTabs.main && SFTabs.main.setUserSettings) {
              SFTabs.main.setUserSettings(newSettings);
            }
            if (SFTabs.main && SFTabs.main.applyTheme) {
              SFTabs.main.applyTheme();
            }
          }).catch(err => {
            console.error('[Storage] Error checking storage mode:', err);
          });
        }

        // Handle chunked tabs changes (check for metadata changes)
        if (changes.customTabs_metadata || changes.customTabs) {
          // Re-read tabs from sync storage
          SFTabs.storageChunking.readChunkedSync('customTabs').then(tabs => {
            if (tabs) {
              // Only update popup UI if we're in the popup context
              if (SFTabs.main && SFTabs.main.setTabs) {
                SFTabs.main.setTabs(tabs);
              }
              if (SFTabs.ui && SFTabs.ui.renderTabList) {
                SFTabs.ui.renderTabList();
              }
            }
          }).catch(err => {
          });
        }
      }
    });

  } else {
  }
}

/**
 * Get profiles from browser storage
 * Reads from sync (with chunking) or local storage based on user preference
 * @returns {Promise<Array>} Array of profile objects
 */
async function getProfiles() {
  try {
    const useSyncStorage = await getStoragePreference();

    if (useSyncStorage) {
      // Read from sync storage with chunking support
      const profiles = await SFTabs.storageChunking.readChunkedSync('profiles');

      if (profiles && profiles.length > 0) {
        return profiles;
      }

      return [];
    } else {
      // Read from local storage
      const localResult = await browser.storage.local.get('profiles');

      if (localResult.profiles && localResult.profiles.length > 0) {
        return localResult.profiles;
      }

      return [];
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Save profiles to browser storage
 * Saves to sync (with chunking) or local storage based on user preference
 * @param {Array} profiles - Array of profile objects
 * @returns {Promise<Array>} The saved profiles
 */
async function saveProfiles(profiles, showToast = true) {
  try {
    // Sort profiles by creation date
    const sortedProfiles = [...profiles].sort((a, b) =>
      new Date(a.createdAt) - new Date(b.createdAt)
    );

    const useSyncStorage = await getStoragePreference();

    if (useSyncStorage) {
      // Save to sync storage with chunking support
      await SFTabs.storageChunking.saveChunkedSync('profiles', sortedProfiles);
    } else {
      // Save to local storage
      await browser.storage.local.set({
        profiles: sortedProfiles
      });
    }

    // Show success message (only in popup context and if requested)
    if (showToast && SFTabs.main && SFTabs.main.showStatus) {
      SFTabs.main.showStatus('Profiles saved', false);
    }

    return sortedProfiles;
  } catch (error) {
    // Show error message (only in popup context)
    if (SFTabs.main && SFTabs.main.showStatus) {
      SFTabs.main.showStatus('Error saving profiles: ' + error.message, true);
    }
    throw error;
  }
}

/**
 * Get tabs for a specific profile
 * @param {string} profileId - The profile ID
 * @returns {Promise<Array>} Array of tab objects for this profile
 */
async function getProfileTabs(profileId) {
  try {
    const useSyncStorage = await getStoragePreference();
    const storageKey = `profile_${profileId}_tabs`;

    if (useSyncStorage) {
      const tabs = await SFTabs.storageChunking.readChunkedSync(storageKey);
      return tabs || [];
    } else {
      const localResult = await browser.storage.local.get(storageKey);
      return localResult[storageKey] || [];
    }
  } catch (error) {
    console.error('[Storage] getProfileTabs - error:', error);
    throw error;
  }
}

/**
 * Save tabs for a specific profile
 * @param {string} profileId - The profile ID
 * @param {Array} tabs - Array of tab objects
 * @returns {Promise<Array>} The saved tabs
 */
async function saveProfileTabs(profileId, tabs) {
  try {
    // Sort tabs by position before saving
    const sortedTabs = [...tabs].sort((a, b) => a.position - b.position);

    // Clean temporary fields from each tab before saving
    const cleanedTabs = sortedTabs.map(tab => cleanTabForStorage(tab));

    const useSyncStorage = await getStoragePreference();
    const storageKey = `profile_${profileId}_tabs`;

    if (useSyncStorage) {
      await SFTabs.storageChunking.saveChunkedSync(storageKey, cleanedTabs);
    } else {
      const storageObj = {};
      storageObj[storageKey] = cleanedTabs;
      await browser.storage.local.set(storageObj);
    }

    return cleanedTabs;
  } catch (error) {
    throw error;
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
  setupStorageListeners,
  // Profile storage functions
  getProfiles,
  saveProfiles,
  getProfileTabs,
  saveProfileTabs
};