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
        }),
        remove: (keys) => new Promise((resolve, reject) => {
          chrome.storage.local.remove(keys, () => {
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
        remove: (keys) => new Promise((resolve, reject) => {
          chrome.storage.sync.remove(keys, () => {
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
    return { preferSync: true, hasChunkedSync: false, hasDirectSync: false, hasLocal: false };
  }
}

/**
 * Detect if migration is needed and set flag for user-initiated migration
 * Returns true if migration is needed, false otherwise
 */
async function detectMigrationNeeded() {
  try {
    const currentVersion = browser.runtime.getManifest().version;
    const localData = await browser.storage.local.get(['extensionVersion', 'migrationCompleted']);

    const storedVersion = localData.extensionVersion;
    const migrationCompleted = localData.migrationCompleted;

    // If migration already completed for this version, no need to migrate
    if (migrationCompleted === currentVersion) {
      return false;
    }

    // Check if we have legacy tab data but no profiles
    const format = await detectStorageFormat();
    const syncTabCount = format.syncTabs?.length || 0;
    const localTabCount = format.localTabs?.length || 0;

    // Check if profiles exist
    let hasProfiles = false;
    const useSyncStorage = format.preferSync;

    if (useSyncStorage) {
      const profiles = await readChunkedSync('profiles');
      hasProfiles = profiles && profiles.length > 0;
    } else {
      const localProfiles = await browser.storage.local.get('profiles');
      hasProfiles = localProfiles.profiles && localProfiles.profiles.length > 0;
    }

    // Need migration if we have tabs but no profiles
    const needsMigration = (syncTabCount > 0 || localTabCount > 0) && !hasProfiles;

    if (needsMigration) {
      // Set migration pending flag
      await browser.storage.local.set({
        migrationPending: true,
        extensionVersion: storedVersion || 'unknown'
      });
      return true;
    }

    // No migration needed, ensure version is up to date
    await browser.storage.local.set({
      extensionVersion: currentVersion,
      migrationPending: false
    });

    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Handle extension installation and updates
 */
browser.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Check if migration is needed on fresh install
    await detectMigrationNeeded();
  } else if (details.reason === 'update') {
    // Check if migration is needed after update
    await detectMigrationNeeded();
  }
});

// Check for pending migration on startup
browser.runtime.onStartup.addListener(async () => {
  try {
    // Quick check - if migration already completed, skip
    const currentVersion = browser.runtime.getManifest().version;
    const { migrationCompleted } = await browser.storage.local.get('migrationCompleted');

    if (migrationCompleted === currentVersion) {
      return; // Already migrated for this version
    }

    // Check if migration is needed
    await detectMigrationNeeded();
  } catch (error) {
    // Error checking migration status on startup
  }
});

/**
 * Extract org identifier from Salesforce URL
 */
function extractOrgIdentifier(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Sandbox patterns (check first)
    const sandboxSetupMatch = hostname.match(/^([^.]+)\.sandbox\.my\.salesforce-setup\.com$/i);
    if (sandboxSetupMatch) return sandboxSetupMatch[1];

    const sandboxMyDomainMatch = hostname.match(/^([^.]+)\.sandbox\.my\.salesforce\.com$/i);
    if (sandboxMyDomainMatch) return sandboxMyDomainMatch[1];

    const sandboxLightningMatch = hostname.match(/^([^.]+)\.sandbox\.lightning\.force\.com$/i);
    if (sandboxLightningMatch) return sandboxLightningMatch[1];

    // Developer edition patterns
    const devSetupMatch = hostname.match(/^([^.]+)\.develop\.my\.salesforce-setup\.com$/i);
    if (devSetupMatch) return devSetupMatch[1];

    const devLightningMatch = hostname.match(/^([^.]+)\.develop\.lightning\.force\.com$/i);
    if (devLightningMatch) return devLightningMatch[1];

    // Standard patterns
    const lightningMatch = hostname.match(/^([^.]+)\.lightning\.force\.com$/i);
    if (lightningMatch) return lightningMatch[1];

    const myDomainMatch = hostname.match(/^([^.]+)\.my\.salesforce\.com$/i);
    if (myDomainMatch) return myDomainMatch[1];

    const setupMatch = hostname.match(/^([^.]+)\.my\.salesforce-setup\.com$/i);
    if (setupMatch) return setupMatch[1];

    const standardMatch = hostname.match(/^([^.]+)\.salesforce\.com$/i);
    if (standardMatch) return standardMatch[1];

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Check if auto-switching is enabled and switch profile if URL matches
 */
async function checkAndSwitchProfile(url) {
  try {
    // Get user settings
    const settingsResult = await browser.storage.sync.get('userSettings');
    const settings = settingsResult.userSettings || {};

    // Check if profiles and auto-switching are enabled
    if (!settings.profilesEnabled || !settings.autoSwitchProfiles) {
      return;
    }

    // Check if this is a Salesforce URL
    if (!url || (!url.includes('salesforce.com') &&
                  !url.includes('salesforce-setup.com') &&
                  !url.includes('force.com'))) {
      return;
    }

    // Extract org identifier from URL
    const orgIdentifier = extractOrgIdentifier(url);
    if (!orgIdentifier) {
      return;
    }

    // Get all profiles
    const profilesResult = await browser.storage.sync.get('profiles');
    const profiles = profilesResult.profiles || [];

    // Find a profile that matches this URL pattern
    const matchingProfile = profiles.find(profile => {
      if (!profile.urlPatterns || profile.urlPatterns.length === 0) {
        return false;
      }
      return profile.urlPatterns.some(pattern => {
        // Case-insensitive match
        return pattern.toLowerCase() === orgIdentifier.toLowerCase();
      });
    });

    let targetProfile = null;

    if (matchingProfile) {
      // Found a matching profile
      targetProfile = matchingProfile;
    } else {
      // No match found - fall back to default profile
      const defaultProfile = profiles.find(p => p.isDefault) ||
                           profiles.find(p => p.id === settings.defaultProfileId);

      if (defaultProfile) {
        targetProfile = defaultProfile;
      } else {
        return; // No default profile found
      }
    }

    // Check if this profile is already active
    if (settings.activeProfileId === targetProfile.id) {
      return; // Already on this profile
    }

    // Switch to the target profile
    settings.activeProfileId = targetProfile.id;
    targetProfile.lastActive = new Date().toISOString();

    // Save updated settings and profiles
    await browser.storage.sync.set({
      userSettings: settings,
      profiles: profiles
    });

    // Notify all open tabs to refresh their tab bars
    const allTabs = await browser.tabs.query({
      url: [
        "*://*.lightning.force.com/lightning/setup/*",
        "*://*.salesforce-setup.com/lightning/setup/*",
        "*://*.my.salesforce-setup.com/lightning/setup/*",
        "*://*.salesforce.com/lightning/setup/*",
        "*://*.my.salesforce.com/lightning/setup/*",
        "*://*.sandbox.my.salesforce-setup.com/lightning/setup/*",
        "*://*.sandbox.my.salesforce.com/lightning/setup/*",
        "*://*.sandbox.lightning.force.com/lightning/setup/*",
        "*://*.develop.my.salesforce-setup.com/lightning/setup/*",
        "*://*.develop.lightning.force.com/lightning/setup/*"
      ]
    });

    allTabs.forEach(tab => {
      browser.tabs.sendMessage(tab.id, { action: 'refresh_tabs' })
        .catch(() => {}); // Ignore errors for tabs without content script
    });

  } catch (error) {
    // Silently handle profile switching errors
  }
}

/**
 * Listen for tab activation (user switches tabs)
 */
browser.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await browser.tabs.get(activeInfo.tabId);
    if (tab.url) {
      await checkAndSwitchProfile(tab.url);
    }
  } catch (error) {
    // Tab might not be accessible
  }
});

/**
 * Listen for tab URL updates (user navigates within a tab)
 */
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only process when URL changes and is complete
  if (changeInfo.url || (changeInfo.status === 'complete' && tab.url)) {
    await checkAndSwitchProfile(changeInfo.url || tab.url);
  }
});

/**
 * Handle keyboard shortcuts
 */
browser.commands.onCommand.addListener(async (command) => {
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

      // Check if we have a tab at this position
      if (eligibleTabs[position]) {
        const targetTab = eligibleTabs[position];

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
        }
      }
    } catch (error) {
      // Error handling keyboard command
    }
  }
});
