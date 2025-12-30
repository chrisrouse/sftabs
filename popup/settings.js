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
			console.warn('Could not load profiles:', error);
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
		// Settings are always in sync storage (small, benefit from cross-device sync)
		const result = await browser.storage.sync.get('userSettings');
		userSettings = result.userSettings || { ...SFTabs.constants.DEFAULT_SETTINGS };
	} catch (error) {
		userSettings = { ...SFTabs.constants.DEFAULT_SETTINGS };
	}
}

/**
 * Save user settings to storage
 */
async function saveUserSettings() {
	try {
		await browser.storage.sync.set({ userSettings });
		showStatus('Settings saved', false);
	} catch (error) {
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
	document.getElementById('use-sync-storage').checked = userSettings.useSyncStorage !== false;
	document.getElementById('enable-profiles').checked = userSettings.profilesEnabled || false;
	document.getElementById('auto-switch-profiles').checked = userSettings.autoSwitchProfiles || false;

	// Update floating button settings
	if (!userSettings.floatingButton) {
		userSettings.floatingButton = { ...SFTabs.constants.DEFAULT_SETTINGS.floatingButton };
	}
	document.getElementById('floating-button-enabled').checked = userSettings.floatingButton.enabled || false;
	document.getElementById('floating-button-display-mode').value = userSettings.floatingButton.displayMode || 'both';
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

	// Use sync storage
	document.getElementById('use-sync-storage').addEventListener('change', async (e) => {
		const newValue = e.target.checked;

		const confirmed = confirm(
			newValue
				? 'Enable cross-device sync?\n\nYour tabs will be synced across all your computers using browser sync. This allows you to access your custom tabs on any device where you\'re signed in.\n\nNote: Large configurations (>100KB) may not sync properly. Click OK to continue.'
				: 'Disable cross-device sync?\n\nYour tabs will only be stored on this computer. They will not sync to other devices.\n\nClick OK to continue.'
		);

		if (confirmed) {
			const oldValue = userSettings.useSyncStorage;
			userSettings.useSyncStorage = newValue;
			try {
				// Perform migration if needed
				if (oldValue !== newValue) {
					await migrateBetweenStorageTypes(oldValue, newValue);
				}
				await saveUserSettings();
				showStatus(
					newValue ? 'Sync enabled - tabs will now sync across devices' : 'Sync disabled - tabs stored locally only',
					false
				);
			} catch (error) {
				showStatus('Error: ' + error.message, true);
				e.target.checked = !newValue;
				userSettings.useSyncStorage = oldValue;
			}
		} else {
			e.target.checked = !newValue;
		}
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

	// Floating button display mode
	document.getElementById('floating-button-display-mode').addEventListener('change', async (e) => {
		if (!userSettings.floatingButton) {
			userSettings.floatingButton = { ...SFTabs.constants.DEFAULT_SETTINGS.floatingButton };
		}
		userSettings.floatingButton.displayMode = e.target.value;
		await saveUserSettings();
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
		filename += `_${new Date().toISOString().split('T')[0]}.json`;

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

/**
 * Import configuration from JSON file
 */
async function importConfiguration(file) {
	try {
		const text = await file.text();
		const importData = JSON.parse(text);

		// Detect if this is a pre-v2 config (legacy format without profiles)
		const isLegacyConfig = !importData.version && importData.customTabs && (!importData.profiles || importData.profiles.length === 0);

		if (isLegacyConfig) {
			// This is a v1.x config - trigger migration wizard
			showStatus('Legacy configuration detected. Preparing migration wizard...', false);

			// Store the legacy data and trigger migration
			await browser.storage.local.set({
				extensionVersion: 'unknown',
				migrationCompleted: false,
				migrationPending: true,
				customTabs: importData.customTabs,
				userSettings: importData.userSettings || {}
			});

			// Also store in sync if that's the preference
			const useSyncStorage = userSettings.useSyncStorage || true;
			if (useSyncStorage) {
				await browser.storage.sync.set({
					userSettings: importData.userSettings || {}
				});
			}

			// Close settings and reload main popup to show migration wizard
			setTimeout(() => {
				window.close();
			}, 1500);
			return;
		}

		// Normalize old format to new format
		let normalizedData = importData;

		// Detect old format (from import_export.html)
		if (importData.customTabs && !importData.version) {
			normalizedData = {
				version: '2.0.0',
				exportDate: importData.exportedAt || new Date().toISOString(),
				settings: importData.userSettings || {},
				tabs: importData.customTabs || [],
				profiles: [],
				chunkedData: {}
			};
		}
		// Detect new format but use "tabs" key if "settings" exists
		else if (importData.version && importData.settings) {
			normalizedData = importData;
		}
		// Invalid format
		else if (!importData.version && !importData.customTabs) {
			throw new Error('Invalid configuration file - missing required fields');
		}

		// Always show import modal to let user choose what to import
		showImportModal(normalizedData);
	} catch (error) {
		showStatus('Import failed: ' + error.message, true);
	}
}

/**
 * Show import modal for profile selection
 */
async function showImportModal(importData) {
	const modal = document.getElementById('import-target-modal');
	const profileSelect = document.getElementById('import-profile-select');
	const newProfileSection = document.getElementById('new-profile-section');
	const overwriteProfileSection = document.getElementById('overwrite-profile-section');
	const importTabsCheckbox = document.getElementById('import-tabs');
	const importSettingsCheckbox = document.getElementById('import-settings');
	const destinationSection = document.getElementById('import-destination-section');

	// Check if profiles are enabled
	const profilesEnabled = userSettings.profilesEnabled || false;

	// Load current profiles if enabled
	const result = await browser.storage.sync.get('profiles');
	const profiles = result.profiles || [];

	// Populate profile select
	profileSelect.innerHTML = '<option value="">Choose a profile...</option>';
	profiles.forEach(profile => {
		const option = document.createElement('option');
		option.value = profile.id;
		option.textContent = profile.name;
		profileSelect.appendChild(option);
	});

	// Reset checkboxes to default state
	importTabsCheckbox.checked = true;
	importSettingsCheckbox.checked = false;

	// Show/hide destination section based on profiles being enabled and tabs checkbox
	const handleTabsCheckboxChange = () => {
		if (importTabsCheckbox.checked && profilesEnabled) {
			destinationSection.style.display = 'block';
		} else {
			destinationSection.style.display = 'none';
		}
	};

	// Initial state - hide destination if profiles not enabled
	if (!profilesEnabled) {
		destinationSection.style.display = 'none';
	}

	importTabsCheckbox.removeEventListener('change', handleTabsCheckboxChange);
	importTabsCheckbox.addEventListener('change', handleTabsCheckboxChange);

	// Handle radio button changes
	const radioButtons = modal.querySelectorAll('input[name="import-option"]');
	radioButtons.forEach(radio => {
		radio.addEventListener('change', (e) => {
			if (e.target.value === 'overwrite') {
				overwriteProfileSection.style.display = 'block';
				newProfileSection.style.display = 'none';
			} else {
				overwriteProfileSection.style.display = 'none';
				newProfileSection.style.display = 'block';
			}
		});
	});

	// Handle import confirmation
	document.getElementById('import-modal-confirm').onclick = async () => {
		const importTabs = importTabsCheckbox.checked;
		const importSettings = importSettingsCheckbox.checked;

		// Validate at least one option is selected
		if (!importTabs && !importSettings) {
			showStatus('Please select at least one option to import', true);
			return;
		}

		// Only validate destination if importing tabs and profiles are enabled
		let mode = null;
		let target = null;

		if (importTabs && profilesEnabled) {
			const selectedOption = modal.querySelector('input[name="import-option"]:checked').value;

			if (selectedOption === 'overwrite') {
				const profileId = profileSelect.value;
				if (!profileId) {
					showStatus('Please select a profile', true);
					return;
				}
				mode = 'overwrite';
				target = profileId;
			} else {
				const profileName = document.getElementById('new-profile-name').value.trim();
				if (!profileName) {
					showStatus('Please enter a profile name', true);
					return;
				}
				mode = 'new';
				target = profileName;
			}
		}

		await performImport(importData, mode, target, importTabs, importSettings);
		hideImportModal();
	};

	// Handle cancel
	document.getElementById('import-modal-cancel').onclick = () => {
		hideImportModal();
	};

	modal.style.display = 'flex';
}

/**
 * Hide import modal
 */
function hideImportModal() {
	document.getElementById('import-target-modal').style.display = 'none';
}

/**
 * Perform the import operation
 */
async function performImport(importData, mode, target, importTabs = true, importSettings = false) {
	try {
		// Import settings if requested
		if (importSettings && importData.settings) {
			const mergedSettings = {
				...userSettings,
				...importData.settings,
				// Preserve current profile state unless we're doing a full reset
				profilesEnabled: mode === 'overwrite' && !target ? importData.settings.profilesEnabled : userSettings.profilesEnabled,
				activeProfileId: userSettings.activeProfileId
			};
			await browser.storage.sync.set({ userSettings: mergedSettings });
			userSettings = mergedSettings;
		}

		// Import tabs if requested
		if (importTabs) {
			// Determine the tabs to import - handle both old format (tabs/customTabs) and new format (profileData)
			let tabsToImport = [];
			if (importData.profileData && Object.keys(importData.profileData).length > 0) {
				// New format: use the first profile's tabs
				const firstProfileId = Object.keys(importData.profileData)[0];
				tabsToImport = importData.profileData[firstProfileId] || [];
			} else {
				// Old format: use tabs or customTabs
				tabsToImport = importData.tabs || importData.customTabs || [];
			}

			// Import tabs to the specified destination
			if (mode === 'overwrite' && target) {
				// Overwrite specific profile's tabs
				const storageKey = `profile_${target}_tabs`;
				await browser.storage.sync.set({ [storageKey]: tabsToImport });
			} else if (mode === 'new') {
				// Create new profile with imported tabs
				const result = await browser.storage.sync.get('profiles');
				const profiles = result.profiles || [];

				const newProfileId = 'profile_' + Date.now();
				const newProfile = {
					id: newProfileId,
					name: target,
					createdAt: new Date().toISOString(),
					lastActive: new Date().toISOString(),
					urlPatterns: []
				};

				profiles.push(newProfile);
				await browser.storage.sync.set({ profiles });

				// Save tabs to the new profile's storage
				const storageKey = `profile_${newProfileId}_tabs`;
				await browser.storage.sync.set({ [storageKey]: tabsToImport });
			} else {
				// Direct overwrite (no profiles) - import to active profile or default storage
				if (userSettings.activeProfileId) {
					const storageKey = `profile_${userSettings.activeProfileId}_tabs`;
					await browser.storage.sync.set({ [storageKey]: tabsToImport });
				} else if (tabsToImport.length > 0) {
					await browser.storage.sync.set({ tabs: tabsToImport });
				}
			}

			// Import chunked data
			if (importData.chunkedData) {
				await browser.storage.local.set(importData.chunkedData);
			}
		}

		// Show appropriate success message
		let message = 'Configuration imported successfully';
		if (importTabs && importSettings) {
			message = 'Tabs and settings imported successfully';
		} else if (importTabs) {
			message = 'Tabs imported successfully';
		} else if (importSettings) {
			message = 'Settings imported successfully';
		}

		showStatus(message, false);

		// Reload UI
		await loadUserSettings();
		updateUI();
		applyTheme();
	} catch (error) {
		showStatus('Import failed: ' + error.message, true);
	}
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
 * Migrate tabs between storage types when user changes preference
 * @param {boolean} fromSync - true if migrating from sync, false if from local
 * @param {boolean} toSync - true if migrating to sync, false if to local
 */
async function migrateBetweenStorageTypes(fromSync, toSync) {
	try {
		// Read tabs from source storage
		let tabs = [];
		if (fromSync) {
			// Read from sync storage
			const syncResult = await browser.storage.sync.get('customTabs');
			tabs = syncResult.customTabs || [];
		} else {
			// Read from local storage
			const localResult = await browser.storage.local.get('customTabs');
			tabs = localResult.customTabs || [];
		}

		if (tabs.length === 0) {
			return;
		}

		// Save tabs to destination storage
		if (toSync) {
			// Save to sync storage
			await browser.storage.sync.set({ customTabs: tabs });
			// Clear old local storage
			await browser.storage.local.remove(['customTabs', 'extensionVersion']);
		} else {
			// Save to local storage
			await browser.storage.local.set({
				customTabs: tabs,
				extensionVersion: '2.0.0'
			});
			// Clear old sync storage
			await browser.storage.sync.remove(['customTabs']);
		}
	} catch (error) {
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
