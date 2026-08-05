// background.js
// Background script that runs when extension installs or updates
// Handles seamless storage migration from sync to local storage

'use strict';

// Org matching lives in shared utils so this worker and the popup cannot drift
// apart on it. Chrome's service worker has importScripts; Firefox's background
// is an event page without it, so build-manifest.js puts utils.js ahead of this
// file in the scripts array instead.
if (typeof importScripts === 'function') {
  importScripts('popup/js/shared/utils.js');
}

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
    tabs: chrome.tabs,
    windows: chrome.windows
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
    const orgIdentifier = SFTabs.utils.extractOrgIdentifier(url);
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
 * Re-evaluate the profile for whatever the user is actually looking at.
 *
 * activeProfileId is a single global value and switching broadcasts to every
 * Salesforce tab in every window, so the trigger has to be the focused
 * window's active tab. Keying off any tab that happens to load lets a
 * background window switch the profile out from under the window in front —
 * which is what made two orgs in two windows both fall back to the default.
 */
async function evaluateFocusedTab() {
  try {
    const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab && tab.url) {
      await checkAndSwitchProfile(tab.url);
    }
  } catch (error) {
    // No focused window, or the tab is not accessible
  }
}

/**
 * Listen for tab activation (user switches tabs)
 */
browser.tabs.onActivated.addListener(() => evaluateFocusedTab());

/**
 * Listen for tab URL updates (user navigates within a tab).
 * Background tabs are ignored: only the tab in front should drive the profile.
 */
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!tab.active) return;
  if (changeInfo.url || (changeInfo.status === 'complete' && tab.url)) {
    await evaluateFocusedTab();
  }
});

/**
 * Listen for window focus. Moving between windows fires this rather than
 * tabs.onActivated, so without it switching windows never re-evaluated — the
 * reason two windows worked as tabs but not as windows.
 */
if (browser.windows && browser.windows.onFocusChanged) {
  browser.windows.onFocusChanged.addListener(windowId => {
    if (windowId === browser.windows.WINDOW_ID_NONE) return;  // focus left the browser
    evaluateFocusedTab();
  });
}

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

/**
 * Quick Add from the Salesforce menu bar.
 *
 * The content script parses the page — using the same shared parser the popup's
 * Quick Add uses — and names the profiles that should receive the tab. All that
 * happens here is the write, because this worker owns the chunk-aware storage
 * helpers and a content script has no business carrying a second copy of them.
 *
 * Appending, never inserting: a tab arriving in a profile must not disturb an
 * order arranged there. Already-present ids are skipped rather than duplicated,
 * so a double click costs nothing.
 */
async function quickAddTabToProfiles(tab, profileIds) {
  const useSync = await prefersSyncStorage();
  const targets = Array.isArray(profileIds) && profileIds.length
    ? profileIds.map(id => `profile_${id}_tabs`)
    : ['customTabs'];   // installs old enough to predate profiles

  let written = 0;
  for (const key of targets) {
    const existing = (useSync
      ? await readChunkedSync(key)
      : (await browser.storage.local.get(key))[key]) || [];

    if (existing.some(t => t && t.id === tab.id)) continue;

    const next = [...existing, { ...tab, position: existing.length }];
    if (useSync) await saveChunkedSync(key, next);
    else await browser.storage.local.set({ [key]: next });
    written++;
  }
  return written;
}

/** Where this install keeps its tabs. Mirrors getStoragePreference elsewhere. */
async function prefersSyncStorage() {
  try {
    const local = await browser.storage.local.get(['deviceSettings', 'userSettings']);
    if (typeof local.deviceSettings?.useSyncStorage === 'boolean') {
      return local.deviceSettings.useSyncStorage;
    }
    if (typeof local.userSettings?.useSyncStorage === 'boolean') {
      return local.userSettings.useSyncStorage;
    }
    return true;
  } catch {
    return true;
  }
}

/**
 * Persist an order dragged in the Salesforce tab bar.
 *
 * The content script reports which tabs are in the bar and in what order; the
 * rule that turns that into positions lives in shared utils, so the popup's own
 * drag-and-drop and this one cannot disagree about what an order means.
 *
 * Only top-level positions move — a nested tab keeps its place inside its
 * parent, which renumbering the whole array by index would have destroyed.
 */
async function reorderTabsForProfile(profileId, order) {
  const key = profileId ? `profile_${profileId}_tabs` : 'customTabs';
  const useSync = await prefersSyncStorage();

  const tabs = (useSync
    ? await readChunkedSync(key)
    : (await browser.storage.local.get(key))[key]) || [];
  if (!tabs.length) return 0;

  const next = SFTabs.utils.reorderTopLevelTabs(tabs, order);
  if (useSync) await saveChunkedSync(key, next);
  else await browser.storage.local.set({ [key]: next });
  return next.length;
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const action = message && message.action;
  if (action !== 'quick_add_tab' && action !== 'reorder_tabs') return;

  const work = action === 'quick_add_tab'
    ? quickAddTabToProfiles(message.tab, message.profileIds)
    : reorderTabsForProfile(message.profileId, message.order);

  work
    .then(async written => {
      // Tell every open Salesforce page to redraw, including the sender — its
      // own bar has to grow the new tab too.
      const tabs = await browser.tabs.query({ url: [
        '*://*.lightning.force.com/*', '*://*.salesforce-setup.com/*',
        '*://*.my.salesforce-setup.com/*', '*://*.salesforce.com/*',
        '*://*.my.salesforce.com/*',
      ] });
      await Promise.all(tabs.map(t =>
        browser.tabs.sendMessage(t.id, { action: 'refresh_tabs' }).catch(() => {})));
      sendResponse({ ok: true, written });
    })
    .catch(error => sendResponse({ ok: false, error: error.message }));

  return true;   // reply is async
});
