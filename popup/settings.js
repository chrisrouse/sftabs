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
		} else {
			// Show profile selection modal
			if (window.SFTabs && window.SFTabs.profiles && window.SFTabs.profiles.showProfileSelectionForDisable) {
				const selectedProfile = await window.SFTabs.profiles.showProfileSelectionForDisable();

				if (selectedProfile) {
					// User confirmed and selected a profile to keep
					userSettings.profilesEnabled = false;
					userSettings.autoSwitchProfiles = false;
					document.getElementById('auto-switch-profiles').checked = false;
					await saveUserSettings();
					toggleAutoSwitchVisibility();
				} else {
					// User cancelled, revert checkbox
					e.target.checked = true;
				}
			} else {
				// Fallback to simple confirm if the function isn't available
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
					// User cancelled, revert checkbox
					e.target.checked = true;
				}
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
		showExportModal();
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
 * Show export options modal
 */
async function showExportModal() {
	const modal = document.getElementById('export-options-modal');
	const profilesList = document.getElementById('export-profiles-list');
	const everythingCheckbox = document.getElementById('export-everything');
	const settingsCheckbox = document.getElementById('export-settings');

	// Load current profiles
	const result = await browser.storage.sync.get('profiles');
	const profiles = result.profiles || [];

	// Clear and populate profile checkboxes
	profilesList.innerHTML = '';
	profiles.forEach(profile => {
		const label = document.createElement('label');
		label.className = 'checkbox-group';

		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.checked = true;
		checkbox.disabled = true;
		checkbox.className = 'export-profile-checkbox';
		checkbox.dataset.profileId = profile.id;

		const span = document.createElement('span');
		span.textContent = profile.name;

		label.appendChild(checkbox);
		label.appendChild(span);
		profilesList.appendChild(label);
	});

	// Reset "Everything" checkbox to default state
	everythingCheckbox.checked = true;
	settingsCheckbox.disabled = true;
	settingsCheckbox.checked = true;

	// Handle "Everything" checkbox
	const handleEverythingChange = () => {
		const isChecked = everythingCheckbox.checked;
		settingsCheckbox.disabled = isChecked;
		if (isChecked) {
			settingsCheckbox.checked = true;
		}

		const profileCheckboxes = profilesList.querySelectorAll('.export-profile-checkbox');
		profileCheckboxes.forEach(cb => {
			cb.disabled = isChecked;
			if (isChecked) {
				cb.checked = true;
			}
		});
	};

	// Remove old listener and add new one
	everythingCheckbox.removeEventListener('change', handleEverythingChange);
	everythingCheckbox.addEventListener('change', handleEverythingChange);

	// Handle export confirmation
	document.getElementById('export-modal-confirm').onclick = async () => {
		const exportEverything = everythingCheckbox.checked;
		const exportSettings = settingsCheckbox.checked;
		const selectedProfileIds = [];

		if (!exportEverything) {
			const profileCheckboxes = profilesList.querySelectorAll('.export-profile-checkbox');
			profileCheckboxes.forEach(cb => {
				if (cb.checked) {
					selectedProfileIds.push(cb.dataset.profileId);
				}
			});
		}

		await performExport(exportEverything, exportSettings, selectedProfileIds);
		hideExportModal();
	};

	// Handle cancel
	document.getElementById('export-modal-cancel').onclick = () => {
		hideExportModal();
	};

	modal.style.display = 'flex';
}

/**
 * Hide export options modal
 */
function hideExportModal() {
	document.getElementById('export-options-modal').style.display = 'none';
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
