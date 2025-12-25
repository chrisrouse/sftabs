// popup/js/popup-profiles.js
// Profile management functionality

// In-memory cache of profiles (loaded from storage)
let profilesCache = [];

// Track the profile being edited
let editingProfile = null;

/**
 * Load profiles from storage into cache
 */
async function loadProfiles() {
  try {
    profilesCache = await SFTabs.storage.getProfiles();
  } catch (error) {
    profilesCache = [];
  }
}

/**
 * Generate a unique profile ID
 */
function generateProfileId() {
  return 'profile_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Get active profile ID from settings
 */
async function getActiveProfileId() {
  const settings = await SFTabs.storage.getUserSettings();
  return settings.activeProfileId;
}

/**
 * Get default profile ID from settings
 */
async function getDefaultProfileId() {
  const settings = await SFTabs.storage.getUserSettings();
  return settings.defaultProfileId;
}

/**
 * Initialize profiles functionality
 */
async function initProfiles() {

  // Load profiles from storage
  await loadProfiles();

  // Load settings to check if profiles are enabled
  const settings = await SFTabs.storage.getUserSettings();

  // Get DOM elements
  const profilesButton = document.querySelector('#profiles-button');
  const enableProfilesCheckbox = document.querySelector('#enable-profiles');
  const profileOptions = document.querySelector('#profile-options');
  const autoSwitchCheckbox = document.querySelector('#auto-switch-profiles');
  const urlPatternsSection = document.querySelector('#url-patterns-section');
  const profileNameInput = document.querySelector('#profile-name');
  const profileNameCounter = document.querySelector('#profile-name-counter');

  // Set initial checkbox states from settings
  if (enableProfilesCheckbox) {
    enableProfilesCheckbox.checked = settings.profilesEnabled || false;
  }
  if (autoSwitchCheckbox) {
    autoSwitchCheckbox.checked = settings.autoSwitchProfiles || false;
  }

  // Auto-create Default profile if none exist (upgrade/first use scenario)
  // This happens regardless of profilesEnabled setting - profiles are now always used internally
  if (profilesCache.length === 0) {

    // Try to get tabs from legacy storage first, then fall back to current state
    let tabsToMigrate = [];

    // Check sync storage for legacy tabs
    const legacyTabsSync = await getLegacyTabsFromStorage('sync');
    if (legacyTabsSync && legacyTabsSync.length > 0) {
      tabsToMigrate = legacyTabsSync;
    } else {
      // Check local storage for legacy tabs
      const legacyTabsLocal = await getLegacyTabsFromStorage('local');
      if (legacyTabsLocal && legacyTabsLocal.length > 0) {
        tabsToMigrate = legacyTabsLocal;
      } else {
        // Fall back to current state
        tabsToMigrate = SFTabs.main.getTabs();
      }
    }

    // Create Default profile
    const defaultProfile = {
      id: generateProfileId(),
      name: 'Default',
      isDefault: true,
      urlPatterns: [],
      createdAt: new Date().toISOString(),
      lastActive: null
    };

    // Add to cache
    profilesCache.push(defaultProfile);

    // Save profile to storage
    await SFTabs.storage.saveProfiles(profilesCache);

    // Save tabs to this profile
    await SFTabs.storage.saveProfileTabs(defaultProfile.id, tabsToMigrate);

    // Set as default and active profile in settings
    settings.defaultProfileId = defaultProfile.id;
    settings.activeProfileId = defaultProfile.id;
    await SFTabs.storage.saveUserSettings(settings);

  }

  // DISABLED: Migration recovery code removed to fix empty profile issue
  // This code was running on every popup load and migrating legacy tabs to empty profiles
  // even when users explicitly chose "Start with no tabs"
  // Migration now ONLY happens when profiles are first enabled (via checkbox handler)
  // See checkbox handler around line 168-186 for migration logic

  // Show/hide UI based on settings
  toggleProfilesEnabled(settings.profilesEnabled || false);
  toggleUrlPatternsSection(settings.autoSwitchProfiles || false);

  // Setup event listeners
  if (profilesButton) {
    profilesButton.addEventListener('click', showProfileList);
  }

  if (enableProfilesCheckbox) {
    enableProfilesCheckbox.addEventListener('change', async function() {
      const enabled = this.checked;
      const settings = await SFTabs.storage.getUserSettings();

      // If disabling profiles UI, clean up non-active profiles
      if (!enabled && profilesCache.length > 1) {

        // Prompt user to select which profile to keep as the default
        const selectedProfile = await showProfileSelectionForDisable();

        if (!selectedProfile) {
          // User cancelled - revert checkbox
          this.checked = true;
          return;
        }

        // Set selected profile as active
        settings.activeProfileId = selectedProfile.id;
        settings.defaultProfileId = selectedProfile.id;

        // Delete all OTHER profiles and their storage
        const profilesToDelete = profilesCache.filter(p => p.id !== selectedProfile.id);
        const useSyncStorage = await SFTabs.storage.getStoragePreference();

        for (const profile of profilesToDelete) {
          const profileTabsKey = `profile_${profile.id}_tabs`;

          if (useSyncStorage) {
            await SFTabs.storageChunking.clearChunkedSync(profileTabsKey);
          } else {
            await browser.storage.local.remove(profileTabsKey);
          }
        }

        // Update cache to only contain selected profile
        profilesCache.length = 0;
        profilesCache.push(selectedProfile);
        await SFTabs.storage.saveProfiles(profilesCache);


        if (window.SFTabs && window.SFTabs.main) {
          window.SFTabs.main.showStatus(`Profiles UI disabled. Kept ${selectedProfile.name} profile`, false);
        }
      }

      // Update settings and toggle UI visibility
      settings.profilesEnabled = enabled;
      await SFTabs.storage.saveUserSettings(settings);
      toggleProfilesEnabled(enabled);

      // Update UI if enabling profiles
      if (enabled) {
        await updateActiveProfileBanner();
        await populateActiveProfileSelector();
      }
    });
  }

  if (autoSwitchCheckbox) {
    autoSwitchCheckbox.addEventListener('change', async function() {
      const enabled = this.checked;
      const settings = await SFTabs.storage.getUserSettings();
      settings.autoSwitchProfiles = enabled;
      await SFTabs.storage.saveUserSettings(settings);
      toggleUrlPatternsSection(enabled);
    });
  }

  if (profileNameInput) {
    profileNameInput.addEventListener('input', function() {
      updateCharacterCounter(this.value.length);
    });
  }

  // Setup profile list buttons
  const profileListCloseButton = document.querySelector('#profile-list-close-button');
  if (profileListCloseButton) {
    profileListCloseButton.addEventListener('click', () => {
      if (window.SFTabs && window.SFTabs.main) {
        window.SFTabs.main.showMainContent();
      }
    });
  }

  const createProfileButton = document.querySelector('#create-profile-button');
  if (createProfileButton) {
    createProfileButton.addEventListener('click', () => showProfileEditForm());
  }

  // Setup profile edit buttons
  const profileSaveButton = document.querySelector('#profile-save-button');
  if (profileSaveButton) {
    profileSaveButton.addEventListener('click', saveProfile);
  }

  const profileCancelButton = document.querySelector('#profile-cancel-button');
  if (profileCancelButton) {
    profileCancelButton.addEventListener('click', () => {
      showProfileList();
    });
  }

  // Setup URL pattern buttons
  const addUrlPatternButton = document.querySelector('#add-url-pattern-button');
  if (addUrlPatternButton) {
    addUrlPatternButton.addEventListener('click', addUrlPattern);
  }

  const captureDomainButton = document.querySelector('#capture-domain-button');
  if (captureDomainButton) {
    captureDomainButton.addEventListener('click', captureCurrentDomain);
  }

  // Setup active profile selector
  const activeProfileSelector = document.querySelector('#active-profile-selector');
  if (activeProfileSelector) {
    activeProfileSelector.addEventListener('change', function() {
      switchActiveProfile(this.value);
    });
  }

  // Setup profile initialization option buttons
  const initWithDefaultsButton = document.querySelector('#init-with-defaults');
  if (initWithDefaultsButton) {
    initWithDefaultsButton.addEventListener('click', initializeProfileWithDefaults);
  }

  const initEmptyButton = document.querySelector('#init-empty');
  if (initEmptyButton) {
    initEmptyButton.addEventListener('click', initializeProfileEmpty);
  }

  const initCloneButton = document.querySelector('#init-clone');
  if (initCloneButton) {
    initCloneButton.addEventListener('click', showCloneProfileSelector);
  }

  const cloneConfirmButton = document.querySelector('#clone-confirm-button');
  if (cloneConfirmButton) {
    cloneConfirmButton.addEventListener('click', confirmCloneProfile);
  }

  const cloneCancelButton = document.querySelector('#clone-cancel-button');
  if (cloneCancelButton) {
    cloneCancelButton.addEventListener('click', hideCloneProfileSelector);
  }

}

/**
 * Toggle profiles enabled/disabled
 */
function toggleProfilesEnabled(enabled) {

  const profilesButton = document.querySelector('#profiles-button');
  const profileOptions = document.querySelector('#profile-options');
  const activeProfileBanner = document.querySelector('#active-profile-banner');

  if (profilesButton) {
    profilesButton.style.display = enabled ? 'flex' : 'none';
  }

  if (profileOptions) {
    profileOptions.style.display = enabled ? 'block' : 'none';
  }

  if (activeProfileBanner) {
    activeProfileBanner.style.display = enabled ? 'flex' : 'none';
  }

  // Add/remove with-banner class from panels
  const mainContent = document.querySelector('#main-content');
  const actionPanel = document.querySelector('#action-panel');

  if (enabled) {
    if (mainContent) mainContent.classList.add('with-banner');
    if (actionPanel) actionPanel.classList.add('with-banner');

    // Update active profile banner
    updateActiveProfileBanner();
  } else {
    if (mainContent) mainContent.classList.remove('with-banner');
    if (actionPanel) actionPanel.classList.remove('with-banner');

    // Hide profile switcher dropdown if open
    hideProfileSwitcher();
  }
}

/**
 * Toggle URL patterns section visibility
 */
function toggleUrlPatternsSection(visible) {
  const urlPatternsSection = document.querySelector('#url-patterns-section');
  if (urlPatternsSection) {
    urlPatternsSection.style.display = visible ? 'block' : 'none';
  }
}

/**
 * Update character counter
 */
function updateCharacterCounter(length) {
  const counter = document.querySelector('#profile-name-counter');
  if (counter) {
    counter.textContent = length;
  }
}

/**
 * Update active profile banner
 */
async function updateActiveProfileBanner() {
  const banner = document.querySelector('#active-profile-banner');
  const profileName = document.querySelector('#active-profile-name');

  if (!banner || !profileName) return;

  const activeProfileId = await getActiveProfileId();
  const activeProfile = profilesCache.find(p => p.id === activeProfileId);

  if (activeProfile) {
    profileName.textContent = activeProfile.name;
  }

  // Setup profile switcher if not already done
  if (!banner.hasAttribute('data-switcher-initialized')) {
    setupProfileSwitcher();
    banner.setAttribute('data-switcher-initialized', 'true');
  }
}

/**
 * Setup profile switcher dropdown
 */
function setupProfileSwitcher() {
  const banner = document.querySelector('#active-profile-banner');
  const dropdown = document.querySelector('#profile-switcher-dropdown');

  if (!banner || !dropdown) return;

  // Toggle dropdown when clicking the banner
  banner.addEventListener('click', async (e) => {
    e.stopPropagation();
    const isVisible = dropdown.style.display === 'block';

    if (isVisible) {
      hideProfileSwitcher();
    } else {
      await showProfileSwitcher();
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && !banner.contains(e.target)) {
      hideProfileSwitcher();
    }
  });
}

/**
 * Show profile switcher dropdown
 */
async function showProfileSwitcher() {
  const dropdown = document.querySelector('#profile-switcher-dropdown');
  const dropdownList = document.querySelector('#profile-switcher-list');

  if (!dropdown || !dropdownList) return;

  // Get current active profile
  const activeProfileId = await getActiveProfileId();

  // Clear existing items
  dropdownList.innerHTML = '';

  // Populate with all profiles
  profilesCache.forEach(profile => {
    const item = document.createElement('div');
    item.className = 'profile-switcher-item';
    if (profile.id === activeProfileId) {
      item.classList.add('active');
    }

    item.textContent = profile.name;
    item.dataset.profileId = profile.id;

    item.addEventListener('click', async () => {
      await switchActiveProfile(profile.id);
      hideProfileSwitcher();
    });

    dropdownList.appendChild(item);
  });

  dropdown.style.display = 'block';
}

/**
 * Hide profile switcher dropdown
 */
function hideProfileSwitcher() {
  const dropdown = document.querySelector('#profile-switcher-dropdown');
  if (dropdown) {
    dropdown.style.display = 'none';
  }
}

/**
 * Switch active profile
 */
async function switchActiveProfile(profileId) {

  if (!profileId) return;

  try {
    // Save active profile to settings
    const settings = await SFTabs.storage.getUserSettings();
    settings.activeProfileId = profileId;
    await SFTabs.storage.saveUserSettings(settings);

    // Update profile's last active timestamp
    const profile = profilesCache.find(p => p.id === profileId);
    if (profile) {
      profile.lastActive = new Date().toISOString();
      await SFTabs.storage.saveProfiles(profilesCache);
    }

    // Update banner
    await updateActiveProfileBanner();

    // Update active profile selector
    const activeProfileSelector = document.querySelector('#active-profile-selector');
    if (activeProfileSelector) {
      activeProfileSelector.value = profileId;
    }

    // Load tabs for the selected profile
    const profileTabs = await SFTabs.storage.getProfileTabs(profileId);

    // Update the main tabs state
    if (window.SFTabs && window.SFTabs.main) {
      SFTabs.main.setTabs(profileTabs);

      // Show main content to display the tab list (or empty state if no tabs)
      SFTabs.main.showMainContent();

      // Re-render the tab list
      if (SFTabs.ui && SFTabs.ui.renderTabList) {
        SFTabs.ui.renderTabList();
      }

      const activeProfile = profilesCache.find(p => p.id === profileId);
      if (activeProfile) {
        SFTabs.main.showStatus(`Switched to profile: ${activeProfile.name}`, false);
      }
    }

    // Send message to all Salesforce tabs to refresh the tab bar immediately
    browser.tabs.query({
      url: [
        "*://*.lightning.force.com/lightning/setup/*",
        "*://*.salesforce-setup.com/lightning/setup/*",
        "*://*.my.salesforce-setup.com/lightning/setup/*",
        "*://*.salesforce.com/lightning/setup/*",
        "*://*.my.salesforce.com/lightning/setup/*"
      ]
    }).then(tabs => {
      tabs.forEach(tab => {
        browser.tabs.sendMessage(tab.id, { action: 'refresh_tabs' })
          .catch(error => {});
      });
    }).catch(error => {
      if (window.SFTabs && window.SFTabs.main) {
        SFTabs.main.showStatus('Error switching profile: ' + error.message, true);
      }
    });
  } catch (error) {
    if (window.SFTabs && window.SFTabs.main) {
      SFTabs.main.showStatus('Error switching profile: ' + error.message, true);
    }
  }
}

/**
 * Populate active profile selector
 */
async function populateActiveProfileSelector() {
  const selector = document.querySelector('#active-profile-selector');
  if (!selector) return;

  // Clear existing options except the first one
  selector.innerHTML = '<option value="">Select a profile...</option>';

  // Add profiles from cache
  profilesCache.forEach(profile => {
    const option = document.createElement('option');
    option.value = profile.id;
    option.textContent = profile.name;
    selector.appendChild(option);
  });

  // Set current active profile
  const activeProfileId = await getActiveProfileId();
  selector.value = activeProfileId || '';
}

/**
 * Show profile list
 */
async function showProfileList() {

  // Reload profiles from storage
  await loadProfiles();

  // Hide other action panel content
  const tabSettingsContent = document.querySelector('#tab-settings-content');
  const profileEditContent = document.querySelector('#profile-edit-content');
  const profileListContent = document.querySelector('#profile-list-content');
  const actionPanelTitle = document.querySelector('#action-panel-title');

  if (tabSettingsContent) tabSettingsContent.style.display = 'none';
  if (profileEditContent) profileEditContent.style.display = 'none';
  if (profileListContent) profileListContent.style.display = 'block';
  if (actionPanelTitle) actionPanelTitle.textContent = 'Profiles';

  // Populate active profile selector
  await populateActiveProfileSelector();

  // Render profile list
  await renderProfileList();

  // Show action panel
  if (window.SFTabs && window.SFTabs.main) {
    const actionPanel = window.SFTabs.main.getDOMElements().actionPanel;
    const mainContent = window.SFTabs.main.getDOMElements().mainContent;

    if (actionPanel && mainContent) {
      mainContent.classList.remove('active');
      mainContent.style.display = 'none';
      actionPanel.classList.add('active');
      actionPanel.style.display = 'block';
    }
  }
}

/**
 * Render profile list
 */
async function renderProfileList() {
  const profileList = document.querySelector('#profile-list');
  const profileCount = document.querySelector('#profile-count');

  if (!profileList) return;

  // Update count
  if (profileCount) {
    profileCount.textContent = profilesCache.length;
  }

  // Clear existing items
  profileList.innerHTML = '';

  // Get default profile ID
  const defaultProfileId = await getDefaultProfileId();

  // Add profile items
  profilesCache.forEach((profile, index) => {
    const profileItem = createProfileListItem(profile, index, defaultProfileId);
    profileList.appendChild(profileItem);
  });
}

/**
 * Create a profile list item - matches dropdown menu style
 */
function createProfileListItem(profile, index, defaultProfileId) {
  const div = document.createElement('div');
  div.className = 'profile-item';

  // Drag handle
  const dragHandle = SFTabs.shared.createDragHandle();

  // Label with number
  const labelSpan = document.createElement('span');
  labelSpan.textContent = `${index + 1}. ${profile.name}`;
  labelSpan.style.flex = '1';

  // Button container
  const buttonContainer = SFTabs.shared.createButtonContainer();

  // Default button (D)
  const isDefault = profile.id === defaultProfileId;
  const defaultButton = SFTabs.shared.createListActionButton('default', {
    text: 'D',
    title: 'Set as default profile',
    onClick: () => setDefaultProfile(profile.id),
    isActive: isDefault
  });

  // Edit button
  const editButton = SFTabs.shared.createListActionButton('edit', {
    text: 'Edit',
    title: 'Edit this profile',
    onClick: () => showProfileEditForm(profile)
  });

  // Delete button
  const deleteButton = SFTabs.shared.createListActionButton('delete', {
    text: '×',
    title: 'Delete this profile',
    onClick: () => deleteProfile(profile)
  });

  buttonContainer.appendChild(defaultButton);
  buttonContainer.appendChild(editButton);
  buttonContainer.appendChild(deleteButton);

  // Assemble
  div.appendChild(dragHandle);
  div.appendChild(labelSpan);
  div.appendChild(buttonContainer);

  return div;
}

/**
 * Set default profile
 */
async function setDefaultProfile(profileId) {

  try {
    // Update all profiles' isDefault flag
    profilesCache.forEach(p => {
      p.isDefault = (p.id === profileId);
    });

    // Save to storage
    await SFTabs.storage.saveProfiles(profilesCache);

    // Update settings
    const settings = await SFTabs.storage.getUserSettings();
    settings.defaultProfileId = profileId;
    await SFTabs.storage.saveUserSettings(settings);

    // Re-render the profile list to update button states
    await renderProfileList();

    // Show status message
    if (window.SFTabs && window.SFTabs.main) {
      const profile = profilesCache.find(p => p.id === profileId);
      if (profile) {
        window.SFTabs.main.showStatus(`"${profile.name}" set as default profile`, false);
      }
    }
  } catch (error) {
    if (window.SFTabs && window.SFTabs.main) {
      window.SFTabs.main.showStatus('Error setting default profile: ' + error.message, true);
    }
  }
}

/**
 * Show profile edit form
 */
function showProfileEditForm(profile = null) {

  // Store the profile being edited
  editingProfile = profile;

  // Hide other action panel content
  const tabSettingsContent = document.querySelector('#tab-settings-content');
  const profileListContent = document.querySelector('#profile-list-content');
  const profileEditContent = document.querySelector('#profile-edit-content');
  const actionPanelTitle = document.querySelector('#action-panel-title');

  if (tabSettingsContent) tabSettingsContent.style.display = 'none';
  if (profileListContent) profileListContent.style.display = 'none';
  if (profileEditContent) profileEditContent.style.display = 'block';

  // Update title
  const profileEditTitle = document.querySelector('#profile-edit-title');
  if (profileEditTitle) {
    profileEditTitle.textContent = profile ? `Edit Profile: ${profile.name}` : 'New Profile';
  }
  if (actionPanelTitle) {
    actionPanelTitle.textContent = profile ? 'Edit Profile' : 'New Profile';
  }

  // Populate form
  const profileNameInput = document.querySelector('#profile-name');

  if (profileNameInput) {
    profileNameInput.value = profile ? profile.name : '';
    updateCharacterCounter(profileNameInput.value.length);
  }

  // Show/hide URL patterns section based on auto-switch setting
  const autoSwitchCheckbox = document.querySelector('#auto-switch-profiles');
  if (autoSwitchCheckbox) {
    toggleUrlPatternsSection(autoSwitchCheckbox.checked);
  }

  // Render URL patterns if profile exists
  if (profile && profile.urlPatterns) {
    renderUrlPatternList(profile.urlPatterns);
  } else {
    renderUrlPatternList([]);
  }

  // Show action panel if not already visible
  if (window.SFTabs && window.SFTabs.main) {
    const actionPanel = window.SFTabs.main.getDOMElements().actionPanel;
    const mainContent = window.SFTabs.main.getDOMElements().mainContent;

    if (actionPanel && mainContent) {
      mainContent.classList.remove('active');
      mainContent.style.display = 'none';
      actionPanel.classList.add('active');
      actionPanel.style.display = 'block';
    }
  }
}

/**
 * Render URL pattern list
 */
function renderUrlPatternList(patterns) {
  const patternList = document.querySelector('#url-pattern-list');
  const patternCount = document.querySelector('#url-pattern-count');

  if (!patternList) return;

  // Update count
  if (patternCount) {
    patternCount.textContent = patterns.length;
  }

  // Clear existing items
  patternList.innerHTML = '';

  if (patterns.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-list-state';
    emptyState.textContent = 'No URL patterns yet. Add one above.';
    patternList.appendChild(emptyState);
    return;
  }

  // Add pattern items
  patterns.forEach((pattern, index) => {
    const patternItem = createUrlPatternItem(pattern, index);
    patternList.appendChild(patternItem);
  });
}

/**
 * Create a URL pattern list item - matches dropdown menu style
 */
function createUrlPatternItem(pattern, index) {
  const div = document.createElement('div');
  div.className = 'url-pattern-item';

  // Drag handle
  const dragHandle = SFTabs.shared.createDragHandle();

  // Label with number and pattern
  const labelSpan = document.createElement('span');
  labelSpan.className = 'url-pattern-text';
  labelSpan.textContent = `${index + 1}. ${pattern}`;
  labelSpan.dataset.pattern = pattern; // Store the actual pattern value
  labelSpan.style.flex = '1';
  labelSpan.style.fontFamily = "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace";
  labelSpan.style.fontSize = '13px';

  // Button container
  const buttonContainer = SFTabs.shared.createButtonContainer();

  // Edit button
  const editButton = SFTabs.shared.createListActionButton('edit', {
    text: 'Edit',
    title: 'Edit this URL pattern',
    onClick: () => editUrlPattern(pattern, index)
  });

  // Delete button
  const deleteButton = SFTabs.shared.createListActionButton('delete', {
    text: '×',
    title: 'Delete this URL pattern',
    onClick: () => deleteUrlPattern(index)
  });

  buttonContainer.appendChild(editButton);
  buttonContainer.appendChild(deleteButton);

  // Assemble
  div.appendChild(dragHandle);
  div.appendChild(labelSpan);
  div.appendChild(buttonContainer);

  return div;
}

/**
 * Show modal to select which profile to keep when disabling profiles
 * @returns {Promise<Object|null>} Selected profile or null if cancelled
 */
async function showProfileSelectionForDisable() {
  return new Promise(async (resolve) => {
    const modal = document.querySelector('#disable-profiles-modal');
    const keepProfileSelect = document.querySelector('#keep-profile-select');
    const confirmButton = document.querySelector('#disable-profiles-confirm-button');
    const cancelButton = document.querySelector('#disable-profiles-cancel-button');

    if (!modal || !keepProfileSelect || !confirmButton || !cancelButton) {
      resolve(null);
      return;
    }

    // Populate dropdown with all profiles
    // Clear all existing options first
    while (keepProfileSelect.firstChild) {
      keepProfileSelect.removeChild(keepProfileSelect.firstChild);
    }

    // Add placeholder option
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = 'Choose a profile...';
    keepProfileSelect.appendChild(placeholderOption);

    const settings = await SFTabs.storage.getUserSettings();
    const defaultProfileId = settings.defaultProfileId;

    profilesCache.forEach(profile => {
      const option = document.createElement('option');
      option.value = profile.id;
      option.textContent = profile.name;

      // Pre-select the default profile
      if (profile.id === defaultProfileId) {
        option.selected = true;
      }

      keepProfileSelect.appendChild(option);
    });

    // Show modal
    modal.style.display = 'flex';

    // Setup event handlers
    const handleConfirm = () => {
      const selectedProfileId = keepProfileSelect.value;

      if (!selectedProfileId) {
        alert('Please select a profile to keep');
        return;
      }

      const selectedProfile = profilesCache.find(p => p.id === selectedProfileId);

      // Clean up
      cleanup();
      resolve(selectedProfile);
    };

    const handleCancel = () => {
      cleanup();
      resolve(null);
    };

    const cleanup = () => {
      modal.style.display = 'none';
      keepProfileSelect.value = '';
      confirmButton.removeEventListener('click', handleConfirm);
      cancelButton.removeEventListener('click', handleCancel);
    };

    // Add event listeners
    confirmButton.addEventListener('click', handleConfirm);
    cancelButton.addEventListener('click', handleCancel);

    // Close on outside click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        handleCancel();
      }
    });
  });
}

/**
 * Add URL pattern
 */
function addUrlPattern() {
  const input = document.querySelector('#url-pattern-input');
  const errorDiv = document.querySelector('#url-pattern-error');

  if (!input) return;

  const pattern = input.value.trim();

  if (!pattern) {
    showUrlPatternError('Please enter a URL pattern');
    return;
  }

  // Check for duplicates across all profiles (excluding current profile being edited)
  const duplicate = profilesCache.find(p =>
    p.id !== editingProfile?.id &&
    p.urlPatterns && p.urlPatterns.includes(pattern)
  );

  if (duplicate) {
    showUrlPatternError(`URL already used by ${duplicate.name}`);
    return;
  }

  // Hide error
  if (errorDiv) {
    errorDiv.style.display = 'none';
  }

  // Add to current list (mock - just for UI demo)
  const currentPatterns = Array.from(document.querySelectorAll('.url-pattern-text')).map(el => el.dataset.pattern || el.textContent);
  currentPatterns.push(pattern);

  renderUrlPatternList(currentPatterns);

  // Clear input
  input.value = '';

}

/**
 * Show URL pattern error
 */
function showUrlPatternError(message) {
  const errorDiv = document.querySelector('#url-pattern-error');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }
}

/**
 * Edit URL pattern
 */
function editUrlPattern(pattern, index) {
  const input = document.querySelector('#url-pattern-input');
  if (input) {
    input.value = pattern;
    input.focus();
  }

  // In real implementation, we'd need to remove the old pattern when saving
}

/**
 * Delete URL pattern
 */
function deleteUrlPattern(index) {
  const currentPatterns = Array.from(document.querySelectorAll('.url-pattern-text')).map(el => el.dataset.pattern || el.textContent);
  currentPatterns.splice(index, 1);
  renderUrlPatternList(currentPatterns);

}

/**
 * Capture current domain from active Salesforce tab
 */
async function captureCurrentDomain() {
  try {
    // Query all tabs to find Salesforce tabs
    const allTabs = await browser.tabs.query({});

    // Filter for Salesforce tabs only
    const salesforceTabs = allTabs.filter(tab => {
      const url = tab.url || '';
      return url.includes('salesforce.com') ||
             url.includes('salesforce-setup.com') ||
             url.includes('force.com');
    });

    if (salesforceTabs.length === 0) {
      throw new Error('No Salesforce tabs found. Please open a Salesforce org first.');
    }

    // Find the most recently active Salesforce tab
    // Sort by lastAccessed (most recent first)
    salesforceTabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
    const targetTab = salesforceTabs[0];

    const url = targetTab.url;

    // Extract org identifier from various Salesforce URL formats
    const orgIdentifier = extractOrgIdentifier(url);

    if (!orgIdentifier) {
      throw new Error(`Could not extract org identifier from URL: ${url}`);
    }

    // Set the input value
    const input = document.querySelector('#url-pattern-input');

    if (input) {
      input.value = orgIdentifier;
      input.focus();
    }

    if (window.SFTabs && window.SFTabs.main) {
      window.SFTabs.main.showStatus(`Domain captured: ${orgIdentifier}`, false);
    }

  } catch (error) {
    if (window.SFTabs && window.SFTabs.main) {
      window.SFTabs.main.showStatus(`Error: ${error.message}`, true);
    }
  }
}

/**
 * Extract org identifier from Salesforce URL
 * @param {string} url - Full Salesforce URL
 * @returns {string|null} Org identifier or null if not found
 */
function extractOrgIdentifier(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Pattern 1: subdomain.sandbox.my.salesforce-setup.com (sandbox setup URLs)
    // Example: amplify--dev.sandbox.my.salesforce-setup.com
    const sandboxSetupMatch = hostname.match(/^([^.]+)\.sandbox\.my\.salesforce-setup\.com$/i);
    if (sandboxSetupMatch) {
      return sandboxSetupMatch[1];
    }

    // Pattern 2: subdomain.sandbox.my.salesforce.com (sandbox my domain)
    // Example: myorg--dev.sandbox.my.salesforce.com
    const sandboxMyDomainMatch = hostname.match(/^([^.]+)\.sandbox\.my\.salesforce\.com$/i);
    if (sandboxMyDomainMatch) {
      return sandboxMyDomainMatch[1];
    }

    // Pattern 3: subdomain.sandbox.lightning.force.com (sandbox lightning)
    // Example: myorg--dev.sandbox.lightning.force.com
    const sandboxLightningMatch = hostname.match(/^([^.]+)\.sandbox\.lightning\.force\.com$/i);
    if (sandboxLightningMatch) {
      return sandboxLightningMatch[1];
    }

    // Pattern 4: subdomain.develop.my.salesforce-setup.com (developer edition setup URLs)
    // Example: levelupcrm12-dev-ed.develop.my.salesforce-setup.com
    const devSetupMatch = hostname.match(/^([^.]+)\.develop\.my\.salesforce-setup\.com$/i);
    if (devSetupMatch) {
      return devSetupMatch[1];
    }

    // Pattern 5: subdomain.lightning.force.com (lightning experience)
    // Example: myorg-dev-ed.lightning.force.com
    const lightningMatch = hostname.match(/^([^.]+)\.lightning\.force\.com$/i);
    if (lightningMatch) {
      return lightningMatch[1];
    }

    // Pattern 6: subdomain.my.salesforce.com (my domain)
    // Example: myorg.my.salesforce.com
    const myDomainMatch = hostname.match(/^([^.]+)\.my\.salesforce\.com$/i);
    if (myDomainMatch) {
      return myDomainMatch[1];
    }

    // Pattern 7: subdomain.salesforce.com (standard)
    // Example: myorg.salesforce.com
    const standardMatch = hostname.match(/^([^.]+)\.salesforce\.com$/i);
    if (standardMatch) {
      return standardMatch[1];
    }

    // Pattern 8: subdomain.my.salesforce-setup.com (setup URLs)
    // Example: myorg-dev-ed.my.salesforce-setup.com
    const setupMatch = hostname.match(/^([^.]+)\.my\.salesforce-setup\.com$/i);
    if (setupMatch) {
      return setupMatch[1];
    }

    // Pattern 9: subdomain.develop.lightning.force.com (developer edition)
    // Example: myorg-dev-ed.develop.lightning.force.com
    const devLightningMatch = hostname.match(/^([^.]+)\.develop\.lightning\.force\.com$/i);
    if (devLightningMatch) {
      return devLightningMatch[1];
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Save profile
 */
async function saveProfile() {
  const nameInput = document.querySelector('#profile-name');

  if (!nameInput) return;

  const name = nameInput.value.trim();

  if (!name) {
    if (window.SFTabs && window.SFTabs.main) {
      window.SFTabs.main.showStatus('Profile name is required', true);
    }
    return;
  }

  try {

    // Get URL patterns from the list
    const urlPatterns = Array.from(document.querySelectorAll('.url-pattern-text'))
      .map(el => el.dataset.pattern || el.textContent.replace(/^\d+\.\s*/, '').trim());

    if (editingProfile) {
      // Update existing profile
      const profile = profilesCache.find(p => p.id === editingProfile.id);
      if (profile) {
        profile.name = name;
        profile.urlPatterns = urlPatterns;
      }
    } else {
      // Create new profile
      const newProfile = {
        id: generateProfileId(),
        name: name,
        isDefault: profilesCache.length === 0, // First profile is default
        urlPatterns: urlPatterns,
        createdAt: new Date().toISOString(),
        lastActive: null
      };
      profilesCache.push(newProfile);

      // Initialize empty tabs for this profile
      await SFTabs.storage.saveProfileTabs(newProfile.id, []);

      // If this is the first profile, set it as default in settings
      if (profilesCache.length === 1) {
        const settings = await SFTabs.storage.getUserSettings();
        settings.defaultProfileId = newProfile.id;
        await SFTabs.storage.saveUserSettings(settings);
      }

      // Save to storage
      await SFTabs.storage.saveProfiles(profilesCache);

      if (window.SFTabs && window.SFTabs.main) {
        window.SFTabs.main.showStatus('Profile created', false);
      }

      // Switch to the newly created profile to show initialization options
      setTimeout(async () => {
        await switchActiveProfile(newProfile.id);
        // Show main content so user can see the initialization options
        if (window.SFTabs && window.SFTabs.main) {
          window.SFTabs.main.showMainContent();
        }
      }, 800);
      return; // Exit early for new profile flow
    }

    // For existing profile updates, save and show profile list
    // Save to storage
    await SFTabs.storage.saveProfiles(profilesCache);

    if (window.SFTabs && window.SFTabs.main) {
      window.SFTabs.main.showStatus('Profile saved', false);
    }

    setTimeout(async () => {
      await showProfileList();
    }, 800);
  } catch (error) {
    if (window.SFTabs && window.SFTabs.main) {
      window.SFTabs.main.showStatus('Error saving profile: ' + error.message, true);
    }
  }
}

/**
 * Delete profile
 */
async function deleteProfile(profile) {

  // Confirm deletion
  const confirmed = confirm(`Are you sure you want to delete the profile "${profile.name}"? This cannot be undone.`);
  if (!confirmed) return;

  try {
    // Remove from cache
    const index = profilesCache.findIndex(p => p.id === profile.id);
    if (index > -1) {
      profilesCache.splice(index, 1);
    }

    // Save to storage
    await SFTabs.storage.saveProfiles(profilesCache);

    // Check if this was the active or default profile
    const settings = await SFTabs.storage.getUserSettings();
    let settingsChanged = false;

    if (settings.activeProfileId === profile.id) {
      settings.activeProfileId = profilesCache.length > 0 ? profilesCache[0].id : null;
      settingsChanged = true;
    }

    if (settings.defaultProfileId === profile.id) {
      settings.defaultProfileId = profilesCache.length > 0 ? profilesCache[0].id : null;
      settingsChanged = true;
    }

    if (settingsChanged) {
      await SFTabs.storage.saveUserSettings(settings);
    }

    if (window.SFTabs && window.SFTabs.main) {
      window.SFTabs.main.showStatus(`Profile "${profile.name}" deleted`, false);
    }

    // Re-render list
    await renderProfileList();
  } catch (error) {
    if (window.SFTabs && window.SFTabs.main) {
      window.SFTabs.main.showStatus('Error deleting profile: ' + error.message, true);
    }
  }
}

/**
 * Get tabs from a specific storage location
 * @param {string} storageType - 'sync' or 'local'
 * @returns {Promise<Array>} Array of tabs
 */
async function getLegacyTabsFromStorage(storageType) {
  try {
    if (storageType === 'sync') {
      const tabs = await SFTabs.storageChunking.readChunkedSync('customTabs');
      return tabs || [];
    } else {
      const result = await browser.storage.local.get('customTabs');
      const tabs = result.customTabs || [];
      return tabs;
    }
  } catch (error) {
    return [];
  }
}

/**
 * Check for legacy tabs in the old customTabs storage
 * @returns {Promise<Array>} Array of legacy tabs, or empty array if none found
 * @deprecated Use getLegacyTabsFromStorage() instead for more control
 */
async function getLegacyTabs() {
  try {
    const useSyncStorage = await SFTabs.storage.getStoragePreference();

    if (useSyncStorage) {
      // Check sync storage
      const legacyTabs = await SFTabs.storageChunking.readChunkedSync('customTabs');
      return legacyTabs || [];
    } else {
      // Check local storage
      const result = await browser.storage.local.get('customTabs');
      return result.customTabs || [];
    }
  } catch (error) {
    return [];
  }
}

/**
 * Initialize profile with default tabs
 */
async function initializeProfileWithDefaults() {

  try {
    const settings = await SFTabs.storage.getUserSettings();
    const activeProfileId = settings.activeProfileId;

    if (!activeProfileId) {
      throw new Error('No active profile');
    }

    // Get built-in default tabs
    const defaultTabs = window.SFTabs && window.SFTabs.constants
      ? window.SFTabs.constants.DEFAULT_TABS
      : [];

    if (defaultTabs.length === 0) {
      throw new Error('No default tabs available');
    }

    // Save default tabs to the current profile
    await SFTabs.storage.saveProfileTabs(activeProfileId, defaultTabs);

    // Update main tabs state and re-render
    if (window.SFTabs && window.SFTabs.main) {
      SFTabs.main.setTabs(defaultTabs);

      if (SFTabs.ui && SFTabs.ui.renderTabList) {
        SFTabs.ui.renderTabList();
      }

      SFTabs.main.showStatus('Profile initialized with default tabs', false);
    }

  } catch (error) {
    if (window.SFTabs && window.SFTabs.main) {
      window.SFTabs.main.showStatus('Error initializing profile: ' + error.message, true);
    }
  }
}

/**
 * Initialize profile as empty (save empty array to storage)
 */
async function initializeProfileEmpty() {

  try {
    const settings = await SFTabs.storage.getUserSettings();
    const activeProfileId = settings.activeProfileId;

    if (!activeProfileId) {
      throw new Error('No active profile');
    }

    // Save empty tabs array to the current profile
    const emptyTabs = [];
    await SFTabs.storage.saveProfileTabs(activeProfileId, emptyTabs);

    // Update main tabs state
    if (window.SFTabs && window.SFTabs.main) {
      SFTabs.main.setTabs(emptyTabs);

      // Hide the initialization options
      const profileInitOptions = document.querySelector('#profile-init-options');
      if (profileInitOptions) {
        profileInitOptions.style.display = 'none';
      }

      // Show regular empty state
      const domElements = SFTabs.main.getDOMElements();
      if (domElements.emptyState) {
        domElements.emptyState.style.display = 'block';
      }

      SFTabs.main.showStatus('Profile initialized (empty)', false);
    }

  } catch (error) {
    if (window.SFTabs && window.SFTabs.main) {
      window.SFTabs.main.showStatus('Error initializing profile: ' + error.message, true);
    }
  }
}

/**
 * Show clone profile selector
 */
async function showCloneProfileSelector() {

  try {
    const profileCloneSelector = document.querySelector('#profile-clone-selector');
    const cloneSourceSelect = document.querySelector('#clone-source-profile');

    if (!profileCloneSelector || !cloneSourceSelect) {
      throw new Error('Clone selector elements not found');
    }

    // Get current active profile ID so we don't show it as an option
    const settings = await SFTabs.storage.getUserSettings();
    const activeProfileId = settings.activeProfileId;

    // Populate the select with available profiles (excluding current profile)
    cloneSourceSelect.innerHTML = '<option value="">Choose a profile...</option>';

    profilesCache.forEach(profile => {
      if (profile.id !== activeProfileId) {
        const option = document.createElement('option');
        option.value = profile.id;
        option.textContent = profile.name;
        cloneSourceSelect.appendChild(option);
      }
    });

    // Show the selector
    profileCloneSelector.style.display = 'block';

    // Scroll the selector into view after a short delay to ensure it's rendered
    setTimeout(() => {
      profileCloneSelector.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }, 100);

  } catch (error) {
    if (window.SFTabs && window.SFTabs.main) {
      window.SFTabs.main.showStatus('Error showing profile selector: ' + error.message, true);
    }
  }
}

/**
 * Hide clone profile selector
 */
function hideCloneProfileSelector() {
  const profileCloneSelector = document.querySelector('#profile-clone-selector');
  if (profileCloneSelector) {
    profileCloneSelector.style.display = 'none';
  }

  // Reset the select
  const cloneSourceSelect = document.querySelector('#clone-source-profile');
  if (cloneSourceSelect) {
    cloneSourceSelect.value = '';
  }
}

/**
 * Confirm clone profile
 */
async function confirmCloneProfile() {

  try {
    const cloneSourceSelect = document.querySelector('#clone-source-profile');
    const sourceProfileId = cloneSourceSelect ? cloneSourceSelect.value : null;

    if (!sourceProfileId) {
      throw new Error('Please select a profile to clone');
    }

    const settings = await SFTabs.storage.getUserSettings();
    const activeProfileId = settings.activeProfileId;

    if (!activeProfileId) {
      throw new Error('No active profile');
    }

    // Get tabs from the source profile
    const sourceTabs = await SFTabs.storage.getProfileTabs(sourceProfileId);

    if (!sourceTabs || sourceTabs.length === 0) {
      throw new Error('Source profile has no tabs to clone');
    }

    // Clone the tabs (create new IDs for each tab to avoid conflicts)
    const clonedTabs = sourceTabs.map(tab => ({
      ...tab,
      id: 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    }));

    // Save cloned tabs to the current profile
    await SFTabs.storage.saveProfileTabs(activeProfileId, clonedTabs);

    // Update main tabs state and re-render
    if (window.SFTabs && window.SFTabs.main) {
      SFTabs.main.setTabs(clonedTabs);

      if (SFTabs.ui && SFTabs.ui.renderTabList) {
        SFTabs.ui.renderTabList();
      }

      const sourceProfile = profilesCache.find(p => p.id === sourceProfileId);
      const sourceName = sourceProfile ? sourceProfile.name : 'selected profile';
      SFTabs.main.showStatus(`Cloned ${clonedTabs.length} tabs from "${sourceName}"`, false);
    }

    // Hide the selector
    hideCloneProfileSelector();

  } catch (error) {
    if (window.SFTabs && window.SFTabs.main) {
      window.SFTabs.main.showStatus('Error cloning profile: ' + error.message, true);
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initProfiles();
});

// Export for use by other modules
window.SFTabs = window.SFTabs || {};
window.SFTabs.profiles = {
  initProfiles,
  loadProfiles,
  toggleProfilesEnabled,
  showProfileList,
  showProfileEditForm,
  switchActiveProfile,
  updateActiveProfileBanner,
  showProfileSelectionForDisable
};
