// popup/js/storage-chunking.js
// Storage chunking utilities for handling large configs in sync storage

/**
 * Split a JSON string into chunks of specified size
 * @param {string} jsonString - The JSON string to chunk
 * @param {number} chunkSize - Maximum size of each chunk in bytes
 * @returns {string[]} Array of chunk strings
 */
function chunkData(jsonString, chunkSize) {
	if (!jsonString) {
		return [];
	}

	const chunks = [];
	let offset = 0;

	while (offset < jsonString.length) {
		const chunk = jsonString.slice(offset, offset + chunkSize);
		chunks.push(chunk);
		offset += chunkSize;
	}

	console.log(`📦 Chunked data: ${jsonString.length} bytes into ${chunks.length} chunks`);
	return chunks;
}

/**
 * Reassemble chunks back into a single JSON string
 * @param {string[]} chunks - Array of chunk strings
 * @returns {string} Reassembled JSON string
 */
function unchunkData(chunks) {
	if (!chunks || chunks.length === 0) {
		return '';
	}

	const reassembled = chunks.join('');
	console.log(`🔧 Reassembled ${chunks.length} chunks into ${reassembled.length} bytes`);
	return reassembled;
}

/**
 * Save data to sync storage with automatic chunking if needed
 * @param {string} baseKey - Base key name (e.g., 'customTabs')
 * @param {*} data - Data to save (will be JSON stringified)
 * @returns {Promise<{success: boolean, chunked: boolean, chunkCount: number}>}
 */
async function saveChunkedSync(baseKey, data) {
	try {
		const jsonString = JSON.stringify(data);
		const byteSize = new Blob([jsonString]).size;
		const chunkSize = SFTabs.constants.CHUNK_SIZE;

		console.log(`💾 Saving to sync storage: ${baseKey} (${byteSize} bytes)`);

		// Clear any existing chunks first
		await clearChunkedSync(baseKey);

		// Determine if chunking is needed
		if (byteSize <= chunkSize) {
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

			return { success: true, chunked: false, chunkCount: 1 };
		}

		// Need to chunk the data
		const chunks = chunkData(jsonString, chunkSize);
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

		return { success: true, chunked: true, chunkCount: chunks.length };
	} catch (error) {
		console.error(`❌ Error saving to sync storage:`, error);

		// Check if it's a quota error
		if (error.message && error.message.includes('QUOTA')) {
			throw new Error(`Sync storage quota exceeded. Your configuration is too large (${Math.round(byteSize / 1024)}KB). Please reduce the number of tabs or dropdown items.`);
		}

		throw error;
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
		const jsonString = unchunkData(chunks);
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
 * Detect the storage format for a given key
 * @param {string} baseKey - Base key name
 * @returns {Promise<{location: 'sync-chunked'|'sync-direct'|'local'|'none', metadata: object|null}>}
 */
async function detectStorageFormat(baseKey) {
	try {
		// Check for chunked sync storage
		const metadataKey = `${baseKey}_metadata`;
		const syncMetadata = await browser.storage.sync.get(metadataKey);

		if (syncMetadata[metadataKey] && syncMetadata[metadataKey].chunked) {
			return { location: 'sync-chunked', metadata: syncMetadata[metadataKey] };
		}

		// Check for non-chunked sync storage
		const syncDirect = await browser.storage.sync.get(baseKey);
		if (syncDirect[baseKey]) {
			return { location: 'sync-direct', metadata: null };
		}

		// Check for local storage
		const localData = await browser.storage.local.get(baseKey);
		if (localData[baseKey]) {
			return { location: 'local', metadata: null };
		}

		return { location: 'none', metadata: null };
	} catch (error) {
		console.error(`❌ Error detecting storage format:`, error);
		return { location: 'none', metadata: null };
	}
}

// Export functions
window.SFTabs = window.SFTabs || {};
window.SFTabs.storageChunking = {
	chunkData,
	unchunkData,
	saveChunkedSync,
	readChunkedSync,
	clearChunkedSync,
	detectStorageFormat
};
