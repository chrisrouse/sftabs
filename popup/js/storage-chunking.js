// popup/js/storage-chunking.js
// The pages' entry point to chunked sync storage.
//
// Sync storage caps a single value, so anything larger is split across
// `${key}_chunk_N` with a `${key}_metadata` record giving the count.
//
// The implementation is not here. It lives in shared/utils.js, which the popup,
// the settings page, both content-script entries and the background worker all
// load — this file is the SFTabs.storageChunking name the pages already call
// through. There used to be two full implementations, this one and a copy in
// background.js, and they drifted: the worker's reader returned null when
// reassembly failed while this one threw, so a torn read became "you have no
// tabs" in the worker and the next write made that true. One implementation
// cannot disagree with itself.

/** Read one value, reassembling chunks. Throws if a chunk is missing. */
async function readChunkedSync(baseKey) {
	return SFTabs.utils.readChunkedSyncValue(baseKey);
}

/** Write one value, chunking it when it outgrows a single sync entry. */
async function saveChunkedSync(baseKey, data) {
	return SFTabs.utils.writeChunkedSyncValue(baseKey, data);
}

/**
 * Delete a value and every chunk of it.
 *
 * Distinct from writing, and still needed: migrating between storage areas and
 * resetting both remove a key outright rather than replacing its contents.
 *
 * The speculative sweep of fifty chunk keys is deliberate here, unlike on the
 * write path where it was removed. A deletion is the one moment orphans left by
 * an interrupted earlier write should be cleared, and it is rare — Chrome's
 * limit of 120 sync writes a minute is no concern for an explicit delete.
 */
async function clearChunkedSync(baseKey) {
	try {
		const metadataKey = `${baseKey}_metadata`;
		const metadata = (await browser.storage.sync.get(metadataKey))[metadataKey];

		const keysToRemove = [baseKey, metadataKey];
		const known = (metadata && metadata.chunked && metadata.chunkCount) || 0;
		for (let i = 0; i < Math.max(known, 50); i++) {
			keysToRemove.push(`${baseKey}_chunk_${i}`);
		}

		await browser.storage.sync.remove(keysToRemove);
	} catch (error) {
		// Best-effort: unreferenced keys are ignored by readers, which take the
		// count from metadata, so a failure here is not worth surfacing.
	}
}

// Export
window.SFTabs = window.SFTabs || {};
window.SFTabs.storageChunking = {
	saveChunkedSync,
	readChunkedSync,
	clearChunkedSync
};
