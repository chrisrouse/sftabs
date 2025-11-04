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
