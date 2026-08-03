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

// ── i18n ───────────────────────────────────────────────────────

/**
 * Localized string. Static copy in popup.html is handled by i18n-helper.js;
 * this is for anything this file builds at runtime, which that DOM pass never
 * sees. Returns the key when it is missing, so a typo is visible not blank.
 */
function t(key, ...subs) {
  return chrome.i18n.getMessage(key, subs.map(String)) || key;
}

/**
 * Icons drawn in more than one row template.
 *
 * Vendored SLDS utility paths — icons/slds/delete.svg and edit.svg — hoisted
 * because the delete glyph alone had been pasted four times, in wrappers that
 * had already drifted apart on the focusable attribute. Long enough that a
 * divergent copy would not be caught in review. Single-use icons stay inline,
 * where they read better than an indirection.
 */
const ICON_DELETE = '<svg viewBox="0 0 52 52" fill="currentColor" aria-hidden="true" focusable="false"><path d="M45.5 10H33V6a4 4 0 0 0-4-4h-6a4 4 0 0 0-4 4v4H6.5c-.8 0-1.5.7-1.5 1.5v3c0 .8.7 1.5 1.5 1.5h39c.8 0 1.5-.7 1.5-1.5v-3c0-.8-.7-1.5-1.5-1.5M23 7c0-.6.4-1 1-1h4c.6 0 1 .4 1 1v3h-6zm18.5 13h-31c-.8 0-1.5.7-1.5 1.5V45a5 5 0 0 0 5 5h24a5 5 0 0 0 5-5V21.5c0-.8-.7-1.5-1.5-1.5M23 42c0 .6-.4 1-1 1h-2c-.6 0-1-.4-1-1V28c0-.6.4-1 1-1h2c.6 0 1 .4 1 1zm10 0c0 .6-.4 1-1 1h-2c-.6 0-1-.4-1-1V28c0-.6.4-1 1-1h2c.6 0 1 .4 1 1z"/></svg>';
const ICON_EDIT = '<svg viewBox="0 0 520 520" fill="currentColor" aria-hidden="true" focusable="false"><path d="m95 334 89 89c4 4 10 4 14 0l222-223c4-4 4-10 0-14l-88-88a10 10 0 0 0-14 0L95 321c-4 4-4 10 0 13M361 57a10 10 0 0 0 0 14l88 88c4 4 10 4 14 0l25-25a38 38 0 0 0 0-55l-47-47a40 40 0 0 0-57 0zM21 482c-2 10 7 19 17 17l109-26c4-1 7-3 9-5l2-2c2-2 3-9-1-13l-90-90c-4-4-11-3-13-1l-2 2a20 20 0 0 0-5 9z"/></svg>';

// ── State ──────────────────────────────────────────────────────
let state = {
  tabs:            [],
  profiles:        [],
  settings:        {},
  activeView:      'empty',   // 'empty' | 'edit-tab' | 'dropdowns' | 'edit-profile'
                              //         | 'settings' | 'release-notes'
  editingProfileId: null,     // profile open in the form; null while creating
  editingColor:     null,     // color chosen in the open edit form
  editingTabId:    null,
  profileDropdownOpen: false,
  pendingDeleteId: null,
  loadError:       null,
  expandedPaths:   new Set(), // UI-only; never written to storage
  settingsSection: null,      // open Settings section id; null = the tile hub
  profileFormIsNew: false,    // the profile form is creating, not editing
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
  applyProfilesVisibility(state.settings.profilesEnabled);
  applyTheme(state.settings.themeMode);
  applyDensity(state.settings.compactMode);
  showView('empty');
  bindEvents();
  await initReleaseNotes();
  installStorageListener();
  if (state.loadError) showStatus(state.loadError, 'error');
});

/** Single source of truth for the displayed version: the manifest. */
function renderVersion() {
  const el = document.getElementById('footer-version');
  if (!el) return;
  const version = browser.runtime.getManifest().version;
  el.textContent = `v${version}`;
  el.setAttribute('aria-label', t('ariaVersion', version));
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

  showStatus(t(tabs.length === 1 ? 'migratedTabsForwardOne' : 'migratedTabsForwardMany', String(tabs.length)));
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
 * and recognizes upgrades, which matters because showing this to an existing
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

  await runFirstLaunchWizard();
}

/** Open the wizard and resolve once it closes. */
function runFirstLaunchWizard() {
  return new Promise(resolve => {
    const overlay = document.getElementById('modal-first-launch');
    if (!overlay) return resolve();

    document.getElementById('fl-start').textContent = t('firstLaunchGetStartedButton');
    overlay.hidden = false;

    document.getElementById('fl-start').addEventListener('click', async () => {
      const setup = document.querySelector('input[name="fl-setup"]:checked')?.value || 'default';
      const enableProfiles = document.getElementById('fl-enable-profiles').checked;

      try {
        await applyFirstLaunchChoice(setup, enableProfiles);
      } catch (err) {
        // Leaving storage empty is recoverable: ensureUsableState() seeds
        // defaults on the next line of init.
        state.loadError = t('errorSetupDidNotFinish', err.message);
      }
      overlay.hidden = true;
      resolve();
    }, { once: true });
  });
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
  // to import into rather than a half-initialized state.
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
      t(unread ? 'ariaViewReleaseNotesUnread' : 'ariaViewReleaseNotes'));
  }
}

async function closeReleaseNotes() {
  const dismissed = document.getElementById('dismiss-release-notes')?.checked;
  const version = releaseNotesVersion();

  if (dismissed && version) {
    try {
      await browser.storage.local.set({ seenReleaseNotesVersion: version });
      setReleaseNotesUnread(false);
      showStatus(t('releaseNotesDismissed'));
    } catch (err) {
      showStatus(t('errorCouldNotSave', err.message), 'error');
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
    // Open pages were relying solely on storage.onChanged to notice an edit,
    // which left a renamed or colored tab looking stale until a reload.
    // Switching profile has always sent this; saving a tab never did.
    // Rebuilding is idempotent, so arriving twice costs nothing.
    broadcastTabRefresh();
  } catch (err) {
    showStatus(t('errorCouldNotSave', err.message), 'error');
  }
}

/**
 * Patch settings without clobbering keys this UI doesn't model.
 * Re-reads stored settings so fields like floatingButton and
 * autoSwitchProfiles survive — never write state.settings wholesale.
 */
async function patchSettings(partial, { skipMigration = false } = {}) {
  try {
    const stored = await SFTabs.storage.getUserSettings();
    const merged = { ...stored, ...partial };
    await SFTabs.storage.saveUserSettings(merged, skipMigration, false);
    state.settings = merged;
  } catch (err) {
    showStatus(t('errorCouldNotSaveSetting', err.message), 'error');
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
    showStatus(t('nestingDepthLimit'), 'error');
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

  showStatus(t('tabNestedUnder', src.label, tgt.label));
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
    showStatus(t('nestingDepthLimit'), 'error');
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
    list.innerHTML = `<li class="tab-list-empty">${emptyStateHTML()}</li>`;
    return;
  }
  const ordered = state.tabs.slice().sort((a, b) => a.position - b.position);
  list.innerHTML = ordered.map(tab => tabItemHTML(tab)).join('');
  // Colors are inline custom properties, so they go on after the markup exists
  ordered.forEach(tab => {
    const el = list.querySelector(`.tab-item[data-id="${tab.id}"]`);
    if (el) paintTabRow(el, tab);
  });
}

/**
 * Empty state. Keeps lightning-empty-state's text anatomy -- an h3 title and a
 * description -- without an illustration.
 */
function emptyStateHTML() {
  return `<div class="empty-state">
    <h3 class="empty-state-title">${t('emptyStateTitle')}</h3>
    <p class="empty-state-desc">${t('emptyStateDesc')}</p>
  </div>`;
}

function tabItemHTML(tab) {
  const type   = tabType(tab);
  const name   = esc(tab.label);
  const path   = tab.path ? esc(tab.path) : '';
  const newTabOn = tab.openInNewTab ? 'is-on' : '';
  const newTabAriaLabel = tab.openInNewTab
    ? t('ariaOpenInNewTabOn')
    : t('ariaOpenInNewTabOff');

  return `
  <li class="tab-item" role="listitem" data-id="${tab.id}" data-type="${type}" tabindex="-1">
    <div class="drag-handle" aria-hidden="true" title="${t('dragToReorderTitle')}">
      <div class="drag-dots">
        <span></span><span></span>
        <span></span><span></span>
        <span></span><span></span>
      </div>
    </div>
    <div class="tab-info">
      <div class="tab-info-top">
        <span class="sftabs-tc-mark" aria-hidden="true"></span>
        <span class="tab-name">${name}</span>
        ${hasDropdown(tab) ? `<span class="tab-count">${countItems(tab.dropdownItems)}<span class="sr-only"> ${t('srSubItems')}</span></span>` : ''}
      </div>
      ${path ? `<span class="tab-path">${path}</span>` : ''}
      ${hasDropdown(tab) ? `<button class="tab-dropdown-note" data-action="manage-items" data-id="${tab.id}"
        >▾ ${countItems(tab.dropdownItems)} sub-item${countItems(tab.dropdownItems) === 1 ? '' : 's'}</button>` : ''}
    </div>
    <div class="tab-actions" role="group" aria-label="${t('ariaTabActions', name)}">
      <button class="tab-btn tab-btn--move tab-btn--up"
        aria-label="${t('ariaMoveUpNamed', name)}" title="${t('moveTabUp')}" data-action="move-up" data-id="${tab.id}">
        <svg viewBox="0 0 520 520" fill="currentColor" aria-hidden="true" focusable="false"><path d="M414 210c8-8 8-19 0-27L264 36a20 20 0 0 0-28 0L86 183c-8 8-8 19 0 27l28 27c8 8 20 8 28 0l47-46c8-8 22-2 22 9v270c0 10 9 20 20 20h40c11 0 20-11 20-20V200c0-12 14-17 22-9l47 46c8 8 20 8 28 0z"/></svg>
      </button>
      <button class="tab-btn tab-btn--move tab-btn--down"
        aria-label="${t('ariaMoveDownNamed', name)}" title="${t('moveTabDown')}" data-action="move-down" data-id="${tab.id}">
        <svg viewBox="0 0 520 520" fill="currentColor" aria-hidden="true" focusable="false"><path d="M96 310c-8 8-8 19 0 27l150 147c8 8 20 8 28 0l151-147c8-8 8-19 0-27l-28-27a20 20 0 0 0-28 0l-47 46c-8 8-22 3-22-9V50c0-10-9-20-20-20h-40c-11 0-20 11-20 20v270c0 12-14 17-22 9l-47-46a20 20 0 0 0-28 0z"/></svg>
      </button>
      <button class="tab-btn tab-btn--group ${hasDropdown(tab) ? 'is-on' : ''}"
        aria-label="${hasDropdown(tab) ? t('ariaManageSubItems', String(countItems(tab.dropdownItems)), name) : t('ariaAddSubItems', name)}"
        title="${t('subItemsTitle')}" data-action="manage-items" data-id="${tab.id}">
        <svg viewBox="0 0 520 520" fill="currentColor" aria-hidden="true" focusable="false"><path d="M231 230H108c-7 0-14 6-14 13v105H53c-7 0-14 7-14 14v100c0 7 7 14 14 14h137c7 0 14-7 14-14V362c0-7-7-14-14-14h-41v-64h219v64h-41c-7 0-14 7-14 14v100c0 7 7 14 14 14h137c7 0 13-7 13-14V362c0-7-6-14-13-14h-42V243c0-7-7-13-14-13H286v-64h41c7 0 13-7 13-14V52c0-7-6-14-13-14H190c-7 0-14 7-14 14v100c0 7 7 14 14 14h42v64z"/></svg>
      </button>
      <button class="tab-btn tab-btn--edit"
        aria-label="${t('ariaEditNamed', name)}" title="${t('editButton')}" data-action="edit" data-id="${tab.id}">
        ${ICON_EDIT}
      </button>
      <button class="tab-btn tab-btn--newtab ${newTabOn}"
        aria-label="${newTabAriaLabel}" aria-pressed="${!!tab.openInNewTab}"
        title="${t('tabOpenInNewTabLabel')}" data-action="toggle-newtab" data-id="${tab.id}">
        <svg viewBox="0 0 520 520" fill="currentColor" aria-hidden="true" focusable="false"><path d="M487 20H296c-8 0-16 5-16 13v30c0 8 7 17 16 17h79c9 0 14 10 7 16L212 266c-6 6-6 15 0 21l21 21c6 6 15 6 21 0l170-170c6-6 16-2 16 7v79c0 8 8 17 16 17h29c8 0 15-9 15-17V34c0-9-5-14-13-14M363 255l-34 35q-9 9-9 21v114c0 8-7 15-15 15H95c-8 0-15-7-15-15V215c0-8 7-15 15-15h115c8 0 16-3 21-9l34-34c6-6 2-17-7-17H60a40 40 0 0 0-40 40v280a40 40 0 0 0 40 40h280a40 40 0 0 0 40-40V262c0-9-11-13-17-7"/></svg>
      </button>
      <button class="tab-btn tab-btn--delete"
        aria-label="${t('ariaDeleteNamed', name)}" title="${t('deleteButtonTitle')}" data-action="delete" data-id="${tab.id}">
        ${ICON_DELETE}
      </button>
    </div>
  </li>`;
}

function renderProfileChip() {
  const active = state.profiles.find(p => p.id === state.settings.activeProfileId);
  if (!active) return;
  // Icon-only trigger, so the active profile lives in the label and tooltip
  const btn = document.getElementById('btn-profile-switcher');
  btn.setAttribute('aria-label', t('ariaSwitchProfileNamed', active.name));
  btn.title = active.name;
}

function renderProfileDropdown() {
  const dropdown = document.getElementById('profile-dropdown');
  const active   = state.settings.activeProfileId;

  dropdown.innerHTML = `
    <div class="profile-dropdown-header">${t('profilesSection')}</div>
    ${orderedProfiles().map(p => `
      <button class="profile-option" role="option"
        aria-selected="${p.id === active}"
        data-profile-id="${p.id}">
        <span class="profile-option-dot" style="background:${profileColor(p.id)}"></span>
        <span>${esc(p.name)}</span>
        ${p.id === active ? `<span class="profile-option-check" aria-hidden="true">✓</span>` : ''}
      </button>
    `).join('')}
    <button class="profile-option profile-option-new" id="btn-new-profile">
      <span aria-hidden="true">+</span>
      <span>${t('newProfileButton')}</span>
    </button>
`;

  document.getElementById('btn-new-profile').addEventListener('click', () => {
    closeProfileDropdown();
    openProfileForm(null);
  });
}

// ── Profile management ─────────────────────────────────────────

/**
 * Show a form at its top with the first field ready.
 *
 * focus() scrolls the focused element into view inside its nearest scrolling
 * ancestor, and .edit-form is one. The tray is mid-animation at that moment —
 * trayContentFadeIn applies a transform, which makes the panel a containing
 * block — and the scroll it computes lands somewhere arbitrary, so the form
 * opened already scrolled past its own first label. preventScroll declines that
 * scroll; the position is then set here, where it is not a guess.
 *
 * Reset matters on its own too: the form element is reused rather than rebuilt,
 * so it would otherwise reopen wherever it was left.
 */
function openFormAtTop(formId, inputId) {
  const form = document.getElementById(formId);
  if (form) form.scrollTop = 0;
  document.getElementById(inputId)?.focus({ preventScroll: true });
}

/**
 * Open the profile form. `profileId` null means create.
 *
 * Same anatomy as the tab form on purpose — .panel-view / .edit-form /
 * .form-group / .check-row — so the two read as one pattern.
 */
function openProfileForm(profileId) {
  const profile = profileId ? state.profiles.find(p => p.id === profileId) : null;
  state.editingProfileId = profile ? profile.id : null;
  // Tracked separately from editingProfileId, which the first autosave fills in
  // even while creating — this stays true for the life of the form.
  state.profileFormIsNew = !profile;
  renderSeedChoices();

  document.getElementById('profile-panel-title').textContent =
    t(profile ? 'editProfileTitle' : 'newProfileTitle');
  document.getElementById('profile-panel-subtitle').textContent =
    t(profile ? 'editProfileSubtitle' : 'newProfileSubtitle');

  document.getElementById('input-profile-name').value = profile ? profile.name : '';
  document.getElementById('input-profile-orgs').value = (profile?.urlPatterns || []).join('\n');
  document.getElementById('profile-name-error').hidden = true;
  document.getElementById('input-profile-name').removeAttribute('aria-invalid');
  updateCharCount('input-profile-name', 'profile-name-count', 30);

  showView('edit-profile');
  openFormAtTop('form-edit-profile', 'input-profile-name');
}

/**
 * Persist whatever the profile form currently holds.
 *
 * Returns false when there is nothing to save yet — an empty name — so the
 * autosave caller can stay quiet rather than nagging while someone is still
 * typing the first character.
 *
 * The first successful save of a new profile records its id in
 * state.editingProfileId, which is what stops every subsequent keystroke
 * creating another profile.
 */
async function persistProfileForm() {
  const name = document.getElementById('input-profile-name').value.trim();
  if (!name) return false;

  // One identifier per line, blanks dropped, de-duplicated case-insensitively
  const seen = new Set();
  const urlPatterns = document.getElementById('input-profile-orgs').value
    .split('\n').map(v => v.trim()).filter(Boolean)
    .filter(v => { const k = v.toLowerCase(); return seen.has(k) ? false : (seen.add(k), true); });

  const editing = state.editingProfileId
    ? state.profiles.find(p => p.id === state.editingProfileId)
    : null;

  const profiles = state.profiles.map(p => ({ ...p }));
  let saved;
  if (editing) {
    saved = profiles.find(p => p.id === editing.id);
    saved.name = name;
    saved.urlPatterns = urlPatterns;
  } else {
    saved = {
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      name,
      isDefault: false,
      urlPatterns,
      createdAt: new Date().toISOString(),
      lastActive: null,
      position: profiles.length
    };
    profiles.push(saved);
  }

  // Default is set from the star in the list, not here. Only guarantee that the
  // set never ends up with none, since background.js falls back to it.
  if (!profiles.some(p => p.isDefault)) profiles[0].isDefault = true;

  await SFTabs.storage.saveProfiles(profiles, false);
  state.profiles = profiles;

  if (!editing) {
    // Claim the id before anything can await again, so a fast second keystroke
    // updates this profile instead of creating a sibling
    state.editingProfileId = saved.id;
    // Give it a tab list immediately, so switching to it never reads as data
    // loss. What goes in it comes from the form's "Start with" choice.
    await seedTabsFor(saved.id);
  }

  renderProfileChip();
  renderProfileDropdown();
  syncAutoSwitchRow();
  return { saved, created: !editing };
}

/**
 * Save as you type. There is no Save button: the form commits on a pause in
 * typing and on blur, which is why the panel can be closed at any point
 * without losing the profile.
 */
async function autosaveProfileForm() {
  if (state.activeView !== 'edit-profile') return;   // panel closed mid-debounce
  try {
    const result = await persistProfileForm();
    if (!result) return;
    showStatus(t(result.created ? 'profileCreatedNamed' : 'profileSavedNamed', result.saved.name));
  } catch (err) {
    showStatus(t('errorSavingProfile', err.message), 'error');
  }
}

/**
 * Delete a profile and its tabs.
 *
 * Deliberately different from the shipped settings page, which leaves
 * `profile_<id>_tabs` behind. Orphaned tab data is invisible, unreachable, and
 * on sync storage it permanently consumes quota. The confirm names how many
 * tabs go with it, so the cost is stated rather than hidden.
 */
async function deleteProfileFlow(profileId) {
  const profile = state.profiles.find(p => p.id === profileId);
  if (!profile) return;
  if (state.profiles.length < 2) {
    showStatus(t('cannotDeleteLastProfile'), 'error');
    return;
  }

  let tabCount = 0;
  try {
    tabCount = (await SFTabs.storage.getProfileTabs(profileId) || []).length;
  } catch { /* count is advisory */ }

  const ok = await confirmDialog(
    t('deleteProfileConfirmTitle'),
    t(tabCount === 1 ? 'deleteProfileConfirmOne' : 'deleteProfileConfirmMany',
      profile.name, String(tabCount))
  );
  if (!ok) return;

  try {
    const remaining = state.profiles.filter(p => p.id !== profileId);
    const fallback = remaining.find(p => p.isDefault) || remaining[0];
    if (!remaining.some(p => p.isDefault)) fallback.isDefault = true;

    await SFTabs.storage.saveProfiles(remaining, false);

    const patch = {};
    if (state.settings.activeProfileId === profileId) patch.activeProfileId = fallback.id;
    if (state.settings.defaultProfileId === profileId) patch.defaultProfileId = fallback.id;
    if (Object.keys(patch).length) await patchSettings(patch);

    // Only after the profile is unreferenced, so a failure above cannot orphan
    // the tabs of a profile that still exists
    await removeProfileTabs(profileId);

    state.profiles = remaining;
    state.tabs = await SFTabs.storage.getProfileTabs(state.settings.activeProfileId) || [];
    renderTabList();
    bindTabListEvents();
    renderProfileChip();
    renderProfileDropdown();
    renderProfilesList();
    showStatus(t('profileDeleted', profile.name));
    if (state.activeView === 'edit-profile') openProfilesList();
    broadcastTabRefresh();
  } catch (err) {
    showStatus(t('errorDeletingProfile', err.message), 'error');
  }
}

/** Remove a profile's tab data from whichever area holds it, chunks included. */
async function removeProfileTabs(profileId) {
  const key = `profile_${profileId}_tabs`;
  try {
    await SFTabs.storageChunking.clearChunkedSync(key);
  } catch { /* not chunked, or sync unavailable */ }
  try {
    await browser.storage.sync.remove([key]);
    await browser.storage.local.remove([key]);
  } catch { /* nothing to remove */ }
}

/**
 * Reset the "Start with" control for a fresh form.
 *
 * Hidden when editing: re-seeding an existing profile would throw away tabs the
 * person already has, and nothing on this form should be able to do that.
 */
function renderSeedChoices() {
  const group = document.getElementById('group-profile-seed');
  if (!group) return;

  group.hidden = !state.profileFormIsNew;
  if (group.hidden) return;

  document.querySelector('input[name="profile-seed"][value="none"]').checked = true;

  // Only profiles that already exist can be copied — not the one being created.
  const source = document.getElementById('input-profile-seed-source');
  source.innerHTML = state.profiles
    .filter(p => p.id !== state.editingProfileId)
    .map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`)
    .join('');
  source.disabled = true;
}

/** Which starting point the form is currently offering. */
function readSeedChoice() {
  const picked = document.querySelector('input[name="profile-seed"]:checked');
  return {
    mode: picked ? picked.value : 'none',
    sourceId: document.getElementById('input-profile-seed-source')?.value || null
  };
}

/**
 * The tabs a new profile begins with.
 *
 * Cloned verbatim rather than re-keyed. Tab ids only have to be unique inside a
 * profile, and they already are in the source; regenerating them would mean
 * remapping every parentId on nested tabs, which is a good way to orphan one.
 */
async function seedTabsFor(profileId) {
  const { mode, sourceId } = readSeedChoice();
  let tabs = [];

  if (mode === 'default') {
    tabs = window.SFTabs?.constants?.DEFAULT_TABS || [];
  } else if (mode === 'copy' && sourceId) {
    tabs = (await SFTabs.storage.getProfileTabs(sourceId)) || [];
  }

  await SFTabs.storage.saveProfileTabs(profileId, JSON.parse(JSON.stringify(tabs)));
  return tabs.length;
}

/**
 * The profile list is the Profiles section of Settings, not a sheet of its own.
 * Everything that used to open that sheet lands here instead.
 */
function openProfilesList() {
  showSettingsSection('profiles');   // renders the list on the way in
  showView('settings');
}

/**
 * Auto-switch can only act on linked orgs, so when it is on and no profile has
 * one, say so — otherwise it looks like a toggle that does nothing.
 */
function syncAutoSwitchRow() {
  const toggle = document.getElementById('setting-auto-switch');
  if (!toggle) return;
  toggle.checked = !!state.settings.autoSwitchProfiles;
  const anyLinked = state.profiles.some(p => (p.urlPatterns || []).length);
  document.getElementById('auto-switch-hint').hidden = !(toggle.checked && !anyLinked);
}

function renderProfilesList() {
  const list = document.getElementById('profiles-list');
  if (!list) return;
  const active = state.settings.activeProfileId;

  // Same anatomy as the tab rows: drag handle, info, action group
  list.innerHTML = orderedProfiles().map(p => {
    const name = esc(p.name);
    const patterns = (p.urlPatterns || []).length;
    const meta = [
      patterns ? t(patterns === 1 ? 'orgCountOne' : 'orgCountMany', String(patterns))
               : t('noOrgsLinked'),
      p.id === active ? t('activeBadge') : null
    ].filter(Boolean).join(' · ');

    return `
    <li class="tab-item dropdown-item" data-profile-id="${p.id}">
      <div class="drag-handle" aria-hidden="true" title="${t('dragToReorderTitle')}">
        <div class="drag-dots">
          <span></span><span></span>
          <span></span><span></span>
          <span></span><span></span>
        </div>
      </div>
      <span class="profile-dot" style="background:${profileColor(p.id)}" aria-hidden="true"></span>
      <div class="tab-info">
        <div class="tab-info-top"><span class="tab-name">${name}</span></div>
        <span class="tab-path">${meta}</span>
      </div>
      <div class="tab-actions" role="group" aria-label="${t('ariaTabActions', name)}">
        <button class="tab-btn tab-btn--star ${p.isDefault ? 'is-on' : ''}"
          data-action="default-profile" data-id="${p.id}"
          aria-pressed="${!!p.isDefault}"
          aria-label="${p.isDefault ? t('ariaIsDefaultProfile', name) : t('ariaMakeDefaultProfile', name)}"
          title="${p.isDefault ? t('defaultProfileTitle') : t('makeDefaultProfileTitle')}">
          ${p.isDefault ? `<svg viewBox="0 0 520 520" fill="currentColor" aria-hidden="true" focusable="false"><path d="m274 31 46 150c2 6 8 9 14 9h150c15 0 21 20 9 29l-122 90c-5 4-7 11-5 17l58 154c4 14-11 26-23 17l-131-98c-5-4-12-4-18 0l-132 98c-12 9-28-3-23-17l56-154c2-6 0-13-5-17L26 219c-12-9-5-29 9-29h150c7 0 12-2 14-9l47-151c4-14 24-13 28 1"/></svg>` : `<svg viewBox="0 0 520 520" fill="currentColor" aria-hidden="true" focusable="false"><path d="M493 219c12-9 6-29-9-29H334c-6 0-12-3-14-9L274 31c-4-14-24-15-28-1l-47 151c-2 7-7 9-14 9H36c-14 0-21 20-9 29l122 90c5 4 7 11 5 17L98 480c-5 14 11 26 23 17l132-98c6-4 13-4 18 0l131 98c12 9 27-3 23-17l-58-154c-2-6 0-13 5-17l122-90Zm-146 58h-1a56 56 0 0 0-18 62v1l17 46c3 7-6 14-12 9l-38-28a56 56 0 0 0-65-2l-1 1-42 31c-7 5-16-1-13-9l18-49c7-22 0-47-18-62h-1l-43-32c-6-4-3-14 5-14h50c7 0 18-1 29-8a52 52 0 0 0 24-30l14-45c3-8 13-8 16 0l14 45v1a55 55 0 0 0 52 37h50c8 0 11 10 5 14l-43 32Z"/></svg>`}
        </button>
        <button class="tab-btn tab-btn--edit" data-action="edit-profile" data-id="${p.id}"
          aria-label="${t('ariaEditNamed', name)}" title="${t('editButton')}">
          ${ICON_EDIT}
        </button>
        ${state.profiles.length > 1 ? `
        <button class="tab-btn tab-btn--delete" data-action="delete-profile" data-id="${p.id}"
          aria-label="${t('ariaDeleteNamed', name)}" title="${t('deleteButtonTitle')}">
          ${ICON_DELETE}
        </button>` : ''}
      </div>
    </li>`;
  }).join('');

  list.querySelectorAll('[data-action="edit-profile"]').forEach(btn => {
    btn.addEventListener('click', () => openProfileForm(btn.dataset.id));
  });
  list.querySelectorAll('[data-action="delete-profile"]').forEach(btn => {
    btn.addEventListener('click', () => deleteProfileFlow(btn.dataset.id));
  });
  list.querySelectorAll('[data-action="default-profile"]').forEach(btn => {
    btn.addEventListener('click', () => setDefaultProfile(btn.dataset.id));
  });
  bindProfileDrag();
}

/** Display order: explicit position when set, creation order otherwise. */
/**
 * Which profiles besides the active one can hold a tab.
 *
 * A tab lives in one profile's list; putting "the same" tab in two means
 * writing a copy into each, keyed by the same id. Ids only have to be unique
 * within a profile, so reusing one across profiles costs nothing and is what
 * makes membership answerable at all.
 */
function otherProfiles() {
  return orderedProfiles().filter(p => p.id !== state.settings.activeProfileId);
}

/** Profiles whose list already contains this id. */
async function profilesHoldingTab(tabId) {
  const held = [];
  for (const profile of otherProfiles()) {
    const tabs = (await SFTabs.storage.getProfileTabs(profile.id)) || [];
    if (tabs.some(t => t.id === tabId)) held.push(profile.id);
  }
  return held;
}

/**
 * Make each profile's membership match `wanted`.
 *
 * Added copies go on the end, so a tab arriving in a profile never displaces
 * what is already arranged there. Removal is by id and leaves the rest of the
 * order intact.
 */
async function applyTabMembership(tab, wanted) {
  const want = new Set(wanted);
  for (const profile of otherProfiles()) {
    const tabs = (await SFTabs.storage.getProfileTabs(profile.id)) || [];
    const next = SFTabs.utils.withTabMembership(tabs, tab, want.has(profile.id));
    // Returned unchanged when there is nothing to do, so this skips the write
    if (next !== tabs) await SFTabs.storage.saveProfileTabs(profile.id, next);
  }
}

/**
 * The membership table on the edit form.
 *
 * The active profile is listed first, checked and disabled: the tab is being
 * edited there, so it is in that profile by definition, and removing it is what
 * the delete button is for.
 */
async function renderTabProfiles(tabId) {
  const group = document.getElementById('group-tab-profiles');
  const rows = document.getElementById('tab-profile-rows');
  if (!group || !rows) return;

  const others = otherProfiles();
  group.hidden = !state.settings.profilesEnabled || others.length === 0;
  if (group.hidden) return;

  const active = state.profiles.find(p => p.id === state.settings.activeProfileId);
  const held = tabId ? await profilesHoldingTab(tabId) : [];

  const row = (profile, checked, locked) => `
    <tr>
      <td class="profile-table-check">
        <input type="checkbox" data-profile-id="${esc(profile.id)}"
          ${checked ? 'checked' : ''} ${locked ? 'disabled' : ''}
          aria-label="${esc(profile.name)}" />
      </td>
      <td class="profile-table-name">${esc(profile.name)}</td>
      <td class="profile-table-note">${locked ? esc(t('tabInProfilesCurrent')) : ''}</td>
    </tr>`;

  rows.innerHTML =
    (active ? row(active, true, true) : '') +
    others.map(p => row(p, held.includes(p.id), false)).join('');
}

/** The profiles ticked on the edit form, active one excluded. */
function readTabProfiles() {
  return [...document.querySelectorAll('#tab-profile-rows input[data-profile-id]:not(:disabled)')]
    .filter(box => box.checked)
    .map(box => box.dataset.profileId);
}

function orderedProfiles() {
  return [...state.profiles].sort((a, b) =>
    (a.position ?? Infinity) - (b.position ?? Infinity) ||
    new Date(a.createdAt) - new Date(b.createdAt));
}

/**
 * Exactly one profile is the default — background.js falls back to it when no
 * linked org matches, so the star is a radio, not a checkbox.
 */
async function setDefaultProfile(profileId) {
  const target = state.profiles.find(p => p.id === profileId);
  if (!target || target.isDefault) return;
  try {
    const profiles = state.profiles.map(p => ({ ...p, isDefault: p.id === profileId }));
    await SFTabs.storage.saveProfiles(profiles, false);
    state.profiles = profiles;
    await patchSettings({ defaultProfileId: profileId });
    renderProfilesList();
    renderProfileDropdown();
    showStatus(t('defaultProfileSet', target.name));
  } catch (err) {
    showStatus(t('errorSavingProfile', err.message), 'error');
  }
}

function bindProfileDrag() {
  const list = document.getElementById('profiles-list');
  if (!list) return;
  list.querySelectorAll('.drag-handle').forEach(handle => {
    handle.addEventListener('mousedown', e => {
      const row = handle.closest('.tab-item');
      if (!row) return;
      startDrag(e, row, {
        container: list,
        itemSelector: '.tab-item',
        canNest: () => false,           // profiles are a flat list
        onDrop: (srcEl, tgtEl, zone) =>
          reorderProfile(srcEl.dataset.profileId, tgtEl.dataset.profileId, zone === 'before')
      });
    });
  });
}

async function reorderProfile(sourceId, targetId, before) {
  const ordered = orderedProfiles();
  const from = ordered.findIndex(p => p.id === sourceId);
  const to = ordered.findIndex(p => p.id === targetId);
  if (from === -1 || to === -1 || from === to) return;

  const [moved] = ordered.splice(from, 1);
  const insertAt = ordered.findIndex(p => p.id === targetId) + (before ? 0 : 1);
  ordered.splice(insertAt, 0, moved);

  // Renumber the whole list: partial positions would tie at Infinity and fall
  // back to creation order, which is not what was just dragged.
  const profiles = ordered.map((p, i) => ({ ...p, position: i }));
  try {
    await SFTabs.storage.saveProfiles(profiles, false);
    state.profiles = profiles;
    renderProfilesList();
    renderProfileDropdown();
  } catch (err) {
    showStatus(t('errorSavingProfile', err.message), 'error');
  }
}

/** Generic confirm on the storage modal's markup. Returns a promise. */
function confirmDialog(title, body) {
  return new Promise(resolve => {
    const overlay = document.getElementById('modal-storage');
    document.getElementById('modal-storage-title').textContent = title;
    document.getElementById('modal-storage-body').textContent = body;
    overlay.hidden = false;
    const cancel = document.getElementById('modal-storage-cancel');
    const confirm = document.getElementById('modal-storage-confirm');
    const done = answer => {
      overlay.hidden = true;
      cancel.removeEventListener('click', onCancel);
      confirm.removeEventListener('click', onConfirm);
      resolve(answer);
    };
    const onCancel = () => done(false);
    const onConfirm = () => done(true);
    cancel.addEventListener('click', onCancel);
    confirm.addEventListener('click', onConfirm);
    cancel.focus();
  });
}

/**
 * Append the current tab's org identifier to the patterns field.
 *
 * Patterns are compared by exact equality against this identifier, so typing a
 * hostname would never match — hence a capture action rather than a free field.
 */
async function captureCurrentOrg() {
  try {
    const [active] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!active?.url) return showStatus(t('noActiveTab'), 'error');

    const org = SFTabs.utils.extractOrgIdentifier(active.url);
    if (!org) return showStatus(t('notASalesforceOrg'), 'error');

    const field = document.getElementById('input-profile-orgs');
    const existing = field.value.split('\n').map(v => v.trim()).filter(Boolean);
    if (existing.some(v => v.toLowerCase() === org.toLowerCase())) {
      return showStatus(t('orgAlreadyLinked', org));
    }
    field.value = existing.concat(org).join('\n');
    showStatus(t('orgCaptured', org));
  } catch (err) {
    showStatus(t('errorCouldNotSave', err.message), 'error');
  }
}


// ── View management ────────────────────────────────────────────

function showView(viewName) {
  const tray  = document.getElementById('panel-tray');
  const views = ['edit-tab', 'settings', 'release-notes', 'dropdowns', 'edit-profile'];

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

/**
 * Sections whose contents are built at runtime, and so have to be rebuilt each
 * time the section is opened rather than once at load.
 *
 * Without this, Profiles rendered only when something else happened to call
 * renderProfilesList() — so arriving from the hub showed an empty list, and a
 * detour through New Profile and back appeared to fix it.
 */
const SETTINGS_SECTION_REFRESH = {
  profiles: () => {
    renderProfilesList();
    syncAutoSwitchRow();
  },
  'org-colors': () => syncOrgColorsSection(),
  button: () => syncFloatingButtonSection(),
  data: () => renderPocResult(),            // TEMPORARY, with the POC
};

/**
 * Move between the Settings hub and one of its sections.
 *
 * Deliberately NOT part of showView(). That switches `panel-view`s and writes
 * `state.activeView`, which is compared against string literals in a dozen
 * places — `=== 'settings'` toggles the footer gear, `!== 'empty'` guards a
 * keyboard shortcut. Adding sibling views called 'settings-tabs' and friends
 * would silently falsify both, the same way `activeView === 'edit'` never
 * matched the stored 'edit-tab'. Settings stays one view; only its innards move.
 *
 * @param {string|null} id  section to open, or null for the hub
 */
function showSettingsSection(id) {
  const hub = document.getElementById('settings-hub');
  if (!hub) return;

  state.settingsSection = id;
  hub.hidden = Boolean(id);

  let title = t('settingsHeader');
  document.querySelectorAll('#view-settings .settings-section').forEach(section => {
    const match = section.dataset.settingsSection === id;
    section.hidden = !match;
    if (match) {
      const heading = section.querySelector('.settings-section-title');
      if (heading) title = heading.textContent;
    }
  });

  document.getElementById('settings-title').textContent = title;
  document.getElementById('btn-settings-back').hidden = !id;

  if (id) SETTINGS_SECTION_REFRESH[id]?.();
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
  document.getElementById('edit-panel-subtitle').textContent = t('editingTabSubtitle', tab.label);
  document.getElementById('input-tab-name').value    = tab.label;
  document.getElementById('input-tab-path').value    = tab.path || '';
  document.getElementById('input-is-object').checked    = !!tab.isObject;
  document.getElementById('input-is-custom-url').checked = !!tab.isCustomUrl;
  document.getElementById('input-open-new-tab').checked  = !!tab.openInNewTab;
  updateCharCount('input-tab-name', 'tab-name-count', 30);
  state.editingColor = tab.color || null;
  renderColorPicker(state.editingColor);
  renderTabProfiles(state.editingTabId);

  showView('edit-tab');
  openFormAtTop('form-edit-tab', 'input-tab-name');
}

function openAddTab() {
  state.editingTabId = null;

  document.getElementById('edit-panel-title').textContent    = 'Add Tab';
  document.getElementById('edit-panel-subtitle').textContent = t('addTabSubtitle');
  document.getElementById('input-tab-name').value    = '';
  document.getElementById('input-tab-path').value    = '';
  document.getElementById('input-is-object').checked    = false;
  document.getElementById('input-is-custom-url').checked = false;
  document.getElementById('input-open-new-tab').checked  = false;
  updateCharCount('input-tab-name', 'tab-name-count', 30);
  state.editingColor = null;              // None is the default on every tab
  renderColorPicker(null);
  renderTabProfiles(state.editingTabId);

  showView('edit-tab');
  openFormAtTop('form-edit-tab', 'input-tab-name');
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
  document.getElementById('dropdown-title').textContent = t('manageItemsTitle');
  document.getElementById('dropdown-subtitle').textContent = t('itemsInTab', tab.label);

  renderDropdownItems(tabId);
  showView('dropdowns');
}

function renderDropdownItems(tabId) {
  const tab = state.tabs.find(t => t.id === tabId);
  if (!tab) return;

  const list = document.getElementById('dropdown-items-list');
  const items = tab.dropdownItems || [];
  list.innerHTML = '';

  const itemCount = countItems(items);
  document.getElementById('dropdown-subtitle').textContent =
    t(itemCount === 1 ? 'itemCountInTabOne' : 'itemCountInTabMany', String(itemCount), tab.label);

  const scrapeBtn = document.getElementById('btn-scrape-object');
  scrapeBtn.hidden = !isObjectManagerTab(tab);
  document.getElementById('scrape-object-label').textContent =
    t(items.length ? 'refreshItemsButton' : 'loadItemsButton');

  if (!items.length && !state.addingItemUnder) {
    list.innerHTML = `<li class="dropdown-empty">${t('noItemsYet')}</li>`;
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
    <div class="drag-handle" aria-hidden="true" title="${t('dragToReorderTitle')}">
      <div class="drag-dots"><span></span><span></span><span></span><span></span><span></span><span></span></div>
    </div>
    ${children.length
      ? `<button class="dropdown-twisty" data-action="toggle-item" data-path="${pathKey(path)}"
           aria-expanded="${expanded}" aria-label="${expanded ? t('ariaCollapseNamed', label) : t('ariaExpandNamed', label)}">
           <svg viewBox="0 0 520 520" fill="currentColor" aria-hidden="true"><path d="M476 178 271 385c-6 6-16 6-22 0L44 178c-6-6-6-16 0-22l22-22c6-6 16-6 22 0l161 163c6 6 16 6 22 0l161-162c6-6 16-6 22 0l22 22c5 6 5 15 0 21"/></svg>
         </button>`
      : `<span class="dropdown-twisty-spacer" aria-hidden="true"></span>`}
    <div class="tab-info">
      <div class="tab-info-top">
        <span class="tab-name"><span class="dropdown-item-num">${numbering}.</span> ${label}</span>
        ${children.length ? `<span class="tab-count is-static">${children.length}<span class="sr-only"> ${t('srSubItems')}</span></span>` : ''}
      </div>
      ${item.path ? `<span class="tab-path">${esc(item.path)}</span>` : ''}
    </div>
    <div class="tab-actions" role="group" aria-label="${t('ariaItemActions', label)}">
      ${canNest ? `<button class="tab-btn tab-btn--group" data-action="add-child" data-path="${pathKey(path)}"
        aria-label="${t('ariaAddItemUnder', label)}" title="${t('addSubItemTitle')}">
        <svg viewBox="0 0 520 520" fill="currentColor" aria-hidden="true"><path d="M300 290h165c8 0 15-7 15-15v-30c0-8-7-15-15-15H300c-6 0-10-4-10-10V55c0-8-7-15-15-15h-30c-8 0-15 7-15 15v165c0 6-4 10-10 10H55c-8 0-15 7-15 15v30c0 8 7 15 15 15h165c6 0 10 4 10 10v165c0 8 7 15 15 15h30c8 0 15-7 15-15V300c0-6 4-10 10-10"/></svg>
      </button>` : ''}
      <button class="tab-btn tab-btn--edit" data-action="edit-item" data-path="${pathKey(path)}"
        aria-label="${t('ariaEditNamed', label)}" title="${t('editButton')}">
        ${ICON_EDIT}
      </button>
      <button class="tab-btn tab-btn--promote" data-action="promote-item" data-path="${pathKey(path)}"
        aria-label="${path.length === 1 ? t('ariaPromoteToTab', label) : t('ariaPromoteLevel', label)}"
        title="${path.length === 1 ? t('promoteToTabTitle') : t('promoteLevelTitle')}">
        <svg viewBox="0 0 520 520" fill="currentColor" aria-hidden="true"><path d="M35 440c-7 0-15 7-15 15v30c0 8 8 15 15 15h239c8 0 16-8 16-15V153c0-9 10-13 17-7l56 56c6 6 15 6 21 0l21-21c6-6 6-15 0-21L270 24c-6-6-15-6-21 0L114 159c-6 6-6 15 0 21l21 21c6 6 15 6 21 0l56-56c6-6 18-2 18 7v273c0 16-16 15-16 15z"/></svg>
      </button>
      <button class="tab-btn tab-btn--delete" data-action="delete-item" data-path="${pathKey(path)}"
        aria-label="${t('ariaDeleteNamed', label)}" title="${t('deleteButtonTitle')}">
        ${ICON_DELETE}
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
  label.textContent = t('loading');

  try {
    const [active] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!active) {
      showStatus(t('noActiveTab'), 'error');
      return;
    }

    // The shim resolves to null instead of rejecting when no receiver exists
    const res = await browser.tabs.sendMessage(active.id, { action: 'parse_navigation' });
    if (!res) {
      showStatus(t('openObjectManagerFirst', wantedObject), 'error');
      return;
    }
    if (res.success === false) {
      showStatus(res.error || t('errorReadingNavigation'), 'error');
      return;
    }

    const items = res.items || res.navigation || [];
    if (!items.length) {
      showStatus(t('noNavigationItems'), 'error');
      return;
    }
    if (res.pageInfo && res.pageInfo.type !== 'objectManager') {
      showStatus(t('goToObjectInSetup', wantedObject), 'error');
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
    showStatus(t('errorLoadingNavigation', err.message), 'error');
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
    showStatus(t('itemLabelRequired'), 'error');
    document.getElementById('item-label').focus();
    return;
  }

  if (path) {
    const item = getItemByPath(tab.dropdownItems, path);
    if (item) { item.label = label; item.path = itemPath; }
    showStatus(t('itemSaved', label));
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
    showStatus(t('itemAdded', label));
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
  const withKids = childCount
    ? t(childCount === 1 ? 'withSubItemsOne' : 'withSubItemsMany', String(childCount))
    : '';

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
    showStatus(t('itemPromotedToTab', moving.label, withKids));
  } else {
    // Insert directly after the former parent, in the parent's own list
    const parentPath = path.slice(0, -1);
    const list = getParentList(tab.dropdownItems, parentPath);
    if (!list) return;
    list.splice(parentPath[parentPath.length - 1] + 1, 0, moving);
    showStatus(t('itemPromotedLevel', moving.label, withKids));
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
  showStatus(t('itemDeleted'));

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
      <input type="text" class="form-input" id="item-label" placeholder="${t('itemLabelPlaceholder')}"
             value="${esc(item.label || '')}" maxlength="30" autocomplete="off" />
      <input type="text" class="form-input" id="item-path" placeholder="${t('itemPathPlaceholder')}"
             value="${esc(item.path || '')}" autocomplete="off" />
      <div class="dropdown-item-fields-actions">
        <button class="btn-secondary" data-action="cancel-item">${t('cancelButton')}</button>
        <button class="btn-primary" data-action="commit-item"
                data-path="${path ? pathKey(path) : ''}">${t(path ? 'saveTab' : 'addButton')}</button>
      </div>
    </div>`;
  return li;
}

async function saveTab(e) {
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
    color:       state.editingColor || null,
  };

  let saved;
  if (state.editingTabId) {
    // Update existing
    state.tabs = state.tabs.map(t =>
      t.id === state.editingTabId ? { ...t, ...updates } : t
    );
    saved = state.tabs.find(t => t.id === state.editingTabId);
    showStatus(t('tabSavedStatus', name));
  } else {
    // Create new
    saved = {
      id:           SFTabs.utils.generateId(),
      position:     state.tabs.length,
      dropdownItems:[],
      isSetupObject:false,
      color:        null,
      ...updates,
    };
    state.tabs = [...state.tabs, saved];
    showStatus(t('tabAddedStatus', name));
  }

  // Read the ticks before the view changes and the table is re-rendered
  const wanted = document.getElementById('group-tab-profiles')?.hidden
    ? null
    : readTabProfiles();

  renderTabList();
  bindTabListEvents();
  showView('empty');
  await persistTabs();

  if (wanted) {
    try {
      await applyTabMembership(saved, wanted);
      broadcastTabRefresh();
    } catch (err) {
      showStatus(t('errorCouldNotSave', err.message), 'error');
    }
  }
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
  document.getElementById('modal-delete-body').textContent =
    t('deleteTabConfirmBody', tab.label);
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
  showStatus(t('tabDeletedStatus'));
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
  broadcastTabRefresh();
  showStatus(t('switchedToProfile', state.profiles.find(p => p.id === profileId)?.name || ''));
}

/**
 * Tell open Salesforce pages to rebuild their injected nav. Without this a page
 * keeps the previous profile's tabs until it is reloaded.
 *
 * Same URL set production broadcasts to, and the receivers already exist in
 * content-main.js and navigation-parser.js. Failures are expected and ignored:
 * a matching tab may predate the content script, in which case there is nobody
 * listening and nothing to fix.
 */
function broadcastTabRefresh() {
  const SETUP_PAGES = [
    '*://*.lightning.force.com/lightning/setup/*',
    '*://*.salesforce-setup.com/lightning/setup/*',
    '*://*.my.salesforce-setup.com/lightning/setup/*',
    '*://*.salesforce.com/lightning/setup/*',
    '*://*.my.salesforce.com/lightning/setup/*'
  ];
  browser.tabs.query({ url: SETUP_PAGES })
    .then(tabs => tabs.forEach(tab =>
      browser.tabs.sendMessage(tab.id, { action: 'refresh_tabs' }).catch(() => {})))
    .catch(() => {});
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

/**
 * React to storage written outside this popup — most often background.js
 * auto-switching profiles by URL, which otherwise leaves the popup showing the
 * previous profile's tabs.
 *
 * Two things make this safe. Our own writes fire this listener too, so it acts
 * only when the incoming value genuinely differs from what we hold. And a
 * re-render would discard whatever the user is typing, so an external tab change
 * is ignored while an edit is open — the next render picks it up. An external
 * profile switch is not ignored, because the whole context has moved and stale
 * tabs would be worse than a closed form.
 */
function installStorageListener() {
  if (!browser.storage?.onChanged) return;

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' && area !== 'sync') return;

    const incoming = changes.userSettings?.newValue;
    if (incoming?.activeProfileId &&
        incoming.activeProfileId !== state.settings.activeProfileId) {
      adoptExternalProfileSwitch(incoming);
      return;
    }

    const activeId = state.settings.activeProfileId;
    if (!activeId || isEditing()) return;
    const tabsKey = `profile_${activeId}_tabs`;
    const touched = Object.keys(changes)
      .some(k => k === tabsKey || k.startsWith(`${tabsKey}_chunk_`));
    if (touched) reloadTabsFromStorage();
  });
}

/** True while the user has an edit in progress that a re-render would destroy. */
function isEditing() {
  // showView() stores the view id, so this is 'edit-tab' -- not 'edit'
  return state.activeView === 'edit-tab' ||
         state.activeView === 'edit-profile' ||
         state.activeView === 'dropdowns' ||
         state.editingItemPath !== null ||
         state.addingItemUnder !== null;
}

async function adoptExternalProfileSwitch(settings) {
  state.settings = settings;
  state.profiles = await SFTabs.storage.getProfiles() || [];
  state.tabs = await SFTabs.storage.getProfileTabs(settings.activeProfileId) || [];
  if (isEditing()) showView('empty');
  renderTabList();
  bindTabListEvents();
  renderProfileChip();
  renderProfileDropdown();
  const name = state.profiles.find(p => p.id === settings.activeProfileId)?.name || '';
  showStatus(t('profileChangedExternally', name));
}

async function reloadTabsFromStorage() {
  state.tabs = await SFTabs.storage.getProfileTabs(state.settings.activeProfileId) || [];
  renderTabList();
  bindTabListEvents();
  showStatus(t('tabsUpdatedExternally'));
}

// ── Storage location ───────────────────────────────────────────

/**
 * Move tabs and profiles between sync and local storage.
 *
 * Order matters and is the whole reason this is not a one-liner.
 * migrateBetweenStorageTypes() finds its source by calling getProfiles(),
 * which reads getStoragePreference() — so the preference must still hold the
 * OLD value while it runs, or it reads the destination, finds nothing, and
 * returns having moved no data. The shipped settings page migrates first and
 * saves the preference second for exactly this reason; we do the same, then
 * pass skipMigration so saveUserSettings does not run it again against the
 * flipped preference.
 */
async function changeStorageLocation(toSync) {
  const fromSync = !!state.settings.useSyncStorage;
  if (fromSync === toSync) return;

  // Enabling sync over data another device already put there would overwrite
  // it. The settings page has a conflict resolver; we refuse and point at it
  // rather than shipping a second one.
  if (toSync && await syncAreaHasData()) {
    showStatus(t('syncConflictUseSettings'), 'error');
    syncSettingsPanel();
    return;
  }

  if (!await confirmStorageChange(toSync)) {
    syncSettingsPanel();   // put the radio back
    return;
  }

  try {
    await SFTabs.storage.migrateBetweenStorageTypes(fromSync, toSync);
    await patchSettings({ useSyncStorage: toSync }, { skipMigration: true });

    // Re-read from the new location: if the move dropped anything, the list
    // shows it now rather than after the next launch.
    state.profiles = await SFTabs.storage.getProfiles() || [];
    state.tabs = state.settings.activeProfileId
      ? await SFTabs.storage.getProfileTabs(state.settings.activeProfileId) || []
      : [];
    renderTabList();
    bindTabListEvents();
    renderProfileChip();
    renderProfileDropdown();
    showStatus(t(toSync ? 'syncEnabled' : 'syncDisabled'));
  } catch (err) {
    // The preference is only written after a successful migration, so failing
    // here leaves the data where it was and the old preference intact.
    showStatus(t('errorSavingSettings', err.message), 'error');
  }
  syncSettingsPanel();
}

/**
 * True if sync storage already holds another device's tabs.
 *
 * Deliberately looks for `profile_*_tabs` keys rather than `profiles`:
 * migrateBetweenStorageTypes does not remove the profiles list from sync when
 * moving to local ("keep for potential future migration"), so a stale profiles
 * entry is normal after a sync -> local switch and would make this refuse every
 * switch back. Tab keys are cleared, so their presence means real foreign data.
 */
async function syncAreaHasData() {
  try {
    const all = await browser.storage.sync.get(null);
    return Object.keys(all).some(k => /^profile_.+_tabs(_metadata|_chunk_\d+)?$/.test(k));
  } catch {
    return false;   // unreadable sync is not a conflict
  }
}

function confirmStorageChange(toSync) {
  return new Promise(resolve => {
    const overlay = document.getElementById('modal-storage');
    document.getElementById('modal-storage-title').textContent =
      t(toSync ? 'enableSyncConfirmTitle' : 'disableSyncConfirmTitle');
    document.getElementById('modal-storage-body').textContent =
      t(toSync ? 'enableSyncConfirmMessage' : 'disableSyncConfirmMessage');
    overlay.hidden = false;

    const done = answer => {
      overlay.hidden = true;
      cancel.removeEventListener('click', onCancel);
      confirm.removeEventListener('click', onConfirm);
      resolve(answer);
    };
    const cancel = document.getElementById('modal-storage-cancel');
    const confirm = document.getElementById('modal-storage-confirm');
    const onCancel = () => done(false);
    const onConfirm = () => done(true);
    cancel.addEventListener('click', onCancel);
    confirm.addEventListener('click', onConfirm);
    cancel.focus();
  });
}

// ── Tab colors ────────────────────────────────────────────────

const tabColorsOn = () => !!(state.settings.tabColors && state.settings.tabColors.enabled);
const TAB_COLOR_STYLES = ['dot', 'tint'];
const tabColorStyle = () => {
  const stored = state.settings.tabColors && state.settings.tabColors.style;
  return TAB_COLOR_STYLES.includes(stored) ? stored : 'dot';
};

/** Paint a rendered row from its tab's stored color. No-op when switched off. */
function paintTabRow(el, tab) {
  const utils = window.SFTabs && window.SFTabs.utils;
  if (!utils || !utils.applyTabColor) return;
  utils.applyTabColor(el, tab.color, tabColorStyle(), tabColorsOn());
}

/**
 * The picker: one dot per palette hue, plus a "none" option.
 *
 * Rebuilt whenever the form opens rather than once at startup, because the
 * feature can be switched on while the popup is open.
 */
function renderColorPicker(selected) {
  const group = document.getElementById('group-tab-color');
  const dots = document.getElementById('tab-color-dots');
  if (!group || !dots) return;

  group.hidden = !tabColorsOn();
  if (group.hidden) return;

  const palette = (window.SFTabs?.utils?.TAB_COLORS) || {};
  // Shade-major, so the grid reads as three rows of the same twelve hues —
  // deep, base, light — rather than the hues arriving in triplets.
  const names = Object.keys(palette);
  const bySuffix = suffix => names.filter(n => colorShade(n) === suffix);
  const options = [null, ...bySuffix('deep'), ...bySuffix(''), ...bySuffix('light')];

  dots.innerHTML = options.map(name => {
    const on = (name || null) === (selected || null);
    return `<button type="button" role="radio" aria-checked="${on}"
      class="color-dot${name ? '' : ' color-dot--none'}" data-color="${name || ''}"
      title="${esc(colorLabel(name))}" aria-label="${esc(colorLabel(name))}"
      ${name ? `style="--dot-color: ${palette[name].accent}"` : ''}></button>`;
  }).join('');

  dots.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      state.editingColor = dot.dataset.color || null;
      dots.querySelectorAll('.color-dot').forEach(d =>
        d.setAttribute('aria-checked', String(d === dot)));
    });
  });
}

/** The shade half of a palette key: 'teal-light' -> 'light', 'teal' -> ''. */
function colorShade(name) {
  const match = /-(deep|light)$/.exec(name || '');
  return match ? match[1] : '';
}

/**
 * Reads a palette key back as a name. The hue and the shade are separate
 * strings so translators aren't given thirty-six near-identical phrases, and
 * the two are joined through a locale key rather than concatenated, since
 * their order isn't the same in every language.
 */
function colorLabel(name) {
  if (!name) return t('colorNone');
  const shade = colorShade(name);
  const hue = t('colorName_' + (shade ? name.slice(0, -(shade.length + 1)) : name)
    .replace(/-/g, '_'));
  if (!shade) return hue;
  return t('colorWithShade', hue, t(shade === 'deep' ? 'colorShadeDeep' : 'colorShadeLight'));
}

/**
 * Turn profiles off, keeping one profile's tabs.
 *
 * Disabling is destructive in a way enabling is not: with the feature off there
 * is one list of tabs, so every other profile's tabs stop being reachable. The
 * advanced page always asked which to keep before doing this, and the popup's
 * toggle did not — it flipped the flag and left the rest. Now that the popup is
 * the only way to do it, it has to ask.
 *
 * The kept profile becomes both active and default, since background.js falls
 * back to the default when nothing matches.
 */
async function disableProfilesKeeping(keepId) {
  const keep = state.profiles.find(p => p.id === keepId);
  if (!keep) return;

  for (const profile of state.profiles) {
    if (profile.id !== keepId) await removeProfileTabs(profile.id);
  }

  const remaining = [{ ...keep, isDefault: true, position: 0 }];
  await SFTabs.storage.saveProfiles(remaining, false);
  state.profiles = remaining;

  await patchSettings({
    profilesEnabled: false,
    autoSwitchProfiles: false,
    activeProfileId: keepId,
    defaultProfileId: keepId,
  });

  state.tabs = (await SFTabs.storage.getProfileTabs(keepId)) || [];
  renderTabList();
  bindTabListEvents();
  renderProfileChip();
  applyProfilesVisibility(false);
  broadcastTabRefresh();
}

/**
 * Ask which profile survives, then disable.
 *
 * With one profile there is nothing to choose and nothing to lose, so the
 * toggle just flips.
 */
function promptDisableProfiles() {
  if (state.profiles.length < 2) {
    patchSettings({ profilesEnabled: false });
    applyProfilesVisibility(false);
    return;
  }

  const select = document.getElementById('modal-disable-profiles-keep');
  select.innerHTML = orderedProfiles()
    .map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  const active = state.settings.activeProfileId;
  if (active && state.profiles.some(p => p.id === active)) select.value = active;

  document.getElementById('modal-disable-profiles-body').textContent =
    t('disableProfilesBody', String(state.profiles.length - 1));
  document.getElementById('modal-disable-profiles').hidden = false;
  select.focus();
}

function closeDisableProfilesModal(restoreToggle) {
  document.getElementById('modal-disable-profiles').hidden = true;
  if (restoreToggle) document.getElementById('setting-profiles').checked = true;
}

// ══ TEMPORARY: file-picker proof of concept ══════════════════════
// Does an <input type="file"> survive in an extension popup? Chromium has open
// reports saying no, but a competitor appears to manage it, so this measures it
// rather than arguing about it.
//
// Written to storage in two stages, because "it worked" and "it didn't" are not
// the only outcomes. If the popup is torn down when the OS dialog takes focus,
// nothing is recorded. If it survives the dialog but dies during the async read,
// stage one lands and stage two does not — and that second case still rules out
// a popup-native import, since import has to read the file.
//
// Delete this function, its bindings, the markup and the storage key together.
async function recordPocStage(patch) {
  const stored = (await browser.storage.local.get('filePickerPoc')).filePickerPoc || {};
  await browser.storage.local.set({ filePickerPoc: { ...stored, ...patch } });
  renderPocResult();
}

async function renderPocResult() {
  const el = document.getElementById('poc-result');
  if (!el) return;
  const r = (await browser.storage.local.get('filePickerPoc')).filePickerPoc;
  if (!r || !r.picked) {
    el.textContent = 'No test run yet.';
    return;
  }
  const survived = r.stillOpen ? 'popup stayed open' : 'popup had closed';
  const read = r.readBytes != null
    ? `read ${r.readBytes} bytes`
    : (r.readError ? `read failed: ${r.readError}` : 'never finished reading');
  el.textContent = `${r.name} · ${r.size} bytes · ${survived} · ${read}`;
}

function bindFilePickerPoc() {
  const input = document.getElementById('poc-file-input');
  const button = document.getElementById('btn-poc-pick');
  if (!input || !button) return;

  button.addEventListener('click', () => {
    // Marker written before the dialog opens, so a run that vanishes entirely
    // is distinguishable from one that was never started
    browser.storage.local.set({ filePickerPoc: { started: Date.now() } });
    input.click();
  });

  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    if (!file) return;

    // Stage one, synchronous: the change event fired at all
    recordPocStage({
      picked: true,
      name: file.name,
      size: file.size,
      // document.hasFocus() is the honest test — the popup can still be alive
      // in this callback and about to be dismissed
      stillOpen: document.hasFocus(),
    });

    // Stage two: can we actually read it before being torn down?
    const reader = new FileReader();
    reader.onload = () => recordPocStage({ readBytes: String(reader.result).length });
    reader.onerror = () => recordPocStage({ readError: String(reader.error && reader.error.name) });
    reader.readAsText(file);
  });
}

// ── Floating button ────────────────────────────────────────────

/** The stored config, with everything the renderers need present. */
function floatingButtonConfig() {
  const defaults = SFTabs.constants.DEFAULT_SETTINGS.floatingButton;
  return { ...defaults, ...(state.settings.floatingButton || {}) };
}

/** Patch one or more fields without dropping the rest of the object. */
async function patchFloatingButton(partial) {
  await patchSettings({ floatingButton: { ...floatingButtonConfig(), ...partial } });
}

/**
 * Reflect the stored config into the section.
 *
 * The edge comes from the shared resolver rather than reading `side` directly,
 * so this and the page agree on what an older `anchor` value means — a settings
 * screen highlighting one edge while the button sits on the other is the exact
 * drift that resolver exists to prevent.
 */
function syncFloatingButtonSection() {
  const toggle = document.getElementById('setting-floating-button');
  if (!toggle) return;
  const config = floatingButtonConfig();

  toggle.checked = !!config.enabled;
  document.getElementById('setting-header-menu').checked =
    !!(state.settings.headerMenu && state.settings.headerMenu.enabled);
  document.getElementById('floating-button-options').hidden = !config.enabled;
  if (!config.enabled) return;

  const pick = (group, value) => {
    const input = document.querySelector(`input[name="${group}"][value="${value}"]`);
    if (input) input.checked = true;
  };
  pick('fb-location', config.location);
  pick('fb-layout', config.layout);

  const side = SFTabs.utils.resolveFloatingSide(config);
  document.querySelectorAll('#floating-button-sides button[data-side]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.side === side));
  });

  // A legacy install stores only the percentage; show its pixel equivalent so
  // the slider is not lying about where the button currently sits.
  let offset = Number(config.offset) || 0;
  if (!offset) {
    const percent = Number.isFinite(Number(config.position)) ? Number(config.position) : 25;
    offset = Math.round((percent / 100) * (window.screen?.availHeight || 900));
  }
  document.getElementById('floating-button-offset').value = offset;
  document.getElementById('floating-button-offset-value').textContent = `${offset}px`;
}

// ── Org colors ─────────────────────────────────────────────────

/** The stored config, with the shape the renderers expect. */
function orgColorConfig() {
  const stored = state.settings.orgColors || {};
  return {
    enabled: !!stored.enabled,
    environments: stored.environments || {},
    orgs: Array.isArray(stored.orgs) ? stored.orgs : [],
  };
}

/** A 16px preview of exactly what the browser tab will show. */
function orgColorSwatch(color) {
  return `<img class="color-table-ico" alt="" src="${esc(SFTabs.utils.orgFaviconDataUrl(color))}" />`;
}

/**
 * The environments we can name from a hostname alone.
 *
 * Not the five an admin thinks in: Full Copy, Partial Copy, Developer and
 * Developer Pro all arrive as `--name.sandbox` with nothing to tell them apart.
 * Separating those is what the per-org list below is for.
 */
const ORG_COLOR_ENVIRONMENTS = ['production', 'sandbox', 'developer', 'scratch', 'demo', 'playground', 'patch'];

function renderEnvColors() {
  const rows = document.getElementById('env-color-rows');
  if (!rows) return;
  const { environments } = orgColorConfig();
  const defaults = SFTabs.utils.DEFAULT_ENV_COLORS;

  // Nothing stored means the shipped colors are in force, so there is nothing
  // a reset would change
  document.getElementById('btn-reset-env-colors').disabled =
    Object.keys(environments).length === 0;

  rows.innerHTML = ORG_COLOR_ENVIRONMENTS.map(env => {
    const color = environments[env] || defaults[env];
    return `<tr>
      <td class="color-table-swatch">${orgColorSwatch(color)}</td>
      <td class="color-table-name">${esc(t('orgEnv_' + env))}</td>
      <td class="color-table-input">
        <input type="color" value="${esc(color)}" data-env-color="${esc(env)}"
          aria-label="${esc(t('orgEnv_' + env))}" />
      </td>
    </tr>`;
  }).join('');
}

/**
 * Orgs with a colour of their own, plus every org any profile is linked to.
 *
 * Profiles already carry org identifiers in urlPatterns, so listing them costs
 * nothing and saves retyping `acme--dev1` by hand. A profile org with no colour
 * set yet shows its environment's colour, same as it would in the tab strip.
 */
function orgColorRows() {
  const { orgs } = orgColorConfig();
  const rows = orgs.map(entry => ({ ...entry, source: 'saved' }));
  const seen = new Set(rows.map(r => String(r.identifier).toLowerCase()));

  state.profiles.forEach(profile => {
    (profile.urlPatterns || []).forEach(pattern => {
      const key = String(pattern).toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({ identifier: pattern, environment: null, color: null, source: profile.name });
    });
  });
  return rows;
}

function renderOrgColors() {
  const rows = document.getElementById('org-color-rows');
  if (!rows) return;

  const entries = orgColorRows();
  const defaults = SFTabs.utils.DEFAULT_ENV_COLORS;
  document.getElementById('org-colors-empty').hidden = entries.length > 0;

  rows.innerHTML = entries.map((entry, index) => {
    const env = entry.environment || 'sandbox';
    const color = entry.color || defaults[env];
    const note = entry.source === 'saved'
      ? t('orgEnv_' + env)
      : t('orgColorsFromProfile', entry.source);
    return `<tr>
      <td class="color-table-swatch">${orgColorSwatch(color)}</td>
      <td class="color-table-name">${esc(entry.identifier)}<span class="color-table-note">${esc(note)}</span></td>
      <td class="color-table-input">
        <input type="color" value="${esc(color)}" data-org-index="${index}"
          aria-label="${esc(entry.identifier)}" />
      </td>
      <td class="color-table-del">
        ${entry.source === 'saved'
          ? `<button type="button" class="tab-btn tab-btn--delete" data-org-remove="${index}"
               aria-label="${esc(t('removeButton'))}" title="${esc(t('removeButton'))}">${ICON_DELETE}</button>`
          : ''}
      </td>
    </tr>`;
  }).join('');

  rows.querySelectorAll('[data-org-index]').forEach(input => {
    input.addEventListener('change', () => saveOrgColor(entries[+input.dataset.orgIndex], input.value));
  });
  rows.querySelectorAll('[data-org-remove]').forEach(button => {
    button.addEventListener('click', () => removeOrgColor(entries[+button.dataset.orgRemove]));
  });
}

/** Write one org's colour, adding the entry if it only existed as a profile link. */
async function saveOrgColor(entry, color) {
  const config = orgColorConfig();
  const environment = entry.environment || 'sandbox';
  const at = config.orgs.findIndex(o =>
    String(o.identifier).toLowerCase() === String(entry.identifier).toLowerCase());

  const next = at === -1
    ? [...config.orgs, { identifier: entry.identifier, environment, color }]
    : config.orgs.map((o, i) => (i === at ? { ...o, color } : o));

  await patchSettings({ orgColors: { ...config, orgs: next } });
  renderOrgColors();
}

async function removeOrgColor(entry) {
  const config = orgColorConfig();
  const next = config.orgs.filter(o =>
    String(o.identifier).toLowerCase() !== String(entry.identifier).toLowerCase());
  await patchSettings({ orgColors: { ...config, orgs: next } });
  renderOrgColors();
}

/**
 * Add the org of the page in front of us.
 *
 * The same four outcomes as captureCurrentOrg on the profile form — no tab, not
 * Salesforce, already there, added — and it shares the strings for the three
 * that say nothing about profiles. The duplicate case gets its own: adding a
 * colour here does not touch profiles, so "already linked to this profile"
 * would be describing something that did not happen.
 */
async function captureOrgColor() {
  try {
    const [active] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!active?.url) return showStatus(t('noActiveTab'), 'error');

    const identifier = SFTabs.utils.extractOrgIdentifier(active.url);
    if (!identifier) return showStatus(t('notASalesforceOrg'), 'error');

    const config = orgColorConfig();
    if (config.orgs.some(o => String(o.identifier).toLowerCase() === identifier.toLowerCase())) {
      return showStatus(t('orgColorsAlreadyAdded', identifier));
    }

    const environment = SFTabs.utils.detectOrgEnvironment(active.url) || 'sandbox';
    const color = config.environments[environment] || SFTabs.utils.DEFAULT_ENV_COLORS[environment];
    await patchSettings({
      orgColors: { ...config, orgs: [...config.orgs, { identifier, environment, color }] },
    });
    renderOrgColors();
    showStatus(t('orgCaptured', identifier));
  } catch (err) {
    showStatus(t('errorCouldNotSave', err.message), 'error');
  }
}

/** Keep the section in step; the lists are moot while the feature is off. */
function syncOrgColorsSection() {
  const toggle = document.getElementById('setting-org-colors');
  if (!toggle) return;
  const { enabled } = orgColorConfig();
  toggle.checked = enabled;
  document.getElementById('org-colors-body').hidden = !enabled;
  if (!enabled) return;
  renderEnvColors();
  renderOrgColors();
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

/**
 * With profiles off, the switcher is meaningless, so hide it. The other header
 * actions keep their places because .header-actions is right-aligned.
 */
function applyProfilesVisibility(enabled) {
  document.getElementById('btn-profile-switcher').hidden = !enabled;
  // Auto-switch, the list and the new-profile button are all meaningless with
  // the feature off; the enable toggle above them stays, or there would be no
  // way back on.
  const manage = document.getElementById('profiles-manage');
  if (manage) manage.hidden = !enabled;
  if (!enabled) {
    closeProfileDropdown();
    if (state.activeView === 'edit-profile') showView('empty');
  }
}

// ── Settings panel ─────────────────────────────────────────────

function syncSettingsPanel() {
  document.querySelectorAll('.theme-card[data-theme-val]').forEach(card => {
    card.setAttribute('aria-checked',
      String(card.dataset.themeVal === state.settings.themeMode));
  });
  document.getElementById('setting-compact').checked       = state.settings.compactMode;
  document.getElementById('setting-skip-delete').checked   = state.settings.skipDeleteConfirmation;
  document.getElementById('setting-profiles').checked      = state.settings.profilesEnabled;
  document.getElementById('setting-quick-add-all').checked = !!state.settings.quickAddAllProfiles;
  document.getElementById('setting-menu-bar-quick-add').checked = !!state.settings.menuBarQuickAdd;
  // "All profiles" says nothing when there is only ever one
  document.getElementById('row-quick-add-all').hidden = !state.settings.profilesEnabled;
  const storageRadio = document.querySelector(`input[name="storage-type"][value="${state.settings.useSyncStorage ? 'sync' : 'local'}"]`);
  if (storageRadio) storageRadio.checked = true;
  syncTabColorRow();
}

/** Keep the color controls in step; the style choice is moot while off. */
function syncTabColorRow() {
  const toggle = document.getElementById('setting-tab-colors');
  if (!toggle) return;
  toggle.checked = tabColorsOn();
  document.getElementById('row-tab-color-style').hidden = !tabColorsOn();
  document.querySelectorAll('[data-color-style]').forEach(btn => {
    btn.setAttribute('aria-checked', String(btn.dataset.colorStyle === tabColorStyle()));
  });
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

/** Drives data-type, which colors the row's left accent bar. */
function tabType(tab) {
  if (tab.isCustomUrl)   return 'custom';
  if (tab.isSetupObject) return 'setup';
  if (tab.isObject)      return 'object';
  return 'standard';
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
  document.getElementById('btn-quick-add').addEventListener('click', async () => {
    // Production's parser handles setup pages, ObjectManager, object lists and
    // custom URLs, and derives the tab name from the page title. It writes to
    // the active profile; anything else is this popup's doing.
    const before = new Set(state.tabs.map(tab => tab.id));
    await SFTabs.tabs.enhancedAddTabForCurrentPage();
    if (!state.settings.quickAddAllProfiles) return;

    // Whatever appeared is what it captured — it adds one tab, but diffing
    // rather than assuming means a no-op run fans nothing out.
    const added = state.tabs.filter(tab => !before.has(tab.id));
    if (!added.length) return;
    try {
      const everyOther = otherProfiles().map(p => p.id);
      for (const tab of added) await applyTabMembership(tab, everyOther);
      broadcastTabRefresh();
      showStatus(t('quickAddFannedOut', String(everyOther.length)));
    } catch (err) {
      showStatus(t('errorCouldNotSave', err.message), 'error');
    }
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
      showSettingsSection(null);   // never resume on the section last looked at
      showView('settings');
    }
  });

  const themeCards = document.querySelectorAll('.theme-card[data-theme-val]');
  themeCards.forEach(card => {
    card.addEventListener('click', () => {
      themeCards.forEach(c => c.setAttribute('aria-checked', String(c === card)));
      applyTheme(card.dataset.themeVal);
      patchSettings({ themeMode: card.dataset.themeVal });
    });
  });

  document.getElementById('setting-compact').addEventListener('change', e => {
    applyDensity(e.target.checked);
    patchSettings({ compactMode: e.target.checked });
  });

  document.getElementById('setting-tab-colors').addEventListener('change', async e => {
    // Only the rendering is switched; stored tab.color values are left alone, so
    // turning it back on restores what was there.
    await patchSettings({ tabColors: { ...state.settings.tabColors, enabled: e.target.checked } });
    syncTabColorRow();
    renderTabList();
    bindTabListEvents();
    if (state.activeView === 'edit-tab') renderColorPicker(state.editingColor);
  });

  document.querySelectorAll('[data-color-style]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await patchSettings({ tabColors: { ...state.settings.tabColors, style: btn.dataset.colorStyle } });
      syncTabColorRow();
      renderTabList();
      bindTabListEvents();
    });
  });

  document.getElementById('setting-floating-button').addEventListener('change', async e => {
    await patchFloatingButton({ enabled: e.target.checked });
    syncFloatingButtonSection();
  });

  document.getElementById('setting-header-menu').addEventListener('change', async e => {
    const current = state.settings.headerMenu || {};
    await patchSettings({ headerMenu: { ...current, enabled: e.target.checked } });
  });

  document.querySelectorAll('input[name="fb-location"]').forEach(radio => {
    radio.addEventListener('change', () => patchFloatingButton({ location: radio.value }));
  });

  // Every layout can dock to either edge, so changing it does not invalidate
  // the placement the way the old nine-cell anchor grid could.
  document.querySelectorAll('input[name="fb-layout"]').forEach(radio => {
    radio.addEventListener('change', () => patchFloatingButton({ layout: radio.value }));
  });

  document.getElementById('floating-button-sides').addEventListener('click', async e => {
    const button = e.target.closest('button[data-side]');
    if (!button) return;
    // `anchor` deleted, not just superseded, so the legacy fallback cannot
    // re-engage and contradict the choice just made
    const { anchor, ...rest } = floatingButtonConfig();
    await patchSettings({ floatingButton: { ...rest, side: button.dataset.side } });
    syncFloatingButtonSection();
  });

  const offsetSlider = document.getElementById('floating-button-offset');
  const offsetValue = document.getElementById('floating-button-offset-value');
  offsetSlider.addEventListener('input', () => {
    offsetValue.textContent = `${offsetSlider.value}px`;   // live while dragging
  });
  offsetSlider.addEventListener('change', async () => {
    const { position, ...rest } = floatingButtonConfig();  // drop the legacy percentage
    await patchSettings({
      floatingButton: { ...rest, offset: parseInt(offsetSlider.value, 10) },
    });
  });

  document.getElementById('setting-org-colors').addEventListener('change', async e => {
    await patchSettings({ orgColors: { ...orgColorConfig(), enabled: e.target.checked } });
    syncOrgColorsSection();
  });

  document.getElementById('env-color-rows').addEventListener('change', async e => {
    const input = e.target.closest('[data-env-color]');
    if (!input) return;
    const config = orgColorConfig();
    await patchSettings({
      orgColors: { ...config, environments: { ...config.environments, [input.dataset.envColor]: input.value } },
    });
    renderEnvColors();
    renderOrgColors();   // profile-linked rows show their environment's colour
  });

  document.getElementById('btn-reset-env-colors').addEventListener('click', async () => {
    // Only the environment layer. Per-org colors were each set deliberately and
    // are not something a button labelled "defaults" should be able to discard.
    await patchSettings({ orgColors: { ...orgColorConfig(), environments: {} } });
    renderEnvColors();
    renderOrgColors();   // profile-linked rows show their environment's color
    showStatus(t('orgColorsResetDone'));
  });

  document.getElementById('btn-capture-org-color').addEventListener('click', captureOrgColor);

  document.getElementById('setting-menu-bar-quick-add').addEventListener('change', async e => {
    await patchSettings({ menuBarQuickAdd: e.target.checked });
    broadcastTabRefresh();   // the bar has to redraw to gain or lose the button
  });

  document.getElementById('setting-quick-add-all').addEventListener('change', e => {
    patchSettings({ quickAddAllProfiles: e.target.checked });
  });

  document.getElementById('setting-skip-delete').addEventListener('change', e => {
    patchSettings({ skipDeleteConfirmation: e.target.checked });
  });

  document.getElementById('setting-profiles').addEventListener('change', e => {
    if (!e.target.checked) return promptDisableProfiles();   // may need to ask first
    patchSettings({ profilesEnabled: true });
    applyProfilesVisibility(true);
  });

  document.getElementById('modal-disable-profiles-cancel')
    .addEventListener('click', () => closeDisableProfilesModal(true));
  document.getElementById('modal-disable-profiles-confirm').addEventListener('click', async () => {
    const keepId = document.getElementById('modal-disable-profiles-keep').value;
    closeDisableProfilesModal(false);
    await disableProfilesKeeping(keepId);
    showStatus(t('profilesDisabled'));
  });

  bindFilePickerPoc();   // TEMPORARY

  document.getElementById('btn-reset-everything').addEventListener('click', () => {
    document.getElementById('modal-reset').hidden = false;
    document.getElementById('modal-reset-cancel').focus();
  });
  document.getElementById('modal-reset-cancel').addEventListener('click', () => {
    document.getElementById('modal-reset').hidden = true;
  });
  document.getElementById('modal-reset-confirm').addEventListener('click', async () => {
    document.getElementById('modal-reset').hidden = true;
    try {
      await SFTabs.storage.resetEverything();
      // Reopening is the only honest way to show a fresh install: every piece
      // of in-memory state this popup holds is now stale
      window.location.reload();
    } catch (err) {
      showStatus(t('errorReset', err.message), 'error');
    }
  });

  // Profiles
  // Autosave: a pause in typing, plus blur so a quick close still commits
  const scheduleProfileSave = SFTabs.utils.debounce(autosaveProfileForm, 700);
  const nameEl = document.getElementById('input-profile-name');
  const nameErr = document.getElementById('profile-name-error');
  nameEl.addEventListener('input', () => {
    updateCharCount('input-profile-name', 'profile-name-count', 30);
    if (nameEl.value.trim()) {
      nameErr.hidden = true;
      nameEl.removeAttribute('aria-invalid');
    }
    scheduleProfileSave();
  });
  nameEl.addEventListener('blur', () => {
    // Autosave cannot commit without a name. Say so, rather than saving
    // nothing and leaving the impression it worked.
    const empty = !nameEl.value.trim();
    nameErr.hidden = !empty;
    if (empty) nameEl.setAttribute('aria-invalid', 'true');
    else autosaveProfileForm();
  });

  const orgsEl = document.getElementById('input-profile-orgs');
  orgsEl.addEventListener('input', scheduleProfileSave);
  orgsEl.addEventListener('blur', autosaveProfileForm);

  // Submitting with Enter should commit now rather than wait for the debounce
  document.getElementById('form-edit-profile').addEventListener('submit', e => {
    e.preventDefault();
    autosaveProfileForm();
  });
  // Closing commits any pending debounce first
  document.getElementById('btn-close-profile').addEventListener('click', async () => {
    await autosaveProfileForm();
    openProfilesList();
  });
  document.getElementById('btn-capture-org').addEventListener('click', captureCurrentOrg);

  // Changing the starting point re-seeds, because autosave has usually created
  // the profile before anyone reaches this control. Only ever fires while
  // creating — the group is hidden when editing — so no existing tabs are at
  // risk. Reversible for as long as the form is open.
  document.querySelectorAll('input[name="profile-seed"]').forEach(radio => {
    radio.addEventListener('change', async () => {
      document.getElementById('input-profile-seed-source').disabled = radio.value !== 'copy';
      if (!state.profileFormIsNew || !state.editingProfileId) return;
      const count = await seedTabsFor(state.editingProfileId);
      showStatus(t('startWithApplied', String(count)));
    });
  });

  document.getElementById('input-profile-seed-source').addEventListener('change', async () => {
    if (!state.profileFormIsNew || !state.editingProfileId) return;
    const count = await seedTabsFor(state.editingProfileId);
    showStatus(t('startWithApplied', String(count)));
  });
  document.getElementById('btn-new-profile-from-list').addEventListener('click', () => openProfileForm(null));
  document.getElementById('setting-auto-switch').addEventListener('change', async e => {
    await patchSettings({ autoSwitchProfiles: e.target.checked });
    syncAutoSwitchRow();
  });

  document.querySelectorAll('input[name="storage-type"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) changeStorageLocation(radio.value === 'sync');
    });
  });

  document.querySelectorAll('.settings-tile[data-settings-section]').forEach(tile => {
    tile.addEventListener('click', () => showSettingsSection(tile.dataset.settingsSection));
  });

  document.getElementById('btn-settings-back')
    .addEventListener('click', () => showSettingsSection(null));

  // Tiles that open a page rather than a section. Import & Export stays on its
  // own page because a file picker closes an extension popup the moment it
  // takes focus, and because the import flow branches on what the file holds.
  const SETTINGS_LINKS = {
    'import-export': () => chrome.runtime.getURL('popup/settings.html'),
    'user-guide': () => 'https://chrisrouse.github.io/sftabs/',
  };
  document.querySelectorAll('.settings-tile[data-settings-link]').forEach(tile => {
    tile.addEventListener('click', () => {
      const url = SETTINGS_LINKS[tile.dataset.settingsLink];
      if (url) chrome.tabs.create({ url: url() });
    });
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
      showStatus(t('noActiveTab'), 'error');
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
    showStatus(t('errorCouldNotNavigate', err.message), 'error');
  }
}

function bindTabListEvents() {
  const tabList = document.getElementById('tab-list');
  tabList.removeEventListener('click', handleTabListClick);
  tabList.addEventListener('click', handleTabListClick);
  bindTabDrag();
}
