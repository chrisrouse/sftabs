// popup/settings.js
// Standalone settings page functionality

let userSettings = {};

/**
 * Initialize the settings page
 */
async function initSettingsPage() {
	// Load user settings
	await loadUserSettings();

	applyTheme();
	setupEventListeners();
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
		userSettings = { ...SFTabs.constants.DEFAULT_SETTINGS };
	}
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
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
	// Through the storage layer rather than straight at sync: it reads the area
	// the user actually chose and reassembles chunked values. Reading sync
	// directly returned nothing for anyone on local storage, and for anyone
	// whose profile list had outgrown 7000 bytes and been split into chunks.
	const profiles = await SFTabs.storage.getProfiles() || [];
	const settings = await SFTabs.storage.getUserSettings() || {};

	// Clear existing content
	profilesList.innerHTML = '';

	// If no profiles exist, show a message
	if (profiles.length === 0) {
		const message = document.createElement('div');
		message.style.cssText = 'font-size: 13px; color: var(--color-text-weak); font-style: italic;';
		message.textContent = chrome.i18n.getMessage('noProfilesConfigured');
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
		countDiv.textContent = tabCount !== 1 ? chrome.i18n.getMessage('tabCountPlural', [String(tabCount)]) : chrome.i18n.getMessage('tabCountSingular', [String(tabCount)]);

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
		// `version` is the export FORMAT, not the extension's, and the importer
		// branches on it: absent means a v1 file keyed on customTabs, or the
		// simple tabTitle/url shape. It stays at 2.0.0 because the shape has not
		// changed — bumping it with each release would imply a format change and
		// eventually confuse an older build reading a newer file.
		//
		// appVersion is the extension that wrote the file. Nothing reads it; it is
		// there so a file can be identified when someone sends one in.
		const exportData = {
			version: '2.0.0',
			appVersion: browser.runtime.getManifest().version,
			exportDate: new Date().toISOString()
		};

		if (exportEverything) {
			// Export everything, read through the storage layer so the values are
			// whole. Taking syncData[`profile_X_tabs`] straight from a get(null)
			// missed two whole classes of user: anyone on local storage, whose
			// data is not in sync at all, and anyone whose profile had outgrown
			// 7000 bytes, where the direct key does not exist because the value
			// lives in _chunk_N parts. Both exported a profile with no tabs.
			exportData.settings = await SFTabs.storage.getUserSettings() || {};
			exportData.profiles = await SFTabs.storage.getProfiles() || [];
			exportData.profileData = {};

			for (const profile of exportData.profiles) {
				exportData.profileData[profile.id] = await SFTabs.storage.getProfileTabs(profile.id) || [];
			}
		} else {
			// Selective export
			if (exportSettings) {
				exportData.settings = await SFTabs.storage.getUserSettings() || {};
			}

			if (selectedProfileIds.length > 0) {
				const allProfiles = await SFTabs.storage.getProfiles() || [];
				exportData.profiles = allProfiles.filter(p => selectedProfileIds.includes(p.id));
				exportData.profileData = {};

				// Export only selected profile tabs
				for (const profileId of selectedProfileIds) {
					exportData.profileData[profileId] = await SFTabs.storage.getProfileTabs(profileId) || [];
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

		showStatus(chrome.i18n.getMessage('configExported'), false);
	} catch (error) {
		showStatus(chrome.i18n.getMessage('errorExport', [error.message]), true);
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
		showStatus(chrome.i18n.getMessage('errorImport', [error.message]), true);
	}
}

/**
 * Parse a Salesforce URL to extract path and determine tab type flags
 * @param {string} url - The URL to parse
 * @returns {Object} Object with path, isObject, isCustomUrl, and isSetupObject
 */
function parseUrlToDetermineTabs(url) {
	const result = {
		path: '',
		isObject: false,
		isCustomUrl: false,
		isSetupObject: false
	};

	if (!url) return result;

	// Check if it's a full URL (has protocol or domain)
	const isFullUrl = url.startsWith('http://') || url.startsWith('https://');
	let pathToAnalyze = url;

	if (isFullUrl) {
		// Extract path from full URL for pattern matching
		try {
			const urlObj = new URL(url);
			pathToAnalyze = urlObj.pathname;
		} catch (e) {
			// If URL parsing fails, treat as custom URL
			result.isCustomUrl = true;
			result.path = url;
			return result;
		}
	}

	// Parse Lightning URL patterns (applies to both full URLs and relative paths)
	// Pattern: /lightning/setup/{SETUP_NAME}/... (capture just the setup name, /home is added back by buildFullUrl)
	const setupMatch = pathToAnalyze.match(/^\/lightning\/setup\/([^/]+)/);
	if (setupMatch) {
		result.isSetupObject = true;
		result.path = setupMatch[1];
		return result;
	}

	// Pattern: /lightning/o/{SOBJECT_PATH} (capture everything after /o/, e.g., "Contact/list" or "Account")
	const objectMatch = pathToAnalyze.match(/^\/lightning\/o\/(.+)$/);
	if (objectMatch) {
		result.isObject = true;
		result.path = objectMatch[1];
		return result;
	}

	// If it was a full URL but doesn't match any Lightning patterns, treat as custom
	if (isFullUrl) {
		result.isCustomUrl = true;
		result.path = url; // Keep the full URL for custom paths
		return result;
	}

	// Default: custom path (relative)
	result.path = url;
	return result;
}

/**
 * Convert simple Salesforce tabs format to full tab structure
 * @param {Array} simpleTabs - Array of {tabTitle, url, openInNewTab}
 * @returns {Array} Array of full tab objects
 */
function convertSimpleTabsToFull(simpleTabs) {
	const converted = simpleTabs.map((simpleTab, index) => {
		const urlInfo = parseUrlToDetermineTabs(simpleTab.url);

		return {
			id: `tab_${Date.now()}_${index}`,
			label: simpleTab.tabTitle || chrome.i18n.getMessage('untitledTab'),
			path: urlInfo.path,
			openInNewTab: simpleTab.openInNewTab || false,
			isObject: urlInfo.isObject,
			isCustomUrl: urlInfo.isCustomUrl,
			isSetupObject: urlInfo.isSetupObject,
			dropdownItems: [],
			position: index
		};
	});
	return converted;
}

/**
 * Detect if data is in simple Salesforce tabs format
 * @param {Object} importData - The data to check
 * @returns {boolean} True if this appears to be simple format
 */
function isSimpleSalesforceFormat(importData) {
	// Simple format: has tabs array with tabTitle and url, no version/settings
	const isSimple = (
		!importData.version &&
		!importData.customTabs &&
		Array.isArray(importData.tabs) &&
		importData.tabs.length > 0 &&
		importData.tabs.every(tab =>
			typeof tab.tabTitle === 'string' &&
			typeof tab.url === 'string' &&
			typeof tab.openInNewTab === 'boolean'
		)
	);
	return isSimple;
}

/**
 * Normalize import data to a consistent format
 */
function normalizeImportData(importData) {
	// Detect if this is simple Salesforce tabs format
	if (isSimpleSalesforceFormat(importData)) {
		const convertedTabs = convertSimpleTabsToFull(importData.tabs);
		return {
			version: 'simple',
			exportDate: new Date().toISOString(),
			settings: {},
			tabs: convertedTabs,
			profiles: [],
			profileData: {},
			chunkedData: {}
		};
	}

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
			countDiv.textContent = tabCount !== 1 ? chrome.i18n.getMessage('tabCountPlural', [String(tabCount)]) : chrome.i18n.getMessage('tabCountSingular', [String(tabCount)]);

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
		document.getElementById('import-tabs-count').textContent = chrome.i18n.getMessage('tabsFromProfile', [tabCount !== 1 ? chrome.i18n.getMessage('tabCountPlural', [String(tabCount)]) : chrome.i18n.getMessage('tabCountSingular', [String(tabCount)]), profile.name]);

		// Show hybrid import options
		document.getElementById('import-hybrid-container').style.display = 'block';
	} else if (isSingleProfile && profilesEnabled) {
		// Single profile with profiles enabled - show destination options
		document.getElementById('import-tabs-container').style.display = 'block';
		const profile = importData.profiles[0];
		const profileTabs = importData.profileData[profile.id] || [];
		const tabCount = profileTabs.length;
		document.getElementById('import-tabs-count').textContent = chrome.i18n.getMessage('tabsFromProfile', [tabCount !== 1 ? chrome.i18n.getMessage('tabCountPlural', [String(tabCount)]) : chrome.i18n.getMessage('tabCountSingular', [String(tabCount)]), profile.name]);

		// Show destination options for profiles mode
		document.getElementById('import-destination-container').style.display = 'block';

		// Populate both profile dropdowns (add and overwrite)
		const profiles = await SFTabs.storage.getProfiles() || [];

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
		document.getElementById('import-tabs-count').textContent = tabCount !== 1 ? chrome.i18n.getMessage('tabCountPlural', [String(tabCount)]) : chrome.i18n.getMessage('tabCountSingular', [String(tabCount)]);

		// If user has profiles enabled, show destination options
		if (profilesEnabled) {
			document.getElementById('import-destination-container').style.display = 'block';

			// Populate both profile dropdowns (add and overwrite)
			const profiles = await SFTabs.storage.getProfiles() || [];

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
		showStatus(chrome.i18n.getMessage('errorInvalidConfig'), true);
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
				showStatus(chrome.i18n.getMessage('selectImportOptionError'), true);
				return;
			}
		}

		// Success!
		hideImportOptions();
		showStatus(chrome.i18n.getMessage('configImported'), false);

		// Profiles may have changed, so the export picker is refreshed rather
		// than the settings controls that used to live on this page
		await loadUserSettings();
		applyTheme();
		if (document.getElementById('export-custom-radio').checked) populateInlineProfilesList();
	} catch (error) {
		showStatus(chrome.i18n.getMessage('errorImport', [error.message]), true);
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
			// Deep merge, or a nested object in the file replaces the live one
			// wholesale — that is how importing with org colours off wiped every
			// per-org override.
			...SFTabs.utils.mergeUserSettings(userSettings, importData.settings),
			// Enable profiles if importing profiles
			profilesEnabled: true,
			// Preserve storage preference
			useSyncStorage: userSettings.useSyncStorage
		};
		await SFTabs.storage.saveUserSettings(mergedSettings, true, false);
		userSettings = mergedSettings;
	} else if (needsProfilesEnabled) {
		// Enable profiles even if not importing settings
		const mergedSettings = {
			...userSettings,
			profilesEnabled: true
		};
		await SFTabs.storage.saveUserSettings(mergedSettings, true, false);
		userSettings = mergedSettings;
	}

	// Import selected profiles
	const currentProfiles = await SFTabs.storage.getProfiles() || [];

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
		await SFTabs.storage.saveProfileTabs(newProfileId, profileTabs);
	}

	// saveProfiles chunks once the list outgrows a single sync value. A raw set
	// left the old chunks and their metadata behind, so the next read
	// reassembled the stale list and silently discarded this write.
	await SFTabs.storage.saveProfiles(currentProfiles, false);
}

/**
 * Import from hybrid mode (single profile, profiles not enabled)
 */
async function importFromHybridMode(importData, importSettings) {
	const hybridMode = document.querySelector('input[name="import-hybrid-mode"]:checked')?.value;

	if (!hybridMode) {
		throw new Error(chrome.i18n.getMessage('selectImportOptionError'));
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
				...SFTabs.utils.mergeUserSettings(userSettings, importData.settings),
				// Preserve current state
				profilesEnabled: userSettings.profilesEnabled,
				activeProfileId: userSettings.activeProfileId,
				useSyncStorage: userSettings.useSyncStorage
			};
			await SFTabs.storage.saveUserSettings(mergedSettings, true, false);
		}

		// Add to existing tabs in the active profile's storage key
		const activeProfileId = userSettings.activeProfileId;
		const existingTabs = await SFTabs.storage.getProfileTabs(activeProfileId) || [];

		// Merge tabs - imported tabs get new positions after existing ones
		const maxPosition = existingTabs.length > 0 ? Math.max(...existingTabs.map(t => t.position || 0)) : -1;
		const existingIds = new Set(existingTabs.map(t => t.id));
		const mergedTabs = [...existingTabs];

		tabs.forEach((tab, index) => {
			const id = existingIds.has(tab.id)
				? `tab_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
				: tab.id;
			mergedTabs.push({
				...tab,
				id,
				position: maxPosition + index + 1
			});
		});

		// Save merged tabs
		await SFTabs.storage.saveProfileTabs(activeProfileId, mergedTabs);
	} else if (hybridMode === 'replace-tabs') {
		// Replace all tabs without enabling profiles
		if (importSettings && importData.settings) {
			const mergedSettings = {
				...SFTabs.utils.mergeUserSettings(userSettings, importData.settings),
				// Preserve current state
				profilesEnabled: userSettings.profilesEnabled,
				activeProfileId: userSettings.activeProfileId,
				useSyncStorage: userSettings.useSyncStorage
			};
			await SFTabs.storage.saveUserSettings(mergedSettings, true, false);
		}

		// Replace tabs in the active profile's storage key
		await SFTabs.storage.saveProfileTabs(userSettings.activeProfileId, tabs);
	}

	// Import chunked data if available
	// No chunkedData restore. It wrote sync-format _chunk_N keys into local,
	// where nothing reads them — chunking is a sync-only concern — so it never
	// restored anything. Tabs now arrive whole in profileData and are written
	// by saveProfileTabs, which re-chunks as needed for the target area.
}

/**
 * Import tabs to a destination (for single tab set)
 */
async function importTabsToDestination(importData, importSettings) {
	const profilesEnabled = userSettings.profilesEnabled || false;

	// Import settings if requested
	if (importSettings && importData.settings) {
		const mergedSettings = {
			...SFTabs.utils.mergeUserSettings(userSettings, importData.settings),
			// Preserve current profile state and storage preference
			profilesEnabled: userSettings.profilesEnabled,
			activeProfileId: userSettings.activeProfileId,
			useSyncStorage: userSettings.useSyncStorage
		};
		await SFTabs.storage.saveUserSettings(mergedSettings, true, false);
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
				throw new Error(chrome.i18n.getMessage('selectProfileError'));
			}

			// Load existing tabs from the profile
			const existingTabs = await SFTabs.storage.getProfileTabs(profileId) || [];

			// Merge tabs - imported tabs get new positions after existing ones
			const maxPosition = existingTabs.length > 0 ? Math.max(...existingTabs.map(t => t.position || 0)) : -1;
			const existingIds = new Set(existingTabs.map(t => t.id));
			const mergedTabs = [...existingTabs];

			tabs.forEach((tab, index) => {
				const id = existingIds.has(tab.id)
					? `tab_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
					: tab.id;
				mergedTabs.push({
					...tab,
					id,
					position: maxPosition + index + 1
				});
			});

			// Save merged tabs
			await SFTabs.storage.saveProfileTabs(profileId, mergedTabs);
		} else if (destRadio.value === 'overwrite') {
			// Overwrite existing profile
			const profileId = document.getElementById('import-profile-select-inline').value;
			if (!profileId) {
				throw new Error(chrome.i18n.getMessage('selectProfileError'));
			}

			await SFTabs.storage.saveProfileTabs(profileId, tabs);
		} else if (destRadio.value === 'new') {
			// Create new profile
			const profileName = document.getElementById('import-new-profile-name').value.trim();
			if (!profileName) {
				throw new Error(chrome.i18n.getMessage('profileNameError'));
			}

			const profiles = await SFTabs.storage.getProfiles() || [];

			const newProfileId = 'profile_' + Date.now();
			const newProfile = {
				id: newProfileId,
				name: profileName,
				createdAt: new Date().toISOString(),
				lastActive: new Date().toISOString(),
				urlPatterns: []
			};

			profiles.push(newProfile);
			await SFTabs.storage.saveProfiles(profiles, false);
			// saveProfileTabs, not a raw set: a large import chunks, and writing
			// the direct key next to stale chunk metadata loses the whole import.
			await SFTabs.storage.saveProfileTabs(newProfileId, tabs);
		}
	} else {
		// No profiles UI - but popup always loads from activeProfileId profile storage internally
		const importMode = document.querySelector('input[name="import-mode"]:checked')?.value || 'add';

		// Note: Popup always loads from activeProfileId profile storage, even when profiles UI is disabled
		// So we must save to profile storage, not to customTabs
		const activeProfileId = userSettings.activeProfileId;

		if (importMode === 'add') {
			// Add to existing tabs
			let existingTabs = [];

			if (activeProfileId) {
				// Load from profile storage (same place popup reads from)
				existingTabs = await SFTabs.storage.getProfileTabs(activeProfileId) || [];
			} else {
				// Fallback to customTabs if no active profile
				const useSyncStorage = await SFTabs.storage.getStoragePreference();
				if (useSyncStorage) {
					existingTabs = await SFTabs.storageChunking.readChunkedSync('customTabs') || [];
				} else {
					const localResult = await browser.storage.local.get('customTabs');
					existingTabs = localResult.customTabs || [];
				}
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
			if (activeProfileId) {
				await SFTabs.storage.saveProfileTabs(activeProfileId, mergedTabs);
			} else {
				// Fallback to customTabs if no active profile
				const useSyncStorage = await SFTabs.storage.getStoragePreference();
				if (useSyncStorage) {
					const saveResult = await SFTabs.storageChunking.saveChunkedSync('customTabs', mergedTabs);
				} else {
					await browser.storage.local.set({ customTabs: mergedTabs });
				}
			}
		} else {
			// Replace all tabs
			if (activeProfileId) {
				await SFTabs.storage.saveProfileTabs(activeProfileId, tabs);
			} else {
				// Fallback to customTabs if no active profile
				const useSyncStorage = await SFTabs.storage.getStoragePreference();

				if (useSyncStorage) {
					const saveResult = await SFTabs.storageChunking.saveChunkedSync('customTabs', tabs);
				} else {
					await browser.storage.local.set({ customTabs: tabs });
				}
			}
		}
	}

	// Import chunked data if available
	// No chunkedData restore. It wrote sync-format _chunk_N keys into local,
	// where nothing reads them — chunking is a sync-only concern — so it never
	// restored anything. Tabs now arrive whole in profileData and are written
	// by saveProfileTabs, which re-chunks as needed for the target area.
}

/**
 * Import only settings
 */
async function importOnlySettings(importData) {
	if (!importData.settings || Object.keys(importData.settings).length === 0) {
		throw new Error(chrome.i18n.getMessage('errorInvalidConfig'));
	}

	const mergedSettings = {
		...SFTabs.utils.mergeUserSettings(userSettings, importData.settings),
		// Preserve current profile state and storage preference
		profilesEnabled: userSettings.profilesEnabled,
		activeProfileId: userSettings.activeProfileId,
		useSyncStorage: userSettings.useSyncStorage
	};

	await SFTabs.storage.saveUserSettings(mergedSettings, true, false);
}

/**
 * Show status message (now uses toast notifications)
 */
function showStatus(message, isError) {
	showToast(message, isError);
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initSettingsPage);
