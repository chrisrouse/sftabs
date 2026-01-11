// popup/settings.js
// Standalone settings page functionality

let userSettings = {};

/**
 * Initialize the settings page
 */
async function initSettingsPage() {
	// Load user settings
	await loadUserSettings();

	// Load profiles if the profiles module is available (needed for disable profiles modal)
	if (window.SFTabs && window.SFTabs.profiles && typeof window.SFTabs.profiles.loadProfiles === 'function') {
		try {
			await window.SFTabs.profiles.loadProfiles();
		} catch (error) {
			// Silently handle profile loading errors
		}
	}

	// Apply current theme
	applyTheme();

	// Initialize UI
	initThemeSelector();
	updateUI();
	setupEventListeners();
}

/**
 * Load user settings from storage
 */
async function loadUserSettings() {
	try {
		// Check BOTH storages to determine which to use
		const [localResult, syncResult] = await Promise.all([
			browser.storage.local.get('userSettings'),
			browser.storage.sync.get('userSettings')
		]);

		// Priority 1: If sync storage has useSyncStorage=true, use sync storage (it's the source of truth)
		if (syncResult.userSettings && syncResult.userSettings.useSyncStorage === true) {
			userSettings = { ...SFTabs.constants.DEFAULT_SETTINGS, ...syncResult.userSettings };
			// Cache in local storage for faster access
			await browser.storage.local.set({ userSettings });
			return;
		}

		// Priority 2: Use local storage if it exists
		if (localResult.userSettings) {
			userSettings = { ...SFTabs.constants.DEFAULT_SETTINGS, ...localResult.userSettings };
			return;
		}

		// Priority 3: Use sync storage if it exists (backward compatibility for v1.x users)
		if (syncResult.userSettings) {
			userSettings = { ...SFTabs.constants.DEFAULT_SETTINGS, ...syncResult.userSettings };

			// If useSyncStorage is not explicitly set, this is an existing user from before v2.1
			// when sync was the default - preserve that behavior
			if (typeof syncResult.userSettings.useSyncStorage !== 'boolean') {
				userSettings.useSyncStorage = true;
			}
			return;
		}

		// Priority 4: No settings found - use defaults
		userSettings = { ...SFTabs.constants.DEFAULT_SETTINGS };
	} catch (error) {
		console.error('[Settings] Error loading settings:', error);
		userSettings = { ...SFTabs.constants.DEFAULT_SETTINGS };
	}
}

/**
 * Save user settings to storage
 */
async function saveUserSettings() {
	try {
		// Respect storage preference
		if (userSettings.useSyncStorage) {
			// Save to sync storage AND cache in local
			await browser.storage.sync.set({ userSettings });
			await browser.storage.local.set({ userSettings });
		} else {
			// Save to local storage only AND remove from sync
			await browser.storage.local.set({ userSettings });
			await browser.storage.sync.remove('userSettings');
		}

		showStatus('Settings saved', false);
	} catch (error) {
		console.error('[Settings] Error saving settings:', error);
		showStatus('Error saving settings: ' + error.message, true);
	}
}

/**
 * Apply theme based on current settings
 */
function applyTheme() {
	if (userSettings.themeMode === 'system') {
		// Check system preference
		if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
			document.documentElement.setAttribute('data-theme', 'dark');
		} else {
			document.documentElement.setAttribute('data-theme', 'light');
		}

		// Listen for changes in system theme
		window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
			const newTheme = e.matches ? 'dark' : 'light';
			document.documentElement.setAttribute('data-theme', newTheme);
		});
	} else {
		// Apply user selected theme
		document.documentElement.setAttribute('data-theme', userSettings.themeMode);
	}
}

/**
 * Initialize the theme selector UI
 */
function initThemeSelector() {
	const themeOptions = document.querySelectorAll('.theme-option');
	const currentTheme = userSettings.themeMode || 'light';

	// Add click handlers to theme options
	themeOptions.forEach(option => {
		option.addEventListener('click', async () => {
			const themeValue = option.getAttribute('data-theme-value');
			userSettings.themeMode = themeValue;
			await saveUserSettings();
			setSelectedTheme(themeValue);
			applyTheme();
		});
	});

	// Set initial selection
	setSelectedTheme(currentTheme);
}

/**
 * Set the selected theme in the UI
 */
function setSelectedTheme(theme) {
	const themeOptions = document.querySelectorAll('.theme-option');

	themeOptions.forEach(option => {
		option.classList.remove('selected');
	});

	const selectedOption = document.querySelector(`.theme-option[data-theme-value="${theme}"]`);
	if (selectedOption) {
		selectedOption.classList.add('selected');
	}
}

/**
 * Update UI to reflect current settings
 */
function updateUI() {
	// Update checkboxes
	document.getElementById('compact-mode').checked = userSettings.compactMode || false;
	document.getElementById('skip-delete-confirmation').checked = userSettings.skipDeleteConfirmation || false;
	document.getElementById('enable-profiles').checked = userSettings.profilesEnabled || false;
	document.getElementById('auto-switch-profiles').checked = userSettings.autoSwitchProfiles || false;

	// Update storage option buttons
	const useSyncStorage = userSettings.useSyncStorage !== false;
	const localOption = document.getElementById('settings-storage-option-local');
	const syncOption = document.getElementById('settings-storage-option-sync');
	const localRadio = document.getElementById('settings-storage-local');
	const syncRadio = document.getElementById('settings-storage-sync');

	if (useSyncStorage) {
		syncOption.classList.add('active');
		localOption.classList.remove('active');
		syncRadio.checked = true;
		localRadio.checked = false;
	} else {
		localOption.classList.add('active');
		syncOption.classList.remove('active');
		localRadio.checked = true;
		syncRadio.checked = false;
	}

	// Update floating button settings
	if (!userSettings.floatingButton) {
		userSettings.floatingButton = { ...SFTabs.constants.DEFAULT_SETTINGS.floatingButton };
	}

	// Migrate old displayMode to new location setting
	if (userSettings.floatingButton.displayMode && !userSettings.floatingButton.location) {
		const displayMode = userSettings.floatingButton.displayMode;
		if (displayMode === 'setup-only') {
			// Old "setup-only" meant no floating button
			userSettings.floatingButton.enabled = false;
			userSettings.floatingButton.location = 'everywhere';
		} else if (displayMode === 'both') {
			userSettings.floatingButton.location = 'everywhere';
		} else if (displayMode === 'floating-only') {
			// Old "floating-only" becomes everywhere (Setup tabs always show now)
			userSettings.floatingButton.location = 'everywhere';
		} else if (displayMode === 'hide-in-setup') {
			userSettings.floatingButton.location = 'outside-setup';
		}
		delete userSettings.floatingButton.displayMode;
	}

	document.getElementById('floating-button-enabled').checked = userSettings.floatingButton.enabled || false;

	// Set the location radio button
	const location = userSettings.floatingButton.location || 'everywhere';
	const locationRadio = document.getElementById(`floating-location-${location}`);
	if (locationRadio) {
		locationRadio.checked = true;
	}

	document.getElementById('floating-button-position').value = userSettings.floatingButton.position || 25;
	document.getElementById('floating-button-position-value').textContent = `${userSettings.floatingButton.position || 25}%`;

	// Show/hide auto-switch option based on profiles enabled
	toggleAutoSwitchVisibility();

	// Show/hide floating button settings based on enabled
	toggleFloatingButtonSettings();
}

/**
 * Toggle auto-switch profiles visibility and disable profiles section
 */
function toggleAutoSwitchVisibility() {
	const autoSwitchContainer = document.getElementById('auto-switch-container');
	const disableProfilesContainer = document.getElementById('disable-profiles-container');
	const enableProfilesCheckbox = document.getElementById('enable-profiles');
	const profilesEnabled = enableProfilesCheckbox.checked;

	autoSwitchContainer.style.display = profilesEnabled ? 'block' : 'none';
	disableProfilesContainer.style.display = profilesEnabled ? 'block' : 'none';

	// Disable the checkbox when profiles are enabled (user must use Disable Profiles button)
	enableProfilesCheckbox.disabled = profilesEnabled;

	// Populate the profile dropdown when showing the section
	if (profilesEnabled && window.SFTabs && window.SFTabs.profiles && window.SFTabs.profiles.populateProfileSelect) {
		window.SFTabs.profiles.populateProfileSelect();
	}
}

/**
 * Toggle floating button settings visibility
 */
function toggleFloatingButtonSettings() {
	const settingsContainer = document.getElementById('floating-button-settings');
	const enabled = document.getElementById('floating-button-enabled').checked;
	settingsContainer.style.display = enabled ? 'block' : 'none';
}


/**
 * Setup sidebar navigation
 */
function setupNavigation() {
	const navItems = document.querySelectorAll('.settings-nav-item');
	const sections = document.querySelectorAll('.settings-section');

	navItems.forEach((item, index) => {
		// Make nav items keyboard accessible
		item.setAttribute('tabindex', '0');
		item.setAttribute('role', 'button');
		item.setAttribute('aria-label', `Navigate to ${item.textContent.trim()} section`);

		// Handle navigation activation
		const activateNavItem = () => {
			const sectionId = item.dataset.section;

			// Update active nav item
			navItems.forEach(nav => {
				nav.classList.remove('active');
				nav.setAttribute('aria-selected', 'false');
			});
			item.classList.add('active');
			item.setAttribute('aria-selected', 'true');

			// Show corresponding section
			sections.forEach(section => section.classList.remove('active'));
			document.getElementById(`section-${sectionId}`).classList.add('active');
		};

		// Click handler
		item.addEventListener('click', activateNavItem);

		// Keyboard handler (Enter and Space)
		item.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				activateNavItem();
			}
			// Arrow key navigation
			else if (e.key === 'ArrowDown') {
				e.preventDefault();
				const nextItem = navItems[index + 1];
				if (nextItem) nextItem.focus();
			}
			else if (e.key === 'ArrowUp') {
				e.preventDefault();
				const prevItem = navItems[index - 1];
				if (prevItem) prevItem.focus();
			}
		});
	});

	// Set initial aria-selected state
	navItems.forEach(item => {
		item.setAttribute('aria-selected', item.classList.contains('active') ? 'true' : 'false');
	});
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
	// Setup sidebar navigation
	setupNavigation();

	// Compact mode
	document.getElementById('compact-mode').addEventListener('change', async (e) => {
		userSettings.compactMode = e.target.checked;
		await saveUserSettings();
	});

	// Skip delete confirmation
	document.getElementById('skip-delete-confirmation').addEventListener('change', async (e) => {
		userSettings.skipDeleteConfirmation = e.target.checked;
		await saveUserSettings();
	});

	// Storage option buttons
	const storageOptions = document.querySelectorAll('[data-storage]');
	storageOptions.forEach(option => {
		option.addEventListener('click', async () => {
			const storageType = option.getAttribute('data-storage');
			const newValue = storageType === 'sync';
			const oldValue = userSettings.useSyncStorage;

			// Don't do anything if already selected
			if (newValue === oldValue) {
				return;
			}

			// When ENABLING sync, check for conflicts
			if (newValue) {
				const conflict = await detectSyncConflict();

				if (conflict.hasConflict) {
					// Show conflict resolution UI
					await showSyncConflictDialog(conflict);
					return;
				}
			}

			const confirmed = confirm(
				newValue
					? 'Enable cross-device sync?\n\nYour tabs will be synced across all your computers using browser sync. This allows you to access your custom tabs on any device where you\'re signed in.\n\nNote: Large configurations (>100KB) may not sync properly. Click OK to continue.'
					: 'Disable cross-device sync?\n\nYour tabs will only be stored on this computer. They will not sync to other devices.\n\nClick OK to continue.'
			);

			if (confirmed) {
				userSettings.useSyncStorage = newValue;
				try {
					// Perform migration if needed
					await migrateBetweenStorageTypes(oldValue, newValue);
					await saveUserSettings();

					// Update UI
					const localOption = document.getElementById('settings-storage-option-local');
					const syncOption = document.getElementById('settings-storage-option-sync');
					const localRadio = document.getElementById('settings-storage-local');
					const syncRadio = document.getElementById('settings-storage-sync');

					if (newValue) {
						syncOption.classList.add('active');
						localOption.classList.remove('active');
						syncRadio.checked = true;
						localRadio.checked = false;
					} else {
						localOption.classList.add('active');
						syncOption.classList.remove('active');
						localRadio.checked = true;
						syncRadio.checked = false;
					}

					showStatus(
						newValue ? 'Sync enabled - tabs will now sync across devices' : 'Sync disabled - tabs stored locally only',
						false
					);
				} catch (error) {
					showStatus('Error: ' + error.message, true);
					userSettings.useSyncStorage = oldValue;
					// Restore UI state
					updateUI();
				}
			}
		});
	});

	// Enable profiles
	document.getElementById('enable-profiles').addEventListener('change', async (e) => {
		const enableProfiles = e.target.checked;

		if (enableProfiles) {
			userSettings.profilesEnabled = true;
			await saveUserSettings();
			toggleAutoSwitchVisibility();
		}
		// Note: Checkbox is disabled when profiles are enabled, so user cannot uncheck it
		// They must use the "Disable Profiles" button instead
	});

	// Disable profiles button (inline section)
	document.getElementById('disable-profiles-button').addEventListener('click', async () => {
		if (window.SFTabs && window.SFTabs.profiles && window.SFTabs.profiles.disableProfilesFromInline) {
			await window.SFTabs.profiles.disableProfilesFromInline();
		}
	});

	// Auto-switch profiles
	document.getElementById('auto-switch-profiles').addEventListener('change', async (e) => {
		userSettings.autoSwitchProfiles = e.target.checked;
		await saveUserSettings();
	});

	// Floating button enabled
	document.getElementById('floating-button-enabled').addEventListener('change', async (e) => {
		if (!userSettings.floatingButton) {
			userSettings.floatingButton = { ...SFTabs.constants.DEFAULT_SETTINGS.floatingButton };
		}
		userSettings.floatingButton.enabled = e.target.checked;
		await saveUserSettings();
		toggleFloatingButtonSettings();
	});

	// Floating button location radio buttons
	const locationRadios = document.querySelectorAll('input[name="floating-button-location"]');
	locationRadios.forEach(radio => {
		radio.addEventListener('change', async (e) => {
			if (!userSettings.floatingButton) {
				userSettings.floatingButton = { ...SFTabs.constants.DEFAULT_SETTINGS.floatingButton };
			}
			userSettings.floatingButton.location = e.target.value;
			await saveUserSettings();
		});
	});

	// Floating button position
	const positionSlider = document.getElementById('floating-button-position');
	const positionValue = document.getElementById('floating-button-position-value');

	positionSlider.addEventListener('input', (e) => {
		positionValue.textContent = `${e.target.value}%`;
	});

	positionSlider.addEventListener('change', async (e) => {
		if (!userSettings.floatingButton) {
			userSettings.floatingButton = { ...SFTabs.constants.DEFAULT_SETTINGS.floatingButton };
		}
		userSettings.floatingButton.position = parseInt(e.target.value);
		await saveUserSettings();
	});

	// Export mode radio buttons
	document.getElementById('export-everything-radio').addEventListener('change', () => {
		toggleExportCustomOptions();
	});

	document.getElementById('export-custom-radio').addEventListener('change', () => {
		toggleExportCustomOptions();
	});

	// Export configuration button
	document.getElementById('export-configuration-button').addEventListener('click', async () => {
		await performExportFromInline();
	});

	// Import button
	document.getElementById('import-button').addEventListener('click', () => {
		document.getElementById('import-file-input').click();
	});

	// Import file input
	document.getElementById('import-file-input').addEventListener('change', (e) => {
		const file = e.target.files[0];
		if (file) {
			importConfiguration(file);
		}
	});

	// Import cancel button
	document.getElementById('import-cancel-button').addEventListener('click', () => {
		hideImportOptions();
	});

	// Import confirm button
	document.getElementById('import-confirm-button').addEventListener('click', async () => {
		await performImportFromInline();
	});

	// Import destination radio buttons
	const importDestRadios = document.querySelectorAll('input[name="import-destination"]');
	importDestRadios.forEach(radio => {
		radio.addEventListener('change', (e) => {
			const addSection = document.getElementById('import-add-section');
			const overwriteSection = document.getElementById('import-overwrite-section');
			const newProfileSection = document.getElementById('import-new-profile-section');

			// Hide all sections first
			addSection.style.display = 'none';
			overwriteSection.style.display = 'none';
			newProfileSection.style.display = 'none';

			// Show the appropriate section
			if (e.target.value === 'add') {
				addSection.style.display = 'block';
			} else if (e.target.value === 'overwrite') {
				overwriteSection.style.display = 'block';
			} else if (e.target.value === 'new') {
				newProfileSection.style.display = 'block';
			}
		});
	});

	// Reset button
	document.getElementById('reset-button').addEventListener('click', async () => {
		const confirmed = confirm(
			'Reset all tabs and settings to their default values?\n\n' +
			'This will remove all custom tabs, reset all settings, and remove all profiles. ' +
			'This action cannot be undone.'
		);

		if (confirmed) {
			await resetToDefaults();
		}
	});

	// User guide link
	document.getElementById('user-guide-link').addEventListener('click', (e) => {
		e.preventDefault();
		browser.tabs.create({
			url: 'https://chrisrouse.github.io/sftabs/'
		});
	});

	// Export before disable link (navigate to Import/Export section)
	document.getElementById('export-before-disable-link').addEventListener('click', (e) => {
		e.preventDefault();

		// Navigate to Import/Export section
		const navItems = document.querySelectorAll('.settings-nav-item');
		const sections = document.querySelectorAll('.settings-section');

		navItems.forEach(nav => {
			nav.classList.remove('active');
			nav.setAttribute('aria-selected', 'false');
		});

		const importExportNav = document.querySelector('.settings-nav-item[data-section="import-export"]');
		if (importExportNav) {
			importExportNav.classList.add('active');
			importExportNav.setAttribute('aria-selected', 'true');
		}

		sections.forEach(section => section.classList.remove('active'));
		const importExportSection = document.getElementById('section-import-export');
		if (importExportSection) {
			importExportSection.classList.add('active');
			importExportSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	});

	// Export before reset link (navigate to Import/Export section)
	document.getElementById('export-before-reset-link').addEventListener('click', (e) => {
		e.preventDefault();

		// Navigate to Import/Export section
		const navItems = document.querySelectorAll('.settings-nav-item');
		const sections = document.querySelectorAll('.settings-section');

		navItems.forEach(nav => {
			nav.classList.remove('active');
			nav.setAttribute('aria-selected', 'false');
		});

		const importExportNav = document.querySelector('.settings-nav-item[data-section="import-export"]');
		if (importExportNav) {
			importExportNav.classList.add('active');
			importExportNav.setAttribute('aria-selected', 'true');
		}

		sections.forEach(section => section.classList.remove('active'));
		const importExportSection = document.getElementById('section-import-export');
		if (importExportSection) {
			importExportSection.classList.add('active');
			importExportSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	});
}

/**
 * Toggle export custom options visibility
 */
function toggleExportCustomOptions() {
	const customOptions = document.getElementById('export-custom-options');
	const customRadio = document.getElementById('export-custom-radio');

	if (customRadio.checked) {
		customOptions.style.display = 'block';
		populateInlineProfilesList();
	} else {
		customOptions.style.display = 'none';
	}
}

/**
 * Populate inline profiles list with tab counts
 */
async function populateInlineProfilesList() {
	const profilesList = document.getElementById('export-profiles-inline');

	// Load profiles from storage
	const result = await browser.storage.sync.get(['profiles', 'userSettings']);
	const profiles = result.profiles || [];
	const settings = result.userSettings || {};

	// Clear existing content
	profilesList.innerHTML = '';

	// If no profiles exist, show a message
	if (profiles.length === 0) {
		const message = document.createElement('div');
		message.style.cssText = 'font-size: 13px; color: var(--color-text-weak); font-style: italic;';
		message.textContent = 'No profiles configured';
		profilesList.appendChild(message);
		return;
	}

	// Add checkbox for each profile with tab count
	for (const profile of profiles) {
		const profileKey = `profile_${profile.id}_tabs`;
		const profileData = await browser.storage.sync.get(profileKey);
		const tabs = profileData[profileKey] || [];
		const tabCount = tabs.length;

		const label = document.createElement('label');
		label.className = 'checkbox-group';
		label.style.cssText = 'display: flex; align-items: flex-start; gap: 8px; padding: 4px 0; margin-bottom: 6px;';

		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.checked = true;
		checkbox.className = 'export-profile-checkbox-inline';
		checkbox.dataset.profileId = profile.id;
		checkbox.style.cssText = 'margin-top: 2px;';

		const textContainer = document.createElement('div');
		textContainer.style.flex = '1';

		const nameDiv = document.createElement('div');
		nameDiv.style.cssText = 'font-weight: 500; color: var(--color-text);';
		nameDiv.textContent = profile.name;

		const countDiv = document.createElement('div');
		countDiv.style.cssText = 'font-size: 12px; color: var(--color-text-weak); margin-top: 1px;';
		countDiv.textContent = `${tabCount} tab${tabCount !== 1 ? 's' : ''}`;

		textContainer.appendChild(nameDiv);
		textContainer.appendChild(countDiv);

		label.appendChild(checkbox);
		label.appendChild(textContainer);
		profilesList.appendChild(label);
	}
}

/**
 * Perform export from inline controls
 */
async function performExportFromInline() {
	const exportMode = document.querySelector('input[name="export-mode"]:checked').value;
	const exportEverything = (exportMode === 'everything');

	let exportSettings = true;
	let selectedProfileIds = [];

	if (!exportEverything) {
		exportSettings = document.getElementById('export-settings-inline').checked;

		const profileCheckboxes = document.querySelectorAll('.export-profile-checkbox-inline');
		profileCheckboxes.forEach(cb => {
			if (cb.checked) {
				selectedProfileIds.push(cb.dataset.profileId);
			}
		});
	}

	await performExport(exportEverything, exportSettings, selectedProfileIds);
}

/**
 * Export configuration to JSON file
 */
async function performExport(exportEverything, exportSettings, selectedProfileIds) {
	try {
		const syncData = await browser.storage.sync.get(null);
		const localData = await browser.storage.local.get(null);

		const exportData = {
			version: '2.0.0',
			exportDate: new Date().toISOString()
		};

		if (exportEverything) {
			// Export everything
			exportData.settings = syncData.userSettings || {};
			exportData.profiles = syncData.profiles || [];
			exportData.profileData = {};
			exportData.chunkedData = {};

			// Export all profile tabs
			const profiles = syncData.profiles || [];
			for (const profile of profiles) {
				const profileKey = `profile_${profile.id}_tabs`;
				if (syncData[profileKey]) {
					exportData.profileData[profile.id] = syncData[profileKey];
				}
			}

			// Include all chunked data
			for (const key in syncData) {
				if (key.includes('_chunk_') || key.includes('_metadata')) {
					exportData.chunkedData[key] = syncData[key];
				}
			}
			for (const key in localData) {
				if (key.includes('_chunk_') || key.includes('_metadata')) {
					exportData.chunkedData[key] = localData[key];
				}
			}
		} else {
			// Selective export
			if (exportSettings) {
				exportData.settings = syncData.userSettings || {};
			}

			if (selectedProfileIds.length > 0) {
				const allProfiles = syncData.profiles || [];
				exportData.profiles = allProfiles.filter(p => selectedProfileIds.includes(p.id));
				exportData.profileData = {};

				// Export only selected profile tabs
				for (const profileId of selectedProfileIds) {
					const profileKey = `profile_${profileId}_tabs`;
					if (syncData[profileKey]) {
						exportData.profileData[profileId] = syncData[profileKey];
					}
				}
			}
		}

		// Create and download file
		const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;

		// Create descriptive filename
		let filename = 'sftabs';
		if (!exportEverything) {
			if (selectedProfileIds.length === 1) {
				const profileName = exportData.profiles[0].name.toLowerCase().replace(/\s+/g, '_');
				filename += `_${profileName}`;
			} else if (selectedProfileIds.length > 1) {
				filename += `_${selectedProfileIds.length}profiles`;
			}
		}
		// Add timestamp (YYYY-MM-DD_HH-MM-SS format)
		const timestamp = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
		filename += `_${timestamp}.json`;

		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);

		showStatus('Configuration exported successfully', false);
	} catch (error) {
		showStatus('Export failed: ' + error.message, true);
	}
}

// Store the parsed import data globally for the confirm button
let pendingImportData = null;

/**
 * Import configuration from JSON file
 */
async function importConfiguration(file) {
	try {
		const text = await file.text();
		const importData = JSON.parse(text);

		// Normalize the data format
		let normalizedData = normalizeImportData(importData);

		// Store for later use
		pendingImportData = normalizedData;

		// Show the inline import options
		populateImportOptions(normalizedData, file.name);
	} catch (error) {
		showStatus('Import failed: ' + error.message, true);
	}
}

/**
 * Normalize import data to a consistent format
 */
function normalizeImportData(importData) {
	// Detect if this is a pre-v2 config (legacy format)
	const isLegacyConfig = !importData.version && importData.customTabs;

	if (isLegacyConfig) {
		// Convert v1.x format to v2 format
		return {
			version: '1.x',
			exportDate: importData.exportedAt || new Date().toISOString(),
			settings: importData.userSettings || {},
			tabs: importData.customTabs || [],
			profiles: [],
			profileData: {},
			chunkedData: {}
		};
	}

	// v2.0+ format
	if (importData.version && importData.settings) {
		return importData;
	}

	// Try to detect tabs in different locations
	const tabs = importData.tabs || importData.customTabs || [];

	return {
		version: importData.version || '2.0.0',
		exportDate: importData.exportDate || importData.exportedAt || new Date().toISOString(),
		settings: importData.settings || importData.userSettings || {},
		tabs: tabs,
		profiles: importData.profiles || [],
		profileData: importData.profileData || {},
		chunkedData: importData.chunkedData || {}
	};
}

/**
 * Populate the inline import options UI
 */
async function populateImportOptions(importData, filename) {
	// Show the container
	document.getElementById('import-options-container').style.display = 'block';

	// Set filename
	document.getElementById('import-filename').textContent = filename;

	// Reset all sections
	document.getElementById('import-settings-container').style.display = 'none';
	document.getElementById('import-profiles-container').style.display = 'none';
	document.getElementById('import-tabs-container').style.display = 'none';
	document.getElementById('import-destination-container').style.display = 'none';
	document.getElementById('import-mode-container').style.display = 'none';
	document.getElementById('import-hybrid-container').style.display = 'none';
	document.getElementById('import-profiles-warning').style.display = 'none';

	// Check if profiles are enabled in current installation
	const profilesEnabled = userSettings.profilesEnabled || false;

	// Show warning if importing profiles but profiles not currently enabled
	const hasProfiles = importData.profiles && importData.profiles.length > 0 && importData.profileData && Object.keys(importData.profileData).length > 0;
	const isSingleProfile = hasProfiles && importData.profiles.length === 1;

	// Only show warning for multiple profiles (single profile has hybrid UI that explains options)
	if (hasProfiles && !profilesEnabled && !isSingleProfile) {
		document.getElementById('import-profiles-warning').style.display = 'block';
	}

	// Show settings option if available
	if (importData.settings && Object.keys(importData.settings).length > 0) {
		document.getElementById('import-settings-container').style.display = 'block';
		document.getElementById('import-settings-checkbox').checked = false; // Unchecked by default
	}

	// Handle profiles vs tabs (variables already defined above for warning check)
	if (hasProfiles && !isSingleProfile) {
		// Multiple profiles in import file
		const profilesList = document.getElementById('import-profiles-list');
		profilesList.innerHTML = '';
		document.getElementById('import-profiles-container').style.display = 'block';

		// Add checkbox for each profile with tab count
		for (const profile of importData.profiles) {
			const profileTabs = importData.profileData[profile.id] || [];
			const tabCount = profileTabs.length;

			const label = document.createElement('label');
			label.className = 'checkbox-group';
			label.style.cssText = 'display: flex; align-items: flex-start; gap: 8px; padding: 4px 0; margin-bottom: 6px;';

			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.checked = true;
			checkbox.className = 'import-profile-checkbox';
			checkbox.dataset.profileId = profile.id;
			checkbox.style.cssText = 'margin-top: 2px;';

			const textContainer = document.createElement('div');
			textContainer.style.flex = '1';

			const nameDiv = document.createElement('div');
			nameDiv.style.cssText = 'font-weight: 500; color: var(--color-text);';
			nameDiv.textContent = profile.name;

			const countDiv = document.createElement('div');
			countDiv.style.cssText = 'font-size: 12px; color: var(--color-text-weak); margin-top: 1px;';
			countDiv.textContent = `${tabCount} tab${tabCount !== 1 ? 's' : ''}`;

			textContainer.appendChild(nameDiv);
			textContainer.appendChild(countDiv);

			label.appendChild(checkbox);
			label.appendChild(textContainer);
			profilesList.appendChild(label);
		}
	} else if (isSingleProfile && !profilesEnabled) {
		// Special case: Single profile but profiles not enabled - show hybrid options
		document.getElementById('import-tabs-container').style.display = 'block';
		const profile = importData.profiles[0];
		const profileTabs = importData.profileData[profile.id] || [];
		const tabCount = profileTabs.length;
		document.getElementById('import-tabs-count').textContent = `${tabCount} tab${tabCount !== 1 ? 's' : ''} from "${profile.name}"`;

		// Show hybrid import options
		document.getElementById('import-hybrid-container').style.display = 'block';
	} else if (isSingleProfile && profilesEnabled) {
		// Single profile with profiles enabled - show destination options
		document.getElementById('import-tabs-container').style.display = 'block';
		const profile = importData.profiles[0];
		const profileTabs = importData.profileData[profile.id] || [];
		const tabCount = profileTabs.length;
		document.getElementById('import-tabs-count').textContent = `${tabCount} tab${tabCount !== 1 ? 's' : ''} from "${profile.name}"`;

		// Show destination options for profiles mode
		document.getElementById('import-destination-container').style.display = 'block';

		// Populate both profile dropdowns (add and overwrite)
		const result = await browser.storage.sync.get('profiles');
		const profiles = result.profiles || [];

		const addSelect = document.getElementById('import-profile-add-select');
		addSelect.innerHTML = '<option value="">Choose a profile...</option>';

		const overwriteSelect = document.getElementById('import-profile-select-inline');
		overwriteSelect.innerHTML = '<option value="">Choose a profile...</option>';

		profiles.forEach(profile => {
			// Add to "add" dropdown
			const addOption = document.createElement('option');
			addOption.value = profile.id;
			addOption.textContent = profile.name;
			addSelect.appendChild(addOption);

			// Add to "overwrite" dropdown
			const overwriteOption = document.createElement('option');
			overwriteOption.value = profile.id;
			overwriteOption.textContent = profile.name;
			overwriteSelect.appendChild(overwriteOption);
		});
	} else if (importData.tabs && importData.tabs.length > 0) {
		// Single set of tabs (legacy or single profile with profiles enabled)
		document.getElementById('import-tabs-container').style.display = 'block';
		const tabCount = importData.tabs.length;
		document.getElementById('import-tabs-count').textContent = `${tabCount} tab${tabCount !== 1 ? 's' : ''}`;

		// If user has profiles enabled, show destination options
		if (profilesEnabled) {
			document.getElementById('import-destination-container').style.display = 'block';

			// Populate both profile dropdowns (add and overwrite)
			const result = await browser.storage.sync.get('profiles');
			const profiles = result.profiles || [];

			const addSelect = document.getElementById('import-profile-add-select');
			addSelect.innerHTML = '<option value="">Choose a profile...</option>';

			const overwriteSelect = document.getElementById('import-profile-select-inline');
			overwriteSelect.innerHTML = '<option value="">Choose a profile...</option>';

			profiles.forEach(profile => {
				// Add to "add" dropdown
				const addOption = document.createElement('option');
				addOption.value = profile.id;
				addOption.textContent = profile.name;
				addSelect.appendChild(addOption);

				// Add to "overwrite" dropdown
				const overwriteOption = document.createElement('option');
				overwriteOption.value = profile.id;
				overwriteOption.textContent = profile.name;
				overwriteSelect.appendChild(overwriteOption);
			});
		} else {
			// Profiles not enabled - show add/replace option
			document.getElementById('import-mode-container').style.display = 'block';
		}
	}
}

/**
 * Hide the inline import options UI
 */
function hideImportOptions() {
	document.getElementById('import-options-container').style.display = 'none';
	document.getElementById('import-file-input').value = ''; // Reset file input
	pendingImportData = null;
}

/**
 * Perform import from inline UI
 */
async function performImportFromInline() {
	if (!pendingImportData) {
		showStatus('No import data available', true);
		return;
	}

	try {
		// Determine what to import
		const importSettings = document.getElementById('import-settings-checkbox')?.checked || false;

		// Check if we're in hybrid mode (single profile, profiles not enabled)
		const hybridContainer = document.getElementById('import-hybrid-container');
		const isHybridMode = hybridContainer && hybridContainer.style.display !== 'none';

		if (isHybridMode) {
			// Handle hybrid mode for single profile
			await importFromHybridMode(pendingImportData, importSettings);
		} else {
			// Check if we're importing profiles or tabs
			const profileCheckboxes = document.querySelectorAll('.import-profile-checkbox:checked');
			const tabsContainer = document.getElementById('import-tabs-container');
			const isTabsVisible = tabsContainer && tabsContainer.style.display !== 'none';

			if (profileCheckboxes.length > 0) {
				// Import selected profiles
				const selectedProfileIds = Array.from(profileCheckboxes).map(cb => cb.dataset.profileId);
				await importSelectedProfiles(pendingImportData, selectedProfileIds, importSettings);
			} else if (isTabsVisible) {
				// Check if we're importing a single profile with profiles enabled
				const hasProfiles = pendingImportData.profiles && pendingImportData.profiles.length > 0 && pendingImportData.profileData && Object.keys(pendingImportData.profileData).length > 0;
				const isSingleProfile = hasProfiles && pendingImportData.profiles.length === 1;

				if (isSingleProfile && userSettings.profilesEnabled) {
					// Extract tabs from profile data for single profile import
					const profile = pendingImportData.profiles[0];
					const profileTabs = pendingImportData.profileData[profile.id] || [];

					// Create a normalized import data structure with tabs at the root level
					const normalizedImportData = {
						...pendingImportData,
						tabs: profileTabs
					};

					await importTabsToDestination(normalizedImportData, importSettings);
				} else {
					// Import tabs to a destination (normal case)
					await importTabsToDestination(pendingImportData, importSettings);
				}
			} else if (importSettings) {
				// Only importing settings
				await importOnlySettings(pendingImportData);
			} else {
				showStatus('Please select at least one option to import', true);
				return;
			}
		}

		// Success!
		hideImportOptions();
		showStatus('Configuration imported successfully', false);

		// Reload UI
		await loadUserSettings();
		updateUI();
		applyTheme();
	} catch (error) {
		showStatus('Import failed: ' + error.message, true);
	}
}

/**
 * Import selected profiles
 */
async function importSelectedProfiles(importData, selectedProfileIds, importSettings) {
	// Enable profiles if not already enabled
	const needsProfilesEnabled = !userSettings.profilesEnabled;

	// Import settings if requested
	if (importSettings && importData.settings) {
		const mergedSettings = {
			...userSettings,
			...importData.settings,
			// Enable profiles if importing profiles
			profilesEnabled: true,
			// Preserve storage preference
			useSyncStorage: userSettings.useSyncStorage
		};
		await browser.storage.sync.set({ userSettings: mergedSettings });
		userSettings = mergedSettings;
	} else if (needsProfilesEnabled) {
		// Enable profiles even if not importing settings
		const mergedSettings = {
			...userSettings,
			profilesEnabled: true
		};
		await browser.storage.sync.set({ userSettings: mergedSettings });
		userSettings = mergedSettings;
	}

	// Import selected profiles
	const result = await browser.storage.sync.get('profiles');
	const currentProfiles = result.profiles || [];

	// Filter and import selected profiles
	const profilesToImport = importData.profiles.filter(p => selectedProfileIds.includes(p.id));

	// Add imported profiles to current profiles
	for (const profile of profilesToImport) {
		// Generate new ID to avoid conflicts
		const newProfileId = 'profile_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
		const newProfile = {
			...profile,
			id: newProfileId,
			createdAt: new Date().toISOString(),
			lastActive: new Date().toISOString()
		};

		currentProfiles.push(newProfile);

		// Import tabs for this profile
		const profileTabs = importData.profileData[profile.id] || [];
		const storageKey = `profile_${newProfileId}_tabs`;
		await browser.storage.sync.set({ [storageKey]: profileTabs });
	}

	// Save updated profiles list
	await browser.storage.sync.set({ profiles: currentProfiles });
}

/**
 * Import from hybrid mode (single profile, profiles not enabled)
 */
async function importFromHybridMode(importData, importSettings) {
	const hybridMode = document.querySelector('input[name="import-hybrid-mode"]:checked')?.value;

	if (!hybridMode) {
		throw new Error('Please select an import option');
	}

	// Get the single profile and its tabs
	const profile = importData.profiles[0];
	const tabs = importData.profileData[profile.id] || [];

	if (hybridMode === 'as-profile') {
		// Import as profile and enable profiles feature
		await importSelectedProfiles(importData, [profile.id], importSettings);
	} else if (hybridMode === 'add-tabs') {
		// Add tabs to existing tabs without enabling profiles
		if (importSettings && importData.settings) {
			const mergedSettings = {
				...userSettings,
				...importData.settings,
				// Preserve current state
				profilesEnabled: userSettings.profilesEnabled,
				activeProfileId: userSettings.activeProfileId,
				useSyncStorage: userSettings.useSyncStorage
			};
			await browser.storage.sync.set({ userSettings: mergedSettings });
		}

		// Add to existing tabs
		const useSyncStorage = await SFTabs.storage.getStoragePreference();
		let existingTabs = [];

		if (useSyncStorage) {
			existingTabs = await SFTabs.storageChunking.readChunkedSync('customTabs') || [];
		} else {
			const localResult = await browser.storage.local.get('customTabs');
			existingTabs = localResult.customTabs || [];
		}

		// Merge tabs - imported tabs get new positions after existing ones
		const maxPosition = existingTabs.length > 0 ? Math.max(...existingTabs.map(t => t.position || 0)) : -1;
		const mergedTabs = [...existingTabs];

		tabs.forEach((tab, index) => {
			mergedTabs.push({
				...tab,
				position: maxPosition + index + 1
			});
		});

		// Save merged tabs
		if (useSyncStorage) {
			await SFTabs.storageChunking.saveChunkedSync('customTabs', mergedTabs);
		} else {
			await browser.storage.local.set({ customTabs: mergedTabs });
		}
	} else if (hybridMode === 'replace-tabs') {
		// Replace all tabs without enabling profiles
		if (importSettings && importData.settings) {
			const mergedSettings = {
				...userSettings,
				...importData.settings,
				// Preserve current state
				profilesEnabled: userSettings.profilesEnabled,
				activeProfileId: userSettings.activeProfileId,
				useSyncStorage: userSettings.useSyncStorage
			};
			await browser.storage.sync.set({ userSettings: mergedSettings });
		}

		// Replace all tabs
		const useSyncStorage = await SFTabs.storage.getStoragePreference();

		if (useSyncStorage) {
			await SFTabs.storageChunking.saveChunkedSync('customTabs', tabs);
		} else {
			await browser.storage.local.set({ customTabs: tabs });
		}
	}

	// Import chunked data if available
	if (importData.chunkedData && Object.keys(importData.chunkedData).length > 0) {
		await browser.storage.local.set(importData.chunkedData);
	}
}

/**
 * Import tabs to a destination (for single tab set)
 */
async function importTabsToDestination(importData, importSettings) {
	const profilesEnabled = userSettings.profilesEnabled || false;

	// Import settings if requested
	if (importSettings && importData.settings) {
		const mergedSettings = {
			...userSettings,
			...importData.settings,
			// Preserve current profile state and storage preference
			profilesEnabled: userSettings.profilesEnabled,
			activeProfileId: userSettings.activeProfileId,
			useSyncStorage: userSettings.useSyncStorage
		};
		await browser.storage.sync.set({ userSettings: mergedSettings });
	}

	// Import tabs
	const tabs = importData.tabs || [];

	if (profilesEnabled) {
		// User has profiles enabled - check destination
		const destRadio = document.querySelector('input[name="import-destination"]:checked');

		if (destRadio.value === 'add') {
			// Add to existing profile
			const profileId = document.getElementById('import-profile-add-select').value;
			if (!profileId) {
				throw new Error('Please select a profile');
			}

			// Load existing tabs from the profile
			const storageKey = `profile_${profileId}_tabs`;
			const result = await browser.storage.sync.get(storageKey);
			const existingTabs = result[storageKey] || [];

			// Merge tabs - imported tabs get new positions after existing ones
			const maxPosition = existingTabs.length > 0 ? Math.max(...existingTabs.map(t => t.position || 0)) : -1;
			const mergedTabs = [...existingTabs];

			tabs.forEach((tab, index) => {
				mergedTabs.push({
					...tab,
					position: maxPosition + index + 1
				});
			});

			// Save merged tabs
			await browser.storage.sync.set({ [storageKey]: mergedTabs });
		} else if (destRadio.value === 'overwrite') {
			// Overwrite existing profile
			const profileId = document.getElementById('import-profile-select-inline').value;
			if (!profileId) {
				throw new Error('Please select a profile');
			}

			const storageKey = `profile_${profileId}_tabs`;
			await browser.storage.sync.set({ [storageKey]: tabs });
		} else if (destRadio.value === 'new') {
			// Create new profile
			const profileName = document.getElementById('import-new-profile-name').value.trim();
			if (!profileName) {
				throw new Error('Please enter a profile name');
			}

			const result = await browser.storage.sync.get('profiles');
			const profiles = result.profiles || [];

			const newProfileId = 'profile_' + Date.now();
			const newProfile = {
				id: newProfileId,
				name: profileName,
				createdAt: new Date().toISOString(),
				lastActive: new Date().toISOString(),
				urlPatterns: []
			};

			profiles.push(newProfile);
			await browser.storage.sync.set({ profiles });

			const storageKey = `profile_${newProfileId}_tabs`;
			await browser.storage.sync.set({ [storageKey]: tabs });
		}
	} else {
		// No profiles - check if we should add or replace
		const importMode = document.querySelector('input[name="import-mode"]:checked')?.value || 'add';

		if (importMode === 'add') {
			// Add to existing tabs
			const useSyncStorage = await SFTabs.storage.getStoragePreference();
			let existingTabs = [];

			if (useSyncStorage) {
				existingTabs = await SFTabs.storageChunking.readChunkedSync('customTabs') || [];
			} else {
				const localResult = await browser.storage.local.get('customTabs');
				existingTabs = localResult.customTabs || [];
			}

			// Merge tabs - imported tabs get new positions after existing ones
			const maxPosition = existingTabs.length > 0 ? Math.max(...existingTabs.map(t => t.position || 0)) : -1;
			const mergedTabs = [...existingTabs];

			tabs.forEach((tab, index) => {
				mergedTabs.push({
					...tab,
					position: maxPosition + index + 1
				});
			});

			// Save merged tabs
			if (useSyncStorage) {
				await SFTabs.storageChunking.saveChunkedSync('customTabs', mergedTabs);
			} else {
				await browser.storage.local.set({ customTabs: mergedTabs });
			}
		} else {
			// Replace all tabs
			const useSyncStorage = await SFTabs.storage.getStoragePreference();

			if (useSyncStorage) {
				await SFTabs.storageChunking.saveChunkedSync('customTabs', tabs);
			} else {
				await browser.storage.local.set({ customTabs: tabs });
			}
		}
	}

	// Import chunked data if available
	if (importData.chunkedData && Object.keys(importData.chunkedData).length > 0) {
		await browser.storage.local.set(importData.chunkedData);
	}
}

/**
 * Import only settings
 */
async function importOnlySettings(importData) {
	if (!importData.settings || Object.keys(importData.settings).length === 0) {
		throw new Error('No settings to import');
	}

	const mergedSettings = {
		...userSettings,
		...importData.settings,
		// Preserve current profile state and storage preference
		profilesEnabled: userSettings.profilesEnabled,
		activeProfileId: userSettings.activeProfileId,
		useSyncStorage: userSettings.useSyncStorage
	};

	await browser.storage.sync.set({ userSettings: mergedSettings });
}

/**
 * Reset everything to defaults
 */
async function resetToDefaults() {
	try {
		// Reset settings
		userSettings = { ...SFTabs.constants.DEFAULT_SETTINGS };
		await browser.storage.sync.set({ userSettings });

		// Reset tabs to defaults
		await browser.storage.sync.set({ tabs: SFTabs.constants.DEFAULT_TABS });

		// Remove profiles
		await browser.storage.sync.remove(['profiles', 'activeProfileId', 'defaultProfileId']);

		// Clear chunked data and profile-specific storage
		const syncData = await browser.storage.sync.get(null);
		const localData = await browser.storage.local.get(null);

		// Remove chunked data from sync storage
		const syncChunkedKeys = Object.keys(syncData).filter(key =>
			key.includes('_chunk_') || key.includes('_metadata') || key.startsWith('profile_')
		);
		if (syncChunkedKeys.length > 0) {
			await browser.storage.sync.remove(syncChunkedKeys);
		}

		// Remove chunked data from local storage
		const localChunkedKeys = Object.keys(localData).filter(key =>
			key.includes('_chunk_') || key.includes('_metadata') || key.startsWith('profile_')
		);
		if (localChunkedKeys.length > 0) {
			await browser.storage.local.remove(localChunkedKeys);
		}

		// Reload UI
		updateUI();
		applyTheme();

		showStatus('All settings and tabs reset to defaults', false);
	} catch (error) {
		showStatus('Reset failed: ' + error.message, true);
	}
}

/**
 * Detect if enabling sync would cause a data conflict
 * @returns {Object} Conflict information
 */
async function detectSyncConflict() {
	try {
		const [localData, syncData] = await Promise.all([
			browser.storage.local.get(['profiles', 'userSettings']),
			browser.storage.sync.get(['profiles', 'userSettings'])
		]);

		const localProfiles = localData.profiles || [];
		const syncProfiles = syncData.profiles || [];

		// Check if both have data
		const hasLocalData = localProfiles.length > 0;
		const hasSyncData = syncProfiles.length > 0;

		if (hasLocalData && hasSyncData) {
			// Get tab counts for each
			let localTabCount = 0;
			for (const profile of localProfiles) {
				const tabsKey = `profile_${profile.id}_tabs`;
				const result = await browser.storage.local.get(tabsKey);
				localTabCount += (result[tabsKey] || []).length;
			}

			let syncTabCount = 0;
			for (const profile of syncProfiles) {
				const tabsKey = `profile_${profile.id}_tabs`;
				const result = await browser.storage.sync.get(tabsKey);
				syncTabCount += (result[tabsKey] || []).length;
			}

			return {
				hasConflict: true,
				local: {
					profileCount: localProfiles.length,
					tabCount: localTabCount,
					profiles: localProfiles,
					settings: localData.userSettings || {}
				},
				sync: {
					profileCount: syncProfiles.length,
					tabCount: syncTabCount,
					profiles: syncProfiles,
					settings: syncData.userSettings || {}
				}
			};
		}

		return { hasConflict: false };
	} catch (error) {
		console.error('[Settings] Error detecting sync conflict:', error);
		return { hasConflict: false };
	}
}

/**
 * Show sync conflict resolution dialog
 * @param {Object} conflict - Conflict information from detectSyncConflict()
 */
async function showSyncConflictDialog(conflict) {
	// Build settings comparison
	let settingsComparison = '';
	const localSettings = conflict.local.settings;
	const syncSettings = conflict.sync.settings;

	// Check for key setting differences
	const settingsDiffer =
		localSettings.themeMode !== syncSettings.themeMode ||
		localSettings.compactMode !== syncSettings.compactMode ||
		localSettings.profilesEnabled !== syncSettings.profilesEnabled;

	if (settingsDiffer) {
		settingsComparison = `\nSettings differ:\n` +
			`  Local: ${localSettings.themeMode} theme, ${localSettings.compactMode ? 'compact' : 'normal'} mode, profiles ${localSettings.profilesEnabled ? 'enabled' : 'disabled'}\n` +
			`  Synced: ${syncSettings.themeMode} theme, ${syncSettings.compactMode ? 'compact' : 'normal'} mode, profiles ${syncSettings.profilesEnabled ? 'enabled' : 'disabled'}\n`;
	}

	const message = `Sync Conflict Detected!\n\n` +
		`Local (this computer):\n` +
		`  ${conflict.local.profileCount} profile(s), ${conflict.local.tabCount} tab(s)\n\n` +
		`Synced (from another device):\n` +
		`  ${conflict.sync.profileCount} profile(s), ${conflict.sync.tabCount} tab(s)` +
		settingsComparison +
		`\nWhat would you like to do?\n\n` +
		`Click OK to merge (keep both local and synced data, use synced settings)\n` +
		`Click Cancel to stop and review your data first`;

	const shouldMerge = confirm(message);

	if (shouldMerge) {
		try {
			// Perform merge
			await mergeSyncData(conflict);

			// Enable sync
			userSettings.useSyncStorage = true;
			await saveUserSettings();

			// Update UI
			const localOption = document.getElementById('settings-storage-option-local');
			const syncOption = document.getElementById('settings-storage-option-sync');
			const localRadio = document.getElementById('settings-storage-local');
			const syncRadio = document.getElementById('settings-storage-sync');

			syncOption.classList.add('active');
			localOption.classList.remove('active');
			syncRadio.checked = true;
			localRadio.checked = false;

			showStatus('Data merged successfully - sync enabled', false);
		} catch (error) {
			showStatus('Merge failed: ' + error.message, true);
		}
	}
}

/**
 * Merge local and sync data
 * @param {Object} conflict - Conflict information
 */
async function mergeSyncData(conflict) {
	try {
		// Merge profiles - keep all unique profiles
		const mergedProfiles = [...conflict.sync.profiles];
		const syncProfileIds = new Set(conflict.sync.profiles.map(p => p.id));

		// Add local profiles that don't exist in sync
		for (const localProfile of conflict.local.profiles) {
			if (!syncProfileIds.has(localProfile.id)) {
				mergedProfiles.push(localProfile);
			}
		}

		// Merge user settings - use sync settings as base
		const localSettings = conflict.local.settings;
		const syncSettings = conflict.sync.settings;

		// Start with sync settings as base, then overlay with defaults for any missing values
		const mergedSettings = {
			...SFTabs.constants.DEFAULT_SETTINGS,
			...syncSettings,
			useSyncStorage: true  // Force this to true since we're enabling sync
		};

		// Merge floatingButton object specifically (in case one has properties the other doesn't)
		if (localSettings.floatingButton || syncSettings.floatingButton) {
			mergedSettings.floatingButton = {
				...SFTabs.constants.DEFAULT_SETTINGS.floatingButton,
				...(localSettings.floatingButton || {}),
				...(syncSettings.floatingButton || {})
			};
		}

		// Update activeProfileId to match a valid profile in the merged set
		if (mergedProfiles.length > 0) {
			// Use sync's active profile if it exists in merged set, otherwise use first profile
			const syncActiveProfile = mergedProfiles.find(p => p.id === syncSettings.activeProfileId);
			const localActiveProfile = mergedProfiles.find(p => p.id === localSettings.activeProfileId);
			mergedSettings.activeProfileId = syncActiveProfile ? syncActiveProfile.id : (localActiveProfile?.id || mergedProfiles[0].id);

			// Update defaultProfileId similarly
			const syncDefaultProfile = mergedProfiles.find(p => p.id === syncSettings.defaultProfileId);
			const localDefaultProfile = mergedProfiles.find(p => p.id === localSettings.defaultProfileId);
			mergedSettings.defaultProfileId = syncDefaultProfile ? syncDefaultProfile.id : (localDefaultProfile?.id || mergedProfiles[0].id);
		}

		// Save merged data to sync storage
		await browser.storage.sync.set({
			profiles: mergedProfiles,
			userSettings: mergedSettings
		});

		// Migrate all profile tabs to sync
		for (const profile of mergedProfiles) {
			const tabsKey = `profile_${profile.id}_tabs`;

			// Try to get tabs from sync first (priority), then local
			const [syncResult, localResult] = await Promise.all([
				browser.storage.sync.get(tabsKey),
				browser.storage.local.get(tabsKey)
			]);

			const tabs = syncResult[tabsKey] || localResult[tabsKey] || [];

			if (tabs.length > 0) {
				await SFTabs.storageChunking.saveChunkedSync(tabsKey, tabs);
			}
		}

		// Cache merged data in local storage
		await browser.storage.local.set({
			profiles: mergedProfiles,
			userSettings: mergedSettings
		});

		showStatus(`Merged ${mergedProfiles.length} profiles and settings successfully`, false);
	} catch (error) {
		console.error('[Settings] Error merging data:', error);
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
		// Get all profiles to migrate their tabs
		const sourceStorage = fromSync ? browser.storage.sync : browser.storage.local;
		const destStorage = toSync ? browser.storage.sync : browser.storage.local;

		const result = await sourceStorage.get('profiles');
		const profiles = result.profiles || [];

		// Migrate each profile's tabs
		for (const profile of profiles) {
			const tabsKey = `profile_${profile.id}_tabs`;

			// Read tabs from source
			const tabsResult = await sourceStorage.get(tabsKey);
			const tabs = tabsResult[tabsKey] || [];

			if (tabs.length > 0) {
				// Save to destination
				if (toSync) {
					// Use chunked storage for sync
					await SFTabs.storageChunking.saveChunkedSync(tabsKey, tabs);
				} else {
					// Direct save for local
					await destStorage.set({ [tabsKey]: tabs });
				}

				// Remove from source
				if (fromSync) {
					// Remove chunked data from sync
					await SFTabs.storageChunking.clearChunkedSync(tabsKey);
				} else {
					// Remove from local
					await sourceStorage.remove(tabsKey);
				}
			}
		}

		// Also migrate profiles list
		if (profiles.length > 0) {
			await destStorage.set({ profiles });
			// Note: Don't remove profiles from source yet - settings page will handle that
		}
	} catch (error) {
		console.error('[Settings] Migration error:', error);
		throw new Error(`Failed to migrate tabs: ${error.message}`);
	}
}

/**
 * Show status message (now uses toast notifications)
 */
function showStatus(message, isError) {
	showToast(message, isError);
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initSettingsPage);
