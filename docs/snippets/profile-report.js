// docs/snippets/profile-report.js
//
// What is actually in storage for profiles, and when it last changed.
//
// WHERE TO PASTE — it must be an extension page, not a Salesforce page. A
// content script cannot read the profile list.
//
//   Chrome   right-click the toolbar icon -> Inspect popup
//   Firefox  about:debugging -> This Firefox -> SF Tabs -> Inspect
//
// Chrome blocks pasting into the console until you type `allow pasting` once.
//
// This prints its report immediately rather than defining something to call
// later — a first draft did the latter and broke, because Chrome's service
// worker idles out after about thirty seconds and takes any global with it,
// and the popup's context dies the moment the popup closes.
//
// It also leaves sftabsProfiles.watch() behind for the live case, which is the
// one worth using: reproduce the problem with it running and the write that
// reverts something names itself. Start it and keep the inspector open.

(async function () {
  'use strict';

  const api = globalThis.browser?.storage ? globalThis.browser : globalThis.chrome;
  if (!api?.storage) {
    console.error('No extension storage here. This has to run on an extension ' +
      'page — see the header. A Salesforce tab cannot read the profile list.');
    return;
  }

  const U = globalThis.SFTabs?.utils;

  /** Which area holds the data. Falls back to the raw flag if utils is absent. */
  async function usingSync() {
    if (U?.storagePreference) return U.storagePreference();
    const device = (await api.storage.local.get('deviceSettings')).deviceSettings;
    return device?.useSyncStorage !== false;
  }

  /** Chunk-aware: a value past ~7KB lives in key_chunk_N and a plain get misses it. */
  async function read(key) {
    if (!(await usingSync())) return (await api.storage.local.get(key))[key];
    if (U?.readChunkedSyncValue) {
      try { return await U.readChunkedSyncValue(key); }
      catch (error) { return { UNREADABLE: String(error) }; }
    }
    return (await api.storage.sync.get(key))[key];
  }

  async function report() {
    const sync = await usingSync();
    const settings = (await api.storage.local.get('userSettings')).userSettings || {};
    const profiles = (await read('profiles')) || [];

    console.log('%cSF Tabs — profile storage', 'font-weight:bold;font-size:13px');
    console.log('area              ', sync ? 'SYNC' : 'LOCAL');
    console.log('activeProfileId   ', settings.activeProfileId,
      '(' + (profiles.find(p => p.id === settings.activeProfileId)?.name ?? '?') + ')');
    console.log('activeProfileAuto ', settings.activeProfileAuto,
      settings.activeProfileAuto
        ? '— set by auto-switch, so it will NOT follow you to an unclaimed org'
        : '— picked by hand, so it WILL');
    console.log('autoSwitch        ', settings.autoSwitchProfiles,
      '  profilesEnabled', settings.profilesEnabled);

    const rows = [];
    for (const profile of profiles) {
      const tabs = (await read(`profile_${profile.id}_tabs`)) || [];
      rows.push({
        name: profile.name,
        starred: !!profile.isDefault,
        linkedOrgs: (profile.urlPatterns || []).join(', ') || '—',
        tabs: Array.isArray(tabs) ? tabs.length : '?',
        tabOrder: Array.isArray(tabs) ? tabs.map(t => t.label).join(' · ') : '?',
        updatedAt: profile.updatedAt || '—',
        id: profile.id,
      });
    }
    console.table(rows);
    console.log('A change missing here never reached storage, or was overwritten. ' +
      'That is not a rendering problem.');
    return { settings, profiles };
  }

  // ── Live watch, for the reverting case ──
  let listener = null;

  function watch() {
    if (listener) return console.log('already watching');
    listener = (changes, area) => {
      for (const [key, change] of Object.entries(changes)) {
        if (key === 'userSettings') {
          const before = change.oldValue || {};
          const after = change.newValue || {};
          const moved = ['activeProfileId', 'activeProfileAuto']
            .filter(field => before[field] !== after[field])
            .map(field => `${field}: ${before[field]} -> ${after[field]}`);
          if (moved.length) console.log(`[${area}] userSettings  ${moved.join(', ')}`);
          continue;
        }
        if (!/^profiles($|_)|^profile_/.test(key)) continue;
        const describe = value =>
          Array.isArray(value) ? value.length + ' items' : typeof value;
        const shrank = Array.isArray(change.oldValue) && Array.isArray(change.newValue) &&
          change.newValue.length < change.oldValue.length;
        console.log(`[${area}] ${key}  ${describe(change.oldValue)} -> ` +
          `${describe(change.newValue)}${shrank ? '   <-- SHRANK' : ''}`);
      }
    };
    api.storage.onChanged.addListener(listener);
    console.log('watching — reproduce the problem now, keeping this inspector open');
  }

  function stop() {
    if (!listener) return;
    api.storage.onChanged.removeListener(listener);
    listener = null;
    console.log('stopped');
  }

  globalThis.sftabsProfiles = { report, watch, stop };

  await report();
  console.log('\nsftabsProfiles.watch() to log writes as they land, .stop() to end. ' +
    'If those come back undefined, the context was torn down — paste this again.');
})();
