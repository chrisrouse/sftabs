// popup/js/popup-profiles.js
// Profile management functionality

// Mock profile data for UI preview
const mockProfiles = [
  {
    id: 'profile_1',
    name: 'Default',
    tabCount: 5,
    urlPatterns: []
  },
  {
    id: 'profile_2',
    name: 'Work - SmartBot',
    tabCount: 8,
    urlPatterns: ['smartbottechnology-dev-ed', 'smartbot']
  },
  {
    id: 'profile_3',
    name: 'Dev - Amplify',
    tabCount: 6,
    urlPatterns: ['amplify--dev', 'amplify--uat']
  }
];

// Track the active profile
let activeProfileId = 'profile_1';

// Track the default profile
let defaultProfileId = 'profile_1';

/**
 * Initialize profiles functionality
 */
function initProfiles() {
  console.log('Initializing profiles UI');

  // Get DOM elements
  const profilesButton = document.querySelector('#profiles-button');
  const enableProfilesCheckbox = document.querySelector('#enable-profiles');
  const profileOptions = document.querySelector('#profile-options');
  const autoSwitchCheckbox = document.querySelector('#auto-switch-profiles');
  const urlPatternsSection = document.querySelector('#url-patterns-section');
  const profileNameInput = document.querySelector('#profile-name');
  const profileNameCounter = document.querySelector('#profile-name-counter');

  // Setup event listeners
  if (profilesButton) {
    profilesButton.addEventListener('click', showProfileList);
  }

  if (enableProfilesCheckbox) {
    enableProfilesCheckbox.addEventListener('change', function() {
      toggleProfilesEnabled(this.checked);
    });
  }

  if (autoSwitchCheckbox) {
    autoSwitchCheckbox.addEventListener('change', function() {
      toggleUrlPatternsSection(this.checked);
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
    createProfileButton.addEventListener('click', showProfileEditForm);
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
function updateActiveProfileBanner() {
  const banner = document.querySelector('#active-profile-banner');
  const profileName = document.querySelector('#active-profile-name');

  if (!banner || !profileName) return;

  const activeProfile = mockProfiles.find(p => p.id === activeProfileId);

  if (activeProfile) {
    profileName.textContent = activeProfile.name;
  }
}

/**
 * Switch active profile
 */
function switchActiveProfile(profileId) {
  console.log('Switching to profile:', profileId);

  if (!profileId) return;

  activeProfileId = profileId;

  // Update banner
  updateActiveProfileBanner();

  // Update active profile selector
  const activeProfileSelector = document.querySelector('#active-profile-selector');
  if (activeProfileSelector) {
    activeProfileSelector.value = profileId;
  }

  // In real implementation, this would:
  // 1. Load tabs for the selected profile
  // 2. Update the tab list display
  // 3. Save active profile to storage

  if (window.SFTabs && window.SFTabs.main) {
    const activeProfile = mockProfiles.find(p => p.id === profileId);
    if (activeProfile) {
      window.SFTabs.main.showStatus(`Switched to profile: ${activeProfile.name}`, false);
    }
  }
}

/**
 * Populate active profile selector
 */
function populateActiveProfileSelector() {
  const selector = document.querySelector('#active-profile-selector');
  if (!selector) return;

  // Clear existing options except the first one
  selector.innerHTML = '<option value="">Select a profile...</option>';

  // Add mock profiles
  mockProfiles.forEach(profile => {
    const option = document.createElement('option');
    option.value = profile.id;
    option.textContent = profile.name;
    selector.appendChild(option);
  });

  // Set current active profile
  selector.value = activeProfileId;
}

/**
 * Show profile list
 */
function showProfileList() {
  console.log('Showing profile list');

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
  populateActiveProfileSelector();

  // Render profile list with mock data
  renderProfileList();

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
function renderProfileList() {
  const profileList = document.querySelector('#profile-list');
  const profileCount = document.querySelector('#profile-count');

  if (!profileList) return;

  // Update count
  if (profileCount) {
    profileCount.textContent = mockProfiles.length;
  }

  // Clear existing items
  profileList.innerHTML = '';

  // Add profile items
  mockProfiles.forEach((profile, index) => {
    const profileItem = createProfileListItem(profile, index);
    profileList.appendChild(profileItem);
  });
}

/**
 * Create a profile list item - matches dropdown menu style
 */
function createProfileListItem(profile, index) {
  const div = document.createElement('div');
  div.className = 'profile-item';

  // Drag handle
  const dragHandle = document.createElement('span');
  dragHandle.textContent = '⋮⋮';
  dragHandle.style.marginRight = '8px';
  dragHandle.style.color = '#706e6b';
  dragHandle.style.cursor = 'grab';
  dragHandle.style.fontSize = '14px';

  // Label with number
  const labelSpan = document.createElement('span');
  labelSpan.textContent = `${index + 1}. ${profile.name}`;
  labelSpan.style.flex = '1';

  // Button container
  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex';
  buttonContainer.style.gap = '4px';
  buttonContainer.style.alignItems = 'center';

  // Default button (D)
  const defaultButton = document.createElement('button');
  defaultButton.type = 'button';
  defaultButton.textContent = 'D';
  defaultButton.style.fontSize = '11px';
  defaultButton.style.padding = '2px 6px';
  defaultButton.style.fontWeight = '600';
  defaultButton.style.border = 'none';
  defaultButton.style.borderRadius = '3px';
  defaultButton.style.cursor = 'pointer';
  defaultButton.style.lineHeight = '1';
  defaultButton.title = 'Set as default profile';

  // Highlight if this is the default profile
  const isDefault = profile.id === defaultProfileId;
  if (isDefault) {
    defaultButton.style.background = '#2e844a';
    defaultButton.style.color = 'white';
  } else {
    defaultButton.style.background = '#e0e0e0';
    defaultButton.style.color = '#706e6b';
  }

  defaultButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDefaultProfile(profile.id);
  });

  // Edit button
  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.textContent = 'Edit';
  editButton.style.fontSize = '11px';
  editButton.style.padding = '2px 6px';
  editButton.style.background = '#0176d3';
  editButton.style.color = 'white';
  editButton.style.border = 'none';
  editButton.style.borderRadius = '3px';
  editButton.style.cursor = 'pointer';
  editButton.title = 'Edit this profile';
  editButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showProfileEditForm(profile);
  });

  // Delete button
  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.textContent = '×';
  deleteButton.style.fontSize = '16px';
  deleteButton.style.padding = '2px 6px';
  deleteButton.style.background = '#c23934';
  deleteButton.style.color = 'white';
  deleteButton.style.border = 'none';
  deleteButton.style.borderRadius = '3px';
  deleteButton.style.cursor = 'pointer';
  deleteButton.style.lineHeight = '1';
  deleteButton.title = 'Delete this profile';
  deleteButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    deleteProfile(profile);
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
function setDefaultProfile(profileId) {
  console.log('Setting default profile:', profileId);

  defaultProfileId = profileId;

  // Re-render the profile list to update button states
  renderProfileList();

  // Show status message
  if (window.SFTabs && window.SFTabs.main) {
    const profile = mockProfiles.find(p => p.id === profileId);
    if (profile) {
      window.SFTabs.main.showStatus(`"${profile.name}" set as default profile`, false);
    }
  }

  // In real implementation, save to storage
}

/**
 * Show profile edit form
 */
function showProfileEditForm(profile = null) {
  console.log('Showing profile edit form', profile);

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
  const dragHandle = document.createElement('span');
  dragHandle.textContent = '⋮⋮';
  dragHandle.style.marginRight = '8px';
  dragHandle.style.color = '#706e6b';
  dragHandle.style.cursor = 'grab';
  dragHandle.style.fontSize = '14px';

  // Label with number and pattern
  const labelSpan = document.createElement('span');
  labelSpan.textContent = `${index + 1}. ${pattern}`;
  labelSpan.style.flex = '1';
  labelSpan.style.fontFamily = "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace";
  labelSpan.style.fontSize = '13px';

  // Button container
  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex';
  buttonContainer.style.gap = '4px';
  buttonContainer.style.alignItems = 'center';

  // Edit button
  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.textContent = 'Edit';
  editButton.style.fontSize = '11px';
  editButton.style.padding = '2px 6px';
  editButton.style.background = '#0176d3';
  editButton.style.color = 'white';
  editButton.style.border = 'none';
  editButton.style.borderRadius = '3px';
  editButton.style.cursor = 'pointer';
  editButton.title = 'Edit this URL pattern';
  editButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    editUrlPattern(pattern, index);
  });

  // Delete button
  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.textContent = '×';
  deleteButton.style.fontSize = '16px';
  deleteButton.style.padding = '2px 6px';
  deleteButton.style.background = '#c23934';
  deleteButton.style.color = 'white';
  deleteButton.style.border = 'none';
  deleteButton.style.borderRadius = '3px';
  deleteButton.style.cursor = 'pointer';
  deleteButton.style.lineHeight = '1';
  deleteButton.title = 'Delete this URL pattern';
  deleteButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    deleteUrlPattern(index);
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

  // Check for duplicates across all profiles (mock validation)
  const duplicate = mockProfiles.find(p =>
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
function saveProfile() {
  const nameInput = document.querySelector('#profile-name');

  if (!nameInput) return;

  const name = nameInput.value.trim();

  if (!name) {
    if (window.SFTabs && window.SFTabs.main) {
      window.SFTabs.main.showStatus('Profile name is required', true);
    }
    return;
  }

  console.log('Saving profile:', name);

  // In real implementation, save to storage
  // For now, just show success and return to list
  if (window.SFTabs && window.SFTabs.main) {
    window.SFTabs.main.showStatus('Profile saved (demo)', false);
  }

  setTimeout(() => {
    showProfileList();
  }, 800);
}

/**
 * Delete profile
 */
function deleteProfile(profile) {
  console.log('Deleting profile:', profile.name);

  // In real implementation, show confirmation modal and delete from storage
  if (window.SFTabs && window.SFTabs.main) {
    window.SFTabs.main.showStatus(`Profile "${profile.name}" deleted (demo)`, false);
  }

  // Re-render list (in real implementation, remove from array first)
  setTimeout(() => {
    renderProfileList();
  }, 500);
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
