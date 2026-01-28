// popup/js/popup-storage.js
// Storage operations for tabs and settings

/**
 * Get storage preference from device-specific settings
 * @returns {Promise<boolean>} true for sync storage, false for local
 */
async function getStoragePreference() {
  try {
    // Check local storage for device-specific setting
    const localResult = await browser.storage.local.get(['deviceSettings', 'userSettings']);

    // Priority 1: Check new deviceSettings location
    if (localResult.deviceSettings && typeof localResult.deviceSettings.useSyncStorage === 'boolean') {
      return localResult.deviceSettings.useSyncStorage;
    }

    // Priority 2: Backward compatibility - check old location
    if (localResult.userSettings && typeof localResult.userSettings.useSyncStorage === 'boolean') {
      return localResult.userSettings.useSyncStorage;
    }

    // Priority 3: Default to sync storage (new default)
    return true;

  } catch (error) {
    // On error, default to sync storage
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
 * Merges device-specific settings (from local) with synced settings (from sync)
 */
async function getUserSettings() {
  try {
    // Read device-specific settings from local storage
    const localResult = await browser.storage.local.get(['deviceSettings', 'userSettings']);

    // Read synced settings from sync storage
    const syncResult = await browser.storage.sync.get('userSettings');

    // Get device-specific useSyncStorage preference (defaults to true)
    let useSyncStorage = true; // New default

    if (localResult.deviceSettings && typeof localResult.deviceSettings.useSyncStorage === 'boolean') {
      // Found device-specific setting
      useSyncStorage = localResult.deviceSettings.useSyncStorage;
    } else if (localResult.userSettings && typeof localResult.userSettings.useSyncStorage === 'boolean') {
      // Backward compatibility - useSyncStorage was in userSettings before
      useSyncStorage = localResult.userSettings.useSyncStorage;
    }

    // Merge synced settings with defaults
    const syncedSettings = syncResult.userSettings || {};
    const mergedSettings = {
      ...SFTabs.constants.DEFAULT_SETTINGS,
      ...syncedSettings,
      useSyncStorage // Override with device-specific value
    };

    return mergedSettings;

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

    // Split settings into device-specific and synced
    const { useSyncStorage, ...syncedSettings } = settings;

    // Save device-specific setting (useSyncStorage) to local storage only
    await browser.storage.local.set({
      deviceSettings: { useSyncStorage }
    });

    // Save all other settings to sync storage (cross-device)
    await browser.storage.sync.set({ userSettings: syncedSettings });

    // Cache the full merged settings in local for quick access
    await browser.storage.local.set({
      userSettings: settings  // Full settings including useSyncStorage
    });

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
 * Migrate tabs and profiles between storage types when user changes preference
 * Note: userSettings always stay in sync storage regardless of preference
 * @param {boolean} fromSync - true if migrating from sync, false if from local
 * @param {boolean} toSync - true if migrating to sync, false if to local
 */
async function migrateBetweenStorageTypes(fromSync, toSync) {
  try {
    // Get profiles list
    const profiles = await getProfiles();

    if (!profiles || profiles.length === 0) {
      return; // Nothing to migrate
    }

    // Determine source and destination storage
    const sourceStorage = fromSync ? browser.storage.sync : browser.storage.local;
    const destStorage = toSync ? browser.storage.sync : browser.storage.local;

    // Migrate each profile's tabs
    for (const profile of profiles) {
      const tabsKey = `profile_${profile.id}_tabs`;

      // Read from source
      let tabs;
      if (fromSync) {
        tabs = await SFTabs.storageChunking.readChunkedSync(tabsKey);
      } else {
        const result = await sourceStorage.get(tabsKey);
        tabs = result[tabsKey] || [];
      }

      // Save to destination
      if (tabs && tabs.length > 0) {
        if (toSync) {
          await SFTabs.storageChunking.saveChunkedSync(tabsKey, tabs);
        } else {
          await destStorage.set({ [tabsKey]: tabs });
        }

        // Remove from source
        if (fromSync) {
          await SFTabs.storageChunking.clearChunkedSync(tabsKey);
        } else {
          await sourceStorage.remove([tabsKey]);
        }
      }
    }

    // Migrate profiles list
    if (toSync) {
      await browser.storage.sync.set({ profiles });
      await browser.storage.local.remove(['profiles']);
    } else {
      await browser.storage.local.set({ profiles });
      // Note: Don't remove profiles from sync - keep for potential future migration
    }

    // NOTE: userSettings are NOT migrated because they always stay in sync storage
    // regardless of the useSyncStorage preference

  } catch (error) {
    throw new Error(`Failed to migrate data: ${error.message}`);
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
            return;
          }

          // Update local cache to keep it in sync (only if we're using sync storage)
          // Use promise chain instead of await since we can't make this callback async
          browser.storage.local.get('userSettings').then(currentSettings => {
            if (currentSettings.userSettings && currentSettings.userSettings.useSyncStorage === false) {
              return;
            }

            browser.storage.local.set({ userSettings: newSettings }).catch(err => {
              // Silently fail - local cache sync is not critical
            });

            // Only update popup UI if we're in the popup context
            if (SFTabs.main && SFTabs.main.setUserSettings) {
              SFTabs.main.setUserSettings(newSettings);
            }
            if (SFTabs.main && SFTabs.main.applyTheme) {
              SFTabs.main.applyTheme();
            }
          }).catch(err => {
            // Silently fail - storage mode check is not critical
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