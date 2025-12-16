// Import/Export functionality for SF Tabs
// Browser compatibility is handled by js/shared/browser-compat.js

// DOM elements
const exportButton = document.getElementById('export-button');
const importButton = document.getElementById('import-button');
const fileInput = document.getElementById('import-file-input');
const statusMessage = document.getElementById('status-message');

// Constants
const CHUNK_SIZE = 7000; // Max bytes per chunk for sync storage (browser limit is ~8KB per key)

// Storage helper functions

/**
 * Get storage preference from user settings
 * @returns {Promise<boolean>} true for sync storage, false for local
 */
async function getStoragePreference() {
	try {
		// Settings are always in sync storage (they're small)
		const result = await browser.storage.sync.get('userSettings');
		if (result.userSettings && typeof result.userSettings.useSyncStorage === 'boolean') {
			return result.userSettings.useSyncStorage;
		}
		// Default to sync storage
		return true;
	} catch (error) {
		return true;
	}
}

/**
 * Read data from sync storage, handling both chunked and non-chunked formats
 * @param {string} baseKey - Base key name (e.g., 'customTabs')
 * @returns {Promise<*>} The reassembled data object, or null if not found
 */
async function readChunkedSync(baseKey) {
	try {
		// First check metadata to determine format
		const metadataKey = `${baseKey}_metadata`;
		const metadataResult = await browser.storage.sync.get(metadataKey);
		const metadata = metadataResult[metadataKey];

		// Check for non-chunked data (old format or small config)
		if (!metadata || !metadata.chunked) {
			const directResult = await browser.storage.sync.get(baseKey);
			if (directResult[baseKey]) {
				return directResult[baseKey];
			}
			return null;
		}

		// Data is chunked - read all chunks
		const chunkCount = metadata.chunkCount;

		const chunkKeys = [];
		for (let i = 0; i < chunkCount; i++) {
			chunkKeys.push(`${baseKey}_chunk_${i}`);
		}

		const chunksResult = await browser.storage.sync.get(chunkKeys);

		// Verify all chunks were found
		const chunks = [];
		for (let i = 0; i < chunkCount; i++) {
			const chunkKey = `${baseKey}_chunk_${i}`;
			if (!chunksResult[chunkKey]) {
				throw new Error(`Missing chunk ${i} of ${chunkCount} for key: ${baseKey}`);
			}
			chunks.push(chunksResult[chunkKey]);
		}

		// Reassemble and parse
		const jsonString = chunks.join('');
		const data = JSON.parse(jsonString);
		return data;
	} catch (error) {
		throw error;
	}
}

/**
 * Clear all chunks and metadata for a given key from sync storage
 * @param {string} baseKey - Base key name
 * @returns {Promise<void>}
 */
async function clearChunkedSync(baseKey) {
	try {
		// Check metadata to see how many chunks exist
		const metadataKey = `${baseKey}_metadata`;
		const metadataResult = await browser.storage.sync.get(metadataKey);
		const metadata = metadataResult[metadataKey];

		const keysToRemove = [baseKey, metadataKey];

		if (metadata && metadata.chunked && metadata.chunkCount) {
			// Add all chunk keys
			for (let i = 0; i < metadata.chunkCount; i++) {
				keysToRemove.push(`${baseKey}_chunk_${i}`);
			}
		}

		// Also try to remove chunks even if metadata is missing (cleanup orphaned chunks)
		// Check for chunks 0-49 (should be more than enough)
		for (let i = 0; i < 50; i++) {
			keysToRemove.push(`${baseKey}_chunk_${i}`);
		}

		await browser.storage.sync.remove(keysToRemove);
	} catch (error) {
		// Don't throw - cleanup is best-effort
	}
}

/**
 * Save data to sync storage with automatic chunking if needed
 * @param {string} baseKey - Base key name (e.g., 'customTabs')
 * @param {*} data - Data to save (will be JSON stringified)
 * @returns {Promise<void>}
 */
async function saveChunkedSync(baseKey, data) {
	try {
		const jsonString = JSON.stringify(data);
		const byteSize = new Blob([jsonString]).size;

		// Clear any existing chunks first
		await clearChunkedSync(baseKey);

		// Determine if chunking is needed
		if (byteSize <= CHUNK_SIZE) {
			// Small enough to save directly
			const storageObj = {};
			storageObj[baseKey] = data;
			storageObj[`${baseKey}_metadata`] = {
				chunked: false,
				byteSize: byteSize,
				savedAt: new Date().toISOString()
			};

			await browser.storage.sync.set(storageObj);
			return;
		}

		// Need to chunk the data
		const chunks = [];
		let offset = 0;
		while (offset < jsonString.length) {
			const chunk = jsonString.slice(offset, offset + CHUNK_SIZE);
			chunks.push(chunk);
			offset += CHUNK_SIZE;
		}

		const storageObj = {};

		// Save each chunk
		chunks.forEach((chunk, index) => {
			const chunkKey = `${baseKey}_chunk_${index}`;
			storageObj[chunkKey] = chunk;
		});

		// Save metadata
		storageObj[`${baseKey}_metadata`] = {
			chunked: true,
			chunkCount: chunks.length,
			byteSize: byteSize,
			savedAt: new Date().toISOString()
		};

		await browser.storage.sync.set(storageObj);
	} catch (error) {
		// Check if it's a quota error
		if (error.message && error.message.includes('QUOTA')) {
			throw new Error(`Sync storage quota exceeded. Your configuration is too large (${Math.round(byteSize / 1024)}KB).`);
		}

		throw error;
	}
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
	// Set up event listeners
	exportButton.addEventListener('click', exportSettings);
	importButton.addEventListener('click', importSettings);
	fileInput.addEventListener('change', handleFileSelect);

	// Set up modal event listeners
	setupModalListeners();

	// Styling functions
	applyThemeFromStorage();
});

// Apply theme based on saved user settings
function applyThemeFromStorage() {
	browser.storage.local.get('userSettings')
		.then((result) => {
			if (result.userSettings && result.userSettings.themeMode) {
				const themeMode = result.userSettings.themeMode;

				if (themeMode === 'system') {
					// Check system preference
					if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
						document.documentElement.setAttribute('data-theme', 'dark');
					} else {
						document.documentElement.setAttribute('data-theme', 'light');
					}
				} else {
					// Apply user selected theme
					document.documentElement.setAttribute('data-theme', themeMode);
				}
			}
		})
		.catch(error => {
			// Error loading theme settings
		});
}

// Export settings function
async function exportSettings() {
	try {
		// Get storage preference to determine which storage area to read from
		const useSyncStorage = await getStoragePreference();

		let customTabs = [];
		let userSettings = {};
		let profiles = [];

		if (useSyncStorage) {
			// Read from sync storage with chunking support
			customTabs = await readChunkedSync('customTabs') || [];

			// Read profiles from sync storage
			profiles = await readChunkedSync('profiles') || [];

			// User settings are always in sync storage
			const settingsResult = await browser.storage.sync.get('userSettings');
			userSettings = settingsResult.userSettings || {};
		} else {
			// Read from local storage
			const result = await browser.storage.local.get(['customTabs', 'userSettings', 'profiles']);
			customTabs = result.customTabs || [];
			userSettings = result.userSettings || {};
			profiles = result.profiles || [];
		}

		// If profiles exist, also export tabs for each profile
		const profileTabs = {};
		if (profiles.length > 0) {
			for (const profile of profiles) {
				const storageKey = `profile_${profile.id}_tabs`;
				if (useSyncStorage) {
					profileTabs[profile.id] = await readChunkedSync(storageKey) || [];
				} else {
					const result = await browser.storage.local.get(storageKey);
					profileTabs[profile.id] = result[storageKey] || [];
				}
			}
		}

		// Create a configuration object containing all settings
		const config = {
			customTabs: customTabs,
			userSettings: userSettings,
			profiles: profiles,
			profileTabs: profileTabs
		};

		// Convert to JSON string
		const jsonString = JSON.stringify(config, null, 2);

		// Create a Blob containing the data
		const blob = new Blob([jsonString], { type: 'application/json' });

		// Create an object URL for the blob
		const url = URL.createObjectURL(blob);

		// Generate timestamp for the filename
		const now = new Date();
		const timestamp = now.getFullYear() + '-' +
			('0' + (now.getMonth() + 1)).slice(-2) + '-' +
			('0' + now.getDate()).slice(-2) + '_' +
			('0' + now.getHours()).slice(-2) + '-' +
			('0' + now.getMinutes()).slice(-2);

		// Create the filename with timestamp
		const filename = `sftabs_config_${timestamp}.json`;

		// Create a temporary anchor element
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;

		// Append to the DOM
		document.body.appendChild(a);

		// Trigger the download
		a.click();

		// Clean up
		document.body.removeChild(a);
		URL.revokeObjectURL(url);

		showStatus('Configuration exported successfully', false);
	} catch (error) {
		showStatus('Error exporting configuration: ' + error.message, true);
	}
}

// Import settings function - simplified direct approach
function importSettings() {
	fileInput.click();
}

// File selection handler - Updated to support profile-aware imports
async function handleFileSelect(event) {
	const file = event.target.files[0];

	if (!file) {
		return;
	}

	const reader = new FileReader();

	reader.onload = async function(e) {
		try {
			const fileContent = e.target.result;
			const config = JSON.parse(fileContent);

			// Validate the configuration
			if (!config.customTabs || !Array.isArray(config.customTabs)) {
				throw new Error('Invalid configuration format: missing customTabs array');
			}

			// Get user settings to check if profiles UI is enabled
			const useSyncStorage = await getStoragePreference();
			let userSettings = {};

			if (useSyncStorage) {
				const result = await browser.storage.sync.get('userSettings');
				userSettings = result.userSettings || {};
			} else {
				const result = await browser.storage.local.get('userSettings');
				userSettings = result.userSettings || {};
			}

			const profilesEnabled = userSettings.profilesEnabled || false;

			if (!profilesEnabled) {
				// Profiles UI is disabled - import directly to active profile
				await importToActiveProfile(config);
				showStatus('Configuration imported successfully to your tabs', false);
				notifyTabsAndPopup();
			} else {
				// Profiles UI is enabled - show modal to choose import target
				pendingImportConfig = config;
				await showImportModal();
			}
		} catch (error) {
			showStatus('Error: ' + error.message, true);
		}
	};

	reader.onerror = function() {
		showStatus('Error reading file', true);
	};

	reader.readAsText(file);

	// Reset the file input to allow selecting the same file again
	fileInput.value = '';
}

// Show status message
function showStatus(message, isError = false) {
	statusMessage.textContent = message;

	// Apply appropriate class
	statusMessage.classList.remove('success', 'error');
	if (isError) {
		statusMessage.classList.add('error');
	} else {
		statusMessage.classList.add('success');
	}
}

// ============================================================================
// NEW: Enhanced Import Functionality with Profile Support
// ============================================================================

// Global variable to store parsed config during import
let pendingImportConfig = null;

/**
 * Setup modal event listeners for import target selection
 */
function setupModalListeners() {
	const overwriteRadio = document.querySelector('input[name="import-option"][value="overwrite"]');
	const newProfileRadio = document.querySelector('input[name="import-option"][value="new"]');
	const overwriteSection = document.getElementById('overwrite-profile-section');
	const newProfileSection = document.getElementById('new-profile-section');
	const confirmButton = document.getElementById('import-modal-confirm');
	const cancelButton = document.getElementById('import-modal-cancel');

	if (overwriteRadio && newProfileRadio) {
		overwriteRadio.addEventListener('change', () => {
			if (overwriteSection) overwriteSection.style.display = 'block';
			if (newProfileSection) newProfileSection.style.display = 'none';
		});

		newProfileRadio.addEventListener('change', () => {
			if (overwriteSection) overwriteSection.style.display = 'none';
			if (newProfileSection) newProfileSection.style.display = 'block';
		});
	}

	if (confirmButton) {
		confirmButton.addEventListener('click', handleImportConfirm);
	}

	if (cancelButton) {
		cancelButton.addEventListener('click', hideImportModal);
	}
}

/**
 * Show import target selection modal
 */
async function showImportModal() {
	const modal = document.getElementById('import-target-modal');
	const profileSelect = document.getElementById('import-profile-select');
	const newProfileInput = document.getElementById('new-profile-name');

	if (!modal || !profileSelect) {
		return;
	}

	// Get current profiles and user settings
	const useSyncStorage = await getStoragePreference();
	let profiles = [];
	let userSettings = {};

	if (useSyncStorage) {
		profiles = await readChunkedSync('profiles') || [];
		const settingsResult = await browser.storage.sync.get('userSettings');
		userSettings = settingsResult.userSettings || {};
	} else {
		const result = await browser.storage.local.get(['profiles', 'userSettings']);
		profiles = result.profiles || [];
		userSettings = result.userSettings || {};
	}

	// Populate profile dropdown
	profileSelect.innerHTML = '<option value="">Choose a profile...</option>';
	const activeProfileId = userSettings.activeProfileId;

	profiles.forEach(profile => {
		const option = document.createElement('option');
		option.value = profile.id;
		option.textContent = profile.name;

		// Pre-select active profile
		if (profile.id === activeProfileId) {
			option.selected = true;
		}

		profileSelect.appendChild(option);
	});

	// Clear new profile name input
	if (newProfileInput) {
		newProfileInput.value = '';
	}

	// Show modal
	modal.style.display = 'flex';
}

/**
 * Hide import target selection modal
 */
function hideImportModal() {
	const modal = document.getElementById('import-target-modal');
	if (modal) {
		modal.style.display = 'none';
	}
	pendingImportConfig = null;
}

/**
 * Handle import confirmation from modal
 */
async function handleImportConfirm() {
	if (!pendingImportConfig) {
		showStatus('No configuration to import', true);
		hideImportModal();
		return;
	}

	const overwriteRadio = document.querySelector('input[name="import-option"][value="overwrite"]');
	const profileSelect = document.getElementById('import-profile-select');
	const newProfileInput = document.getElementById('new-profile-name');

	try {
		let targetProfileId = null;

		if (overwriteRadio && overwriteRadio.checked) {
			// Overwrite existing profile
			const profileId = profileSelect.value;
			if (!profileId) {
				showStatus('Please select a profile to overwrite', true);
				return;
			}

			await importToProfile(pendingImportConfig, profileId);
			targetProfileId = profileId;
			showStatus('Configuration imported successfully to existing profile', false);
		} else {
			// Create new profile
			const profileName = newProfileInput.value.trim();
			if (!profileName) {
				showStatus('Please enter a profile name', true);
				return;
			}

			targetProfileId = await importToNewProfile(pendingImportConfig, profileName);
			showStatus(`Configuration imported successfully to new profile "${profileName}"`, false);
		}

		// Switch to the imported/created profile
		if (targetProfileId) {
			await switchToProfile(targetProfileId);
		}

		hideImportModal();
		notifyTabsAndPopup();
	} catch (error) {
		showStatus('Error importing: ' + error.message, true);
	}
}

/**
 * Import tabs to an existing profile
 */
async function importToProfile(config, profileId) {
	const tabsToImport = config.customTabs || [];
	const useSyncStorage = await getStoragePreference();

	const storageKey = `profile_${profileId}_tabs`;

	if (useSyncStorage) {
		await saveChunkedSync(storageKey, tabsToImport);
	} else {
		const storageData = {};
		storageData[storageKey] = tabsToImport;
		await browser.storage.local.set(storageData);
	}
}

/**
 * Import tabs to a new profile
 * @returns {Promise<string>} The ID of the newly created profile
 */
async function importToNewProfile(config, profileName) {
	const tabsToImport = config.customTabs || [];
	const useSyncStorage = await getStoragePreference();

	// Generate new profile ID
	const profileId = `profile_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

	// Create profile object
	const newProfile = {
		id: profileId,
		name: profileName,
		isDefault: false,
		urlPatterns: [],
		createdAt: new Date().toISOString(),
		lastActive: null
	};

	// Load existing profiles
	let profiles = [];
	if (useSyncStorage) {
		profiles = await readChunkedSync('profiles') || [];
	} else {
		const result = await browser.storage.local.get('profiles');
		profiles = result.profiles || [];
	}

	// Add new profile
	profiles.push(newProfile);

	// Save profiles
	if (useSyncStorage) {
		await saveChunkedSync('profiles', profiles);
	} else {
		await browser.storage.local.set({ profiles });
	}

	// Save tabs for new profile
	await importToProfile(config, profileId);
	return profileId;
}

/**
 * Import directly to active profile (when profiles UI is disabled)
 */
async function importToActiveProfile(config) {
	const useSyncStorage = await getStoragePreference();

	// Get user settings to find active profile
	let userSettings = {};
	if (useSyncStorage) {
		const result = await browser.storage.sync.get('userSettings');
		userSettings = result.userSettings || {};
	} else {
		const result = await browser.storage.local.get('userSettings');
		userSettings = result.userSettings || {};
	}

	const activeProfileId = userSettings.activeProfileId;
	if (!activeProfileId) {
		throw new Error('No active profile found');
	}

	await importToProfile(config, activeProfileId);
}

/**
 * Switch to a specific profile
 * @param {string} profileId - The ID of the profile to switch to
 */
async function switchToProfile(profileId) {
	const useSyncStorage = await getStoragePreference();

	// Load user settings
	let userSettings = {};
	if (useSyncStorage) {
		const result = await browser.storage.sync.get('userSettings');
		userSettings = result.userSettings || {};
	} else {
		const result = await browser.storage.local.get('userSettings');
		userSettings = result.userSettings || {};
	}

	// Update active profile
	userSettings.activeProfileId = profileId;

	// Save updated settings
	if (useSyncStorage) {
		await browser.storage.sync.set({ userSettings });
	} else {
		await browser.storage.local.set({ userSettings });
	}
}

/**
 * Notify all tabs and popup to refresh
 */
function notifyTabsAndPopup() {
	// Send refresh message to all Salesforce tabs
	browser.tabs.query({})
		.then(tabs => {
			tabs.forEach(tab => {
				if (tab.url && (tab.url.includes('lightning.force.com') || tab.url.includes('salesforce.com'))) {
					browser.tabs.sendMessage(tab.id, { action: 'refresh_tabs' })
						.catch(() => {
							// Silently ignore - tab may not have content script
						});
				}
			});
		})
		.catch(() => {
			// Silently ignore query errors
		});

	// Send message to popup to reload if it's open
	browser.runtime.sendMessage({ action: 'reload_popup' })
		.catch(() => {
			// Silently ignore - popup may not be open
		});
}