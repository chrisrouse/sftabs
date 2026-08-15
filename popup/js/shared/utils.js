// popup/js/shared/utils.js
// Shared utility functions

/**
 * Generate a unique ID for tabs
 */
function generateId() {
  return 'tab_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
}

/**
 * Format a Salesforce object name from URL format
 * Examples: 
 * - "Study_Group__c" becomes "Study Group"
 * - "Campaign" stays "Campaign"
 * - "ProductTransfer" becomes "Product Transfer"
 */
function formatObjectNameFromURL(objectNameFromURL) {
  if (!objectNameFromURL) {
    return 'Object';
  }
  
  // Remove any __c or similar custom object suffix
  let cleanName = objectNameFromURL.replace(/__c$/g, '');
  
  // Replace underscores with spaces
  cleanName = cleanName.replace(/_/g, ' ');
  
  // Insert spaces between camelCase words
  cleanName = cleanName.replace(/([a-z])([A-Z])/g, '$1 $2');
  
  // Ensure proper capitalization
  cleanName = cleanName.replace(/\b\w/g, letter => letter.toUpperCase());
  
  return cleanName;
}

/**
 * Get current page information
 */
function getCurrentPageInfo() {
  const currentUrl = window.location.href;
  
  // Check if on ObjectManager page
  const objectManagerMatch = currentUrl.match(/\/lightning\/setup\/ObjectManager\/([^\/]+)/);
  if (objectManagerMatch) {
    return {
      type: 'objectManager',
      objectName: objectManagerMatch[1],
      fullPath: currentUrl.split('/lightning/setup/')[1]?.split('?')[0]
    };
  }
  
  // Check if on general setup page
  const setupMatch = currentUrl.match(/\/lightning\/setup\/([^\/]+)/);
  if (setupMatch) {
    return {
      type: 'setup',
      setupPage: setupMatch[1],
      fullPath: currentUrl.split('/lightning/setup/')[1]?.split('?')[0]
    };
  }
  
  return null;
}

/**
 * Build full URL from tab path and optional sub-path
 */
function buildFullUrl(tab, subPath = '') {
  const baseUrl = window.location.origin;
  
  if (tab.isCustomUrl) {
    let formattedPath = tab.path;
    if (!formattedPath.startsWith('/')) {
      formattedPath = '/' + formattedPath;
    }
    return `${baseUrl}${formattedPath}`;
  } else if (tab.isObject) {
    return `${baseUrl}/lightning/o/${tab.path}`;
  } else {
    // Setup pages
    let fullPath;
    if (subPath) {
      // For dropdown navigation items, use the subPath as-is
      if (subPath.startsWith('/lightning/setup/')) {
        return `${baseUrl}${subPath}`;
      } else {
        fullPath = `${tab.path}/${subPath}`;
      }
    } else {
      // For main tab navigation
      if (tab.path.includes('ObjectManager/')) {
        // ObjectManager URLs don't need /home
        fullPath = tab.path;
      } else {
        // Other setup URLs need /home
        fullPath = `${tab.path}/home`;
      }
    }
    
    return `${baseUrl}/lightning/setup/${fullPath}`;
  }
}

/**
 * Check if Lightning Navigation is enabled
 * Always returns true as Lightning Navigation is now standard
 */
function isLightningNavigationEnabled() {
  return true;
}

/**
 * Debounce function to limit rapid function calls
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Export for use in other modules
/**
 * Salesforce marks an org's type with a partition word in its My Domain host —
 * `acme--dev1.sandbox.my.salesforce.com`, `acme.develop.lightning.force.com`.
 * Production has none. Mapped to our own names so the storage vocabulary does
 * not change if Salesforce renames a partition.
 *
 * What the host does NOT carry is the sandbox tier: Full Copy, Partial Copy,
 * Developer and Developer Pro are all `--name.sandbox`, and the only variable
 * is the name an admin chose. Telling those apart needs a per-org override.
 */
const ORG_PARTITIONS = {
  sandbox:    'sandbox',
  develop:    'developer',    // Developer Edition
  patch:      'patch',
  scratch:    'scratch',
  demo:       'demo',
  trailblaze: 'playground',   // Trailhead Playground
};

/**
 * Longest first, so `my.salesforce.com` is not mistaken for `salesforce.com`.
 *
 * Experience Builder is on its own domain entirely — the manifest injects there
 * but this list did not know the host, so every builder page resolved to no org
 * at all: no favicon tint, and no profile match either.
 */
const SALESFORCE_HOST_SUFFIXES = [
  'builder.salesforce-experience.com',   // Experience Builder
  'my.salesforce-setup.com',
  'my.salesforce.com',
  'lightning.force.com',
  'salesforce-setup.com',
  'salesforce.com',
];

/**
 * Split a Salesforce host into the org's identifier and its partition word.
 *
 * Replaces a hand-written list of nine regexes that had grown gaps — Developer
 * Edition on `develop.my.salesforce.com` matched nothing, and scratch, demo,
 * patch and Trailhead Playground orgs matched nothing at all, which meant
 * profiles silently never resolved for them. Deriving both facts from one split
 * closes those and cannot drift the way parallel regexes did.
 */
function splitOrgHost(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const suffix = SALESFORCE_HOST_SUFFIXES.find(s => hostname.endsWith('.' + s));
    if (!suffix) return null;

    const labels = hostname.slice(0, -(suffix.length + 1)).split('.');
    if (labels.length === 1) return { identifier: labels[0], partition: null };
    if (labels.length === 2 && ORG_PARTITIONS[labels[1]]) {
      return { identifier: labels[0], partition: labels[1] };
    }
    return null;   // a host shape we do not recognize; better null than a guess
  } catch {
    return null;
  }
}

/**
 * The org an URL belongs to, as a bare identifier — `acme`, `acme--dev1`.
 *
 * This is the value profiles store in urlPatterns, so it has to keep returning
 * exactly what it always did for every host that already worked. Verified
 * against the previous implementation before replacing it.
 */
function extractOrgIdentifier(url) {
  const parsed = splitOrgHost(url);
  return parsed ? parsed.identifier : null;
}

/**
 * Which kind of org an URL is, from its host alone.
 *
 * Returns null for anything that is not a Salesforce host.
 *
 * The partition word is the reliable signal, but it only exists on enhanced
 * domains. Without one, two suffixes in the identifier still say what an org
 * is, and both have to be read or the org falls through to `production` — the
 * one answer that must never be wrong, since red is the color that means
 * hesitate.
 *
 *   `--`      a sandbox, on an org that never moved to enhanced domains
 *   `-dev-ed` a Developer Edition org. Salesforce appends this to the My Domain
 *             of every DE org and reserves it, so it cannot be a production org
 *             that happens to be named that way. `smartbottechnology-dev-ed.my.salesforce-setup.com`
 *             read as production until this was here.
 */
function detectOrgEnvironment(url) {
  const parsed = splitOrgHost(url);
  if (!parsed) return null;
  if (parsed.partition) return ORG_PARTITIONS[parsed.partition];
  if (parsed.identifier.includes('--')) return 'sandbox';
  if (parsed.identifier.endsWith('-dev-ed')) return 'developer';
  return 'production';
}

/**
 * Which profile applies to a given Salesforce URL.
 *
 * The point of resolving per URL rather than reading settings.activeProfileId is
 * that activeProfileId is one global value: with two orgs open, whichever was
 * activated last governed every page, so two windows — or two tabs — could not
 * show their own tabs at the same time.
 *
 * Matching deliberately mirrors checkAndSwitchProfile in background.js: exact,
 * case-insensitive equality against the org identifier. If the two ever
 * disagree, a page renders one profile while the popup claims another.
 *
 * When auto-switch is off this returns activeProfileId unchanged, so behavior
 * for anyone not using linked orgs is exactly as before.
 *
 * @param {string} url        the page being rendered
 * @param {Array}  profiles
 * @param {Object} settings   userSettings
 * @returns {string|null} profile id, or null when there is nothing to use
 */
function resolveProfileForUrl(url, profiles, settings) {
  const list = Array.isArray(profiles) ? profiles : [];
  const active = settings && settings.activeProfileId ? settings.activeProfileId : null;

  if (!settings || !settings.profilesEnabled || !settings.autoSwitchProfiles) {
    return active;
  }

  const org = extractOrgIdentifier(url);
  if (org) {
    const match = list.find(p => (p.urlPatterns || []).some(
      pattern => String(pattern).toLowerCase() === org.toLowerCase()));
    if (match) return match.id;
  }

  // No linked org claims this page. What happens next depends on how the
  // active profile came to be active, which is the whole reason
  // activeProfileAuto exists.
  //
  // Picked by hand, it stands. Returning the starred default here instead is
  // what made switching profiles in the popup do nothing on an unlinked org —
  // the popup listed one profile's tabs while the page drew another's.
  //
  // Set by auto-switch, it does not. It belongs to the org that matched, and
  // carrying it onto an org that matched nothing meant one linked production
  // org quietly governed every sandbox beside it: link a profile to `amplify`,
  // visit it once, and `amplify--dev1`, `amplify--qa` and every unrelated org
  // rendered that profile until something else claimed them.
  //
  // The default also answers before anything has been picked at all, which is
  // the only other time there is no choice to honour.
  if (active && !settings.activeProfileAuto) return active;

  const fallback = list.find(p => p.isDefault) ||
                   list.find(p => p.id === (settings.defaultProfileId || null));
  if (fallback) return fallback.id;
  return active;   // no default to fall back to; better the current one than none
}

/**
 * Optional per-tab colors.
 *
 * Keyed by SLDS expressive-palette hue name, not by hex. Storing the name is
 * what lets a color follow the theme: each value is a light-dark() pair, so
 * "teal" is #056764 on a light surface and #06a59a on a dark one. A stored hex
 * would strand every colored tab in whichever theme it was picked under.
 *
 * Three shades per hue — deep, base and light — because at one shade the darker
 * hues are hard to tell apart as dots. Each carries three roles:
 *
 *   accent  the dot and any indicator. Needs 3:1 against white, the threshold
 *           for a graphic rather than text, which is what lets the light shade
 *           go lighter than the label could.
 *   wash    the tint behind a row.
 *   ink     the label on that tint. Equal to the accent for deep and base; a
 *           darker step for light, where the accent alone would fail AA.
 *
 * Every combination was checked against those thresholds in both themes before
 * being written here.
 *
 * Values are verbatim from @salesforce-ux/design-system-2. Neutral is omitted —
 * that is the no-color case — and electric blue, which is the brand accent and
 * would read as "selected" rather than as a chosen color.
 */
const TAB_COLORS = {
  'red-deep': { accent: 'light-dark(#640103, #feb8ab)', wash: 'light-dark(#feded8, #300c01)', ink: 'light-dark(#640103, #feb8ab)' },
  'red': { accent: 'light-dark(#ba0517, #fe5c4c)', wash: 'light-dark(#feded8, #300c01)', ink: 'light-dark(#ba0517, #fe5c4c)' },
  'red-light': { accent: 'light-dark(#fe5c4c, #ba0517)', wash: 'light-dark(#fef1ee, #0c0200)', ink: 'light-dark(#8e030f, #fe8f7d)' },
  'hot-orange-deep': { accent: 'light-dark(#4a2413, #feb9a5)', wash: 'light-dark(#ffded5, #281202)', ink: 'light-dark(#4a2413, #feb9a5)' },
  'hot-orange': { accent: 'light-dark(#aa3001, #ff5d2d)', wash: 'light-dark(#ffded5, #281202)', ink: 'light-dark(#aa3001, #ff5d2d)' },
  'hot-orange-light': { accent: 'light-dark(#ff5d2d, #aa3001)', wash: 'light-dark(#fef1ed, #090200)', ink: 'light-dark(#7e2600, #ff906e)' },
  'orange-deep': { accent: 'light-dark(#3e2b02, #ffba90)', wash: 'light-dark(#fedfd0, #201600)', ink: 'light-dark(#3e2b02, #ffba90)' },
  'orange': { accent: 'light-dark(#825101, #dd7a01)', wash: 'light-dark(#fedfd0, #201600)', ink: 'light-dark(#825101, #dd7a01)' },
  'orange-light': { accent: 'light-dark(#dd7a01, #825101)', wash: 'light-dark(#fff1ea, #060300)', ink: 'light-dark(#5f3e02, #fe9339)' },
  'yellow-deep': { accent: 'light-dark(#4f2100, #fcc003)', wash: 'light-dark(#f9e3b6, #281202)', ink: 'light-dark(#4f2100, #fcc003)' },
  'yellow': { accent: 'light-dark(#8c4b02, #ca8501)', wash: 'light-dark(#f9e3b6, #281202)', ink: 'light-dark(#8c4b02, #ca8501)' },
  'yellow-light': { accent: 'light-dark(#ca8501, #8c4b02)', wash: 'light-dark(#fbf3e0, #090200)', ink: 'light-dark(#6f3400, #e4a201)' },
  'green-deep': { accent: 'light-dark(#143b25, #91db8b)', wash: 'light-dark(#cdefc4, #071b12)', ink: 'light-dark(#143b25, #91db8b)' },
  'green': { accent: 'light-dark(#396547, #3ba755)', wash: 'light-dark(#cdefc4, #071b12)', ink: 'light-dark(#396547, #3ba755)' },
  'green-light': { accent: 'light-dark(#3ba755, #396547)', wash: 'light-dark(#ebf7e6, #010502)', ink: 'light-dark(#194e31, #45c65a)' },
  'teal-deep': { accent: 'light-dark(#023434, #04e1cb)', wash: 'light-dark(#acf3e4, #071b12)', ink: 'light-dark(#023434, #04e1cb)' },
  'teal': { accent: 'light-dark(#056764, #06a59a)', wash: 'light-dark(#acf3e4, #071b12)', ink: 'light-dark(#056764, #06a59a)' },
  'teal-light': { accent: 'light-dark(#06a59a, #056764)', wash: 'light-dark(#def9f3, #010502)', ink: 'light-dark(#024d4c, #01c3b3)' },
  'cloud-blue-deep': { accent: 'light-dark(#023248, #90d0fe)', wash: 'light-dark(#cfe9fe, #001a28)', ink: 'light-dark(#023248, #90d0fe)' },
  'cloud-blue': { accent: 'light-dark(#05628a, #0d9dda)', wash: 'light-dark(#cfe9fe, #001a28)', ink: 'light-dark(#05628a, #0d9dda)' },
  'cloud-blue-light': { accent: 'light-dark(#0d9dda, #05628a)', wash: 'light-dark(#eaf5fe, #000409)', ink: 'light-dark(#084968, #1ab9ff)' },
  'blue-deep': { accent: 'light-dark(#032d60, #aacbff)', wash: 'light-dark(#d8e6fe, #001639)', ink: 'light-dark(#032d60, #aacbff)' },
  'blue': { accent: 'light-dark(#0b5cab, #1b96ff)', wash: 'light-dark(#d8e6fe, #001639)', ink: 'light-dark(#0b5cab, #1b96ff)' },
  'blue-light': { accent: 'light-dark(#1b96ff, #0b5cab)', wash: 'light-dark(#eef4ff, #000310)', ink: 'light-dark(#014486, #78b0fd)' },
  'indigo-deep': { accent: 'light-dark(#270c92, #bec7f6)', wash: 'light-dark(#e0e5f8, #17094e)', ink: 'light-dark(#270c92, #bec7f6)' },
  'indigo': { accent: 'light-dark(#3a49da, #7f8ced)', wash: 'light-dark(#e0e5f8, #17094e)', ink: 'light-dark(#3a49da, #7f8ced)' },
  'indigo-light': { accent: 'light-dark(#7f8ced, #3a49da)', wash: 'light-dark(#f1f3fb, #060116)', ink: 'light-dark(#2f2cb7, #9ea9f1)' },
  'violet-deep': { accent: 'light-dark(#580276, #e5b9fe)', wash: 'light-dark(#f2defe, #2e0039)', ink: 'light-dark(#580276, #e5b9fe)' },
  'violet': { accent: 'light-dark(#9602c7, #cb65ff)', wash: 'light-dark(#f2defe, #2e0039)', ink: 'light-dark(#9602c7, #cb65ff)' },
  'violet-light': { accent: 'light-dark(#cb65ff, #9602c7)', wash: 'light-dark(#f9f0ff, #060300)', ink: 'light-dark(#730394, #d892fe)' },
  'purple-deep': { accent: 'light-dark(#401075, #d7bff2)', wash: 'light-dark(#ece1f9, #240643)', ink: 'light-dark(#401075, #d7bff2)' },
  'purple': { accent: 'light-dark(#7526e3, #ad7bee)', wash: 'light-dark(#ece1f9, #240643)', ink: 'light-dark(#7526e3, #ad7bee)' },
  'purple-light': { accent: 'light-dark(#ad7bee, #7526e3)', wash: 'light-dark(#f6f2fb, #070114)', ink: 'light-dark(#5a1ba9, #c29ef1)' },
  'pink-deep': { accent: 'light-dark(#61022a, #fdb6c5)', wash: 'light-dark(#fddde3, #370114)', ink: 'light-dark(#61022a, #fdb6c5)' },
  'pink': { accent: 'light-dark(#b60554, #ff538a)', wash: 'light-dark(#fddde3, #370114)', ink: 'light-dark(#b60554, #ff538a)' },
  'pink-light': { accent: 'light-dark(#ff538a, #b60554)', wash: 'light-dark(#fef0f3, #0f0003)', ink: 'light-dark(#8a033e, #fe8aa7)' }
};

/**
 * Inline custom properties for a tab's color, or null when it has none.
 *
 * Returned as properties rather than baked-into-CSS classes so the palette lives
 * in exactly one place — here — instead of being restated in every stylesheet
 * that needs it.
 *
 * @param {string|null} name  a TAB_COLORS key
 * @returns {{accent: string, wash: string}|null}
 */
function tabColorVars(name) {
  return (name && TAB_COLORS[name]) ? TAB_COLORS[name] : null;
}

/**
 * Put a tab's color on an element, or take it off.
 *
 * Clearing is as important as setting: turning the feature off must leave the
 * stored color alone but stop rendering it, and rows get reused.
 *
 * @param {Element} el
 * @param {string|null} name   color name, or null/unknown for none
 * @param {string} style       'dot' | 'tint'
 * @param {boolean} enabled    the tabColors.enabled setting
 */
function applyTabColor(el, name, style, enabled) {
  el.classList.remove('sftabs-tc', 'sftabs-tc--dot', 'sftabs-tc--tint');
  el.style.removeProperty('--sftabs-tc');
  el.style.removeProperty('--sftabs-tc-wash');
  el.style.removeProperty('--sftabs-tc-ink');
  if (!enabled) return;

  const color = tabColorVars(name);
  if (!color) return;

  const mode = ['dot', 'tint'].includes(style) ? style : 'dot';
  el.style.setProperty('--sftabs-tc', color.accent);
  el.style.setProperty('--sftabs-tc-wash', color.wash);
  el.style.setProperty('--sftabs-tc-ink', color.ink || color.accent);
  el.classList.add('sftabs-tc', `sftabs-tc--${mode}`);
}

// ── Reading stored tabs from a content script ────────────────────
//
// The popup has popup-storage.js for this; content scripts do not, so each
// surface grew its own copy. Three of them, and they disagreed on the one thing
// that matters: which storage area to read. content-main.js took the preference
// from local, which is where the device-specific value actually lives;
// floating-button.js took it from sync, which does not hold it. So a user who
// switched to local storage got their tabs in the Setup tab bar and an empty
// floating panel, on the same page, with nothing to explain it.

/**
 * Which area this device keeps its data in.
 *
 * deviceSettings is authoritative and local by definition — the popup writes it
 * before migrating anything. The userSettings fallback is for installs that
 * predate it. Defaults to sync, which is what a fresh install uses.
 */
async function storagePreference() {
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
 * One value from sync, reassembled if it was split across chunks.
 *
 * Throws when a chunk is missing or unparseable, rather than returning null —
 * callers coalesce null to an empty array, which turns "I could not read your
 * tabs" into "you have no tabs", and the next write makes that true.
 */
async function readChunkedSyncValue(key) {
  const metadataKey = `${key}_metadata`;
  const metadata = (await browser.storage.sync.get(metadataKey))[metadataKey];

  if (!metadata || !metadata.chunked) {
    return (await browser.storage.sync.get(key))[key] ?? null;
  }

  const chunkKeys = Array.from({ length: metadata.chunkCount }, (_, i) => `${key}_chunk_${i}`);
  const stored = await browser.storage.sync.get(chunkKeys);
  const chunks = chunkKeys.map(chunkKey => {
    if (stored[chunkKey] === undefined) throw new Error(`Missing chunk ${chunkKey}`);
    return stored[chunkKey];
  });
  return JSON.parse(chunks.join(''));
}

/**
 * Drop what the previous value left behind, once the new one is stored.
 *
 * Best-effort by design: an unreferenced chunk is harmless because the metadata
 * states the count, so readers never look at it. Throwing here would fail a
 * write that had already succeeded.
 */
async function pruneStaleChunks(key, keep, previousChunkCount, dropDirectKey = false) {
  try {
    const stale = [];
    if (dropDirectKey) stale.push(key);
    for (let i = keep; i < previousChunkCount; i++) stale.push(`${key}_chunk_${i}`);
    if (stale.length) await browser.storage.sync.remove(stale);
  } catch {
    // Leaving keys behind is the safe failure here.
  }
}

/**
 * Write one value to sync, splitting it across chunks if it is too large.
 *
 * The new value is written before anything is deleted. The old order — clear,
 * then write — left a window in which the value did not exist at all, and in an
 * MV3 service worker, which Chrome terminates whenever it likes, a quick-add
 * that lost that race took a profile's whole tab list with it. Writing first
 * means the worst interruption leaves orphan chunks that readers already skip.
 *
 * Everything for one value goes in a single storage.sync.set, so the chunks and
 * the metadata that describes them cannot disagree.
 */
async function writeChunkedSyncValue(key, data) {
  const json = JSON.stringify(data);
  const byteSize = new Blob([json]).size;
  const chunkSize = SFTabs.constants.CHUNK_SIZE;

  // Note the old shape before overwriting, so the stale tail can be pruned.
  const metadataKey = `${key}_metadata`;
  const previousChunkCount =
    (await browser.storage.sync.get(metadataKey))[metadataKey]?.chunkCount || 0;

  try {
    if (byteSize <= chunkSize) {
      await browser.storage.sync.set({
        [key]: data,
        [metadataKey]: { chunked: false, byteSize, savedAt: new Date().toISOString() }
      });
      await pruneStaleChunks(key, 0, previousChunkCount);
      return { success: true, chunked: false, chunkCount: 1 };
    }

    const chunks = [];
    for (let offset = 0; offset < json.length; offset += chunkSize) {
      chunks.push(json.slice(offset, offset + chunkSize));
    }

    const payload = { [metadataKey]: {
      chunked: true, chunkCount: chunks.length, byteSize, savedAt: new Date().toISOString() } };
    chunks.forEach((chunk, index) => { payload[`${key}_chunk_${index}`] = chunk; });

    await browser.storage.sync.set(payload);
    await pruneStaleChunks(key, chunks.length, previousChunkCount, true);
    return { success: true, chunked: true, chunkCount: chunks.length };
  } catch (error) {
    if (error.message && error.message.includes('QUOTA')) {
      throw new Error(`Sync storage quota exceeded. Your configuration is too large (${Math.round(byteSize / 1024)}KB). Please reduce the number of tabs or dropdown items.`);
    }
    throw error;
  }
}

/** One value from whichever area this device uses. */
async function readStoredValue(key, preferSync) {
  if (preferSync) return readChunkedSyncValue(key);
  return (await browser.storage.local.get(key))[key] ?? null;
}

/**
 * The settings, profiles and tabs that apply to a given page.
 *
 * The profile is resolved from the page's own org rather than the globally
 * active one, so two orgs open at once each render their own tabs. `customTabs`
 * is the pre-profiles layout, still live on old installs.
 *
 * Takes the URL rather than reading window.location, so this stays callable
 * from the background worker, which has no window.
 */
async function loadTabsForUrl(url) {
  const preferSync = await storagePreference();
  const settings = await readStoredValue('userSettings', preferSync) || {};
  const profiles = await readStoredValue('profiles', preferSync) || [];
  const profileId = resolveProfileForUrl(url, profiles, settings) || settings.activeProfileId;
  const tabs = await readStoredValue(
    profileId ? `profile_${profileId}_tabs` : 'customTabs', preferSync) || [];

  return { preferSync, settings, profiles, profileId, tabs };
}

/**
 * Where a tab points. The single rule; there were five.
 *
 * Salesforce Setup nodes live at `/lightning/setup/{node}/home` and the `/home`
 * is not optional. Three kinds of path are exceptions: an ObjectManager path is
 * already complete, a path that arrives fully qualified with `/lightning/` is a
 * link scraped from Salesforce's own navigation and must be used verbatim, and
 * a custom URL may be absolute and belong to another host entirely.
 *
 * Every copy of this had drifted. One omitted the `/home`, which 404'd any tab
 * moved into a folder. One omitted the `/lightning/` passthrough, which
 * double-prefixed a promoted nav item. Two omitted the absolute-URL check, so a
 * custom `https://example.com` link became
 * `https://org.lightning.force.com/https://example.com`. None of them was
 * wrong on purpose; they were written at different times.
 *
 * Returns null when a tab has no destination — a folder is a container, and
 * callers differ on what to render for that: the tab bar needs an inert href,
 * the navigators need to do nothing at all.
 *
 * The origin defaults to this page's. The popup passes the origin of the tab it
 * is acting on, because its own is a moz-extension:// or chrome-extension:// URL.
 * Deriving it by splitting the current URL on '/lightning/setup/' — as the tab
 * bar used to — silently yields the entire URL on any page that is not a Setup
 * page, and Lightning is a single-page app that navigates away from Setup
 * without reloading.
 */
function tabDestinationUrl(tab, origin) {
  const path = String((tab && tab.path) || '').trim();
  if (!path) return null;

  const base = origin || (typeof window !== 'undefined' ? window.location.origin : '');

  if (tab.isCustomUrl) {
    if (/^https?:\/\//i.test(path)) return path;
    return base + (path.startsWith('/') ? path : '/' + path);
  }
  if (path.startsWith('/lightning/')) return base + path;
  if (tab.isObject) return `${base}/lightning/o/${path}`;
  if (path.includes('ObjectManager/')) return `${base}/lightning/setup/${path}`;
  return `${base}/lightning/setup/${path}/home`;
}

/**
 * Rank tabs by how well each one claims the current page.
 *
 * Longest matching prefix wins, and an exact prefix always beats the
 * ObjectManager fallback — a tab pointing at an object still counts as active
 * while you browse that object's sections, but only if nothing matches
 * properly.
 *
 * Extracted because the floating panel had its own rule: it truncated the tab
 * URL at `/Details` and prefix-matched the remainder, so an Account object tab
 * claimed every page under Account, including the sibling Fields tab that
 * should have been the active one. tab-renderer.js had already replaced that
 * with the scoring below and documented why; the panel never got the fix.
 *
 * Takes plain {id, url} pairs so it stays free of the DOM. Callers layer their
 * own tie-breaks on top — the tab bar prefers a tab the user actually clicked.
 */
function matchTabsToUrl(candidates, currentUrl) {
  const url = String(currentUrl || '');

  return (candidates || [])
    .filter(candidate => candidate && candidate.url)
    .map(candidate => {
      if (url.startsWith(candidate.url)) {
        return { id: candidate.id, exact: true, score: candidate.url.length };
      }
      const objectRoot = candidate.url.match(/^.*\/ObjectManager\/[^/]+/);
      if (objectRoot && url.startsWith(objectRoot[0])) {
        return { id: candidate.id, exact: false, score: objectRoot[0].length };
      }
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => (b.exact - a.exact) || (b.score - a.score));
}

/**
 * Does this settings change alter what the Salesforce tab bar draws?
 *
 * Tab colors, the quick-add button and which profile applies all live in
 * userSettings, not in the tab keys — so the storage listener that watches tabs
 * never saw them. Redrawing was left to the popup remembering to broadcast, and
 * it remembered for the quick-add toggle and not for either color control:
 * turning colors off left every tab still colored until the page was
 * reloaded, and switching dot/fill did nothing at all.
 *
 * Compared field by field rather than reacting to any userSettings write, so
 * changing the theme or the floating button does not rebuild the tab bar for
 * nothing. oldValue is absent on a first write, which correctly reads as a
 * change.
 */
/**
 * Did any of these settings actually change?
 *
 * Every surface listens to userSettings, and a settings write fires twice —
 * once for sync and once for the local mirror saveUserSettings keeps. Surfaces
 * that reacted to the bare presence of `changes.userSettings` therefore rebuilt
 * themselves twice for any setting at all, related or not. Toggling tab colors
 * tore down and re-injected the header-menu item, which reflows
 * ul.slds-global-actions and visibly shifted Salesforce's own search bar, and
 * destroyed and recreated the floating handle, which blinked.
 *
 * Comparing the named keys answers both problems at once: an unrelated setting
 * is not a change, and the second write of the same value is not a change
 * either.
 */
function settingsChanged(change, keys) {
  if (!change) return false;
  const before = change.oldValue || {};
  const after = change.newValue || {};
  return keys.some(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}

/**
 * Settings that decide which tabs a surface shows.
 *
 * activeProfileAuto is in here because on an unlinked org it changes the answer
 * on its own: the same activeProfileId resolves to the starred default when
 * auto-switch set it and to itself when you did.
 */
const PROFILE_SETTINGS =
  ['activeProfileId', 'activeProfileAuto', 'profilesEnabled', 'autoSwitchProfiles'];

/** Settings that change what the Salesforce tab bar draws. */
const TAB_BAR_SETTINGS = [
  'tabColors',        // enabled, and dot vs fill
  'menuBarQuickAdd',  // the "+" at the end of the bar
  ...PROFILE_SETTINGS,
];

function settingsAffectTabBar(change) {
  return settingsChanged(change, TAB_BAR_SETTINGS);
}

/**
 * Does this batch of storage changes affect a profile's tabs?
 *
 * Four surfaces asked this and three phrased it differently. Two of them
 * matched `key.endsWith('_tabs')`, which is exactly the key that does NOT exist
 * once a profile outgrows 7000 bytes — chunking replaces it with
 * `_tabs_chunk_N` plus `_tabs_metadata`. So editing a large profile refreshed
 * the Setup tab bar and the header menu while the floating panel kept showing
 * the old list until the page was reloaded.
 *
 * `customTabs` and its chunks are the pre-profiles layout, still live on old
 * installs.
 */
function tabStorageChanged(changes) {
  return Object.keys(changes || {}).some(key =>
    (key.startsWith('profile_') && key.includes('_tabs')) ||
    key === 'customTabs' ||
    key.startsWith('customTabs_chunk_') ||
    key === 'customTabs_metadata');
}

/**
 * Merge imported settings over current ones without losing nested detail.
 *
 * A spread is one level deep, so `{...current, ...incoming}` replaces whole
 * sub-objects rather than merging them. That silently destroys data: importing
 * a file exported before org colors existed — or with the feature switched
 * off, where `orgColors` serialises as `{enabled:false}` — replaced the live
 * `orgColors` outright and took `environments` and every per-org override with
 * it. The same shape applies to floatingButton, headerMenu and tabColors.
 *
 * One level of merging is deliberate, not a step towards a general deep merge.
 * Arrays are replaced wholesale, which is what an import should do to a list:
 * merging `orgs` element-wise would invent entries nobody exported.
 */
function mergeUserSettings(current, incoming) {
  const isPlainObject = value =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

  const merged = { ...(current || {}) };
  for (const [key, value] of Object.entries(incoming || {})) {
    const existing = merged[key];
    merged[key] = isPlainObject(value) && isPlainObject(existing)
      ? { ...existing, ...value }
      : value;
  }
  return merged;
}

/**
 * Where to send someone who wants to leave a review.
 *
 * The listing differs by store, and nothing in the extension's own metadata
 * says which one it came from — but the URL scheme of its own pages does, and
 * that is decided by the browser rather than by anything we ship.
 *
 * Chromium browsers other than Chrome resolve here too. Edge and Brave both use
 * chrome-extension:// and neither has its own listing for this extension, so the
 * Chrome Web Store is the right destination for them as well as the honest one.
 */
const CHROME_REVIEW_URL =
  'https://chromewebstore.google.com/detail/sf-tabs/lkimhffllnjkacnhjfehaihcjilcmdlo/reviews';
const FIREFOX_REVIEW_URL =
  'https://addons.mozilla.org/en-US/firefox/addon/sf-tabs/reviews/';

/**
 * Hex ⇄ HSV, for the org color picker.
 *
 * HSV rather than HSL because the picker is a saturation/brightness square with
 * a hue strip beside it, and those two axes ARE S and V — the mapping is the
 * geometry, not a conversion done on top of it.
 *
 * Here rather than in the popup because it is arithmetic with an exact
 * property worth asserting: every color the picker can produce must survive a
 * round trip through storage and back onto the square unchanged. A drift of one
 * in the last channel would move the dot every time a row was reopened.
 *
 * @param {number} h  0–360
 * @param {number} s  0–1
 * @param {number} v  0–1
 */
function hsvToHex(h, s, v) {
  const channel = n => {
    const k = (n + h / 60) % 6;
    const value = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.min(255, Math.max(0, Math.round(value * 255))).toString(16).padStart(2, '0');
  };
  return '#' + channel(5) + channel(3) + channel(1);
}

/** The inverse. Returns null for anything that is not a hex color. */
function hexToHsv(hex) {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!match) return null;

  const full = match[1].length === 3
    ? match[1].split('').map(c => c + c).join('')
    : match[1];
  const int = parseInt(full, 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;

  const max = Math.max(r, g, b);
  const span = max - Math.min(r, g, b);

  let h = 0;
  if (span) {
    if (max === r) h = ((g - b) / span) % 6;
    else if (max === g) h = (b - r) / span + 2;
    else h = (r - g) / span + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? span / max : 0, v: max };
}

/**
 * Which engine this copy is running on, from the URL of its own pages.
 *
 * Firefox is the only one that serves them over moz-extension://, and unlike a
 * user-agent string it cannot be spoofed or changed by the page. Two things
 * need to know: which store to send a review to, and one popup CSS rule.
 *
 * Anything unreadable answers "not Firefox", which is the majority case and the
 * one whose fallbacks are harmless.
 */
function isFirefox(extensionUrl) {
  return String(extensionUrl || '').startsWith('moz-extension://');
}

function storeReviewUrl(extensionUrl) {
  return isFirefox(extensionUrl) ? FIREFOX_REVIEW_URL : CHROME_REVIEW_URL;
}

/**
 * What to do about the review prompt: 'never' | 'start' | 'wait' | 'show'.
 *
 * Asking on the day someone installs is how a review prompt earns a one-star
 * review, so the first sighting only starts a clock — `start` writes the
 * timestamp and shows nothing. Either button then answers it for good.
 *
 * Deliberately not derived from an install date: there isn't one to read, and a
 * clock that starts when the popup is first opened measures the thing that
 * actually matters, which is use rather than presence.
 *
 * Unparseable state restarts the clock rather than showing the prompt. Nagging
 * someone whose storage is in an odd shape is the worse failure here.
 */
function reviewPromptDecision(stored, now) {
  if (stored && stored.answered) return 'never';
  if (!stored || typeof stored.after !== 'number') return 'start';
  return now >= stored.after ? 'show' : 'wait';
}

/**
 * Whether an on-page surface belongs at this URL.
 *
 * `everywhere` | `setup-only` | `outside-setup`. Shared by the floating button
 * and the environment banner, which offer the same three choices and must read
 * them the same way — two copies of this would eventually disagree about what
 * counts as a Setup page.
 *
 * An unrecognised value shows the surface. Hiding a feature the user has
 * switched on is the worse failure of the two.
 */
function locationAllows(url, location) {
  const inSetup = String(url || '').includes('/lightning/setup/');
  if (location === 'setup-only') return inSetup;
  if (location === 'outside-setup') return !inSetup;
  return true;
}

/**
 * Whether the floating button belongs on this page.
 *
 * The popup has always saved the location choice — but the only code that read
 * it was a shouldShow() method on a class nothing constructs, so the button
 * appeared everywhere regardless.
 */
function floatingButtonAllowedHere(url, floatingButton) {
  const fb = floatingButton || {};
  if (!fb.enabled) return false;
  return locationAllows(url, fb.location);
}

/**
 * Which edge the floating button docks to.
 *
 * Shared because the page and the settings screen must agree: if they disagree,
 * the preview shows one edge and the button appears on the other.
 *
 * `anchor` is read for installs written by an earlier build of the v3 branch,
 * which stored a nine-way {top|middle|bottom}-{left|center|right} grid. Only the
 * horizontal half ever reached the page — the vertical half resolved to `top`
 * for both 'top' and 'middle', and 'center' had no styling under the default
 * drawer layout. No released version ever wrote the field, so taking the side
 * and discarding the rest loses nothing a user could have seen.
 */
function resolveFloatingSide(floatingButton) {
  const fb = floatingButton || {};
  if (fb.side === 'left' || fb.side === 'right') return fb.side;
  return String(fb.anchor || '').endsWith('-left') ? 'left' : 'right';
}

/**
 * One profile's tab list, with `tab` either present or absent.
 *
 * A tab lives inside a profile's list, so "the same tab in two profiles" means
 * a copy in each, sharing an id. Ids only have to be unique within a profile,
 * which is what makes reusing one across them both free and the only way to
 * answer "which profiles hold this tab".
 *
 * Adding appends: a tab arriving in a profile must not displace an order
 * someone arranged there. Removing renumbers what is left so positions stay
 * dense. Both return the original array untouched when there is nothing to do,
 * so callers can skip the write.
 */
function withTabMembership(tabs, tab, shouldHold) {
  const list = Array.isArray(tabs) ? tabs : [];
  const at = list.findIndex(t => t && t.id === tab.id);

  if (shouldHold) {
    if (at !== -1) return list;
    const copy = JSON.parse(JSON.stringify(tab));
    copy.position = list.length;
    return [...list, copy];
  }

  if (at === -1) return list;
  return list.filter(t => t.id !== tab.id).map((t, i) => ({ ...t, position: i }));
}

/**
 * A readable name for a captured page.
 *
 * Lifted verbatim out of popup-tabs.js so the popup's Quick Add and the "+" in
 * the Salesforce menu bar name a page the same way. Two implementations of this
 * would drift on the first ObjectManager edge case.
 */
function generateTabName(path, pageTitle, isObject, isCustomUrl, isSetupObject) {
  let name = '';
  
  if (isCustomUrl) {
    if (pageTitle) {
      let cleanTitle = pageTitle.split(' | ')[0];
      name = cleanTitle;
    }
    
    if (!name || name.length === 0) {
      const pathSegments = path.split('/');
      for (const segment of pathSegments) {
        if (segment && segment.length > 0 && segment !== 'apex' && segment !== 'lightning') {
          name = segment
            .replace(/([A-Z])/g, ' $1')
            .replace(/\.(app|jsp|page)$/, '')
            .replace(/^./, str => str.toUpperCase())
            .trim();
          break;
        }
      }
      
      if (!name || name.length === 0) {
        name = 'Custom Page';
      }
    }
  } else if (isObject) {
    // Try to get object name from page title first (handles custom objects with IDs in URL)
    if (pageTitle) {
      let cleanTitle = pageTitle.split(' | ')[0];
      name = cleanTitle;
    }

    // Fallback to extracting from path if title not available
    if (!name || name.length === 0) {
      const pathSegments = path.split('/');
      if (pathSegments.length > 0) {
        const objectName = formatObjectNameFromURL(pathSegments[0]);
        let viewType = '';
        if (pathSegments.length > 1) {
          viewType = pathSegments[1].charAt(0).toUpperCase() + pathSegments[1].slice(1);
        }
        name = viewType ? `${objectName} ${viewType}` : objectName;
      }
    }
  } else if (path.startsWith('ObjectManager/')) {
    // Name as "<Object> - <Section>" so tabs for different sections of the same
    // object stay distinguishable. The page title is only consulted for the
    // object itself, and only when the URL carries a record ID instead of a
    // readable API name (custom objects).
    const pathSegments = path.split('/').filter(segment => segment.length > 0);

    let objectName = 'Object Manager';
    if (pathSegments.length >= 2) {
      const segment = pathSegments[1];
      const looksLikeId = /^[a-zA-Z0-9]{15,18}$/.test(segment) && !segment.includes('_');
      if (looksLikeId && pageTitle) {
        let cleanTitle = pageTitle.split(' | ')[0];
        if (cleanTitle.includes('Setup: ')) {
          cleanTitle = cleanTitle.split('Setup: ')[1];
        }
        objectName = cleanTitle || formatObjectNameFromURL(segment);
      } else {
        objectName = formatObjectNameFromURL(segment);
      }
    }

    // Section names arrive camel-cased: RelatedLookupFilters -> Related Lookup Filters
    let sectionName = '';
    if (pathSegments.length >= 3 && pathSegments[2].toLowerCase() !== 'details') {
      sectionName = pathSegments[2].replace(/([A-Z])/g, ' $1').trim();
    }

    name = sectionName ? `${objectName} - ${sectionName}` : objectName;
  } else {
    if (pageTitle) {
      let titleParts = pageTitle.split(' | ');
      let cleanTitle = titleParts[0];
      
      if (cleanTitle.includes('Setup')) {
        const setupParts = cleanTitle.split('Setup: ');
        if (setupParts.length > 1) {
          cleanTitle = setupParts[1];
        }
      }

      if (cleanTitle && cleanTitle.length > 0) {
        name = cleanTitle;
      }
    }
    
    if (!name || name.length === 0) {
      if (path && path.length > 0) {
        const pathSegments = path.split('/').filter(segment => segment.length > 0);
        
        if (pathSegments.length > 0) {
          let lastSegment = pathSegments[pathSegments.length - 1];
          name = lastSegment
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
          
          if (!name.trim()) {
            name = path
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase())
              .trim();
          }
        }
      }
      
      if (!name || !name.trim()) {
        name = 'Setup: ' + path;
      }
    }
  }
  
  return name;
}

/**
 * Turn a Salesforce URL into the tab that captures it.
 *
 * Returns null for anything that is not a Salesforce page, and for Salesforce
 * pages with no usable path — the caller decides what to say about that.
 *
 * The shapes it recognizes: /lightning/setup/ paths (with ObjectManager kept
 * whole, so the tab lands on the exact section that was open), /lightning/o/
 * object pages, and anything else on a Salesforce host as a custom URL.
 */
function parsePageToTab(url, pageTitle) {
  if (!url) return null;
  if (!url.includes('salesforce') && !url.includes('.force.com')) return null;

  let isObject = false;
  let isCustomUrl = false;
  let isSetupObject = false;
  let path = '';

  if (url.includes('/lightning/setup/')) {
    const parts = url.split('/lightning/setup/');
    if (parts.length > 1) {
      const fullPath = parts[1].split('?')[0];
      if (fullPath.startsWith('ObjectManager/')) {
        path = fullPath;
        isSetupObject = true;
      } else {
        path = fullPath.replace(/\/(home|view)$/, '');
      }
    }
  } else if (url.includes('/lightning/o/')) {
    isObject = true;
    const parts = url.split('/lightning/o/');
    // Query string kept: list views identify themselves with filterName
    if (parts.length > 1) path = parts[1];
  } else if (url.includes('.lightning.force.com/') || url.includes('.salesforce.com/')) {
    isCustomUrl = true;
    const parts = url.split('.com/');
    if (parts.length > 1) path = parts[1].split('?')[0];
  }

  if (!path) return null;

  return {
    label: generateTabName(path, pageTitle, isObject, isCustomUrl, isSetupObject),
    path,
    isObject,
    isCustomUrl,
    isSetupObject
  };
}

/**
 * Capture a page as a tab and hand it to the background worker to store.
 *
 * Lives here rather than beside a caller because it now has two, injected from
 * different content_scripts entries: the Setup tab bar's "+", which only loads
 * on Setup pages, and the header menu's capture button, which loads on every
 * Salesforce page. Keeping one copy is also what stops the two disagreeing
 * about which profiles receive the page.
 *
 * The write itself belongs to the worker, which owns the chunk-aware storage
 * helpers; this only decides what to store and who gets it.
 *
 * Takes the url and title rather than reading `location` so it stays callable
 * from the worker and testable without a DOM. Returns the stored tab, or null
 * when the page yields nothing worth capturing.
 */
async function quickAddPage(url, title) {
  const parsed = parsePageToTab(url, title);
  if (!parsed) return null;

  const preferSync = await storagePreference();
  const settings = await readStoredValue('userSettings', preferSync) || {};
  const profiles = await readStoredValue('profiles', preferSync) || [];
  const active = resolveProfileForUrl(url, profiles, settings) || settings.activeProfileId;

  // Same rule the popup's Quick Add follows, read from the same setting
  const profileIds = settings.quickAddAllProfiles && profiles.length
    ? profiles.map(p => p.id)
    : (active ? [active] : []);

  const tab = { ...parsed, id: generateId(), openInNewTab: false, dropdownItems: [] };
  await browser.runtime.sendMessage({ action: 'quick_add_tab', tab, profileIds });
  return tab;
}

/**
 * The Salesforce cloud, as one path on a 520 viewBox — SLDS utility
 * `salesforce1`, vendored at icons/slds/salesforce1.svg.
 *
 * Drawing our own copy rather than recoloring the org's real favicon avoids
 * the whole canvas problem: that icon is served cross-origin, and drawing it
 * taints the canvas so toDataURL() throws. This is the same silhouette, and it
 * needs no fetch, no canvas and no re-encoding.
 */
const SALESFORCE_CLOUD_PATH = 'M217 119c17-17 40-28 66-28 34 0 64 19 80 47 14-6 29-10 45-10 62 0 112 50 112 112s-50 112-112 112c-8 0-15-1-22-2a82.4 82.4 0 0 1-72 42c-13 0-25-3-36-8a92.7 92.7 0 0 1-86 56c-40 0-75-25-88-61-6 1-12 2-18 2a87 87 0 0 1-44-162 100.5 100.5 0 0 1 93-140c35 1 64 16 82 40';

/** Colors for orgs nobody has configured. Chosen to stay apart at 16px. */
const DEFAULT_ENV_COLORS = {
  production: '#c5221f',   // the one worth hesitating over
  sandbox:    '#1e8e3e',
  developer:  '#1a73e8',
  scratch:    '#7526e3',
  demo:       '#b06000',
  patch:      '#5c5c5c',
  playground: '#0d9dda'
};

/**
 * A favicon of the Salesforce cloud in one color, as an SVG data URL.
 *
 * SVG rather than a canvas PNG because both browsers have taken SVG favicons
 * for years and it removes every moving part — no image decode, no canvas, no
 * tainting, and it stays sharp on whatever the display does.
 */
function orgFaviconDataUrl(color) {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520">' +
    '<path fill="' + color + '" d="' + SALESFORCE_CLOUD_PATH + '"/></svg>';
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

/**
 * The color an org's tab icon should take, or null to leave it alone.
 *
 * A per-org entry wins over its environment's color — that is the whole point
 * of the override, and it is what lets three sandboxes in one org be told
 * apart when the hostname says only "sandbox" for all three.
 *
 * Entries are keyed by identifier AND environment because the identifier alone
 * collides: `acme.lightning.force.com` and `acme.develop.lightning.force.com`
 * both reduce to `acme`, and they are different orgs.
 */
/**
 * Perceptual lightness contrast, per APCA — the model behind WCAG 3.
 *
 * Returns Lc, roughly -108…108. The sign is the polarity; only the magnitude
 * matters here. Constants are APCA 0.1.9 and are not adjustable: they were fit
 * to reading experiments, and changing one silently makes the number mean
 * something other than what its scale says.
 *
 * @param {number} textY  luminance of the text, 0–1
 * @param {number} bgY    luminance of the background, 0–1
 */
function apcaContrast(textY, bgY) {
  // Very dark backgrounds are flattened towards black, or the curve overstates
  // how much contrast is available down there.
  const clamp = y => (y > 0.022 ? y : y + Math.pow(0.022 - y, 1.414));
  const text = clamp(textY);
  const background = clamp(bgY);
  if (Math.abs(background - text) < 0.0005) return 0;

  if (background > text) {   // dark text on a light background
    const raw = (Math.pow(background, 0.56) - Math.pow(text, 0.57)) * 1.14;
    return raw < 0.1 ? 0 : (raw - 0.027) * 100;
  }
  const raw = (Math.pow(background, 0.65) - Math.pow(text, 0.62)) * 1.14;
  return raw > -0.1 ? 0 : (raw + 0.027) * 100;
}

/**
 * White or near-black, whichever the given background can actually carry.
 *
 * The org palette is configurable and someone will pick a pale yellow, on which
 * white text is unreadable — so the banner cannot simply always use white the
 * way the extension it grew out of did, which only ever had two fixed colors.
 *
 * This used to be WCAG 2 relative luminance with the 0.179 crossover, and it
 * was wrong in a way that is well known: that formula systematically under-
 * rates saturated blues, because its coefficients treat blue as contributing
 * almost nothing to lightness. On the Developer Edition blue it scored black at
 * 4.66 and white at 4.51 — a hair apart, decided for black — and the result was
 * visibly less legible than white. APCA scores the same pair 33 and 76.
 *
 * It also flipped the sandbox green and the Playground blue, both of which had
 * the same complaint against them. Pale colors are unaffected: white text on
 * #ffe680 or #ffc0cb still loses, which is the case the whole function exists
 * for.
 *
 * Three-digit hex is expanded rather than rejected. Falling back to white on an
 * unparsed color is a guess, and `#ffc` is exactly the case where it is wrong.
 */
function readableInk(hex) {
  let value = String(hex || '').trim().replace('#', '');
  if (value.length === 3) value = value.split('').map(c => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return '#ffffff';

  // APCA's own transfer function: a plain 2.4 exponent, not WCAG's piecewise
  // one. Mixing the two would put the luminance on a scale the constants above
  // were not fitted against.
  const channel = (index, weight) =>
    weight * Math.pow(parseInt(value.slice(index, index + 2), 16) / 255, 2.4);
  const background =
    channel(0, 0.2126729) + channel(2, 0.7151522) + channel(4, 0.0721750);

  const onBlack = Math.abs(apcaContrast(0, background));
  const onWhite = Math.abs(apcaContrast(1, background));
  return onBlack > onWhite ? '#181818' : '#ffffff';
}

/**
 * The color configured for the org a URL belongs to, whatever it is being
 * drawn on.
 *
 * Separate from resolveOrgColor, which additionally asks whether favicon
 * tinting is switched on. Two surfaces want this color now — the favicon and
 * the environment banner — and each has its own toggle, so "which color is
 * this org" and "should the favicon be tinted" had to stop being one question.
 *
 * Returns null for a page that belongs to no org.
 */
function orgColorFor(url, orgColors) {
  const config = orgColors || {};

  const environment = detectOrgEnvironment(url);
  if (!environment) return null;

  const identifier = extractOrgIdentifier(url);
  const override = (config.orgs || []).find(entry =>
    entry &&
    String(entry.identifier).toLowerCase() === String(identifier).toLowerCase() &&
    (entry.environment || environment) === environment);
  if (override && override.color) return override.color;

  const environments = config.environments || {};
  return environments[environment] || DEFAULT_ENV_COLORS[environment] || null;
}

/** The color to tint the favicon with, or null when that is switched off. */
function resolveOrgColor(url, orgColors) {
  if (!orgColors || !orgColors.enabled) return null;
  return orgColorFor(url, orgColors);
}

/**
 * The color for the environment banner, or null when it does not belong here.
 *
 * Two gates, not one: the feature switch, and the same everywhere / Setup only
 * / outside Setup choice the floating button offers. Both live here rather than
 * in the content script so the rule is testable and so the popup could preview
 * it without duplicating the logic.
 */
function orgBannerColor(url, orgColors) {
  if (!orgColors || !orgColors.banner) return null;
  if (!locationAllows(url, orgColors.bannerLocation)) return null;
  return orgColorFor(url, orgColors);
}

/**
 * Apply an order taken from the Salesforce tab bar back onto stored tabs.
 *
 * Salesforce's own console tab bar can be dragged, and our injected tabs carry
 * navexConsoleTabItem, so they inherit that for free — but it moves DOM nodes
 * and nothing else, and the next render rebuilds from `position` and snaps them
 * back. This turns the DOM order into stored positions.
 *
 * Only top-level tabs appear in the bar, so only their positions move. A nested
 * tab keeps whatever position it had inside its parent; renumbering the whole
 * array by index would quietly reshuffle children that were never dragged.
 *
 * A partial order permutes only the slots its own tabs occupy. Numbering them
 * 0..n-1 instead would collide with tabs that were not in the bar: given
 * positions a:0 b:1 c:2 and an order of just ['c'], c would be handed 0 and sit
 * on top of a, producing an order nobody dragged. So the tabs being reordered
 * keep their collective set of positions and are dealt back out in the new
 * sequence. That case is real — the bar can be showing a subset while a render
 * races a write.
 */
function reorderTopLevelTabs(tabs, orderedIds) {
  const list = Array.isArray(tabs) ? tabs : [];
  const moving = (orderedIds || [])
    .filter(id => list.some(tab => tab && !tab.parentId && tab.id === id));
  if (!moving.length) return list;

  const slots = list
    .filter(tab => tab && !tab.parentId && moving.includes(tab.id))
    .map(tab => tab.position ?? 0)
    .sort((a, b) => a - b);

  const assigned = new Map(moving.map((id, index) => [id, slots[index]]));

  return list.map(tab => {
    if (!tab || tab.parentId || !assigned.has(tab.id)) return tab;
    const position = assigned.get(tab.id);
    return tab.position === position ? tab : { ...tab, position };
  });
}

/**
 * Whether a bar order differs from what the stored positions would produce.
 *
 * The caller uses this to skip writes: our own render puts the tabs in stored
 * order, so without this check the observer that watches for drags would fire
 * on every render and write back what was already there.
 */
function tabOrderMatches(tabs, orderedIds) {
  const stored = (Array.isArray(tabs) ? tabs : [])
    .filter(tab => tab && !tab.parentId)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map(tab => tab.id);
  const seen = (orderedIds || []).filter(id => stored.includes(id));
  return seen.length === stored.length && seen.every((id, i) => id === stored[i]);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateId,
    extractOrgIdentifier,
    detectOrgEnvironment,
    DEFAULT_ENV_COLORS,
    resolveOrgColor,
    orgBannerColor,
    apcaContrast,
    readableInk,
    orgColorFor,
    orgFaviconDataUrl,
    ORG_PARTITIONS,
    TAB_COLORS,
    tabColorVars,
    applyTabColor,
    resolveProfileForUrl,
    resolveFloatingSide,
    hsvToHex,
    hexToHsv,
    isFirefox,
    storeReviewUrl,
    reviewPromptDecision,
    locationAllows,
    floatingButtonAllowedHere,
    mergeUserSettings,
  tabStorageChanged,
  settingsAffectTabBar,
  PROFILE_SETTINGS,
  settingsChanged,
  matchTabsToUrl,
  tabDestinationUrl,
  loadTabsForUrl,
  readStoredValue,
  readChunkedSyncValue,
  pruneStaleChunks,
  writeChunkedSyncValue,
  storagePreference,
    withTabMembership,
    reorderTopLevelTabs,
    tabOrderMatches,
    generateTabName,
    parsePageToTab,
    quickAddPage,
    getCurrentPageInfo,
    buildFullUrl,
    isLightningNavigationEnabled,
    debounce
  };
} else {
  // Browser environment
  // globalThis rather than window: a service worker has no window, and the
  // background worker imports this file for its org matching.
  globalThis.SFTabs = globalThis.SFTabs || {};

  // See the matching note in constants.js: on Firefox a content script's
  // globalThis is its sandbox, not the page window, and every file in content/
  // reads these off `window`. Pointing both at one object here is enough — the
  // .utils assignment below mutates that shared object.
  // No-op in the worker (no window) and on Chrome (window === globalThis).
  if (typeof window !== 'undefined' && window !== globalThis) {
    window.SFTabs = globalThis.SFTabs;
  }

  globalThis.SFTabs.utils = {
    generateId,
    extractOrgIdentifier,
    detectOrgEnvironment,
    DEFAULT_ENV_COLORS,
    resolveOrgColor,
    orgBannerColor,
    apcaContrast,
    readableInk,
    orgColorFor,
    orgFaviconDataUrl,
    ORG_PARTITIONS,
    TAB_COLORS,
    tabColorVars,
    applyTabColor,
    resolveProfileForUrl,
    resolveFloatingSide,
    hsvToHex,
    hexToHsv,
    isFirefox,
    storeReviewUrl,
    reviewPromptDecision,
    locationAllows,
    floatingButtonAllowedHere,
    mergeUserSettings,
    tabStorageChanged,
    settingsAffectTabBar,
    PROFILE_SETTINGS,
    settingsChanged,
    matchTabsToUrl,
    tabDestinationUrl,
    loadTabsForUrl,
    readStoredValue,
    readChunkedSyncValue,
    pruneStaleChunks,
    writeChunkedSyncValue,
    storagePreference,
    withTabMembership,
    reorderTopLevelTabs,
    tabOrderMatches,
    generateTabName,
    parsePageToTab,
    quickAddPage,
    getCurrentPageInfo,
    buildFullUrl,
    isLightningNavigationEnabled,
    debounce
  };
}