// popup/settings.js
// Standalone settings page functionality

let userSettings = {};

/**
 * Initialize the settings page
 */
async function initSettingsPage() {
	// Load user settings
	await loadUserSettings();

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

	// Show/hide auto-switch option based on profiles enabled
	toggleAutoSwitchVisibility();
}

/**
 * Toggle auto-switch profiles visibility
 */
function toggleAutoSwitchVisibility() {
	const autoSwitchContainer = document.getElementById('auto-switch-container');
	const profilesEnabled = document.getElementById('enable-profiles').checked;
	autoSwitchContainer.style.display = profilesEnabled ? 'block' : 'none';
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
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
			userSettings.useSyncStorage = newValue;
			try {
				await SFTabs.storage.saveUserSettings(userSettings);
				showStatus(
					newValue ? 'Sync enabled - tabs will now sync across devices' : 'Sync disabled - tabs stored locally only',
					false
				);
			} catch (error) {
				showStatus('Error: ' + error.message, true);
				e.target.checked = !newValue;
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
		} else {
			// Show confirmation dialog
			const confirmed = confirm(
				'Disable profiles?\n\nThis will merge all tabs from all profiles into a single tab list. You can re-enable profiles later.\n\nClick OK to continue.'
			);

			if (confirmed) {
				userSettings.profilesEnabled = false;
				userSettings.autoSwitchProfiles = false;
				document.getElementById('auto-switch-profiles').checked = false;
				await saveUserSettings();
				toggleAutoSwitchVisibility();
			} else {
				e.target.checked = true;
			}
		}
	});

	// Auto-switch profiles
	document.getElementById('auto-switch-profiles').addEventListener('change', async (e) => {
		userSettings.autoSwitchProfiles = e.target.checked;
		await saveUserSettings();
	});

	// Keyboard shortcuts button
	document.getElementById('keyboard-shortcuts-button').addEventListener('click', () => {
		openKeyboardShortcutsPage();
	});

	// Export button
	document.getElementById('export-button').addEventListener('click', () => {
		exportConfiguration();
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
	document.getElementById('reset-button').addEventListener('click', () => {
		showResetModal();
	});

	// Reset modal buttons
	document.getElementById('reset-modal-cancel').addEventListener('click', () => {
		hideResetModal();
	});

	document.getElementById('reset-modal-confirm').addEventListener('click', async () => {
		await resetToDefaults();
		hideResetModal();
	});

	// Changelog link
	document.getElementById('changelog-link').addEventListener('click', (e) => {
		e.preventDefault();
		browser.tabs.create({
			url: 'https://github.com/chrisrouse/sftabs/blob/main/CHANGELOG.md'
		});
	});
}

/**
 * Open keyboard shortcuts configuration page
 */
function openKeyboardShortcutsPage() {
	const isFirefox = typeof browser !== 'undefined' && browser.runtime && browser.runtime.getBrowserInfo;
	const isChrome = typeof chrome !== 'undefined' && chrome.runtime && !isFirefox;

	if (isFirefox) {
		browser.tabs.create({ url: 'about:addons' }).catch(err => {
			showStatus('Could not open shortcuts page', true);
		});
	} else if (isChrome) {
		browser.tabs.create({ url: 'chrome://extensions/shortcuts' }).catch(err => {
			showStatus('Could not open shortcuts page', true);
		});
	} else {
		showStatus('Could not detect browser type', true);
	}
}

/**
 * Export configuration to JSON file
 */
async function exportConfiguration() {
	try {
		// Get all data from storage
		const syncData = await browser.storage.sync.get(null);
		const localData = await browser.storage.local.get(null);

		// Combine data
		const exportData = {
			version: '1.5.0',
			exportDate: new Date().toISOString(),
			settings: syncData.userSettings || {},
			tabs: syncData.tabs || [],
			profiles: syncData.profiles || [],
			chunkedData: {}
		};

		// Include chunked data if it exists
		for (const key in localData) {
			if (key.startsWith('chunk_')) {
				exportData.chunkedData[key] = localData[key];
			}
		}

		// Create and download file
		const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `sftabs_config_${new Date().toISOString().split('T')[0]}.json`;
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

		// Validate import data
		if (!importData.version) {
			throw new Error('Invalid configuration file');
		}

		// Check if profiles are enabled
		const profilesEnabled = importData.settings?.profilesEnabled || false;

		if (profilesEnabled && importData.profiles && importData.profiles.length > 0) {
			// Show profile selection modal
			showImportModal(importData);
		} else {
			// Direct import for non-profile configurations
			await performImport(importData, 'overwrite', null);
		}
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

	// Load current profiles
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
		const selectedOption = modal.querySelector('input[name="import-option"]:checked').value;

		if (selectedOption === 'overwrite') {
			const profileId = profileSelect.value;
			if (!profileId) {
				showStatus('Please select a profile', true);
				return;
			}
			await performImport(importData, 'overwrite', profileId);
		} else {
			const profileName = document.getElementById('new-profile-name').value.trim();
			if (!profileName) {
				showStatus('Please enter a profile name', true);
				return;
			}
			await performImport(importData, 'new', profileName);
		}

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
async function performImport(importData, mode, target) {
	try {
		// Import settings
		if (importData.settings) {
			await browser.storage.sync.set({ userSettings: importData.settings });
			userSettings = importData.settings;
		}

		// Import tabs and profiles
		if (mode === 'overwrite' && target) {
			// Overwrite specific profile
			const result = await browser.storage.sync.get('profiles');
			const profiles = result.profiles || [];
			const profileIndex = profiles.findIndex(p => p.id === target);

			if (profileIndex !== -1 && importData.tabs) {
				profiles[profileIndex].tabs = importData.tabs;
				await browser.storage.sync.set({ profiles });
			}
		} else if (mode === 'new') {
			// Create new profile
			const result = await browser.storage.sync.get('profiles');
			const profiles = result.profiles || [];

			const newProfile = {
				id: 'profile_' + Date.now(),
				name: target,
				tabs: importData.tabs || [],
				urlPatterns: []
			};

			profiles.push(newProfile);
			await browser.storage.sync.set({ profiles });
		} else {
			// Direct overwrite (no profiles)
			if (importData.tabs) {
				await browser.storage.sync.set({ tabs: importData.tabs });
			}
		}

		// Import chunked data
		if (importData.chunkedData) {
			await browser.storage.local.set(importData.chunkedData);
		}

		// Reload UI
		await loadUserSettings();
		updateUI();
		applyTheme();

		showStatus('Configuration imported successfully', false);
	} catch (error) {
		showStatus('Import failed: ' + error.message, true);
	}
}

/**
 * Show reset confirmation modal
 */
function showResetModal() {
	document.getElementById('reset-modal').style.display = 'flex';
}

/**
 * Hide reset confirmation modal
 */
function hideResetModal() {
	document.getElementById('reset-modal').style.display = 'none';
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

		// Clear chunked data
		const localData = await browser.storage.local.get(null);
		const chunkedKeys = Object.keys(localData).filter(key => key.startsWith('chunk_'));
		if (chunkedKeys.length > 0) {
			await browser.storage.local.remove(chunkedKeys);
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
 * Show status message
 */
function showStatus(message, isError) {
	const statusEl = document.getElementById('status-message');
	statusEl.textContent = message;
	statusEl.className = isError ? 'error' : 'success';
	statusEl.style.display = 'block';

	setTimeout(() => {
		statusEl.style.display = 'none';
	}, 3000);
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initSettingsPage);
