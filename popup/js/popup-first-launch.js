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

    const isUpgrade = hasMigration || hasProfiles || hasTabs || hasUserSettings;

    if (isUpgrade) {
      // This is an upgrade - skip first-launch wizard
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
 */
async function initFirstLaunchModal() {
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
