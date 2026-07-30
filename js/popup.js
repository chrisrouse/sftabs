/**
 * popup.js — UI v2
 *
 * Reads and writes real data through the production storage layer
 * (SFTabs.storage) — the same modules the previous UI uses. No forked
 * storage code.
 *
 * Data-safety rules — keep these true:
 *   1. Production shapes are canonical. Adapt this UI to them, never the
 *      reverse (see settings.themeMode, derived profile colors).
 *   2. Never write an object built from this UI's model. Read the stored
 *      object, patch only the keys we own, write it back — otherwise keys
 *      this UI doesn't know about (settings.floatingButton, autoSwitchProfiles,
 *      per-tab fields) get silently dropped.
 *   3. Tabs live in profile-scoped storage (getProfileTabs/saveTabs), not the
 *      legacy `customTabs` key, even when the profiles UI is switched off.
 *   4. Never overwrite existing data on load. ensureUsableState() only
 *      repairs (adopt a profile), migrates v1 `customTabs` into a profile,
 *      or seeds defaults into genuinely empty storage.
 */

// ── State ──────────────────────────────────────────────────────
let state = {
  tabs:            [],
  profiles:        [],
  settings:        {},
  activeView:      'empty',   // 'empty' | 'edit' | 'settings' | 'release-notes'
  editingTabId:    null,
  profileDropdownOpen: false,
  pendingDeleteId: null,
  loadError:       null,
  expandedPaths:   new Set(), // UI-only; never written to storage
  editingItemPath: null,      // dropdown item currently open for inline edit
  addingItemUnder: null,      // parent path for a pending add ([] = root)
};

// ── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  installProductionHooks();
  renderVersion();
  // Must precede loadFromStorage: ensureUsableState() would otherwise seed
  // defaults silently and there would be nothing left to choose.
  await maybeRunFirstLaunch();
  await loadFromStorage();
  renderTabList();
  renderProfileChip();
  renderProfileDropdown();
  applyTheme(state.settings.themeMode);
  applyDensity(state.settings.compactMode);
  showView('empty');
  bindEvents();
  await initReleaseNotes();
  if (state.loadError) showStatus(state.loadError, 'error');
});

/** Single source of truth for the displayed version: the manifest. */
function renderVersion() {
  const el = document.getElementById('footer-version');
  if (!el) return;
  const version = browser.runtime.getManifest().version;
  el.textContent = `v${version}`;
  el.setAttribute('aria-label', `Version ${version}`);
}

/**
 * Load settings, profiles and tabs through the production storage layer.
 * Read-only: nothing here writes, so it cannot damage existing data.
 */
async function loadFromStorage() {
  const missing = preflight();
  if (missing) {
    state.tabs = [];
    state.settings = { ...(window.SFTabs?.constants?.DEFAULT_SETTINGS || {}) };
    state.loadError = missing;
    return;
  }
  try {
    await ensureUsableState();

    state.settings = await SFTabs.storage.getUserSettings();
    state.profiles = await SFTabs.storage.getProfiles() || [];

    // Production keeps tabs in profile-scoped storage even when the profiles
    // UI is off. A null activeProfileId here means initialization was skipped
    // because pre-existing data was found — surface that instead of rendering
    // an empty list, which would look like data loss.
    if (state.settings.activeProfileId) {
      state.tabs = await SFTabs.storage.getProfileTabs(state.settings.activeProfileId) || [];
    } else {
      state.tabs = [];
      state.loadError = state.loadError || 'Could not establish an active profile.';
    }
  } catch (err) {
    state.tabs = [];
    state.settings = { ...(window.SFTabs?.constants?.DEFAULT_SETTINGS || {}) };
    state.loadError = `Could not read saved data: ${err.message}`;
  }
}

/**
 * First-run setup: create the default profile and seed DEFAULT_TABS.
 *
 * Deliberately conservative — it runs ONLY when storage is completely empty.
 * If a profile, an activeProfileId, or v1-era `customTabs` already exists, it
 * bails without writing, because that case is a migration and belongs to the
 * production first-launch/migration flow, not to us.
 */
async function ensureUsableState() {
  const settings = await SFTabs.storage.getUserSettings();
  const profiles = await SFTabs.storage.getProfiles() || [];

  // Healthy: an active profile that actually exists
  if (settings.activeProfileId && profiles.some(p => p.id === settings.activeProfileId)) {
    return;
  }

  // Repair: profiles exist but nothing is active, or the active id is stale
  // (also the landing spot if a migration was interrupted part-way).
  if (profiles.length) {
    const fallback = profiles.find(p => p.isDefault) || profiles[0];
    await SFTabs.storage.saveUserSettings(
      { ...settings, activeProfileId: fallback.id,
        defaultProfileId: settings.defaultProfileId || fallback.id },
      true, false
    );
    return;
  }

  // No profiles at all — either a v1 install to migrate, or a fresh one to seed
  const legacyTabs = await readLegacyTabs();
  if (legacyTabs.length) {
    await migrateLegacyTabs(legacyTabs, settings);
  } else {
    await seedDefaults(settings);
  }
}

/** v1 stored tabs under `customTabs`; check both areas, preferred first. */
async function readLegacyTabs() {
  const preferSync = await SFTabs.storage.getStoragePreference();
  const fromSync  = async () => (await SFTabs.storageChunking.readChunkedSync('customTabs')) || [];
  const fromLocal = async () => (await browser.storage.local.get('customTabs'))?.customTabs || [];
  const first = preferSync ? await fromSync() : await fromLocal();
  if (first.length) return first;
  return preferSync ? await fromLocal() : await fromSync();
}

/**
 * Move v1 tabs into a Default profile — the headless equivalent of
 * production's migration modal, which is unreachable now that the manifest
 * points at this popup. The legacy `customTabs` key is deliberately left in
 * place as a backup, exactly as production leaves it.
 */
async function migrateLegacyTabs(tabs, settings) {
  const profileId = 'profile_' + Date.now() + '_default';
  await SFTabs.storage.saveProfiles([{
    id: profileId,
    name: 'Default',
    isDefault: true,
    urlPatterns: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }], false);

  await SFTabs.storage.saveProfileTabs(profileId, tabs);
  await SFTabs.storage.saveUserSettings(
    { ...settings, activeProfileId: profileId, defaultProfileId: profileId },
    true, false
  );

  const version = browser.runtime.getManifest().version;
  await browser.storage.local.set({
    extensionVersion: version,
    migrationCompleted: version,
    migrationPending: false
  });

  showStatus(`Brought ${tabs.length} existing tab${tabs.length === 1 ? '' : 's'} forward`);
}

async function seedDefaults(settings) {
  await createFirstProfile(settings, [...SFTabs.constants.DEFAULT_TABS]);
}

/**
 * Create the Default profile and give it `tabs`. Shared by the silent seed path
 * and the first-launch wizard so there is one way to establish initial state.
 * Writes go through the production storage layer, never raw storage calls.
 */
async function createFirstProfile(settings, tabs) {
  const profile = {
    id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    name: 'Default',
    isDefault: true,
    urlPatterns: [],
    createdAt: new Date().toISOString(),
    lastActive: null
  };
  await SFTabs.storage.saveProfiles([profile]);
  await SFTabs.storage.saveUserSettings(
    { ...settings, activeProfileId: profile.id, defaultProfileId: profile.id },
    false, false
  );
  await SFTabs.storage.saveProfileTabs(profile.id, tabs);
  return profile;
}

// ── First launch ───────────────────────────────────────────────

/**
 * Show the welcome wizard, but only on a genuinely fresh install.
 *
 * Detection is production's `checkFirstLaunch()` — it reads both storage areas
 * and recognises upgrades, which matters because showing this to an existing
 * user would offer to overwrite their tabs. Anything other than
 * 'first-install' (upgrade, already completed, synced data from another
 * device, or an error) falls through to the existing headless path.
 */
async function maybeRunFirstLaunch() {
  if (!window.SFTabs?.firstLaunch?.checkFirstLaunch) return;

  let status;
  try {
    status = await SFTabs.firstLaunch.checkFirstLaunch();
  } catch {
    return; // never block the popup on this check
  }
  if (status?.reason !== 'first-install') return;

  await runFirstLaunchWizard({ preview: false });
}

/**
 * Open the wizard and resolve once it closes.
 *
 * `preview: true` is the Settings > Debug route — everything is interactive but
 * the choice is never applied, so it can be opened on a populated install
 * without touching saved data.
 */
function runFirstLaunchWizard({ preview }) {
  return new Promise(resolve => {
    const overlay = document.getElementById('modal-first-launch');
    if (!overlay) return resolve();

    document.getElementById('fl-preview-note').hidden = !preview;
    document.getElementById('fl-start').textContent = preview ? 'Close preview' : 'Get started';
    overlay.hidden = false;

    document.getElementById('fl-start').addEventListener('click', async () => {
      const setup = document.querySelector('input[name="fl-setup"]:checked')?.value || 'default';
      const enableProfiles = document.getElementById('fl-enable-profiles').checked;

      if (preview) {
        showStatus(describeFirstLaunchChoice(setup, enableProfiles));
      } else {
        try {
          await applyFirstLaunchChoice(setup, enableProfiles);
        } catch (err) {
          // Leaving storage empty is recoverable: ensureUsableState() seeds
          // defaults on the next line of init.
          state.loadError = `Setup didn't finish: ${err.message}`;
        }
      }
      overlay.hidden = true;
      resolve();
    }, { once: true });
  });
}

/** What a real run of this choice would have done — preview mode only. */
function describeFirstLaunchChoice(setup, enableProfiles) {
  const count = window.SFTabs?.constants?.DEFAULT_TABS?.length;
  const outcome = {
    default: `a Default profile with ${count ? `${count} tabs` : 'the default tabs'}`,
    empty:   'an empty Default profile',
    import:  'an empty Default profile, then opened the settings page to import'
  }[setup];
  return `Preview only — would have created ${outcome}, profiles ${enableProfiles ? 'on' : 'off'}. Nothing was saved.`;
}

/**
 * Apply the wizard's answers. Storage location is deliberately not offered
 * here yet — DEFAULT_SETTINGS' sync preference stands, changeable in Settings.
 */
async function applyFirstLaunchChoice(setup, enableProfiles) {
  const settings = {
    ...(await SFTabs.storage.getUserSettings()),
    profilesEnabled: enableProfiles
  };

  // 'import' gets an empty profile too, so the popup has a valid active profile
  // to import into rather than a half-initialised state.
  const tabs = setup === 'default' ? [...SFTabs.constants.DEFAULT_TABS] : [];
  await createFirstProfile(settings, tabs);

  // Recorded in both areas, as production does, so a second device doesn't
  // re-run the wizard over synced data.
  await browser.storage.local.set({ firstLaunchCompleted: true });
  try {
    await browser.storage.sync.set({ firstLaunchCompleted: true });
  } catch {
    // Sync unavailable or quota-bound; the local flag is enough on this device.
  }

  if (setup === 'import') {
    browser.tabs.create({ url: browser.runtime.getURL('popup/settings.html') });
  }
}

// ── Release notes ──────────────────────────────────────────────

/**
 * The version the newest notes describe — read from the panel itself so
 * updating the notes markup updates the unread check with it. Deliberately not
 * the manifest version: a build that ships no new notes shouldn't ring the bell.
 */
function releaseNotesVersion() {
  const label = document.querySelector('#view-release-notes .rn-version-label');
  return label ? label.textContent.trim().replace(/^v/i, '') : null;
}

async function initReleaseNotes() {
  const version = releaseNotesVersion();
  if (!version) return;
  let seen = null;
  try {
    seen = (await browser.storage.local.get('seenReleaseNotesVersion')).seenReleaseNotesVersion;
  } catch {
    // Unreadable storage: treat as unread rather than hiding the notes
  }
  setReleaseNotesUnread(seen !== version);
}

/**
 * The bell stays visible either way — it is the only route back to the notes.
 * Only the dot and the label reflect whether they've been read.
 */
function setReleaseNotesUnread(unread) {
  const dot = document.getElementById('notif-dot');
  const btn = document.getElementById('btn-release-notes');
  if (dot) dot.hidden = !unread;
  if (btn) {
    btn.setAttribute('aria-label',
      unread ? 'View release notes — new update available' : 'View release notes');
  }
}

async function closeReleaseNotes() {
  const dismissed = document.getElementById('dismiss-release-notes')?.checked;
  const version = releaseNotesVersion();

  if (dismissed && version) {
    try {
      await browser.storage.local.set({ seenReleaseNotesVersion: version });
      setReleaseNotesUnread(false);
      showStatus('Release notes dismissed');
    } catch (err) {
      showStatus(`Could not save that: ${err.message}`, 'error');
    }
  }
  showView('empty');
}

/**
 * Persist the current tab list. saveTabs() handles sorting, stripping staging
 * fields via cleanTabForStorage, chunking, and profile routing.
 */
async function persistTabs() {
  try {
    await SFTabs.storage.saveTabs(state.tabs);
  } catch (err) {
    showStatus(`Could not save: ${err.message}`, 'error');
  }
}

/**
 * Patch settings without clobbering keys this UI doesn't model.
 * Re-reads stored settings so fields like floatingButton and
 * autoSwitchProfiles survive — never write state.settings wholesale.
 */
async function patchSettings(partial) {
  try {
    const stored = await SFTabs.storage.getUserSettings();
    const merged = { ...stored, ...partial };
    await SFTabs.storage.saveUserSettings(merged, false, false);
    state.settings = merged;
  } catch (err) {
    showStatus(`Could not save setting: ${err.message}`, 'error');
  }
}

/**
 * Shim the hooks production modules expect, so we can reuse them instead of
 * re-deriving their logic. popup-tabs.js's quick-add needs exactly these
 * three; saveTabs() also calls setTabs/renderTabList when present.
 */
function installProductionHooks() {
  window.SFTabs = window.SFTabs || {};
  // Proxy so a module reaching for an unshimmed hook logs instead of failing
  // silently — popup-storage guards its calls with `if (SFTabs.main && ...)`.
  const warnOnMissing = obj => new Proxy(obj, {
    get(target, prop) {
      if (!(prop in target) && typeof prop === 'string') {
        console.warn(`[SF Tabs] production module wants SFTabs hook "${String(prop)}" which the v2 popup does not shim`);
      }
      return target[prop];
    }
  });
  SFTabs.main = warnOnMissing({
    getTabs: () => state.tabs,
    setTabs: tabs => { state.tabs = tabs; },
    showStatus: (message, isError) => showStatus(message, isError ? 'error' : 'success'),
    // saveUserSettings needs these three. getUserSettings in particular gates
    // its sync<->local comparison: without it, flipping useSyncStorage would
    // save the preference but never move the data.
    getUserSettings: () => state.settings,
    setUserSettings: settings => { state.settings = settings; },
    applyTheme: () => applyTheme(state.settings.themeMode)
  });
  SFTabs.ui = warnOnMissing({
    renderTabList: () => { renderTabList(); bindTabListEvents(); }
  });
}

/**
 * Report the first missing dependency by name instead of letting a generic
 * "cannot read properties of undefined" surface. The usual cause is a stale
 * manifest: the extension must be reloaded after permissions change.
 */
function preflight() {
  const reload = 'Reload the extension at chrome://extensions.';
  if (typeof chrome === 'undefined' || !chrome.runtime) return `No extension APIs. ${reload}`;
  if (!chrome.storage) return `Storage permission not granted — stale manifest. ${reload}`;
  if (typeof browser === 'undefined') return `browser-compat.js did not load. ${reload}`;
  if (!browser.storage || !browser.storage.local) return `browser.storage shim missing. ${reload}`;
  if (!window.SFTabs?.storage?.getUserSettings) return `popup-storage.js did not load. ${reload}`;
  if (!window.SFTabs?.storageChunking) return `storage-chunking.js did not load. ${reload}`;
  if (!window.SFTabs?.constants) return `constants.js did not load. ${reload}`;
  if (!window.SFTabs?.tabs?.enhancedAddTabForCurrentPage) return `popup-tabs.js did not load. ${reload}`;
  return null;
}

/**
 * Profile chip/dot color. Production profiles have no color field, so derive
 * a stable one from the id rather than inventing stored data.
 */
/** Production derives this from the items array; it is not a stored field. */
function hasDropdown(tab) {
  return Array.isArray(tab?.dropdownItems) && tab.dropdownItems.length > 0;
}

// ── Dropdown item tree ─────────────────────────────────────────
// Items are addressed by index path, e.g. [0,2] = items[0].dropdownItems[2].
// The tab itself is the parent, so the item tree may be two levels deep:
// child and grandchild. The injected nav only draws flyouts that far.
const MAX_ITEM_DEPTH = 2;

const pathKey = path => path.join('.');

function getItemByPath(items, path) {
  let list = items, item = null;
  for (const idx of path) {
    if (!Array.isArray(list) || !list[idx]) return null;
    item = list[idx];
    list = item.dropdownItems;
  }
  return item;
}

function getParentList(items, path) {
  if (path.length === 1) return items;
  const parent = getItemByPath(items, path.slice(0, -1));
  return parent ? parent.dropdownItems : null;
}

function removeItemByPath(items, path) {
  const list = getParentList(items, path);
  if (!list) return null;
  const [removed] = list.splice(path[path.length - 1], 1);
  // Production drops the key entirely rather than leaving an empty array
  if (path.length > 1 && list.length === 0) {
    const parent = getItemByPath(items, path.slice(0, -1));
    if (parent) delete parent.dropdownItems;
  }
  return removed || null;
}

function countItems(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((n, i) => n + 1 + countItems(i.dropdownItems), 0);
}

/** Depth of an items array: 1 for a flat list, +1 per nested level. */
function itemsDepth(items) {
  if (!Array.isArray(items) || !items.length) return 0;
  return 1 + Math.max(...items.map(i => itemsDepth(i.dropdownItems)));
}

/** Flatten the tree honoring collapsed branches, for rendering. */
function walkVisibleItems(items, level = 0, path = [], out = []) {
  (items || []).forEach((item, idx) => {
    const p = [...path, idx];
    out.push({ item, path: p, level });
    if (state.expandedPaths.has(pathKey(p))) {
      walkVisibleItems(item.dropdownItems, level + 1, p, out);
    }
  });
  return out;
}

const PROFILE_DOT_COLORS = ['#04e1cb', '#78b0fd', '#ad7bee', '#fcc003', '#fe8f7d', '#45c65a'];
function profileColor(profileId = '') {
  let hash = 0;
  for (let i = 0; i < profileId.length; i++) hash = (hash * 31 + profileId.charCodeAt(i)) >>> 0;
  return PROFILE_DOT_COLORS[hash % PROFILE_DOT_COLORS.length];
}

// ── Drag and drop ──────────────────────────────────────────────
// One engine drives both lists. Drop zones are positional rather than
// production's 500ms hover delay: the top/bottom thirds of a row mean
// "place before/after", the middle third means "nest inside".

let dragIndicatorEl = null;

function getDragIndicator() {
  if (!dragIndicatorEl) {
    dragIndicatorEl = document.createElement('div');
    dragIndicatorEl.className = 'drag-indicator';
    dragIndicatorEl.hidden = true;
    document.body.appendChild(dragIndicatorEl);
  }
  return dragIndicatorEl;
}

function showDropIndicator(rect, zone) {
  const el = getDragIndicator();
  el.hidden = false;
  el.classList.toggle('is-nest', zone === 'nest');
  if (zone === 'nest') {
    el.style.cssText =
      `top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px`;
  } else {
    const y = zone === 'before' ? rect.top : rect.bottom;
    el.style.cssText = `top:${y - 1}px;left:${rect.left}px;width:${rect.width}px;height:2px`;
  }
}

function hideDropIndicator() {
  if (dragIndicatorEl) dragIndicatorEl.hidden = true;
}

/**
 * Begin a drag. `opts.canNest(sourceEl, targetEl)` gates the middle zone;
 * `opts.onDrop(sourceEl, targetEl, zone)` commits it.
 */
function startDrag(event, sourceEl, opts) {
  event.preventDefault();
  const { container, itemSelector, canNest, onDrop } = opts;
  let targetEl = null, zone = null;

  sourceEl.classList.add('is-dragging');
  document.body.classList.add('is-dragging-active');

  const onMove = ev => {
    hideDropIndicator(); // never let the indicator win the hit test
    const under = document.elementFromPoint(ev.clientX, ev.clientY);
    const row = under && under.closest(itemSelector);

    if (!row || row === sourceEl || !container.contains(row) || sourceEl.contains(row)) {
      targetEl = zone = null;
      return;
    }
    const rect = row.getBoundingClientRect();
    const offset = ev.clientY - rect.top;
    const nestOk = canNest(sourceEl, row);
    zone = (nestOk && offset > rect.height / 3 && offset < (rect.height * 2) / 3)
      ? 'nest'
      : (offset < rect.height / 2 ? 'before' : 'after');
    targetEl = row;
    showDropIndicator(rect, zone);
  };

  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    hideDropIndicator();
    sourceEl.classList.remove('is-dragging');
    document.body.classList.remove('is-dragging-active');
    if (targetEl && zone) onDrop(sourceEl, targetEl, zone);
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// ── Tab list: reorder, or drop onto a tab to nest it as a sub-item ──

function bindTabDrag() {
  const list = document.getElementById('tab-list');
  list.querySelectorAll('.drag-handle').forEach(handle => {
    handle.addEventListener('mousedown', e => {
      const row = handle.closest('.tab-item');
      if (!row) return;
      startDrag(e, row, {
        container: list,
        itemSelector: '.tab-item',
        canNest: (srcEl, tgtEl) => canNestTab(srcEl.dataset.id, tgtEl.dataset.id),
        onDrop: (srcEl, tgtEl, zone) => zone === 'nest'
          ? nestTabIntoTab(srcEl.dataset.id, tgtEl.dataset.id)
          : reorderTab(srcEl.dataset.id, tgtEl.dataset.id, zone === 'before')
      });
    });
  });
}

/** Nesting is blocked when the combined tree would exceed the depth limit. */
function canNestTab(sourceId, targetId) {
  const src = state.tabs.find(t => t.id === sourceId);
  const tgt = state.tabs.find(t => t.id === targetId);
  if (!src || !tgt) return false;
  const incoming = 1 + itemsDepth(src.dropdownItems);       // src becomes a child
  const existing = itemsDepth(tgt.dropdownItems);
  return Math.max(incoming, existing) <= MAX_ITEM_DEPTH;
}

function reorderTab(sourceId, targetId, before) {
  const sorted = state.tabs.slice().sort((a, b) => a.position - b.position);
  const from = sorted.findIndex(t => t.id === sourceId);
  const to   = sorted.findIndex(t => t.id === targetId);
  if (from === -1 || to === -1) return;

  const [moved] = sorted.splice(from, 1);
  const insertAt = sorted.findIndex(t => t.id === targetId) + (before ? 0 : 1);
  sorted.splice(insertAt, 0, moved);
  sorted.forEach((t, i) => { t.position = i; });

  state.tabs = sorted;
  renderTabList();
  bindTabListEvents();
  persistTabs();
}

/** Move a whole tab under another tab, keeping its own sub-items. */
function nestTabIntoTab(sourceId, targetId) {
  const src = state.tabs.find(t => t.id === sourceId);
  const tgt = state.tabs.find(t => t.id === targetId);
  if (!src || !tgt) return;

  if (!canNestTab(sourceId, targetId)) {
    showStatus('Too many levels — nesting stops at parent, child, grandchild.', 'error');
    return;
  }

  const item = {
    label: src.label,
    path: src.path || '',
    url: src.isCustomUrl ? src.path : null,
    isObject: !!src.isObject,
    isCustomUrl: !!src.isCustomUrl,
    isSetupObject: !!src.isSetupObject
  };
  if (src.dropdownItems?.length) {
    item.dropdownItems = JSON.parse(JSON.stringify(src.dropdownItems));
  }

  tgt.dropdownItems = tgt.dropdownItems || [];
  tgt.dropdownItems.push(item);
  state.tabs = state.tabs.filter(t => t.id !== sourceId);
  state.tabs.sort((a, b) => a.position - b.position).forEach((t, i) => { t.position = i; });

  showStatus(`"${src.label}" moved under "${tgt.label}"`);
  renderTabList();
  bindTabListEvents();
  if (state.activeView === 'dropdowns' && state.editingTabId === targetId) {
    renderDropdownItems(targetId);
  }
  persistTabs();
}

// ── Sub-item list: reorder and re-nest within the tree ──

function bindItemDrag() {
  const list = document.getElementById('dropdown-items-list');
  list.querySelectorAll('.dropdown-item[data-path] .drag-handle').forEach(handle => {
    const row = handle.closest('.dropdown-item');
    handle.addEventListener('mousedown', e => {
      startDrag(e, row, {
        container: list,
        itemSelector: '.dropdown-item[data-path]',
        canNest: (srcEl, tgtEl) => canNestItem(parsePath(srcEl), parsePath(tgtEl)),
        onDrop: (srcEl, tgtEl, zone) => moveDropdownItem(parsePath(srcEl), parsePath(tgtEl), zone)
      });
    });
  });
}

const parsePath = el => el.dataset.path.split('.').map(Number);

/** True when `maybeChild` sits inside `maybeParent`. */
function isDescendantPath(maybeChild, maybeParent) {
  return maybeParent.length < maybeChild.length &&
         maybeParent.every((v, i) => maybeChild[i] === v);
}

function canNestItem(fromPath, toPath) {
  if (isDescendantPath(toPath, fromPath)) return false; // no dropping into own subtree
  const tab = state.tabs.find(t => t.id === state.editingTabId);
  if (!tab) return false;
  const moving = getItemByPath(tab.dropdownItems, fromPath);
  if (!moving) return false;
  // toPath.length is the target's depth; the moved subtree lands one below it
  return toPath.length + 1 + itemsDepth(moving.dropdownItems) <= MAX_ITEM_DEPTH;
}

function moveDropdownItem(fromPath, toPath, zone) {
  const tab = state.tabs.find(t => t.id === state.editingTabId);
  if (!tab) return;
  if (isDescendantPath(toPath, fromPath)) return;

  if (zone === 'nest' && !canNestItem(fromPath, toPath)) {
    showStatus('Too many levels — nesting stops at parent, child, grandchild.', 'error');
    return;
  }

  const moving = JSON.parse(JSON.stringify(getItemByPath(tab.dropdownItems, fromPath)));
  removeItemByPath(tab.dropdownItems, fromPath);

  // Removing an earlier sibling shifts the target index down by one
  const adjusted = [...toPath];
  const sameParent = fromPath.length === toPath.length &&
    fromPath.slice(0, -1).every((v, i) => toPath[i] === v);
  if (sameParent && fromPath[fromPath.length - 1] < toPath[toPath.length - 1]) {
    adjusted[adjusted.length - 1] -= 1;
  }

  if (zone === 'nest') {
    const parent = getItemByPath(tab.dropdownItems, adjusted);
    if (!parent) return;
    parent.dropdownItems = parent.dropdownItems || [];
    parent.dropdownItems.push(moving);
    state.expandedPaths.add(pathKey(adjusted));
  } else {
    const list = getParentList(tab.dropdownItems, adjusted);
    if (!list) return;
    const at = adjusted[adjusted.length - 1] + (zone === 'before' ? 0 : 1);
    list.splice(at, 0, moving);
  }

  renderDropdownItems(state.editingTabId);
  renderTabList();
  bindTabListEvents();
  persistTabs();
}

// ── Rendering ──────────────────────────────────────────────────

function renderTabList() {
  const list = document.getElementById('tab-list');
  if (!state.tabs.length) {
    list.innerHTML = `<li class="tab-list-empty" role="listitem">
      <p style="padding:16px 12px;font-size:12px;color:var(--t-weak);text-align:center;">No tabs yet — add your first one!</p>
    </li>`;
    return;
  }
  list.innerHTML = state.tabs
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(tab => tabItemHTML(tab))
    .join('');
}

function tabItemHTML(tab) {
  const type   = tabType(tab);
  const badge  = tabBadgeLabel(type);
  const name   = esc(tab.label);
  const path   = tab.path ? esc(tab.path) : '';
  const newTabOn = tab.openInNewTab ? 'is-on' : '';
  const newTabAriaLabel = tab.openInNewTab
    ? `Open in new tab: on — click to toggle off`
    : `Open in new tab: off — click to toggle on`;

  return `
  <li class="tab-item" role="listitem" data-id="${tab.id}" data-type="${type}" tabindex="-1">
    <div class="drag-handle" aria-hidden="true" title="Drag to reorder">
      <div class="drag-dots">
        <span></span><span></span>
        <span></span><span></span>
        <span></span><span></span>
      </div>
    </div>
    <div class="tab-info">
      <div class="tab-info-top">
        <span class="tab-badge tab-badge--${type}" aria-label="${badge} tab">${badge}</span>
        <span class="tab-name">${name}</span>
        ${hasDropdown(tab) ? `<span class="tab-count">${countItems(tab.dropdownItems)}<span class="sr-only"> sub-items</span></span>` : ''}
      </div>
      ${path ? `<span class="tab-path">${path}</span>` : ''}
      ${hasDropdown(tab) ? `<button class="tab-dropdown-note" data-action="manage-items" data-id="${tab.id}"
        >▾ ${countItems(tab.dropdownItems)} sub-item${countItems(tab.dropdownItems) === 1 ? '' : 's'}</button>` : ''}
    </div>
    <div class="tab-actions" role="group" aria-label="Actions for ${name} tab">
      <button class="tab-btn tab-btn--move tab-btn--up"
        aria-label="Move ${name} up" title="Move up" data-action="move-up" data-id="${tab.id}">
        <svg viewBox="0 0 520 520" fill="currentColor" aria-hidden="true" focusable="false"><path d="M414 210c8-8 8-19 0-27L264 36a20 20 0 0 0-28 0L86 183c-8 8-8 19 0 27l28 27c8 8 20 8 28 0l47-46c8-8 22-2 22 9v270c0 10 9 20 20 20h40c11 0 20-11 20-20V200c0-12 14-17 22-9l47 46c8 8 20 8 28 0z"/></svg>
      </button>
      <button class="tab-btn tab-btn--move tab-btn--down"
        aria-label="Move ${name} down" title="Move down" data-action="move-down" data-id="${tab.id}">
        <svg viewBox="0 0 520 520" fill="currentColor" aria-hidden="true" focusable="false"><path d="M96 310c-8 8-8 19 0 27l150 147c8 8 20 8 28 0l151-147c8-8 8-19 0-27l-28-27a20 20 0 0 0-28 0l-47 46c-8 8-22 3-22-9V50c0-10-9-20-20-20h-40c-11 0-20 11-20 20v270c0 12-14 17-22 9l-47-46a20 20 0 0 0-28 0z"/></svg>
      </button>
      <button class="tab-btn tab-btn--group ${hasDropdown(tab) ? 'is-on' : ''}"
        aria-label="${hasDropdown(tab) ? `Manage ${countItems(tab.dropdownItems)} sub-items in ` : 'Add sub-items to '}${name}"
        title="Sub-items" data-action="manage-items" data-id="${tab.id}">
        <svg viewBox="0 0 520 520" fill="currentColor" aria-hidden="true" focusable="false"><path d="M231 230H108c-7 0-14 6-14 13v105H53c-7 0-14 7-14 14v100c0 7 7 14 14 14h137c7 0 14-7 14-14V362c0-7-7-14-14-14h-41v-64h219v64h-41c-7 0-14 7-14 14v100c0 7 7 14 14 14h137c7 0 13-7 13-14V362c0-7-6-14-13-14h-42V243c0-7-7-13-14-13H286v-64h41c7 0 13-7 13-14V52c0-7-6-14-13-14H190c-7 0-14 7-14 14v100c0 7 7 14 14 14h42v64z"/></svg>
      </button>
      <button class="tab-btn tab-btn--edit"
        aria-label="Edit ${name}" title="Edit" data-action="edit" data-id="${tab.id}">
        <svg viewBox="0 0 520 520" fill="currentColor" aria-hidden="true" focusable="false"><path d="m95 334 89 89c4 4 10 4 14 0l222-223c4-4 4-10 0-14l-88-88a10 10 0 0 0-14 0L95 321c-4 4-4 10 0 13M361 57a10 10 0 0 0 0 14l88 88c4 4 10 4 14 0l25-25a38 38 0 0 0 0-55l-47-47a40 40 0 0 0-57 0zM21 482c-2 10 7 19 17 17l109-26c4-1 7-3 9-5l2-2c2-2 3-9-1-13l-90-90c-4-4-11-3-13-1l-2 2a20 20 0 0 0-5 9z"/></svg>
      </button>
      <button class="tab-btn tab-btn--newtab ${newTabOn}"
        aria-label="${newTabAriaLabel}" aria-pressed="${!!tab.openInNewTab}"
        title="Open in new tab" data-action="toggle-newtab" data-id="${tab.id}">
        <svg viewBox="0 0 520 520" fill="currentColor" aria-hidden="true" focusable="false"><path d="M487 20H296c-8 0-16 5-16 13v30c0 8 7 17 16 17h79c9 0 14 10 7 16L212 266c-6 6-6 15 0 21l21 21c6 6 15 6 21 0l170-170c6-6 16-2 16 7v79c0 8 8 17 16 17h29c8 0 15-9 15-17V34c0-9-5-14-13-14M363 255l-34 35q-9 9-9 21v114c0 8-7 15-15 15H95c-8 0-15-7-15-15V215c0-8 7-15 15-15h115c8 0 16-3 21-9l34-34c6-6 2-17-7-17H60a40 40 0 0 0-40 40v280a40 40 0 0 0 40 40h280a40 40 0 0 0 40-40V262c0-9-11-13-17-7"/></svg>
      </button>
      <button class="tab-btn tab-btn--delete"
        aria-label="Delete ${name}" title="Delete" data-action="delete" data-id="${tab.id}">
        <svg viewBox="0 0 52 52" fill="currentColor" aria-hidden="true" focusable="false"><path d="M45.5 10H33V6a4 4 0 0 0-4-4h-6a4 4 0 0 0-4 4v4H6.5c-.8 0-1.5.7-1.5 1.5v3c0 .8.7 1.5 1.5 1.5h39c.8 0 1.5-.7 1.5-1.5v-3c0-.8-.7-1.5-1.5-1.5M23 7c0-.6.4-1 1-1h4c.6 0 1 .4 1 1v3h-6zm18.5 13h-31c-.8 0-1.5.7-1.5 1.5V45a5 5 0 0 0 5 5h24a5 5 0 0 0 5-5V21.5c0-.8-.7-1.5-1.5-1.5M23 42c0 .6-.4 1-1 1h-2c-.6 0-1-.4-1-1V28c0-.6.4-1 1-1h2c.6 0 1 .4 1 1zm10 0c0 .6-.4 1-1 1h-2c-.6 0-1-.4-1-1V28c0-.6.4-1 1-1h2c.6 0 1 .4 1 1z"/></svg>
      </button>
    </div>
  </li>`;
}

function renderProfileChip() {
  const active = state.profiles.find(p => p.id === state.settings.activeProfileId);
  if (!active) return;
  document.getElementById('profile-chip-name').textContent = active.name;
  document.getElementById('profile-chip-dot').style.background = profileColor(active.id);
}

function renderProfileDropdown() {
  const dropdown = document.getElementById('profile-dropdown');
  const active   = state.settings.activeProfileId;

  dropdown.innerHTML = `
    <div class="profile-dropdown-header">Profiles</div>
    ${state.profiles.map(p => `
      <button class="profile-option" role="option"
        aria-selected="${p.id === active}"
        data-profile-id="${p.id}">
        <span class="profile-option-dot" style="background:${profileColor(p.id)}"></span>
        <span>${esc(p.name)}</span>
        ${p.id === active ? `<span class="profile-option-check" aria-hidden="true">✓</span>` : ''}
      </button>
    `).join('')}`;
}

// ── View management ────────────────────────────────────────────

function showView(viewName) {
  const tray  = document.getElementById('panel-tray');
  const views = ['edit-tab', 'settings', 'release-notes', 'dropdowns'];

  if (viewName === 'empty') {
    tray.classList.remove('is-open');
    views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) el.hidden = true;
    });
  } else {
    views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) el.hidden = (v !== viewName);
    });
    tray.classList.add('is-open');
  }

  // Clear editing highlight unless we're showing the edit form or dropdowns
  if (viewName !== 'edit-tab' && viewName !== 'dropdowns') {
    clearEditingHighlight();
  }

  state.activeView = viewName;

  const settingsBtn = document.getElementById('btn-footer-settings');
  if (settingsBtn) settingsBtn.setAttribute('aria-pressed', viewName === 'settings' ? 'true' : 'false');
}

function clearEditingHighlight() {
  document.querySelectorAll('.tab-item.is-editing').forEach(el => el.classList.remove('is-editing'));
  document.getElementById('tab-list').classList.remove('has-editing');
}

// ── Edit form ──────────────────────────────────────────────────

function openEditTab(tabId) {
  const tab = state.tabs.find(t => t.id === tabId);
  if (!tab) return;

  state.editingTabId = tabId;

  // Highlight the tab being edited, dim the others
  document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('is-editing'));
  document.getElementById('tab-list').classList.add('has-editing');
  const tabEl = document.querySelector(`.tab-item[data-id="${tabId}"]`);
  if (tabEl) tabEl.classList.add('is-editing');

  document.getElementById('edit-panel-title').textContent    = 'Edit Tab';
  document.getElementById('edit-panel-subtitle').textContent = `Editing "${tab.label}"`;
  document.getElementById('input-tab-name').value    = tab.label;
  document.getElementById('input-tab-path').value    = tab.path || '';
  document.getElementById('input-is-object').checked    = !!tab.isObject;
  document.getElementById('input-is-custom-url').checked = !!tab.isCustomUrl;
  document.getElementById('input-open-new-tab').checked  = !!tab.openInNewTab;
  updateCharCount('input-tab-name', 'tab-name-count', 30);

  showView('edit-tab');
  document.getElementById('input-tab-name').focus();
}

function openAddTab() {
  state.editingTabId = null;

  document.getElementById('edit-panel-title').textContent    = 'Add Tab';
  document.getElementById('edit-panel-subtitle').textContent = 'Create a new custom navigation tab.';
  document.getElementById('input-tab-name').value    = '';
  document.getElementById('input-tab-path').value    = '';
  document.getElementById('input-is-object').checked    = false;
  document.getElementById('input-is-custom-url').checked = false;
  document.getElementById('input-open-new-tab').checked  = false;
  updateCharCount('input-tab-name', 'tab-name-count', 30);

  showView('edit-tab');
  document.getElementById('input-tab-name').focus();
}

function openDropdownManagement(tabId) {
  const tab = state.tabs.find(t => t.id === tabId);
  if (!tab) return;

  state.editingTabId = tabId;

  // Highlight the tab being edited
  document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('is-editing'));
  document.getElementById('tab-list').classList.add('has-editing');
  const tabEl = document.querySelector(`.tab-item[data-id="${tabId}"]`);
  if (tabEl) tabEl.classList.add('is-editing');

  state.editingItemPath = null;
  state.addingItemUnder = null;
  document.getElementById('dropdown-title').textContent = 'Manage Items';
  document.getElementById('dropdown-subtitle').textContent = `Items in "${tab.label}"`;

  renderDropdownItems(tabId);
  showView('dropdowns');
}

function renderDropdownItems(tabId) {
  const tab = state.tabs.find(t => t.id === tabId);
  if (!tab) return;

  const list = document.getElementById('dropdown-items-list');
  const items = tab.dropdownItems || [];
  list.innerHTML = '';

  document.getElementById('dropdown-subtitle').textContent =
    `${countItems(items)} item${countItems(items) === 1 ? '' : 's'} in "${tab.label}"`;

  const scrapeBtn = document.getElementById('btn-scrape-object');
  scrapeBtn.hidden = !isObjectManagerTab(tab);
  document.getElementById('scrape-object-label').textContent =
    items.length ? 'Refresh items from this page' : 'Load items from this page';

  if (!items.length && !state.addingItemUnder) {
    list.innerHTML = `<li class="dropdown-empty">No items yet</li>`;
  }

  walkVisibleItems(items).forEach(({ item, path, level }) => {
    list.appendChild(
      pathKey(path) === pathKey(state.editingItemPath || [])
        ? itemEditRow(item, path, level)
        : itemRow(item, path, level)
    );
    // Inline "add child" form directly under its parent
    if (state.addingItemUnder && pathKey(state.addingItemUnder) === pathKey(path)) {
      list.appendChild(itemEditRow({ label: '', path: '' }, null, level + 1));
    }
  });

  // Root-level add form
  if (state.addingItemUnder && !state.addingItemUnder.length) {
    list.appendChild(itemEditRow({ label: '', path: '' }, null, 0));
  }

  bindItemDrag();
}

/** A single item row — same anatomy as a tab row so the two lists read alike. */
function itemRow(item, path, level) {
  const li = document.createElement('li');
  li.className = 'tab-item dropdown-item';
  li.style.marginLeft = `${level * 20}px`;
  li.dataset.path = pathKey(path);

  const children  = item.dropdownItems || [];
  const expanded  = state.expandedPaths.has(pathKey(path));
  const numbering = path.map(i => i + 1).join('.');
  // level is 0-based: a level-0 row is a child, so it may still take grandchildren
  const canNest   = level + 2 <= MAX_ITEM_DEPTH;
  const label     = esc(item.label);

  li.innerHTML = `
    <div class="drag-handle" aria-hidden="true" title="Drag to reorder">
      <div class="drag-dots"><span></span><span></span><span></span><span></span><span></span><span></span></div>
    </div>
    ${children.length
      ? `<button class="dropdown-twisty" data-action="toggle-item" data-path="${pathKey(path)}"
           aria-expanded="${expanded}" aria-label="${expanded ? 'Collapse' : 'Expand'} ${label}">
           <svg viewBox="0 0 520 520" fill="currentColor" aria-hidden="true"><path d="M476 178 271 385c-6 6-16 6-22 0L44 178c-6-6-6-16 0-22l22-22c6-6 16-6 22 0l161 163c6 6 16 6 22 0l161-162c6-6 16-6 22 0l22 22c5 6 5 15 0 21"/></svg>
         </button>`
      : `<span class="dropdown-twisty-spacer" aria-hidden="true"></span>`}
    <div class="tab-info">
      <div class="tab-info-top">
        <span class="tab-name"><span class="dropdown-item-num">${numbering}.</span> ${label}</span>
        ${children.length ? `<span class="tab-count is-static">${children.length}<span class="sr-only"> sub-items</span></span>` : ''}
      </div>
      ${item.path ? `<span class="tab-path">${esc(item.path)}</span>` : ''}
    </div>
    <div class="tab-actions" role="group" aria-label="Actions for ${label}">
      ${canNest ? `<button class="tab-btn tab-btn--group" data-action="add-child" data-path="${pathKey(path)}"
        aria-label="Add an item under ${label}" title="Add sub-item">
        <svg viewBox="0 0 520 520" fill="currentColor" aria-hidden="true"><path d="M300 290h165c8 0 15-7 15-15v-30c0-8-7-15-15-15H300c-6 0-10-4-10-10V55c0-8-7-15-15-15h-30c-8 0-15 7-15 15v165c0 6-4 10-10 10H55c-8 0-15 7-15 15v30c0 8 7 15 15 15h165c6 0 10 4 10 10v165c0 8 7 15 15 15h30c8 0 15-7 15-15V300c0-6 4-10 10-10"/></svg>
      </button>` : ''}
      <button class="tab-btn tab-btn--edit" data-action="edit-item" data-path="${pathKey(path)}"
        aria-label="Edit ${label}" title="Edit">
        <svg viewBox="0 0 520 520" fill="currentColor" aria-hidden="true"><path d="m95 334 89 89c4 4 10 4 14 0l222-223c4-4 4-10 0-14l-88-88a10 10 0 0 0-14 0L95 321c-4 4-4 10 0 13M361 57a10 10 0 0 0 0 14l88 88c4 4 10 4 14 0l25-25a38 38 0 0 0 0-55l-47-47a40 40 0 0 0-57 0zM21 482c-2 10 7 19 17 17l109-26c4-1 7-3 9-5l2-2c2-2 3-9-1-13l-90-90c-4-4-11-3-13-1l-2 2a20 20 0 0 0-5 9z"/></svg>
      </button>
      <button class="tab-btn tab-btn--promote" data-action="promote-item" data-path="${pathKey(path)}"
        aria-label="${path.length === 1 ? `Move ${label} out to its own tab` : `Move ${label} up one level`}"
        title="${path.length === 1 ? 'Move out to its own tab' : 'Move up one level'}">
        <svg viewBox="0 0 520 520" fill="currentColor" aria-hidden="true"><path d="M35 440c-7 0-15 7-15 15v30c0 8 8 15 15 15h239c8 0 16-8 16-15V153c0-9 10-13 17-7l56 56c6 6 15 6 21 0l21-21c6-6 6-15 0-21L270 24c-6-6-15-6-21 0L114 159c-6 6-6 15 0 21l21 21c6 6 15 6 21 0l56-56c6-6 18-2 18 7v273c0 16-16 15-16 15z"/></svg>
      </button>
      <button class="tab-btn tab-btn--delete" data-action="delete-item" data-path="${pathKey(path)}"
        aria-label="Delete ${label}" title="Delete">
        <svg viewBox="0 0 52 52" fill="currentColor" aria-hidden="true"><path d="M45.5 10H33V6a4 4 0 0 0-4-4h-6a4 4 0 0 0-4 4v4H6.5c-.8 0-1.5.7-1.5 1.5v3c0 .8.7 1.5 1.5 1.5h39c.8 0 1.5-.7 1.5-1.5v-3c0-.8-.7-1.5-1.5-1.5M23 7c0-.6.4-1 1-1h4c.6 0 1 .4 1 1v3h-6zm18.5 13h-31c-.8 0-1.5.7-1.5 1.5V45a5 5 0 0 0 5 5h24a5 5 0 0 0 5-5V21.5c0-.8-.7-1.5-1.5-1.5M23 42c0 .6-.4 1-1 1h-2c-.6 0-1-.4-1-1V28c0-.6.4-1 1-1h2c.6 0 1 .4 1 1zm10 0c0 .6-.4 1-1 1h-2c-.6 0-1-.4-1-1V28c0-.6.4-1 1-1h2c.6 0 1 .4 1 1z"/></svg>
      </button>
    </div>`;
  return li;
}

// ── ObjectManager auto-population ──────────────────────────────
// Asks the content script to parse the object's left-hand Setup nav and
// turns those links into sub-items. Ported from popup-dropdown.js; the
// tab-resolution guesswork isn't needed here because the panel already
// knows which tab it's editing.

/** Object API name from a tab path like "ObjectManager/Account/details". */
function objectNameFromPath(path = '') {
  const m = path.match(/ObjectManager\/([^/]+)/i);
  return m ? m[1] : null;
}

function isObjectManagerTab(tab) {
  return !!objectNameFromPath(tab?.path || '');
}

async function scrapeObjectNavigation() {
  const tab = state.tabs.find(t => t.id === state.editingTabId);
  if (!tab) return;

  const wantedObject = objectNameFromPath(tab.path);
  const btn = document.getElementById('btn-scrape-object');
  const label = document.getElementById('scrape-object-label');
  const original = label.textContent;
  btn.disabled = true;
  label.textContent = 'Loading…';

  try {
    const [active] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!active) {
      showStatus('No active browser tab detected.', 'error');
      return;
    }

    // The shim resolves to null instead of rejecting when no receiver exists
    const res = await browser.tabs.sendMessage(active.id, { action: 'parse_navigation' });
    if (!res) {
      showStatus(`Open the ${wantedObject} Object Manager page in Setup, then try again.`, 'error');
      return;
    }
    if (res.success === false) {
      showStatus(res.error || 'Could not read the page navigation.', 'error');
      return;
    }

    const items = res.items || res.navigation || [];
    if (!items.length) {
      showStatus('No navigation items found on this page.', 'error');
      return;
    }
    if (res.pageInfo && res.pageInfo.type !== 'objectManager') {
      showStatus(`Go to ${wantedObject} in Setup to load its list.`, 'error');
      return;
    }
    // Guard against pulling Contact's nav into the Account tab
    if (wantedObject && res.objectName &&
        wantedObject.toLowerCase() !== res.objectName.toLowerCase()) {
      showStatus(
        `This tab is for "${wantedObject}" but you're viewing "${res.objectName}".`, 'error');
      return;
    }

    // Store only canonical fields — the parser also returns id/dataList/
    // isActive/order, which production leaks into storage.
    const previous = countItems(tab.dropdownItems);
    tab.dropdownItems = items.map(i => ({
      label: i.label,
      path: i.path || i.url || '',
      isObject: false,
      isCustomUrl: false
    }));

    state.expandedPaths.clear();
    showStatus(previous
      ? `Replaced ${previous} item${previous === 1 ? '' : 's'} with ${items.length} from ${res.objectName || wantedObject}`
      : `Added ${items.length} items from ${res.objectName || wantedObject}`);

    renderDropdownItems(state.editingTabId);
    renderTabList();
    bindTabListEvents();
    persistTabs();
  } catch (err) {
    showStatus(`Could not load navigation: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    label.textContent = original;
  }
}

// ── Dropdown item actions ──────────────────────────────────────

/** Save an inline edit, or add a new item when `path` is null. */
function commitDropdownItem(path) {
  const tab = state.tabs.find(t => t.id === state.editingTabId);
  if (!tab) return;

  const label = document.getElementById('item-label').value.trim();
  const itemPath = document.getElementById('item-path').value.trim();
  if (!label) {
    showStatus('Item label is required.', 'error');
    document.getElementById('item-label').focus();
    return;
  }

  if (path) {
    const item = getItemByPath(tab.dropdownItems, path);
    if (item) { item.label = label; item.path = itemPath; }
    showStatus(`"${label}" saved`);
  } else {
    const parentPath = state.addingItemUnder || [];
    const newItem = { label, path: itemPath, isObject: false, isCustomUrl: false };
    if (!parentPath.length) {
      tab.dropdownItems = tab.dropdownItems || [];
      tab.dropdownItems.push(newItem);
    } else {
      const parent = getItemByPath(tab.dropdownItems, parentPath);
      if (!parent) return;
      parent.dropdownItems = parent.dropdownItems || [];
      parent.dropdownItems.push(newItem);
    }
    showStatus(`"${label}" added`);
  }

  state.editingItemPath = null;
  state.addingItemUnder = null;
  renderDropdownItems(state.editingTabId);
  renderTabList();
  bindTabListEvents();
  persistTabs();
}

/**
 * Sub-items and tabs store paths differently: an item keeps the parser's full
 * "/lightning/setup/..." path and is navigated as origin+path, while a tab
 * stores a bare "ObjectManager/..." path that the navigator prefixes with
 * "/lightning/setup/". Promoting has to translate, or the prefix doubles up.
 */
function itemPathToTabFields(item) {
  const path = item.path || '';

  if (item.isCustomUrl) return { path, isObject: false, isCustomUrl: true };
  if (item.isObject)    return { path, isObject: true,  isCustomUrl: false };

  if (path.startsWith('/lightning/setup/')) {
    return { path: path.slice('/lightning/setup/'.length), isObject: false, isCustomUrl: false };
  }
  if (path.startsWith('/lightning/o/')) {
    return { path: path.slice('/lightning/o/'.length), isObject: true, isCustomUrl: false };
  }
  // Any other absolute path (/lightning/n/..., /apex/...) is a custom URL
  if (path.startsWith('/')) return { path, isObject: false, isCustomUrl: true };

  return { path, isObject: false, isCustomUrl: false };
}

/**
 * Move an item out one level, carrying its own children with it.
 *   grandchild -> becomes a sibling of its parent, just below it
 *   child      -> becomes its own top-level tab
 * Depth never increases here, so no limit check is needed.
 */
function promoteDropdownItem(path) {
  const tab = state.tabs.find(t => t.id === state.editingTabId);
  if (!tab) return;

  const item = getItemByPath(tab.dropdownItems, path);
  if (!item) return;

  const moving = JSON.parse(JSON.stringify(item));
  const childCount = countItems(moving.dropdownItems);
  const withKids = childCount ? ` with ${childCount} item${childCount === 1 ? '' : 's'}` : '';

  removeItemByPath(tab.dropdownItems, path);

  if (path.length === 1) {
    // Already a direct child — the next level up is the tab list itself
    const asTab = itemPathToTabFields(moving);
    state.tabs.push({
      id: SFTabs.utils.generateId(),
      label: moving.label,
      path: asTab.path,
      openInNewTab: false,
      isObject: asTab.isObject,
      isCustomUrl: asTab.isCustomUrl,
      isSetupObject: asTab.path.startsWith('ObjectManager/'),
      dropdownItems: moving.dropdownItems || [],
      position: state.tabs.length
    });
    showStatus(`"${moving.label}" moved out to its own tab${withKids}`);
  } else {
    // Insert directly after the former parent, in the parent's own list
    const parentPath = path.slice(0, -1);
    const list = getParentList(tab.dropdownItems, parentPath);
    if (!list) return;
    list.splice(parentPath[parentPath.length - 1] + 1, 0, moving);
    showStatus(`"${moving.label}" moved up a level${withKids}`);
  }

  state.expandedPaths.clear(); // paths shifted underneath us

  renderDropdownItems(state.editingTabId);
  renderTabList();
  bindTabListEvents();
  persistTabs();
}

function deleteDropdownItem(path) {
  const tab = state.tabs.find(t => t.id === state.editingTabId);
  if (!tab) return;
  const item = getItemByPath(tab.dropdownItems, path);
  if (!item) return;

  const childCount = countItems(item.dropdownItems);
  if (!state.settings.skipDeleteConfirmation) {
    const extra = childCount ? ` and its ${childCount} nested item${childCount === 1 ? '' : 's'}` : '';
    if (!confirm(`Delete "${item.label}"${extra}?`)) return;
  }

  removeItemByPath(tab.dropdownItems, path);
  state.expandedPaths.clear();
  showStatus('Item deleted');

  renderDropdownItems(state.editingTabId);
  renderTabList();
  bindTabListEvents();
  persistTabs();
}

/** Inline editor. `path` null means this is a new item being added. */
function itemEditRow(item, path, level) {
  const li = document.createElement('li');
  li.className = 'dropdown-item dropdown-item--editing';
  li.style.marginLeft = `${level * 20}px`;
  li.innerHTML = `
    <div class="dropdown-item-fields">
      <input type="text" class="form-input" id="item-label" placeholder="Label"
             value="${esc(item.label || '')}" maxlength="30" autocomplete="off" />
      <input type="text" class="form-input" id="item-path" placeholder="Path or URL"
             value="${esc(item.path || '')}" autocomplete="off" />
      <div class="dropdown-item-fields-actions">
        <button class="btn-secondary" data-action="cancel-item">Cancel</button>
        <button class="btn-primary" data-action="commit-item"
                data-path="${path ? pathKey(path) : ''}">${path ? 'Save' : 'Add'}</button>
      </div>
    </div>`;
  return li;
}

function saveTab(e) {
  e.preventDefault();
  const nameInput = document.getElementById('input-tab-name');
  const name = nameInput.value.trim();

  if (!name) {
    document.getElementById('tab-name-error').hidden = false;
    nameInput.setAttribute('aria-invalid', 'true');
    nameInput.focus();
    return;
  }
  document.getElementById('tab-name-error').hidden = true;
  nameInput.removeAttribute('aria-invalid');

  const updates = {
    label:       name,
    path:        document.getElementById('input-tab-path').value.trim(),
    isObject:    document.getElementById('input-is-object').checked,
    isCustomUrl: document.getElementById('input-is-custom-url').checked,
    openInNewTab:document.getElementById('input-open-new-tab').checked,
  };

  if (state.editingTabId) {
    // Update existing
    state.tabs = state.tabs.map(t =>
      t.id === state.editingTabId ? { ...t, ...updates } : t
    );
    showStatus(`"${name}" saved`);
  } else {
    // Create new
    const newTab = {
      id:           SFTabs.utils.generateId(),
      position:     state.tabs.length,
      dropdownItems:[],
      isSetupObject:false,
      ...updates,
    };
    state.tabs = [...state.tabs, newTab];
    showStatus(`"${name}" added`);
  }

  renderTabList();
  bindTabListEvents();
  showView('empty');
  persistTabs();
}

// ── Tab actions ────────────────────────────────────────────────

function promptDeleteTab(tabId) {
  const tab = state.tabs.find(t => t.id === tabId);
  if (!tab) return;

  if (state.settings.skipDeleteConfirmation) {
    confirmDelete(tabId);
    return;
  }
  // Show modal
  document.getElementById('modal-delete-name').textContent = tab.label;
  state.pendingDeleteId = tabId;
  document.getElementById('modal-delete').hidden = false;
  document.getElementById('modal-delete-cancel').focus();
}

function confirmDelete(tabId) {
  const id = tabId || state.pendingDeleteId;
  state.tabs = state.tabs.filter(t => t.id !== id);
  state.pendingDeleteId = null;
  document.getElementById('modal-delete').hidden = true;
  renderTabList();
  bindTabListEvents();
  if (state.editingTabId === id) showView('empty');
  showStatus('Tab deleted');
  persistTabs();
}

function toggleNewTab(tabId) {
  state.tabs = state.tabs.map(t =>
    t.id === tabId ? { ...t, openInNewTab: !t.openInNewTab } : t
  );
  renderTabList();
  bindTabListEvents();
  persistTabs();
}

function moveTab(tabId, direction) {
  const sorted = state.tabs.slice().sort((a, b) => a.position - b.position);
  const idx = sorted.findIndex(t => t.id === tabId);
  if (idx === -1) return;
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= sorted.length) return;

  // Swap positions
  const tempPos = sorted[idx].position;
  sorted[idx].position = sorted[swapIdx].position;
  sorted[swapIdx].position = tempPos;

  state.tabs = sorted;
  renderTabList();
  bindTabListEvents();

  // Restore focus to the moved tab
  const movedTab = document.querySelector(`[data-id="${tabId}"]`);
  if (movedTab) movedTab.focus();
  persistTabs();
}

// ── Profile switching ──────────────────────────────────────────

async function switchProfile(profileId) {
  await patchSettings({ activeProfileId: profileId });
  state.tabs = await SFTabs.storage.getProfileTabs(profileId) || [];
  renderTabList();
  bindTabListEvents();
  renderProfileChip();
  renderProfileDropdown();
  closeProfileDropdown();
  showStatus(`Switched to ${state.profiles.find(p => p.id === profileId)?.name || 'profile'}`);
}

function openProfileDropdown() {
  state.profileDropdownOpen = true;
  const dropdown = document.getElementById('profile-dropdown');
  dropdown.hidden = false;
  document.getElementById('btn-profile-switcher').setAttribute('aria-expanded', 'true');
  dropdown.querySelector('.profile-option')?.focus();
}

function closeProfileDropdown() {
  state.profileDropdownOpen = false;
  const dropdown = document.getElementById('profile-dropdown');
  dropdown.hidden = true;
  document.getElementById('btn-profile-switcher').setAttribute('aria-expanded', 'false');
}

// ── Theme ──────────────────────────────────────────────────────

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', theme);
  }
  state.settings.themeMode = theme;
}

/**
 * Display density. Sets data-density on <html>; the --sft-*-var-* hooks in
 * tokens.css resolve to SLDS compact values, so components that use those
 * hooks reflow without any per-component overrides.
 */
function applyDensity(isCompact) {
  document.documentElement.setAttribute('data-density', isCompact ? 'compact' : 'comfy');
}

// ── Settings panel ─────────────────────────────────────────────

function syncSettingsPanel() {
  const themeButtons = document.querySelectorAll('.seg-btn[data-theme-val]');
  themeButtons.forEach(btn => {
    const active = btn.dataset.themeVal === state.settings.themeMode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  document.getElementById('setting-compact').checked       = state.settings.compactMode;
  document.getElementById('setting-skip-delete').checked   = state.settings.skipDeleteConfirmation;
  document.getElementById('setting-profiles').checked      = state.settings.profilesEnabled;
  const storageRadio = document.querySelector(`input[name="storage-type"][value="${state.settings.useSyncStorage ? 'sync' : 'local'}"]`);
  if (storageRadio) storageRadio.checked = true;
}

// ── Toast ──────────────────────────────────────────────────────

let statusTimer = null;
function showStatus(msg, type = 'success') {
  const region = document.getElementById('status-region');
  region.textContent = msg;
  region.className = `status-region status-${type}`;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    region.textContent = '';
    region.className = 'status-region';
  }, 4800); // SLDS duration-toast-short
}

// ── Char counter ───────────────────────────────────────────────

function updateCharCount(inputId, countId, max) {
  const val = document.getElementById(inputId)?.value.length || 0;
  const el  = document.getElementById(countId);
  if (el) el.textContent = `${val}/${max}`;
}

// ── Helpers ────────────────────────────────────────────────────

function tabType(tab) {
  if (tab.isCustomUrl)   return 'custom';
  if (tab.isSetupObject) return 'setup';
  if (tab.isObject)      return 'object';
  return 'standard';
}

function tabBadgeLabel(type) {
  return { object: 'Obj', setup: 'Setup', custom: 'URL', standard: 'Tab' }[type] || 'Tab';
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Event binding ──────────────────────────────────────────────

function bindEvents() {
  // Header
  document.getElementById('btn-profile-switcher').addEventListener('click', () => {
    state.profileDropdownOpen ? closeProfileDropdown() : openProfileDropdown();
  });

  document.getElementById('btn-release-notes').addEventListener('click', () => {
    // Fresh decision each time the panel opens
    document.getElementById('dismiss-release-notes').checked = false;
    showView('release-notes');
  });

  // Toolbar
  document.getElementById('btn-add-tab').addEventListener('click', openAddTab);
  document.getElementById('btn-quick-add').addEventListener('click', () => {
    // Production's parser handles setup pages, ObjectManager, object lists and
    // custom URLs, and derives the tab name from the page title.
    SFTabs.tabs.enhancedAddTabForCurrentPage();
  });
  // btn-empty-add-tab no longer in DOM (empty state moved to left panel)

  // Edit form
  document.getElementById('form-edit-tab').addEventListener('submit', saveTab);
  document.getElementById('btn-close-edit').addEventListener('click', () => showView('empty'));
  document.getElementById('btn-cancel-edit').addEventListener('click', () => showView('empty'));
  document.getElementById('input-tab-name').addEventListener('input', (e) => {
    updateCharCount('input-tab-name', 'tab-name-count', 30);
    document.getElementById('tab-name-error').hidden = true;
    e.target.removeAttribute('aria-invalid');
  });

  // Settings
  document.getElementById('btn-footer-settings').addEventListener('click', () => {
    if (state.activeView === 'settings') {
      showView('empty');
    } else {
      syncSettingsPanel();
      showView('settings');
    }
  });

  document.querySelectorAll('.seg-btn[data-theme-val]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.seg-btn[data-theme-val]').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      applyTheme(btn.dataset.themeVal);
      patchSettings({ themeMode: btn.dataset.themeVal });
    });
  });

  document.getElementById('setting-compact').addEventListener('change', e => {
    applyDensity(e.target.checked);
    patchSettings({ compactMode: e.target.checked });
  });

  document.getElementById('setting-skip-delete').addEventListener('change', e => {
    patchSettings({ skipDeleteConfirmation: e.target.checked });
  });

  document.getElementById('setting-profiles').addEventListener('change', e => {
    patchSettings({ profilesEnabled: e.target.checked });
    document.querySelector('.header-center').style.visibility = e.target.checked ? 'visible' : 'hidden';
  });

  document.getElementById('btn-preview-first-launch').addEventListener('click', () => {
    runFirstLaunchWizard({ preview: true });
  });

  document.getElementById('btn-advanced-settings').addEventListener('click', e => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('popup/settings.html') });
  });

  // Footer theme toggle

  // Release notes — both exits honour the "don't show again" checkbox
  document.getElementById('btn-close-release-notes').addEventListener('click', closeReleaseNotes);
  document.getElementById('btn-got-it').addEventListener('click', closeReleaseNotes);

  // Dropdown management
  document.getElementById('btn-close-dropdowns').addEventListener('click', () => {
    showView('empty');
  });

  document.getElementById('btn-scrape-object').addEventListener('click', scrapeObjectNavigation);

  document.getElementById('btn-add-dropdown-item').addEventListener('click', () => {
    state.addingItemUnder = [];
    state.editingItemPath = null;
    renderDropdownItems(state.editingTabId);
    document.getElementById('item-label')?.focus();
  });

  document.getElementById('dropdown-items-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const path = btn.dataset.path ? btn.dataset.path.split('.').map(Number) : [];

    switch (btn.dataset.action) {
      case 'toggle-item': {
        const key = pathKey(path);
        state.expandedPaths.has(key)
          ? state.expandedPaths.delete(key)
          : state.expandedPaths.add(key);
        renderDropdownItems(state.editingTabId);
        break;
      }
      case 'add-child':
        state.addingItemUnder = path;
        state.editingItemPath = null;
        state.expandedPaths.add(pathKey(path)); // reveal where it will land
        renderDropdownItems(state.editingTabId);
        document.getElementById('item-label')?.focus();
        break;
      case 'edit-item':
        state.editingItemPath = path;
        state.addingItemUnder = null;
        renderDropdownItems(state.editingTabId);
        document.getElementById('item-label')?.focus();
        break;
      case 'cancel-item':
        state.editingItemPath = null;
        state.addingItemUnder = null;
        renderDropdownItems(state.editingTabId);
        break;
      case 'commit-item':
        commitDropdownItem(btn.dataset.path ? path : null);
        break;
      case 'promote-item':
        promoteDropdownItem(path);
        break;
      case 'delete-item':
        deleteDropdownItem(path);
        break;
    }
  });

  // Modal: delete
  document.getElementById('modal-delete-cancel').addEventListener('click', () => {
    document.getElementById('modal-delete').hidden = true;
    state.pendingDeleteId = null;
  });
  document.getElementById('modal-delete-confirm').addEventListener('click', () => confirmDelete());

  // Profile dropdown
  document.getElementById('profile-dropdown').addEventListener('click', e => {
    const option = e.target.closest('.profile-option');
    if (option) switchProfile(option.dataset.profileId);
  });

  // Close dropdown on outside click
  document.addEventListener('click', e => {
    if (state.profileDropdownOpen &&
        !e.target.closest('#profile-dropdown') &&
        !e.target.closest('#btn-profile-switcher')) {
      closeProfileDropdown();
    }
  });

  // Close modal on overlay click
  document.getElementById('modal-delete').addEventListener('click', e => {
    if (e.target === e.currentTarget) {
      document.getElementById('modal-delete').hidden = true;
      state.pendingDeleteId = null;
    }
  });

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!document.getElementById('modal-delete').hidden) {
        document.getElementById('modal-delete').hidden = true;
        state.pendingDeleteId = null;
      } else if (state.profileDropdownOpen) {
        closeProfileDropdown();
        document.getElementById('btn-profile-switcher').focus();
      } else if (state.activeView !== 'empty') {
        showView('empty');
      }
    }
  });

  bindTabListEvents();
}

const handleTabListClick = e => {
  const btn = e.target.closest('[data-action]');
  if (btn) {
    const { action, id } = btn.dataset;
    if (action === 'edit')        openEditTab(id);
    if (action === 'delete')      promptDeleteTab(id);
    if (action === 'toggle-newtab') toggleNewTab(id);
    if (action === 'move-up')     moveTab(id, 'up');
    if (action === 'move-down')   moveTab(id, 'down');
    if (action === 'manage-items') {
      // Toggle: clicking the same tab's icon again closes the panel
      if (state.activeView === 'dropdowns' && state.editingTabId === id) showView('empty');
      else openDropdownManagement(id);
    }
    return;
  }
  // Clicking the row body (not an action button) navigates
  const row = e.target.closest('.tab-item');
  if (row) navigateToTab(state.tabs.find(t => t.id === row.dataset.id));
};

/**
 * Build the destination URL from the ACTIVE tab's org URL and navigate.
 * (The production popup derives this from its own window.location, which in
 * a popup is the extension URL — that produces a broken destination.)
 */
async function navigateToTab(tab) {
  if (!tab) return;
  try {
    const [active] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!active || !active.url) {
      showStatus('No active browser tab detected.', 'error');
      return;
    }
    const origin = active.url.split('/lightning/')[0];
    const path   = tab.path || '';
    let url;

    if (tab.isCustomUrl) {
      url = /^https?:\/\//i.test(path) ? path : origin + (path.startsWith('/') ? path : `/${path}`);
    } else if (path.startsWith('/lightning/')) {
      url = origin + path;            // already fully qualified
    } else if (tab.isObject) {
      url = `${origin}/lightning/o/${path}`;
    } else if (path.includes('ObjectManager/')) {
      url = `${origin}/lightning/setup/${path}`;
    } else {
      url = `${origin}/lightning/setup/${path}/home`;
    }

    if (tab.openInNewTab) {
      await browser.tabs.create({ url });
    } else {
      try {
        await browser.tabs.sendMessage(active.id, {
          action: 'navigate_to_url', url, useLightning: true
        });
      } catch {
        // Content script not present on this page — navigate directly
        await browser.tabs.update(active.id, { url });
      }
    }
    window.close();
  } catch (err) {
    showStatus(`Could not navigate: ${err.message}`, 'error');
  }
}

function bindTabListEvents() {
  const tabList = document.getElementById('tab-list');
  tabList.removeEventListener('click', handleTabListClick);
  tabList.addEventListener('click', handleTabListClick);
  bindTabDrag();
}
