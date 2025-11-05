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
		console.warn('⚠️ Could not read storage preference, defaulting to sync:', error);
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
				console.log(`📖 Read from sync storage (non-chunked)`);
				return directResult[baseKey];
			}
			console.log(`ℹ️ No data found in sync storage for key: ${baseKey}`);
			return null;
		}

		// Data is chunked - read all chunks
		const chunkCount = metadata.chunkCount;
		console.log(`📖 Reading ${chunkCount} chunks from sync storage`);

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

		console.log(`✅ Successfully reassembled data from ${chunkCount} chunks`);
		return data;
	} catch (error) {
		console.error(`❌ Error reading from sync storage:`, error);
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
		console.log(`🗑️ Cleared sync storage for key: ${baseKey}`);
	} catch (error) {
		console.error(`❌ Error clearing sync storage:`, error);
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

		console.log(`💾 Saving to sync storage: ${baseKey} (${byteSize} bytes)`);

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
			console.log(`✅ Saved to sync storage (non-chunked)`);
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

		console.log(`📦 Chunked data: ${jsonString.length} bytes into ${chunks.length} chunks`);

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
		console.log(`✅ Saved to sync storage (${chunks.length} chunks)`);
	} catch (error) {
		console.error(`❌ Error saving to sync storage:`, error);

		// Check if it's a quota error
		if (error.message && error.message.includes('QUOTA')) {
			throw new Error(`Sync storage quota exceeded. Your configuration is too large (${Math.round(byteSize / 1024)}KB).`);
		}

		throw error;
	}
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
	console.log('Import/Export page loaded');

	// Set up event listeners
	exportButton.addEventListener('click', exportSettings);
	importButton.addEventListener('click', importSettings);
	fileInput.addEventListener('change', handleFileSelect);

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
			console.error('Error loading theme settings:', error);
		});
}

// Export settings function
async function exportSettings() {
	console.log('Exporting settings');

	try {
		// Get storage preference to determine which storage area to read from
		const useSyncStorage = await getStoragePreference();
		console.log('📦 Export using storage preference:', useSyncStorage ? 'sync' : 'local');

		let customTabs = [];
		let userSettings = {};

		if (useSyncStorage) {
			// Read from sync storage with chunking support
			console.log('📦 Reading tabs from sync storage for export');
			customTabs = await readChunkedSync('customTabs') || [];

			// User settings are always in sync storage
			const settingsResult = await browser.storage.sync.get('userSettings');
			userSettings = settingsResult.userSettings || {};
		} else {
			// Read from local storage
			console.log('📦 Reading from local storage for export');
			const result = await browser.storage.local.get(['customTabs', 'userSettings']);
			customTabs = result.customTabs || [];
			userSettings = result.userSettings || {};
		}

		console.log('✅ Found', customTabs.length, 'tabs to export');

		// Create a configuration object containing all settings
		const config = {
			customTabs: customTabs,
			userSettings: userSettings
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
		console.error('Error exporting configuration:', error);
		showStatus('Error exporting configuration: ' + error.message, true);
	}
}

// Import settings function - simplified direct approach
function importSettings() {
	console.log('Import function started');
	fileInput.click();
}

// File selection handler
function handleFileSelect(event) {
	console.log('File selection handler triggered');
	const file = event.target.files[0];

	if (!file) {
		console.log('No file selected');
		return;
	}

	console.log('File selected:', file.name);

	const reader = new FileReader();

	reader.onload = async function(e) {
		try {
			console.log('File read successfully');
			const fileContent = e.target.result;
			const config = JSON.parse(fileContent);

			// Validate the configuration
			if (!config.customTabs || !Array.isArray(config.customTabs)) {
				throw new Error('Invalid configuration format: missing customTabs array');
			}

			console.log('📥 Importing config with', config.customTabs.length, 'tabs');
			console.log('First imported tab:', config.customTabs[0]);

			// Get storage preference to determine where to save
			const useSyncStorage = await getStoragePreference();
			console.log('💾 Import using storage preference:', useSyncStorage ? 'sync' : 'local');

			// Save the configuration to the appropriate storage
			if (useSyncStorage) {
				// Save to sync storage with chunking support
				await saveChunkedSync('customTabs', config.customTabs);

				// User settings always go to sync storage
				await browser.storage.sync.set({
					userSettings: config.userSettings || {}
				});

				console.log('✅ Configuration saved to sync storage');
			} else {
				// Save to local storage
				await browser.storage.local.set({
					customTabs: config.customTabs,
					userSettings: config.userSettings || {}
				});

				console.log('✅ Configuration saved to local storage');
			}

			// Verify it was saved
			let verifyResult;
			if (useSyncStorage) {
				verifyResult = await readChunkedSync('customTabs');
			} else {
				const result = await browser.storage.local.get(['customTabs']);
				verifyResult = result.customTabs;
			}

			console.log('✅ Verified storage contains', verifyResult?.length || 0, 'tabs');
			console.log('Configuration imported successfully');

			// Send refresh message to all Salesforce tabs
			browser.tabs.query({})
				.then(tabs => {
					tabs.forEach(tab => {
						if (tab.url && (tab.url.includes('lightning.force.com') || tab.url.includes('salesforce.com'))) {
							browser.tabs.sendMessage(tab.id, { action: 'refresh_tabs' })
								.then(() => {
									console.log('✅ Tab refresh message sent to tab:', tab.id);
								})
								.catch(err => {
									console.log('ℹ️ Could not send refresh to tab:', tab.id, err.message);
								});
						}
					});
				})
				.catch(err => {
					console.log('ℹ️ Could not query tabs:', err.message);
				});

			// Send message to popup to reload if it's open
			browser.runtime.sendMessage({ action: 'reload_popup' })
				.catch(err => {
					console.log('ℹ️ No popup to reload:', err.message);
				});

			showStatus('Configuration imported successfully. Please reopen the popup to see your tabs.', false);
		} catch (error) {
			console.error('Error importing configuration:', error);
			showStatus('Error: ' + error.message, true);
		}
	};

	reader.onerror = function() {
		console.error('Error reading file');
		showStatus('Error reading file', true);
	};

	reader.readAsText(file);

	// Reset the file input to allow selecting the same file again
	fileInput.value = '';
}

// Show status message
function showStatus(message, isError = false) {
	console.log('Showing status message:', message, isError);
	statusMessage.textContent = message;

	// Apply appropriate class
	statusMessage.classList.remove('success', 'error');
	if (isError) {
		statusMessage.classList.add('error');
	} else {
		statusMessage.classList.add('success');
	}
}