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

    // getUserSettings already resolved the storage preference and returns it,
    // so hand it on rather than making saveProfileTabs read it again.
    await saveProfileTabs(settings.activeProfileId, cleanedTabs, settings.useSyncStorage);

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

    // Merge one level deep, not with a spread. A spread replaces a whole
    // nested object, so settings stored by an older build — say a
    // floatingButton written before `side`, `offset` and `location` existed —
    // came back missing those keys entirely rather than picking up their
    // defaults. Every nested default added since is invisible to existing
    // users under a spread.
    const syncedSettings = syncResult.userSettings || {};
    const mergedSettings = {
      ...SFTabs.utils.mergeUserSettings(SFTabs.constants.DEFAULT_SETTINGS, syncedSettings),
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
    // Split settings into device-specific and synced
    const { useSyncStorage, ...syncedSettings } = settings;

    // Write the new preference and local cache BEFORE migrating so that content
    // scripts reading storage during migration see the correct preference and do
    // not destructively clear the destination storage.
    await browser.storage.local.set({
      deviceSettings: { useSyncStorage },
      userSettings: settings  // Full settings including useSyncStorage
    });

    // Check if useSyncStorage preference changed and migration is needed
    if (!skipMigration && SFTabs.main && SFTabs.main.getUserSettings) {
      const currentSettings = SFTabs.main.getUserSettings();
      if (currentSettings.useSyncStorage !== settings.useSyncStorage) {
        // Storage preference changed - migrate tabs
        await migrateBetweenStorageTypes(currentSettings.useSyncStorage, settings.useSyncStorage);
      }
    }

    // Save all other settings to sync storage (cross-device)
    await browser.storage.sync.set({ userSettings: syncedSettings });

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
    // Fill in any missing `position` before ordering, walking the array and
    // handing out the next number above the highest seen so far. That keeps the
    // incoming order exactly as given while making the data fully positioned,
    // which is the point: a set where some profiles carry a position and others
    // do not cannot be ordered coherently.
    //
    // Sorting the gaps to Infinity instead — the previous approach — looked
    // right because untouched data all tied and fell back to creation order.
    // But Infinity also means last, so a single newly created profile with a
    // real position sorted ahead of every profile that predated the field, and
    // new profiles surfaced at the top of the list instead of the bottom.
    let nextPosition = 0;
    const positioned = profiles.map(profile => {
      const position = Number.isFinite(profile.position) ? profile.position : nextPosition;
      nextPosition = Math.max(nextPosition, position) + 1;
      return profile.position === position ? profile : { ...profile, position };
    });

    const sortedProfiles = positioned.sort((a, b) =>
      a.position - b.position ||
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
/**
 * @param {boolean} [preferSync] the caller's already-resolved storage
 *   preference. Passed rather than cached: a cache would need invalidating at
 *   exactly the moment migrateBetweenStorageTypes depends on this still holding
 *   the old value, and getting that wrong makes a user's whole configuration
 *   look like it vanished. A parameter cannot go stale.
 */
async function saveProfileTabs(profileId, tabs, preferSync) {
  try {
    // Sort tabs by position before saving
    const sortedTabs = [...tabs].sort((a, b) => a.position - b.position);

    // Clean temporary fields from each tab before saving
    const cleanedTabs = sortedTabs.map(tab => cleanTabForStorage(tab));

    const useSyncStorage = typeof preferSync === 'boolean'
      ? preferSync
      : await getStoragePreference();
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
/**
 * Put the extension back to a fresh install.
 *
 * Both areas are cleared outright rather than rewritten with defaults, because
 * the defaults ARE what empty storage produces — every reader in the codebase
 * falls back to DEFAULT_SETTINGS or DEFAULT_TABS when its key is absent. The
 * previous implementation wrote DEFAULT_TABS to a `tabs` key that nothing
 * reads, touched only sync, and left the local mirror behind.
 *
 * Clearing sync propagates: this wipes the synced copy for every device signed
 * into the same browser profile, not just this one. The confirmation has to say
 * so, because nothing here can undo it.
 */
async function resetEverything() {
  await browser.storage.local.clear();
  try {
    await browser.storage.sync.clear();
  } catch (error) {
    // A browser with sync disabled still has a working local area; a failure
    // here should not leave the reset half-done and silent
    console.warn('[SF Tabs] sync storage could not be cleared:', error.message);
  }
  return true;
}

window.SFTabs.storage = {
  getStoragePreference,
  saveTabs,
  getUserSettings,
  saveUserSettings,
  resetEverything,
  migrateBetweenStorageTypes,
  setupStorageListeners,
  // Profile storage functions
  getProfiles,
  saveProfiles,
  getProfileTabs,
  saveProfileTabs
};