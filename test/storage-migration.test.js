#!/usr/bin/env node
/**
 * Storage-switch regression test.
 *
 * Exercises the real production storage modules against a fake storage backend,
 * because this is the one code path that can silently destroy a user's tabs.
 *
 * What it pins down: migrateBetweenStorageTypes() must move the data whichever
 * order its caller does things in.
 *
 * It used to locate its source through getProfiles(), which resolves the area
 * from the stored preference — so persisting the new preference first, the
 * obvious thing to do, made the migration read the empty destination, find no
 * profiles, and return having moved nothing. The tabs stayed in the area the
 * preference had just stopped pointing at: intact, unreachable, and from the
 * user's side indistinguishable from lost. The caller worked around it by
 * migrating first, and this file pinned the other order as unsafe.
 *
 * The function now takes its source from the fromSync argument it was already
 * being given, so neither order can get it wrong. Both are tested below,
 * because the workaround is still what production does and both have to hold.
 *
 * Run: npm test
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

function makeArea() {
  const data = {};
  return {
    _data: data,
    get: keys => Promise.resolve(
      keys == null ? { ...data }
        : (Array.isArray(keys) ? keys : [keys]).reduce((o, k) => (k in data ? (o[k] = data[k]) : 0, o), {})),
    set: obj => { Object.assign(data, obj); return Promise.resolve(); },
    remove: keys => { (Array.isArray(keys) ? keys : [keys]).forEach(k => delete data[k]); return Promise.resolve(); },
    getBytesInUse: () => Promise.resolve(0),
  };
}

const local = makeArea(), sync = makeArea();
global.window = global;
global.browser = {
  storage: { local, sync, onChanged: { addListener() {} } },
  runtime: { getManifest: () => ({ version: '0.0.0' }) },
};
global.chrome = global.browser;
global.SFTabs = {};

// The same order the pages load them in. utils.js is not optional here: the
// chunk layer lives there now, and storage-chunking.js is the facade in front
// of it — omitting it made every write fail with "cannot read properties of
// undefined", which is exactly what a page would do.
for (const f of ['popup/js/shared/constants.js', 'popup/js/shared/utils.js',
                 'popup/js/storage-chunking.js', 'popup/js/popup-storage.js']) {
  new Function(fs.readFileSync(path.join(root, f), 'utf8'))();
}
const S = SFTabs.storage;

let settings;
SFTabs.main = {
  getUserSettings: () => settings,
  setUserSettings: s => { settings = s; },
  showStatus() {}, applyTheme() {},
};

/** Mirrors changeStorageLocation() in js/popup.js: migrate first, then persist. */
async function switchStorage(toSync) {
  const fromSync = !!settings.useSyncStorage;
  if (fromSync === toSync) return;
  await S.migrateBetweenStorageTypes(fromSync, toSync);
  const merged = { ...settings, useSyncStorage: toSync };
  await S.saveUserSettings(merged, true, false);   // skipMigration: already done above
  settings = merged;
}

/** The other order: let saveUserSettings do the migrating. Also correct now. */
async function switchStorageNaive(toSync) {
  const merged = { ...settings, useSyncStorage: toSync };
  await S.saveUserSettings(merged, false, false);
  settings = merged;
}

/** Mirrors syncAreaHasData() in js/popup.js. */
async function syncHasForeignTabs() {
  const all = await sync.get(null);
  return Object.keys(all).some(k => /^profile_.+_tabs(_metadata|_chunk_\d+)?$/.test(k));
}

const TABS = [
  { id: 't1', label: 'Flows', path: 'Flows', position: 0 },
  { id: 't2', label: 'Users', path: 'ManageUsers', position: 1 },
];
const PROFILE = { id: 'p1', name: 'Default', isDefault: true, urlPatterns: [], createdAt: new Date(0).toISOString() };

async function seedLocal() {
  for (const k of Object.keys(local._data)) delete local._data[k];
  for (const k of Object.keys(sync._data)) delete sync._data[k];
  settings = { ...SFTabs.constants.DEFAULT_SETTINGS, useSyncStorage: false, activeProfileId: 'p1', defaultProfileId: 'p1' };
  await local.set({
    deviceSettings: { useSyncStorage: false },
    userSettings: settings,
    profiles: [PROFILE],
    profile_p1_tabs: TABS,
  });
}

/** Mirrors removeProfileTabs() in js/popup.js. */
async function removeProfileTabs(profileId) {
  const key = `profile_${profileId}_tabs`;
  try { await SFTabs.storageChunking.clearChunkedSync(key); } catch {}
  try { await sync.remove([key]); await local.remove([key]); } catch {}
}

/** Mirrors the storage half of deleteProfileFlow() in js/popup.js. */
async function deleteProfile(profileId, profiles) {
  if (profiles.length < 2) return { refused: true, profiles };
  const remaining = profiles.filter(p => p.id !== profileId);
  const fallback = remaining.find(p => p.isDefault) || remaining[0];
  if (!remaining.some(p => p.isDefault)) fallback.isDefault = true;

  await S.saveProfiles(remaining, false);
  const patch = {};
  if (settings.activeProfileId === profileId) patch.activeProfileId = fallback.id;
  if (settings.defaultProfileId === profileId) patch.defaultProfileId = fallback.id;
  if (Object.keys(patch).length) {
    settings = { ...settings, ...patch };
    await S.saveUserSettings(settings, true, false);
  }
  await removeProfileTabs(profileId);   // only once the profile is unreferenced
  return { refused: false, profiles: remaining };
}

async function seedTwoProfiles() {
  for (const k of Object.keys(local._data)) delete local._data[k];
  for (const k of Object.keys(sync._data)) delete sync._data[k];
  settings = { ...SFTabs.constants.DEFAULT_SETTINGS, useSyncStorage: false, activeProfileId: 'p1', defaultProfileId: 'p1' };
  const second = { id: 'p2', name: 'Sandbox', isDefault: false, urlPatterns: ['acme--dev1'], createdAt: new Date(1).toISOString() };
  await local.set({
    deviceSettings: { useSyncStorage: false },
    userSettings: settings,
    profiles: [PROFILE, second],
    profile_p1_tabs: TABS,
    profile_p2_tabs: [{ id: 's1', label: 'Sandbox tab', path: 'X', position: 0 }],
  });
  return [{ ...PROFILE }, second];
}

const results = [];
function check(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}
const counts = async () => ({
  tabs: ((await S.getProfileTabs('p1')) || []).length,
  profiles: ((await S.getProfiles()) || []).length,
});

(async () => {
  // 1. A round trip must preserve everything.
  await seedLocal();
  await switchStorage(true);
  let c = await counts();
  check('local -> sync keeps 2 tabs and 1 profile', c.tabs === 2 && c.profiles === 1, `tabs=${c.tabs} profiles=${c.profiles}`);
  await switchStorage(false);
  c = await counts();
  check('sync -> local keeps 2 tabs and 1 profile', c.tabs === 2 && c.profiles === 1, `tabs=${c.tabs} profiles=${c.profiles}`);

  // 2. And a second round trip, which is where the stale `profiles` copy that
  //    migrateBetweenStorageTypes leaves in sync could cause trouble.
  check('stale profiles left in sync is not mistaken for another device',
    (await syncHasForeignTabs()) === false);
  await switchStorage(true);
  await switchStorage(false);
  c = await counts();
  check('two full round trips keep 2 tabs and 1 profile', c.tabs === 2 && c.profiles === 1, `tabs=${c.tabs} profiles=${c.profiles}`);

  // 3. Genuine foreign data must be detected.
  await seedLocal();
  await sync.set({ profile_other_tabs: [{ id: 'x', label: 'From another device', path: 'X', position: 0 }] });
  check('another device\'s tabs in sync are detected', (await syncHasForeignTabs()) === true);

  // 4. The other order — persist the preference, then migrate — has to work
  //    too. It used to lose everything, because the migration resolved its
  //    source from the preference that had just been changed.
  await seedLocal();
  await switchStorageNaive(true);
  c = await counts();
  check('persisting the preference before migrating keeps the tabs',
    c.tabs === 2 && c.profiles === 1, `tabs=${c.tabs} profiles=${c.profiles}`);

  // And back, so the fix is not one-directional.
  await switchStorageNaive(false);
  c = await counts();
  check('and the same in reverse', c.tabs === 2 && c.profiles === 1,
    `tabs=${c.tabs} profiles=${c.profiles}`);

  // ── A move leaves nothing behind ──
  // The tabs were always removed from the area being left. The profile list was
  // not, when moving to local — a list of profiles whose tabs had just gone.
  await seedLocal();
  await switchStorage(true);                       // local -> sync
  let leftover = Object.keys(local._data).filter(k => /^profile|^profiles/.test(k));
  check('local -> sync leaves nothing in local',
    leftover.length === 0, leftover.join(', ') || 'clean');

  await switchStorage(false);                      // sync -> local
  leftover = Object.keys(sync._data).filter(k => /^profile|^profiles/.test(k));
  check('sync -> local leaves nothing in sync',
    leftover.length === 0, leftover.join(', ') || 'clean');

  c = await counts();
  check('and the tabs are still all there afterwards', c.tabs === 2, `tabs=${c.tabs}`);

  // ── An empty profile must not leave its key behind ──
  // The write and the removal shared one `if (tabs.length > 0)` guard, so a
  // profile with no tabs kept its empty key in the area being left. Nothing
  // ever collected those: the loop walks the profile list from the source, and
  // that list moves across on the first switch, so the next migration does not
  // know they exist. One husk per empty profile per switch, accumulating.
  await seedLocal();
  await local.set({
    profiles: [PROFILE, { id: 'p2', name: 'Empty', urlPatterns: [], createdAt: new Date(0).toISOString() }],
    profile_p2_tabs: [],
  });
  await switchStorage(true);

  const leftInLocal = Object.keys(local._data).filter(k => /^profile_.+_tabs/.test(k));
  check('an empty profile leaves no key in the area being left',
    leftInLocal.length === 0,
    leftInLocal.length ? 'left behind: ' + leftInLocal.join(', ') : 'local is clean');

  // The profile that did have tabs still arrived intact.
  c = await counts();
  check('and the profile that had tabs still made it across',
    c.tabs === 2, `tabs=${c.tabs}`);

  // ── Profile deletion ──
  let profiles = await seedTwoProfiles();
  let r = await deleteProfile('p2', profiles);
  check('deleting a profile removes it from the list', r.profiles.length === 1 && r.profiles[0].id === 'p1');
  check('deleting a profile removes its tab data',
    !('profile_p2_tabs' in local._data) && !('profile_p2_tabs' in sync._data));
  check('the other profile\'s tabs are untouched',
    JSON.stringify(local._data.profile_p1_tabs) === JSON.stringify(TABS));

  // Deleting the active + default profile must hand both roles over.
  profiles = await seedTwoProfiles();
  r = await deleteProfile('p1', profiles);
  check('deleting the active profile reassigns activeProfileId', settings.activeProfileId === 'p2');
  check('deleting the default profile reassigns defaultProfileId', settings.defaultProfileId === 'p2');
  check('a profile always carries isDefault', r.profiles.some(p => p.isDefault));
  c = await counts();
  check('the surviving profile still resolves its tabs', c.profiles === 1);

  // The last profile has nowhere to hand off to.
  r = await deleteProfile('p2', r.profiles);
  check('deleting the last profile is refused', r.refused === true && r.profiles.length === 1);

  // ── Profile ordering ──
  // A new profile is appended, so it has to come out last. It did not: profiles
  // written before `position` existed carry none, the old sort tied those at
  // Infinity, and Infinity also means last — so the single profile holding a
  // real position sorted ahead of every legacy one, and anything newly created
  // surfaced at the top of the list instead of the bottom.
  const orderAfterSave = async profiles => {
    await S.saveProfiles(profiles, false);
    const stored = (await S.getProfiles()) || [];
    return stored.map(p => p.name).join(' -> ');
  };

  const legacy = [
    { id: 'a', name: 'Default', createdAt: '2025-01-01T00:00:00Z' },
    { id: 'b', name: 'test',    createdAt: '2025-02-01T00:00:00Z' },
  ];

  check('a new profile lands at the bottom, past profiles that predate position',
    await orderAfterSave([...legacy,
      { id: 'c', name: 'newest', createdAt: '2025-03-01T00:00:00Z', position: 2 }])
    === 'Default -> test -> newest');

  check('untouched legacy profiles keep their creation order',
    await orderAfterSave(legacy) === 'Default -> test');

  check('a dragged order survives the save',
    await orderAfterSave([
      { id: 'c', name: 'C', position: 0 },
      { id: 'a', name: 'A', position: 1 },
      { id: 'b', name: 'B', position: 2 },
    ]) === 'C -> A -> B');

  check('a half-positioned set keeps the order it arrived in',
    await orderAfterSave([
      { id: 'a', name: 'A', position: 5 }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' },
    ]) === 'A -> B -> C');

  check('saving fills every gap, so the mixed state cannot recur',
    ((await S.getProfiles()) || []).every(p => Number.isFinite(p.position)));

  const failed = results.filter(r2 => !r2.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
