// background.js
// Background script that runs when extension installs or updates
// Handles seamless storage migration from sync to local storage

'use strict';

// The shared foundation: org matching, the chunk layer, CHUNK_SIZE and the
// settings defaults, so this worker and the popup cannot drift apart on any of
// them. Chrome's service worker has importScripts; Firefox's background is an
// event page without it, so build-manifest.js puts these ahead of this file in
// the scripts array instead.
if (typeof importScripts === 'function') {
  importScripts('popup/js/shared/constants.js', 'popup/js/shared/utils.js');
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

/** Read one sync value, reassembling chunks. Shared with every other surface. */
async function readChunkedSync(baseKey) {
  return SFTabs.utils.readChunkedSyncValue(baseKey);
}

/** Write one sync value, chunking it if needed. Shared, so the two cannot drift. */
async function saveChunkedSync(baseKey, data) {
  return SFTabs.utils.writeChunkedSyncValue(baseKey, data);
}

/**
 * Check if auto-switching is enabled and switch profile if URL matches
 */
async function checkAndSwitchProfile(url) {
  try {
    // URL check first — it is free, and it rejects nearly every navigation.
    // Reading settings before it woke the worker for storage on every page load
    // anywhere in the browser.
    if (!url || (!url.includes('salesforce.com') &&
                  !url.includes('salesforce-setup.com') &&
                  !url.includes('force.com'))) {
      return;
    }

    const settingsResult = await browser.storage.sync.get('userSettings');
    const settings = settingsResult.userSettings || {};

    // Check if profiles and auto-switching are enabled
    if (!settings.profilesEnabled || !settings.autoSwitchProfiles) {
      return;
    }

    // Extract org identifier from URL
    const orgIdentifier = SFTabs.utils.extractOrgIdentifier(url);
    if (!orgIdentifier) {
      return;
    }

    // Chunk-aware, like every other reader. A raw get returns undefined once
    // the profile list outgrows a single sync value, so auto-switching simply
    // stopped working — silently — for anyone with enough profiles.
    const useSync = await SFTabs.utils.storagePreference();
    let profiles;
    try {
      profiles = (useSync
        ? await readChunkedSync('profiles')
        : (await browser.storage.local.get('profiles')).profiles) || [];
    } catch (error) {
      return;   // could not read the list; switching blind would be worse
    }

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
    } else if (!settings.activeProfileId) {
      // Nothing has been picked yet, so the default is the only answer there is
      const defaultProfile = profiles.find(p => p.isDefault) ||
                           profiles.find(p => p.id === settings.defaultProfileId);
      if (!defaultProfile) {
        return; // No default profile found
      }
      targetProfile = defaultProfile;
    } else if (settings.activeProfileAuto) {
      // No linked org claims this page, and the profile that is active was put
      // there by this function for a different org. It does not follow — one
      // linked production org would otherwise govern every sandbox beside it.
      const defaultProfile = profiles.find(p => p.isDefault) ||
                           profiles.find(p => p.id === settings.defaultProfileId);
      if (!defaultProfile) {
        return;   // nothing to fall back to; leave what is there
      }
      targetProfile = defaultProfile;
    } else {
      // The active profile was picked by hand, so it stands.
      //
      // This branch used to switch to the starred default unconditionally,
      // which did not merely render the wrong tabs — it wrote activeProfileId
      // back to storage and destroyed the choice. Switching profiles in the
      // popup therefore held only until the next navigation to any unlinked
      // org, which is what made it look intermittent rather than broken.
      return;
    }

    // Check if this profile is already active
    if (settings.activeProfileId === targetProfile.id && settings.activeProfileAuto) {
      return; // Already on this profile, and already marked as ours
    }

    // Switch to the target profile
    settings.activeProfileId = targetProfile.id;

    // Re-read immediately before writing and change only the two fields that
    // belong to this decision. The snapshot above may be seconds old by now,
    // and writing it back whole would revert anything the popup changed in
    // between — toggling tab colors while a Salesforce page finished loading
    // was enough to lose the toggle.
    const current = (await browser.storage.sync.get('userSettings')).userSettings || {};
    await browser.storage.sync.set({
      userSettings: {
        ...current,
        activeProfileId: targetProfile.id,
        // Ours, not the user's — so it will not follow them off this org.
        activeProfileAuto: true,
      }
    });

    // The profile list is deliberately NOT written back here.
    //
    // It used to be, to record lastActive on the profile being switched to —
    // a field written in four places and read in none. The cost of persisting
    // it was writing the whole array from the snapshot read at the top of this
    // function, seconds earlier. Anything the popup changed in between was
    // reverted: a rename, the linked-org list, the starred default, the order
    // profiles are dragged into. The userSettings write above avoids exactly
    // this by re-reading first; this one never did.
    //
    // Switching profiles does not change the profile list, so there is nothing
    // here to save. Deleting the write closes the window rather than narrowing
    // it, and drops a sync write from every switch — which now includes
    // switching to the default on an org no profile claims, so it happens far
    // more often than it used to.

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
  const useSync = await SFTabs.utils.storagePreference();
  const targets = Array.isArray(profileIds) && profileIds.length
    ? profileIds.map(id => `profile_${id}_tabs`)
    : ['customTabs'];   // installs old enough to predate profiles

  let written = 0;
  for (const key of targets) {
    let existing;
    try {
      existing = (useSync
        ? await readChunkedSync(key)
        : (await browser.storage.local.get(key))[key]) || [];
    } catch (error) {
      // Skip this profile rather than write over it. Appending to what we
      // failed to read would replace the stored list with a single tab — the
      // one being added — and there is no way back from that. Not adding the
      // tab is visible and harmless; losing the profile is neither.
      continue;
    }

    if (existing.some(t => t && t.id === tab.id)) continue;

    const next = [...existing, { ...tab, position: existing.length }];
    if (useSync) await saveChunkedSync(key, next);
    else await browser.storage.local.set({ [key]: next });
    written++;
  }
  return written;
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
  const useSync = await SFTabs.utils.storagePreference();

  let tabs;
  try {
    tabs = (useSync
      ? await readChunkedSync(key)
      : (await browser.storage.local.get(key))[key]) || [];
  } catch (error) {
    return 0;   // reordering what we could not read would write a wrong order
  }
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
