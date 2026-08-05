// popup/js/popup-first-launch.js
// Handles first-launch experience for new users

/**
 * Check if this is a first-time installation
 * Returns true if user has never used SF Tabs before
 */
async function checkFirstLaunch() {
  try {
    // Check if firstLaunchCompleted flag exists in BOTH local and sync storage
    const localData = await browser.storage.local.get(['firstLaunchCompleted', 'extensionVersion', 'migrationCompleted']);
    const syncCompletedCheck = await browser.storage.sync.get(['firstLaunchCompleted']);

    // If firstLaunchCompleted flag is set in either storage, they've already completed first-launch
    if (localData.firstLaunchCompleted === true || syncCompletedCheck.firstLaunchCompleted === true) {
      return {
        shouldShowWizard: false,
        reason: 'completed'
      };
    }

    // Check if user is upgrading from an older version (has migrationCompleted or existing data)
    // If they are, skip first-launch wizard
    const syncData = await browser.storage.sync.get(['userSettings', 'profiles', 'customTabs']);
    const localStorageData = await browser.storage.local.get(['userSettings', 'profiles', 'customTabs']);

    // Check if this is an upgrade from an older version
    // Only consider it an upgrade if they have REAL data (profiles or tabs), not just empty settings
    // Note: extensionVersion is set during installation, NOT a reliable upgrade indicator
    const hasProfiles = (syncData.profiles && Array.isArray(syncData.profiles) && syncData.profiles.length > 0) ||
                        (localStorageData.profiles && Array.isArray(localStorageData.profiles) && localStorageData.profiles.length > 0);

    // Check BOTH local and sync storage for tabs (v1.3.0 used sync storage)
    const hasLocalTabs = localStorageData.customTabs && Array.isArray(localStorageData.customTabs) && localStorageData.customTabs.length > 0;
    const hasSyncTabs = syncData.customTabs && Array.isArray(syncData.customTabs) && syncData.customTabs.length > 0;
    const hasTabs = hasLocalTabs || hasSyncTabs;

    const hasMigration = localData.migrationCompleted;
    const hasUserSettings = (syncData.userSettings && Object.keys(syncData.userSettings).length > 0) ||
                            (localStorageData.userSettings && Object.keys(localStorageData.userSettings).length > 0);

    // Check if this is a true upgrade (has data indicating upgrade) vs sync data from another device
    // If they have tabs or profiles in either storage, it's an upgrade
    const hasSyncDataOnly = !hasMigration && !hasTabs && !localStorageData.profiles &&
                            (syncData.profiles?.length > 0 || (syncData.userSettings && !hasSyncTabs));

    if (hasSyncDataOnly) {
      // Sync data found from another device - show wizard with "use synced data" option
      return {
        shouldShowWizard: true,
        reason: 'sync-data-found',
        syncData: {
          hasProfiles: syncData.profiles && syncData.profiles.length > 0,
          profileCount: syncData.profiles?.length || 0,
          hasSettings: syncData.userSettings && Object.keys(syncData.userSettings).length > 0
        }
      };
    }

    const isUpgrade = hasMigration || hasProfiles || hasTabs;

    if (isUpgrade) {
      // This is an upgrade with local data - skip first-launch wizard
      return {
        shouldShowWizard: false,
        reason: 'upgrade'
      };
    }

    // This is a brand new installation - show first-launch modal
    return {
      shouldShowWizard: true,
      reason: 'first-install'
    };

  } catch (error) {
    // On error, assume not first launch to avoid breaking the extension
    return {
      shouldShowWizard: false,
      reason: 'error',
      error: error.message
    };
  }
}

// Export functions for use by other modules
window.SFTabs = window.SFTabs || {};
window.SFTabs.firstLaunch = {
  checkFirstLaunch,
};
