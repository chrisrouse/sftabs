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
    }
  };
}

console.log('SF Tabs: Background script loaded');

/**
 * Perform storage migration from sync to local storage
 * This runs automatically on install/update before user opens popup
 */
async function migrateStorage() {
  console.log('🔄 SF Tabs Background: Starting storage migration check...');

  try {
    // Check both storage locations
    const [localResult, syncResult] = await Promise.all([
      browser.storage.local.get(['customTabs', 'extensionVersion']),
      browser.storage.sync.get(['customTabs', 'userSettings'])
    ]);

    const localTabs = localResult.customTabs || [];
    const syncTabs = syncResult.customTabs || [];

    // Count custom (non-default) tabs in each location
    const localCustomCount = localTabs.filter(t => !t.id?.startsWith('default_tab_')).length;
    const syncCustomCount = syncTabs.filter(t => !t.id?.startsWith('default_tab_')).length;

    console.log('📊 SF Tabs Background: Storage analysis:', {
      local: { total: localTabs.length, custom: localCustomCount },
      sync: { total: syncTabs.length, custom: syncCustomCount },
      hasVersion: !!localResult.extensionVersion
    });

    // Determine if migration is needed
    let needsMigration = false;
    let migrationReason = '';

    if (syncCustomCount > localCustomCount) {
      // Sync has more custom tabs - migrate from sync to local
      needsMigration = true;
      migrationReason = `Sync has ${syncCustomCount} custom tabs vs local's ${localCustomCount}`;
    } else if (syncTabs.length > 0 && localTabs.length === 0) {
      // Sync has tabs but local is empty - migrate
      needsMigration = true;
      migrationReason = 'Sync has tabs but local is empty';
    }

    if (needsMigration) {
      console.log('🔄 SF Tabs Background: Migration needed -', migrationReason);
      console.log('🔄 SF Tabs Background: Migrating', syncTabs.length, 'tabs from sync to local storage');

      // Perform migration
      await browser.storage.local.set({
        customTabs: syncTabs,
        extensionVersion: '1.4.0'
      });

      // Migrate user settings if they exist
      if (syncResult.userSettings) {
        console.log('🔄 SF Tabs Background: Migrating user settings');
        await browser.storage.local.set({
          userSettings: syncResult.userSettings
        });
      }

      console.log('✅ SF Tabs Background: Migration to local storage complete');

      // Clear sync storage after successful migration
      try {
        await browser.storage.sync.clear();
        console.log('✅ SF Tabs Background: Sync storage cleared');
      } catch (e) {
        console.warn('⚠️ SF Tabs Background: Could not clear sync storage:', e);
      }
    } else if (localTabs.length > 0) {
      console.log('✅ SF Tabs Background: Local storage already has', localCustomCount, 'custom tabs - no migration needed');

      // Ensure version marker is set
      if (!localResult.extensionVersion) {
        await browser.storage.local.set({ extensionVersion: '1.4.0' });
        console.log('✅ SF Tabs Background: Added version marker to local storage');
      }
    } else {
      console.log('ℹ️ SF Tabs Background: No tabs found in either storage - first-time install');
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

console.log('SF Tabs: Background script initialized');
