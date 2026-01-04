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
    const syncData = await browser.storage.sync.get(['userSettings', 'profiles']);
    const localStorageData = await browser.storage.local.get(['userSettings', 'profiles', 'customTabs']);

    // Check if this is an upgrade from an older version
    // Only consider it an upgrade if they have REAL data (profiles or tabs), not just empty settings
    // Note: extensionVersion is set during installation, NOT a reliable upgrade indicator
    const hasProfiles = (syncData.profiles && Array.isArray(syncData.profiles) && syncData.profiles.length > 0) ||
                        (localStorageData.profiles && Array.isArray(localStorageData.profiles) && localStorageData.profiles.length > 0);
    const hasTabs = localStorageData.customTabs && Array.isArray(localStorageData.customTabs) && localStorageData.customTabs.length > 0;
    const hasMigration = localData.migrationCompleted;
    const hasUserSettings = (syncData.userSettings && Object.keys(syncData.userSettings).length > 0) ||
                            (localStorageData.userSettings && Object.keys(localStorageData.userSettings).length > 0);

    // Check if this is a true upgrade (has local data/migration flag) vs sync data from another device
    const hasSyncDataOnly = !hasMigration && !hasTabs && !localStorageData.profiles &&
                            (syncData.profiles?.length > 0 || syncData.userSettings);

    // Debug logging
    console.log('[First Launch] Detection check:', {
      hasMigration,
      hasTabs,
      hasLocalProfiles: !!localStorageData.profiles,
      hasSyncProfiles: syncData.profiles?.length > 0,
      hasSyncSettings: !!syncData.userSettings,
      hasSyncDataOnly
    });

    if (hasSyncDataOnly) {
      // Sync data found from another device - show wizard with "use synced data" option
      console.log('[First Launch] Sync data detected from another device');
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
    console.error('Error checking first launch status:', error);
    // On error, assume not first launch to avoid breaking the extension
    return {
      shouldShowWizard: false,
      reason: 'error',
      error: error.message
    };
  }
}

/**
 * Show sync data detected screen
 * @param {Object} syncData - Information about synced data
 */
async function showSyncDataDetectedScreen(syncData) {
  const modal = document.getElementById('first-launch-modal');
  if (!modal) {
    console.error('First launch modal not found');
    return;
  }

  // Update modal content to show sync data detected message
  const contentArea = modal.querySelector('.first-launch-content');
  if (!contentArea) return;

  const profileText = syncData.profileCount > 0
    ? `${syncData.profileCount} profile${syncData.profileCount !== 1 ? 's' : ''} with tabs`
    : 'settings';

  contentArea.innerHTML = `
    <div style="text-align: center; padding: 20px;">
      <div style="font-size: 48px; margin-bottom: 16px;">☁️</div>
      <h2 style="font-size: 28px; font-weight: 600; margin: 0 0 12px 0; color: var(--color-text);">
        Synced Configuration Found
      </h2>
      <p style="font-size: 16px; color: var(--color-text-weak); margin: 0 0 32px 0; line-height: 1.5;">
        We found existing SF Tabs data in your browser sync${syncData.profileCount > 0 ? ` (${profileText})` : ''}.
        <br>Would you like to use it or start fresh?
      </p>

      <div style="display: flex; flex-direction: column; gap: 12px; max-width: 500px; margin: 0 auto;">
        <button id="use-synced-data-button" class="primary-button" style="width: 100%; padding: 16px; font-size: 16px;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span>✓</span>
            <span>Use Synced Configuration (Recommended)</span>
          </div>
        </button>
        <button id="start-fresh-button" class="secondary-button" style="width: 100%; padding: 16px; font-size: 16px;">
          Start Fresh with New Setup
        </button>
      </div>
    </div>
  `;

  // Setup event listeners
  const useSyncedButton = document.getElementById('use-synced-data-button');
  const startFreshButton = document.getElementById('start-fresh-button');

  if (useSyncedButton) {
    useSyncedButton.addEventListener('click', async () => {
      await useSyncedConfiguration();
    });
  }

  if (startFreshButton) {
    startFreshButton.addEventListener('click', async () => {
      // Clear sync data and show normal wizard
      await clearSyncDataAndShowWizard();
    });
  }

  // Show the modal
  modal.classList.add('show');
  modal.style.display = 'flex';
}

/**
 * Use synced configuration from browser sync
 */
async function useSyncedConfiguration() {
  try {
    // Get all sync data
    const syncData = await browser.storage.sync.get(null);

    // Copy sync data to local storage for caching
    if (syncData.userSettings) {
      await browser.storage.local.set({ userSettings: syncData.userSettings });
    }
    if (syncData.profiles) {
      await browser.storage.local.set({ profiles: syncData.profiles });
    }

    // Copy profile tabs
    const profileKeys = Object.keys(syncData).filter(key =>
      key.startsWith('profile_') && key.endsWith('_tabs')
    );
    if (profileKeys.length > 0) {
      const profileTabsData = {};
      profileKeys.forEach(key => {
        profileTabsData[key] = syncData[key];
      });
      await browser.storage.local.set(profileTabsData);
    }

    // Mark first launch as completed
    await browser.storage.local.set({ firstLaunchCompleted: true });
    await browser.storage.sync.set({ firstLaunchCompleted: true });

    // Hide modal and reload
    hideFirstLaunchModal();
    window.location.reload();

  } catch (error) {
    console.error('Error using synced configuration:', error);
    if (SFTabs.main && SFTabs.main.showStatus) {
      SFTabs.main.showStatus('Error loading synced data: ' + error.message, true);
    }
  }
}

/**
 * Clear sync data and show the normal first-launch wizard
 */
async function clearSyncDataAndShowWizard() {
  try {
    // Clear ALL sync storage data (user wants to start fresh)
    const syncData = await browser.storage.sync.get(null);
    const keysToRemove = Object.keys(syncData);
    if (keysToRemove.length > 0) {
      await browser.storage.sync.remove(keysToRemove);
    }

    // Hide modal temporarily
    hideFirstLaunchModal();

    // Re-initialize with normal first-launch wizard
    await initFirstLaunchModal(null);
    showFirstLaunchModal();

  } catch (error) {
    console.error('Error clearing sync data:', error);
    if (SFTabs.main && SFTabs.main.showStatus) {
      SFTabs.main.showStatus('Error clearing sync data: ' + error.message, true);
    }
  }
}

/**
 * Show the first-launch modal
 */
async function showFirstLaunchModal() {
  const modal = document.getElementById('first-launch-modal');
  if (!modal) {
    console.error('First launch modal not found');
    return;
  }

  // Show the modal
  modal.classList.add('show');
  modal.style.display = 'flex';
}

/**
 * Hide the first-launch modal
 */
function hideFirstLaunchModal() {
  const modal = document.getElementById('first-launch-modal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
}

/**
 * Initialize first-launch modal event listeners
 * @param {Object} firstLaunchStatus - Status from checkFirstLaunch()
 */
async function initFirstLaunchModal(firstLaunchStatus) {
  // Check if sync data was found
  if (firstLaunchStatus && firstLaunchStatus.reason === 'sync-data-found') {
    await showSyncDataDetectedScreen(firstLaunchStatus.syncData);
    return;
  }
  // Setup option selection
  const setupOptions = document.querySelectorAll('.setup-option');
  setupOptions.forEach(option => {
    option.addEventListener('click', () => {
      // Remove active class from all options
      setupOptions.forEach(opt => opt.classList.remove('active'));
      // Add active class to clicked option
      option.classList.add('active');
    });
  });

  // Profiles option toggle
  const profilesOption = document.getElementById('profiles-option');
  const profilesCheckbox = document.getElementById('first-launch-enable-profiles');
  if (profilesOption && profilesCheckbox) {
    profilesOption.addEventListener('click', () => {
      profilesCheckbox.checked = !profilesCheckbox.checked;
      profilesOption.classList.toggle('active', profilesCheckbox.checked);
    });
  }

  // Check if sync storage is available
  const syncAvailability = await SFTabs.utils.checkSyncStorageAvailable();
  const syncStorageOption = document.getElementById('storage-option-sync');

  if (!syncAvailability.available && syncStorageOption) {
    // Disable sync storage option if not available
    syncStorageOption.style.opacity = '0.5';
    syncStorageOption.style.cursor = 'not-allowed';
    syncStorageOption.title = `Sync storage not available: ${syncAvailability.error}`;

    // Disable the radio button
    const syncRadio = syncStorageOption.querySelector('input[type="radio"]');
    if (syncRadio) {
      syncRadio.disabled = true;
    }

    // Update description to show it's unavailable
    const syncDescription = syncStorageOption.querySelector('.option-button-description');
    if (syncDescription) {
      syncDescription.textContent = 'Not available (browser sync disabled or not signed in)';
    }
  }

  // Storage option selection
  const storageOptions = document.querySelectorAll('[data-storage]');
  storageOptions.forEach(option => {
    option.addEventListener('click', () => {
      // Check if this option is disabled
      const radio = option.querySelector('input[type="radio"]');
      if (radio && radio.disabled) {
        return; // Don't allow selection of disabled options
      }

      // Remove active class from all storage options
      storageOptions.forEach(opt => opt.classList.remove('active'));
      // Add active class to clicked option
      option.classList.add('active');
      // Update the hidden radio button
      if (radio) {
        radio.checked = true;
      }
    });
  });

  // User Guide button
  const guideButton = document.getElementById('first-launch-guide-button');
  if (guideButton) {
    guideButton.addEventListener('click', () => {
      browser.tabs.create({
        url: 'https://github.com/crouse12/sftabs'
      });
    });
  }

  // Get Started button
  const startButton = document.getElementById('first-launch-start-button');
  if (startButton) {
    startButton.addEventListener('click', handleGetStarted);
  }
}

/**
 * Handle Get Started button click
 */
async function handleGetStarted() {
  try {
    // Get selected setup option
    const activeSetupOption = document.querySelector('.setup-option.active');
    const setupOption = activeSetupOption ? activeSetupOption.getAttribute('data-option') : 'default';

    // Get profiles setting
    const profilesCheckbox = document.getElementById('first-launch-enable-profiles');
    const enableProfiles = profilesCheckbox ? profilesCheckbox.checked : false;

    // Get storage setting
    const storageRadios = document.getElementsByName('first-launch-storage-choice');
    let storageType = 'local'; // default
    for (const radio of storageRadios) {
      if (radio.checked) {
        storageType = radio.value;
        break;
      }
    }

    // Initialize the extension based on selected options FIRST
    await initializeExtension(setupOption, enableProfiles, storageType);

    // Mark first launch as completed in BOTH local and sync storage
    // This ensures the flag persists even if one storage is cleared
    await browser.storage.local.set({ firstLaunchCompleted: true });
    await browser.storage.sync.set({ firstLaunchCompleted: true });

    // Hide the first-launch modal
    hideFirstLaunchModal();

    // Reload the popup to ensure full initialization with all event handlers
    window.location.reload();

  } catch (error) {
    console.error('Error handling first launch:', error);
    if (SFTabs.main && SFTabs.main.showStatus) {
      SFTabs.main.showStatus('Error during setup: ' + error.message, true);
    }
  }
}

/**
 * Initialize extension based on first-launch selections
 */
async function initializeExtension(setupOption, enableProfiles, storageType) {
  try {
    // Create default user settings
    const defaultSettings = {
      ...SFTabs.constants.DEFAULT_SETTINGS,
      profilesEnabled: enableProfiles,
      useSyncStorage: storageType === 'sync'
    };

    // Create a default profile (using same ID format as popup-profiles.js)
    // Note: ID is just timestamp + random string; storage layer adds "profile_" prefix
    const defaultProfile = {
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      name: 'Default',
      isDefault: true,
      urlPatterns: [],
      createdAt: new Date().toISOString(),
      lastActive: null
    };

    // Determine tabs based on setup option
    let tabsToSave = [];
    if (setupOption === 'default') {
      // Add default tabs
      tabsToSave = [...SFTabs.constants.DEFAULT_TABS];
    } else if (setupOption === 'empty') {
      // Keep tabs array empty
      tabsToSave = [];
    } else if (setupOption === 'import') {
      // Navigate to settings page for import
      browser.runtime.openOptionsPage();
      return;
    }

    // Set active profile ID
    defaultSettings.activeProfileId = defaultProfile.id;
    defaultSettings.defaultProfileId = defaultProfile.id;

    // Save settings and profile to the selected storage
    if (storageType === 'sync') {
      // Save to sync storage
      await browser.storage.sync.set({
        userSettings: defaultSettings,
        profiles: [defaultProfile]
      });
      // Also cache userSettings in local storage for quick access
      await browser.storage.local.set({
        userSettings: defaultSettings
      });

      // Save tabs to profile-specific storage (sync)
      await SFTabs.storageChunking.saveChunkedSync(`profile_${defaultProfile.id}_tabs`, tabsToSave);
    } else {
      // Save everything to local storage only
      await browser.storage.local.set({
        userSettings: defaultSettings,
        profiles: [defaultProfile],
        [`profile_${defaultProfile.id}_tabs`]: tabsToSave
      });
    }

    // Note: No need to manually reload UI here - we'll reload the entire popup
    // This ensures all event handlers and initialization are set up correctly

  } catch (error) {
    console.error('Error initializing extension:', error);
    throw error;
  }
}

// Export functions for use by other modules
window.SFTabs = window.SFTabs || {};
window.SFTabs.firstLaunch = {
  checkFirstLaunch,
  showFirstLaunchModal,
  hideFirstLaunchModal,
  initFirstLaunchModal
};
