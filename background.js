// background.js
// Background script that runs when extension installs or updates
// Handles seamless storage migration from sync to local storage

'use strict';

// Chrome compatibility - use native browser API if available, otherwise wrap chrome
if (typeof browser === 'undefined' && typeof chrome !== 'undefined') {
  globalThis.browser = {
    runtime: chrome.runtime,
    storage: {
      local: {
        get: (keys) => new Promise((resolve, reject) => {
          chrome.storage.local.get(keys, (result) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(result);
            }
          });
        }),
        set: (items) => new Promise((resolve, reject) => {
          chrome.storage.local.set(items, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        })
      },
      sync: {
        get: (keys) => new Promise((resolve, reject) => {
          chrome.storage.sync.get(keys, (result) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(result);
            }
          });
        }),
        set: (items) => new Promise((resolve, reject) => {
          chrome.storage.sync.set(items, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        }),
        clear: () => new Promise((resolve, reject) => {
          chrome.storage.sync.clear(() => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        })
      }
    },
    commands: chrome.commands,
    tabs: chrome.tabs
  };
}

console.log('SF Tabs: Background script loaded');

/**
 * Chunked storage utilities for background script
 */
const CHUNK_SIZE = 7000;

async function readChunkedSync(baseKey) {
  try {
    const metadataKey = `${baseKey}_metadata`;
    const metadataResult = await browser.storage.sync.get(metadataKey);
    const metadata = metadataResult[metadataKey];

    if (!metadata || !metadata.chunked) {
      const directResult = await browser.storage.sync.get(baseKey);
      return directResult[baseKey] || null;
    }

    const chunkCount = metadata.chunkCount;
    const chunkKeys = [];
    for (let i = 0; i < chunkCount; i++) {
      chunkKeys.push(`${baseKey}_chunk_${i}`);
    }

    const chunksResult = await browser.storage.sync.get(chunkKeys);
    const chunks = [];
    for (let i = 0; i < chunkCount; i++) {
      const chunkKey = `${baseKey}_chunk_${i}`;
      if (!chunksResult[chunkKey]) {
        throw new Error(`Missing chunk ${i} of ${chunkCount}`);
      }
      chunks.push(chunksResult[chunkKey]);
    }

    const jsonString = chunks.join('');
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error reading chunked sync:', error);
    return null;
  }
}

async function saveChunkedSync(baseKey, data) {
  try {
    const jsonString = JSON.stringify(data);
    const byteSize = new Blob([jsonString]).size;

    // Clear existing chunks first
    const metadataKey = `${baseKey}_metadata`;
    const metadataResult = await browser.storage.sync.get(metadataKey);
    const metadata = metadataResult[metadataKey];

    const keysToRemove = [baseKey, metadataKey];
    if (metadata && metadata.chunked && metadata.chunkCount) {
      for (let i = 0; i < metadata.chunkCount; i++) {
        keysToRemove.push(`${baseKey}_chunk_${i}`);
      }
    }
    await browser.storage.sync.remove(keysToRemove);

    if (byteSize <= CHUNK_SIZE) {
      // Save directly
      const storageObj = {};
      storageObj[baseKey] = data;
      storageObj[`${baseKey}_metadata`] = {
        chunked: false,
        byteSize: byteSize,
        savedAt: new Date().toISOString()
      };
      await browser.storage.sync.set(storageObj);
      return { success: true, chunked: false };
    }

    // Chunk the data
    const chunks = [];
    let offset = 0;
    while (offset < jsonString.length) {
      chunks.push(jsonString.slice(offset, offset + CHUNK_SIZE));
      offset += CHUNK_SIZE;
    }

    const storageObj = {};
    chunks.forEach((chunk, index) => {
      storageObj[`${baseKey}_chunk_${index}`] = chunk;
    });
    storageObj[`${baseKey}_metadata`] = {
      chunked: true,
      chunkCount: chunks.length,
      byteSize: byteSize,
      savedAt: new Date().toISOString()
    };

    await browser.storage.sync.set(storageObj);
    return { success: true, chunked: true, chunkCount: chunks.length };
  } catch (error) {
    console.error('Error saving chunked sync:', error);
    throw error;
  }
}

/**
 * Detect storage format and location for migration
 */
async function detectStorageFormat() {
  try {
    // Check user settings to see what format they prefer
    const syncSettings = await browser.storage.sync.get('userSettings');
    const preferSync = syncSettings.userSettings?.useSyncStorage !== false; // Default true

    // Check for chunked sync storage
    const syncMetadata = await browser.storage.sync.get('customTabs_metadata');
    const hasChunkedSync = !!syncMetadata.customTabs_metadata;

    // Check for non-chunked sync storage
    const syncDirect = await browser.storage.sync.get('customTabs');
    const hasDirectSync = !!syncDirect.customTabs;

    // Check for local storage
    const localData = await browser.storage.local.get('customTabs');
    const hasLocal = !!localData.customTabs;

    return {
      preferSync,
      hasChunkedSync,
      hasDirectSync,
      hasLocal,
      syncTabs: hasChunkedSync ? await readChunkedSync('customTabs') : (syncDirect.customTabs || null),
      localTabs: localData.customTabs || null
    };
  } catch (error) {
    console.error('Error detecting storage format:', error);
    return { preferSync: true, hasChunkedSync: false, hasDirectSync: false, hasLocal: false };
  }
}

/**
 * Perform storage migration - handles v1.3 (sync), v1.4 (local), and v1.5 (chunked sync)
 * This runs automatically on install/update before user opens popup
 */
async function migrateStorage() {
  console.log('🔄 SF Tabs Background: Starting storage migration check for v1.5.0...');

  try {
    const format = await detectStorageFormat();

    console.log('📊 SF Tabs Background: Storage format detected:', {
      preferSync: format.preferSync,
      hasChunkedSync: format.hasChunkedSync,
      hasDirectSync: format.hasDirectSync,
      hasLocal: format.hasLocal,
      syncTabCount: format.syncTabs?.length || 0,
      localTabCount: format.localTabs?.length || 0
    });

    // Determine what needs to be migrated
    const syncTabCount = format.syncTabs?.length || 0;
    const localTabCount = format.localTabs?.length || 0;
    const syncCustomCount = (format.syncTabs || []).filter(t => !t.id?.startsWith('default_tab_')).length;
    const localCustomCount = (format.localTabs || []).filter(t => !t.id?.startsWith('default_tab_')).length;

    // Migration logic based on user preference and existing data
    if (format.preferSync) {
      // User prefers sync storage
      if (syncTabCount > 0 && !format.hasChunkedSync) {
        // Old sync format (v1.3) - migrate to chunked sync
        console.log('🔄 SF Tabs Background: Migrating v1.3 (non-chunked sync) → v1.5 (chunked sync)');
        await saveChunkedSync('customTabs', format.syncTabs);
        await browser.storage.local.remove(['customTabs', 'extensionVersion']);
        console.log('✅ SF Tabs Background: Migration complete - using chunked sync storage');
      } else if (localTabCount > 0 && syncTabCount === 0) {
        // Local storage exists but no sync - migrate local to chunked sync
        console.log('🔄 SF Tabs Background: Migrating v1.4 (local) → v1.5 (chunked sync)');
        await saveChunkedSync('customTabs', format.localTabs);
        await browser.storage.local.remove(['customTabs', 'extensionVersion']);
        console.log('✅ SF Tabs Background: Migration complete - using chunked sync storage');
      } else if (localCustomCount > syncCustomCount) {
        // Local has more custom tabs - migrate to sync
        console.log('🔄 SF Tabs Background: Local has more custom tabs - migrating to chunked sync');
        await saveChunkedSync('customTabs', format.localTabs);
        await browser.storage.local.remove(['customTabs', 'extensionVersion']);
        console.log('✅ SF Tabs Background: Migration complete - using chunked sync storage');
      } else if (syncTabCount > 0) {
        console.log('✅ SF Tabs Background: Already using sync storage - no migration needed');
      } else {
        console.log('ℹ️ SF Tabs Background: No tabs found - first-time install (will use sync)');
      }
    } else {
      // User prefers local storage
      if (syncTabCount > 0 && localTabCount === 0) {
        // Sync exists but no local - migrate to local
        console.log('🔄 SF Tabs Background: Migrating sync → local (user preference)');
        await browser.storage.local.set({
          customTabs: format.syncTabs,
          extensionVersion: '1.5.0'
        });
        // Clear sync storage
        const keysToRemove = ['customTabs', 'customTabs_metadata'];
        for (let i = 0; i < 50; i++) {
          keysToRemove.push(`customTabs_chunk_${i}`);
        }
        await browser.storage.sync.remove(keysToRemove);
        console.log('✅ SF Tabs Background: Migration complete - using local storage');
      } else if (localTabCount > 0) {
        console.log('✅ SF Tabs Background: Already using local storage - no migration needed');
        await browser.storage.local.set({ extensionVersion: '1.5.0' });
      } else {
        console.log('ℹ️ SF Tabs Background: No tabs found - first-time install (will use local)');
      }
    }

    // Ensure user settings are in sync storage (they should always be there)
    const localSettings = await browser.storage.local.get('userSettings');
    if (localSettings.userSettings) {
      console.log('🔄 SF Tabs Background: Moving userSettings to sync storage');
      await browser.storage.sync.set({ userSettings: localSettings.userSettings });
      await browser.storage.local.remove('userSettings');
    }

    return true;
  } catch (error) {
    console.error('❌ SF Tabs Background: Migration error:', error);
    return false;
  }
}

/**
 * Handle extension installation and updates
 */
browser.runtime.onInstalled.addListener(async (details) => {
  console.log('SF Tabs: Extension event:', details.reason);

  if (details.reason === 'install') {
    console.log('SF Tabs: First-time installation detected');
    await migrateStorage();
  } else if (details.reason === 'update') {
    const previousVersion = details.previousVersion;
    const currentVersion = browser.runtime.getManifest().version;
    console.log(`SF Tabs: Updating from ${previousVersion} to ${currentVersion}`);

    // Run migration on every update to handle upgrades from old versions
    await migrateStorage();
  }
});

// Also run migration on startup to catch any edge cases
browser.runtime.onStartup.addListener(async () => {
  console.log('SF Tabs: Browser startup - checking storage');
  await migrateStorage();
});

/**
 * Handle keyboard shortcuts
 */
browser.commands.onCommand.addListener(async (command) => {
  console.log('SF Tabs: Keyboard command received:', command);

  if (command.startsWith('open-tab-')) {
    try {
      // Extract position number from command (1-based)
      const position = parseInt(command.split('-')[2]) - 1;

      // Get custom tabs from storage
      const result = await browser.storage.local.get('customTabs');
      const tabs = result.customTabs || [];

      // Filter to only top-level tabs that have a path (not folder-style tabs)
      const eligibleTabs = tabs
        .filter(tab => !tab.parentId && tab.path)
        .sort((a, b) => a.position - b.position);

      console.log('SF Tabs: Found', eligibleTabs.length, 'eligible tabs for shortcuts');

      // Check if we have a tab at this position
      if (eligibleTabs[position]) {
        const targetTab = eligibleTabs[position];
        console.log('SF Tabs: Navigating to tab:', targetTab.label, 'at position', position + 1);

        // Get the active Salesforce tab
        const [activeTab] = await browser.tabs.query({
          active: true,
          currentWindow: true
        });

        // Check if we're on a Salesforce page
        if (activeTab && activeTab.url &&
            (activeTab.url.includes('lightning.force.com') ||
             activeTab.url.includes('salesforce.com') ||
             activeTab.url.includes('salesforce-setup.com'))) {

          // Send message to content script to navigate
          await browser.tabs.sendMessage(activeTab.id, {
            action: 'navigate_to_tab',
            tab: targetTab
          });

          console.log('SF Tabs: Navigation message sent to content script');
        } else {
          console.warn('SF Tabs: Not on a Salesforce page, keyboard shortcut ignored');
        }
      } else {
        console.warn('SF Tabs: No eligible tab at position', position + 1);
      }
    } catch (error) {
      console.error('SF Tabs: Error handling keyboard command:', error);
    }
  }
});

console.log('SF Tabs: Background script initialized');
