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
    console.log('Loaded', profilesCache.length, 'profiles from storage');
  } catch (error) {
    console.error('Error loading profiles:', error);
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
  console.log('Initializing profiles UI');

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

  // Check if profiles are enabled but no profiles exist (upgrade scenario)
  if (settings.profilesEnabled && profilesCache.length === 0) {
    console.log('Profiles enabled but no profiles exist - creating Default profile');

    // Get current tabs to save to the Default profile
    const currentTabs = SFTabs.main.getTabs();

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

    // Save current tabs to this profile
    await SFTabs.storage.saveProfileTabs(defaultProfile.id, currentTabs);

    // Set as default and active profile in settings
    settings.defaultProfileId = defaultProfile.id;
    settings.activeProfileId = defaultProfile.id;
    await SFTabs.storage.saveUserSettings(settings);

    console.log('Default profile created on init:', defaultProfile.id);
  }

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
      settings.profilesEnabled = enabled;

      // If enabling profiles for the first time, create a Default profile
      if (enabled && profilesCache.length === 0) {
        console.log('Profiles enabled for the first time - creating Default profile');

        // Get current tabs to save to the Default profile
        const currentTabs = SFTabs.main.getTabs();

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

        // Save current tabs to this profile
        await SFTabs.storage.saveProfileTabs(defaultProfile.id, currentTabs);

        // Set as default and active profile in settings
        settings.defaultProfileId = defaultProfile.id;
        settings.activeProfileId = defaultProfile.id;

        console.log('Default profile created:', defaultProfile.id);
      }

      await SFTabs.storage.saveUserSettings(settings);
      toggleProfilesEnabled(enabled);

      // Update active profile banner if profiles were just enabled
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

  console.log('Profiles initialization complete');
}

/**
 * Toggle profiles enabled/disabled
 */
function toggleProfilesEnabled(enabled) {
  console.log('Profiles enabled:', enabled);

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
  const settingsPanel = document.querySelector('#settings-panel');
  const actionPanel = document.querySelector('#action-panel');

  if (enabled) {
    if (mainContent) mainContent.classList.add('with-banner');
    if (settingsPanel) settingsPanel.classList.add('with-banner');
    if (actionPanel) actionPanel.classList.add('with-banner');

    // Update active profile banner
    updateActiveProfileBanner();
  } else {
    if (mainContent) mainContent.classList.remove('with-banner');
    if (settingsPanel) settingsPanel.classList.remove('with-banner');
    if (actionPanel) actionPanel.classList.remove('with-banner');
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
}

/**
 * Switch active profile
 */
async function switchActiveProfile(profileId) {
  console.log('Switching to profile:', profileId);

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
  } catch (error) {
    console.error('Error switching profile:', error);
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
  console.log('Showing profile list');

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
    const settingsPanel = window.SFTabs.main.getDOMElements().settingsPanel;

    if (actionPanel && mainContent && settingsPanel) {
      mainContent.classList.remove('active');
      mainContent.style.display = 'none';
      settingsPanel.classList.remove('active');
      settingsPanel.style.display = 'none';
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
  console.log('Setting default profile:', profileId);

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
    console.error('Error setting default profile:', error);
    if (window.SFTabs && window.SFTabs.main) {
      window.SFTabs.main.showStatus('Error setting default profile: ' + error.message, true);
    }
  }
}

/**
 * Show profile edit form
 */
function showProfileEditForm(profile = null) {
  console.log('Showing profile edit form', profile);

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
    const settingsPanel = window.SFTabs.main.getDOMElements().settingsPanel;

    if (actionPanel && mainContent && settingsPanel) {
      mainContent.classList.remove('active');
      mainContent.style.display = 'none';
      settingsPanel.classList.remove('active');
      settingsPanel.style.display = 'none';
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
  const currentPatterns = Array.from(document.querySelectorAll('.url-pattern-text')).map(el => el.textContent);
  currentPatterns.push(pattern);

  renderUrlPatternList(currentPatterns);

  // Clear input
  input.value = '';

  console.log('URL pattern added:', pattern);
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
  console.log('Editing URL pattern:', pattern, 'at index:', index);
}

/**
 * Delete URL pattern
 */
function deleteUrlPattern(index) {
  const currentPatterns = Array.from(document.querySelectorAll('.url-pattern-text')).map(el => el.textContent);
  currentPatterns.splice(index, 1);
  renderUrlPatternList(currentPatterns);

  console.log('URL pattern deleted at index:', index);
}

/**
 * Capture current domain
 */
function captureCurrentDomain() {
  console.log('Capturing current domain...');

  // In real implementation, we'd query the active tab and extract the MyDomain
  // For now, just show a demo
  const input = document.querySelector('#url-pattern-input');
  if (input) {
    input.value = 'example-dev-ed';
    input.focus();
  }

  if (window.SFTabs && window.SFTabs.main) {
    window.SFTabs.main.showStatus('Domain captured (demo): example-dev-ed', false);
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
    console.log('Saving profile:', name);

    // Get URL patterns from the list
    const urlPatterns = Array.from(document.querySelectorAll('.url-pattern-text'))
      .map(el => el.textContent.replace(/^\d+\.\s*/, '').trim());

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
    }

    // Save to storage
    await SFTabs.storage.saveProfiles(profilesCache);

    if (window.SFTabs && window.SFTabs.main) {
      window.SFTabs.main.showStatus('Profile saved', false);
    }

    setTimeout(async () => {
      await showProfileList();
    }, 800);
  } catch (error) {
    console.error('Error saving profile:', error);
    if (window.SFTabs && window.SFTabs.main) {
      window.SFTabs.main.showStatus('Error saving profile: ' + error.message, true);
    }
  }
}

/**
 * Delete profile
 */
async function deleteProfile(profile) {
  console.log('Deleting profile:', profile.name);

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
    console.error('Error deleting profile:', error);
    if (window.SFTabs && window.SFTabs.main) {
      window.SFTabs.main.showStatus('Error deleting profile: ' + error.message, true);
    }
  }
}

/**
 * Initialize profile with default tabs
 */
async function initializeProfileWithDefaults() {
  console.log('Initializing profile with default tabs');

  try {
    const settings = await SFTabs.storage.getUserSettings();
    const activeProfileId = settings.activeProfileId;

    if (!activeProfileId) {
      throw new Error('No active profile');
    }

    // Get default tabs from constants
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

    console.log('Profile initialized with', defaultTabs.length, 'default tabs');
  } catch (error) {
    console.error('Error initializing profile with defaults:', error);
    if (window.SFTabs && window.SFTabs.main) {
      window.SFTabs.main.showStatus('Error initializing profile: ' + error.message, true);
    }
  }
}

/**
 * Initialize profile as empty (just hide the initialization UI)
 */
async function initializeProfileEmpty() {
  console.log('Initializing empty profile');

  try {
    // Just hide the initialization options and show the regular empty state
    const profileInitOptions = document.querySelector('#profile-init-options');
    if (profileInitOptions) {
      profileInitOptions.style.display = 'none';
    }

    // Show regular empty state
    if (window.SFTabs && window.SFTabs.main) {
      const domElements = SFTabs.main.getDOMElements();
      if (domElements.emptyState) {
        domElements.emptyState.style.display = 'block';
      }

      SFTabs.main.showStatus('Profile initialized (empty)', false);
    }

    console.log('Profile initialized as empty');
  } catch (error) {
    console.error('Error initializing empty profile:', error);
    if (window.SFTabs && window.SFTabs.main) {
      window.SFTabs.main.showStatus('Error initializing profile: ' + error.message, true);
    }
  }
}

/**
 * Show clone profile selector
 */
async function showCloneProfileSelector() {
  console.log('Showing clone profile selector');

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
    console.error('Error showing clone profile selector:', error);
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
  console.log('Confirming clone profile');

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

    console.log('Profile cloned successfully with', clonedTabs.length, 'tabs');
  } catch (error) {
    console.error('Error cloning profile:', error);
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
  toggleProfilesEnabled,
  showProfileList,
  showProfileEditForm,
  switchActiveProfile,
  updateActiveProfileBanner
};
