// popup/js/popup-migration.js
// Migration detection and UI for version upgrades

/**
 * Check if migration is needed based on stored version and current version
 * @returns {Promise<Object>} Migration status object
 */
async function checkMigrationStatus() {
  try {
    const currentVersion = browser.runtime.getManifest().version;
    const localData = await browser.storage.local.get(['extensionVersion', 'migrationCompleted', 'migrationPending']);

    const storedVersion = localData.extensionVersion;
    const migrationCompleted = localData.migrationCompleted;
    const migrationPending = localData.migrationPending;

    // Check if this is a version upgrade that requires migration
    const needsMigration = await detectIfMigrationNeeded(storedVersion, currentVersion);

    const status = {
      currentVersion,
      storedVersion,
      needsMigration,
      migrationCompleted: migrationCompleted === currentVersion,
      migrationPending: migrationPending === true
    };

    return status;
  } catch (error) {
    return {
      currentVersion: '2.0.0',
      storedVersion: null,
      needsMigration: false,
      migrationCompleted: false,
      migrationPending: false,
      error: error.message
    };
  }
}

/**
 * Detect if migration is needed based on version comparison and data state
 * @param {string} storedVersion - Previously stored version
 * @param {string} currentVersion - Current extension version
 * @returns {Promise<boolean>} True if migration is needed
 */
async function detectIfMigrationNeeded(storedVersion, currentVersion) {
  try {
    // If no stored version, check if we have legacy data
    if (!storedVersion) {
      const hasLegacyData = await hasLegacyTabData();
      return hasLegacyData;
    }

    // If stored version is different from current, check for profiles
    if (storedVersion !== currentVersion) {
      const profiles = await SFTabs.storage.getProfiles();
      const hasProfiles = profiles && profiles.length > 0;

      // Need migration if no profiles exist yet
      return !hasProfiles;
    }

    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Check if legacy tab data exists (pre-profiles format)
 * @returns {Promise<boolean>} True if legacy data found
 */
async function hasLegacyTabData() {
  try {
    // Check for tabs in customTabs storage (legacy format)
    const useSyncStorage = await SFTabs.storage.getStoragePreference();

    let tabs = [];
    if (useSyncStorage) {
      tabs = await SFTabs.storageChunking.readChunkedSync('customTabs');
    } else {
      const localResult = await browser.storage.local.get('customTabs');
      tabs = localResult.customTabs || [];
    }

    // Check if we have tabs but no profiles
    if (tabs && tabs.length > 0) {
      const profiles = await SFTabs.storage.getProfiles();
      return !profiles || profiles.length === 0;
    }

    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Estimate migration time based on data size
 * @returns {Promise<string>} Time estimate string
 */
async function estimateMigrationTime() {
  try {
    const useSyncStorage = await SFTabs.storage.getStoragePreference();

    let tabs = [];
    if (useSyncStorage) {
      tabs = await SFTabs.storageChunking.readChunkedSync('customTabs');
    } else {
      const localResult = await browser.storage.local.get('customTabs');
      tabs = localResult.customTabs || [];
    }

    const tabCount = tabs ? tabs.length : 0;

    if (tabCount === 0) {
      return 'less than 1 second';
    } else if (tabCount < 20) {
      return '1-2 seconds';
    } else if (tabCount < 50) {
      return '2-3 seconds';
    } else {
      return '3-5 seconds';
    }
  } catch (error) {
    return 'a few seconds';
  }
}

/**
 * Show the migration modal
 */
async function showMigrationModal() {
  const modal = document.querySelector('#migration-modal');
  const welcomeScreen = document.querySelector('#migration-welcome');
  const timeEstimate = await estimateMigrationTime();

  // Show time estimate
  const timeElement = document.querySelector('#migration-time-value');
  const timeEstimateContainer = document.querySelector('#migration-time-estimate');
  if (timeElement && timeEstimateContainer) {
    timeElement.textContent = timeEstimate;
    timeEstimateContainer.style.display = 'list-item';
  }

  // Detect current storage preference and pre-select
  const currentStorageInfo = await detectCurrentStorage();
  const syncRadio = document.querySelector('#migration-storage-sync');
  const localRadio = document.querySelector('#migration-storage-local');
  const currentStorageMessage = document.querySelector('#migration-current-storage');

  if (currentStorageInfo.usesSync) {
    if (syncRadio) syncRadio.checked = true;
    if (currentStorageMessage) {
      currentStorageMessage.textContent = `Currently using: Sync Storage${currentStorageInfo.hasChunked ? ' (chunked)' : ''}`;
    }
  } else {
    if (localRadio) localRadio.checked = true;
    if (currentStorageMessage) {
      currentStorageMessage.textContent = 'Currently using: Local Storage';
    }
  }

  // Reset to welcome screen
  showMigrationScreen('welcome');

  // Show modal
  if (modal) {
    modal.classList.add('show');
    modal.style.display = 'flex';
    // Add class to body for height adjustment
    document.body.classList.add('migration-active');
  }
}

/**
 * Detect current storage location
 * @returns {Promise<Object>} Storage info
 */
async function detectCurrentStorage() {
  try {
    // Check user settings first
    const syncSettings = await browser.storage.sync.get('userSettings');
    const preferSync = syncSettings.userSettings?.useSyncStorage !== false; // Default true

    // Check for chunked sync storage
    const syncMetadata = await browser.storage.sync.get('customTabs_metadata');
    const hasChunkedSync = !!syncMetadata.customTabs_metadata;

    // Check for non-chunked sync storage
    const syncDirect = await browser.storage.sync.get('customTabs');
    const hasDirectSync = !!syncDirect.customTabs;

    // Check for local storage
    const localData = await browser.storage.local.get('customTabs');
    const hasLocal = !!localData.customTabs;

    return {
      usesSync: preferSync || hasChunkedSync || hasDirectSync,
      usesLocal: !preferSync || hasLocal,
      hasChunked: hasChunkedSync,
      preferSync: preferSync
    };
  } catch (error) {
    return {
      usesSync: true,
      usesLocal: false,
      hasChunked: false,
      preferSync: true
    };
  }
}

/**
 * Hide the migration modal
 */
function hideMigrationModal() {
  const modal = document.querySelector('#migration-modal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
    // Remove class from body
    document.body.classList.remove('migration-active');
  }
}

/**
 * Show a specific migration screen
 * @param {string} screenName - Name of screen to show (welcome, progress, success, error)
 */
function showMigrationScreen(screenName) {
  // Hide all screens
  const screens = ['welcome', 'progress', 'success', 'error'];
  screens.forEach(screen => {
    const element = document.querySelector(`#migration-${screen}`);
    const buttons = document.querySelector(`#migration-${screen}-buttons`);
    if (element) element.style.display = 'none';
    if (buttons) buttons.style.display = 'none';
  });

  // Show requested screen
  const screenElement = document.querySelector(`#migration-${screenName}`);
  const buttonElement = document.querySelector(`#migration-${screenName}-buttons`);
  if (screenElement) screenElement.style.display = 'block';
  if (buttonElement) buttonElement.style.display = 'flex';
}

/**
 * Update migration step status
 * @param {number} stepNumber - Step number (1-3)
 * @param {string} status - Status: 'active', 'completed', 'pending'
 */
function updateMigrationStep(stepNumber, status) {
  const step = document.querySelector(`#migration-step-${stepNumber}`);
  if (!step) return;

  const icon = step.querySelector('.step-icon');

  step.classList.remove('active', 'completed', 'pending');
  step.classList.add(status);

  if (status === 'active') {
    icon.textContent = '⏳';
  } else if (status === 'completed') {
    icon.textContent = '✅';
  } else {
    icon.textContent = '⏳';
  }
}

/**
 * Perform the migration from legacy format to profiles
 * @param {boolean} enableProfiles - Whether to enable profiles feature
 * @param {boolean} useSyncStorage - Whether to use sync or local storage
 * @returns {Promise<boolean>} True if successful
 */
async function performMigration(enableProfiles = false, useSyncStorage = true) {
  try {
    // Step 1: Read existing data
    updateMigrationStep(1, 'active');
    updateMigrationStep(2, 'pending');
    updateMigrationStep(3, 'pending');

    const currentStoragePreference = await SFTabs.storage.getStoragePreference();

    let tabs = [];
    if (currentStoragePreference) {
      tabs = await SFTabs.storageChunking.readChunkedSync('customTabs');
    } else {
      const localResult = await browser.storage.local.get('customTabs');
      tabs = localResult.customTabs || [];
    }

    // If no tabs found in preferred location, check the other
    if (!tabs || tabs.length === 0) {
      if (currentStoragePreference) {
        const localResult = await browser.storage.local.get('customTabs');
        tabs = localResult.customTabs || [];
      } else {
        tabs = await SFTabs.storageChunking.readChunkedSync('customTabs');
      }
    }

    // Simulate some processing time for UX
    await new Promise(resolve => setTimeout(resolve, 500));
    updateMigrationStep(1, 'completed');

    // Step 2: Create Default profile
    updateMigrationStep(2, 'active');

    const defaultProfileId = 'profile_' + Date.now() + '_default';
    const defaultProfile = {
      id: defaultProfileId,
      name: 'Default',
      isDefault: true,
      urlPatterns: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save the profile (suppress toast during migration)
    await SFTabs.storage.saveProfiles([defaultProfile], false);

    // Save tabs to the new profile
    if (tabs && tabs.length > 0) {
      await SFTabs.storage.saveProfileTabs(defaultProfileId, tabs);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    updateMigrationStep(2, 'completed');

    // Step 3: Update settings and clean up
    updateMigrationStep(3, 'active');

    const settings = await SFTabs.storage.getUserSettings();
    settings.activeProfileId = defaultProfileId;
    settings.defaultProfileId = defaultProfileId;
    settings.useSyncStorage = useSyncStorage; // Set user's storage choice

    if (enableProfiles) {
      settings.profilesEnabled = true;
    }

    await SFTabs.storage.saveUserSettings(settings, true, false); // Skip migration check, suppress toast

    // Mark migration as completed
    const currentVersion = browser.runtime.getManifest().version;
    await browser.storage.local.set({
      extensionVersion: currentVersion,
      migrationCompleted: currentVersion,
      migrationPending: false
    });

    await new Promise(resolve => setTimeout(resolve, 500));
    updateMigrationStep(3, 'completed');

    return true;
  } catch (error) {
    throw error;
  }
}

/**
 * Export current configuration as backup before migration
 */
async function exportBackupBeforeMigration() {
  try {
    // Get current tabs and settings
    const useSyncStorage = await SFTabs.storage.getStoragePreference();

    let tabs = [];
    if (useSyncStorage) {
      tabs = await SFTabs.storageChunking.readChunkedSync('customTabs');
    } else {
      const localResult = await browser.storage.local.get('customTabs');
      tabs = localResult.customTabs || [];
    }

    const settings = await SFTabs.storage.getUserSettings();

    const config = {
      customTabs: tabs || [],
      userSettings: settings,
      exportedAt: new Date().toISOString(),
      version: browser.runtime.getManifest().version,
      exportType: 'pre-migration-backup'
    };

    const jsonString = JSON.stringify(config, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `sftabs_backup_${timestamp}.json`;

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    throw error;
  }
}

/**
 * Initialize migration modal event listeners
 */
function initMigrationModal() {
  // Export Backup button
  const exportButton = document.querySelector('#migration-export-button');
  if (exportButton) {
    exportButton.addEventListener('click', async () => {
      try {
        exportButton.disabled = true;
        exportButton.textContent = 'Exporting...';

        await exportBackupBeforeMigration();

        exportButton.textContent = '✓ Backup Exported';
        setTimeout(() => {
          exportButton.disabled = false;
          exportButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline; margin-right: 6px;">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Export Backup
          `;
        }, 2000);
      } catch (error) {
        exportButton.disabled = false;
        exportButton.textContent = 'Export Failed';
        setTimeout(() => {
          exportButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline; margin-right: 6px;">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Export Backup
          `;
        }, 2000);
      }
    });
  }

  // Migrate Now button
  const startButton = document.querySelector('#migration-start-button');
  if (startButton) {
    startButton.addEventListener('click', async () => {
      const enableProfilesCheckbox = document.querySelector('#migration-enable-profiles');
      const enableProfiles = enableProfilesCheckbox ? enableProfilesCheckbox.checked : false;

      // Get storage choice
      const syncRadio = document.querySelector('#migration-storage-sync');
      const useSyncStorage = syncRadio ? syncRadio.checked : true;

      // Show progress screen
      showMigrationScreen('progress');

      try {
        await performMigration(enableProfiles, useSyncStorage);

        // Show success screen
        showMigrationScreen('success');

        // Update success message based on profiles setting
        const enabledMsg = document.querySelector('#migration-profiles-enabled-msg');
        const disabledMsg = document.querySelector('#migration-profiles-disabled-msg');
        if (enableProfiles) {
          if (enabledMsg) enabledMsg.style.display = 'list-item';
          if (disabledMsg) disabledMsg.style.display = 'none';
        } else {
          if (enabledMsg) enabledMsg.style.display = 'none';
          if (disabledMsg) disabledMsg.style.display = 'list-item';
        }
      } catch (error) {
        // Show error screen
        showMigrationScreen('error');
        const errorMsg = document.querySelector('#migration-error-message');
        if (errorMsg) {
          errorMsg.textContent = error.message || 'Unknown error occurred';
        }
      }
    });
  }

  // Done button (after success)
  const doneButton = document.querySelector('#migration-done-button');
  if (doneButton) {
    doneButton.addEventListener('click', () => {
      hideMigrationModal();
      // Reload popup to show new profile-based UI
      window.location.reload();
    });
  }

  // Retry button (after error)
  const retryButton = document.querySelector('#migration-retry-button');
  if (retryButton) {
    retryButton.addEventListener('click', () => {
      showMigrationScreen('welcome');
    });
  }

  // Skip button (after error)
  const skipButton = document.querySelector('#migration-skip-button');
  if (skipButton) {
    skipButton.addEventListener('click', async () => {
      // Mark migration as skipped and continue
      const currentVersion = browser.runtime.getManifest().version;
      await browser.storage.local.set({
        extensionVersion: currentVersion,
        migrationCompleted: false,
        migrationPending: false
      });
      hideMigrationModal();
      window.location.reload();
    });
  }
}

// Export functions for use by other modules
window.SFTabs = window.SFTabs || {};
window.SFTabs.migration = {
  checkMigrationStatus,
  showMigrationModal,
  hideMigrationModal,
  initMigrationModal
};
