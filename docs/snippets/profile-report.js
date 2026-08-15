// docs/snippets/profile-report.js
//
// What is actually in storage for profiles, and when it last changed.
//
// Paste into the console of the extension's own page — right-click the popup →
// Inspect, or about:debugging → Inspect on Firefox. Not a Salesforce page: a
// content script cannot read the profile list.
//
// Answers the question "did my change save, or did something overwrite it",
// which the UI cannot: the popup renders from its own in-memory copy, so a
// reverted write and a stale render look identical on screen.
//
//   sftabsProfiles.report()   print everything, as a table
//   sftabsProfiles.watch()    log every write to profiles or tabs as it happens
//   sftabsProfiles.stop()     stop watching

(function () {
  'use strict';

  const api = globalThis.browser?.storage ? globalThis.browser : globalThis.chrome;
  const U = globalThis.SFTabs?.utils;

  const read = async key => {
    const useSync = U ? await U.storagePreference() : true;
    const area = useSync ? api.storage.sync : api.storage.local;
    if (!useSync) return (await area.get(key))[key];
    // Chunk-aware: a profile past ~7KB lives in key_chunk_N, and a plain get
    // returns undefined for it.
    try { return await U.readChunkedSyncValue(key); }
    catch (e) { return { ERROR: String(e) }; }
  };

  async function report() {
    const useSync = U ? await U.storagePreference() : true;
    const settings = (await api.storage.local.get('userSettings')).userSettings || {};
    const profiles = (await read('profiles')) || [];

    console.log('%cstorage area: ' + (useSync ? 'SYNC' : 'LOCAL'),
      'font-weight:bold');
    console.log('activeProfileId  ', settings.activeProfileId,
      '(' + (profiles.find(p => p.id === settings.activeProfileId)?.name ?? '?') + ')');
    console.log('activeProfileAuto', settings.activeProfileAuto,
      settings.activeProfileAuto
        ? '— set by auto-switch, so it will not follow you to an unclaimed org'
        : '— picked by hand, so it will');
    console.log('autoSwitch       ', settings.autoSwitchProfiles,
      ' profilesEnabled', settings.profilesEnabled);

    const rows = [];
    for (const p of profiles) {
      const tabs = (await read(`profile_${p.id}_tabs`)) || [];
      rows.push({
        name: p.name,
        id: p.id,
        starred: !!p.isDefault,
        linkedOrgs: (p.urlPatterns || []).join(', ') || '—',
        tabs: tabs.length,
        firstTab: tabs[0]?.label ?? '—',
        updatedAt: p.updatedAt || '—',
      });
    }
    console.table(rows);
    console.log('If a change you just made is missing here, it never reached ' +
      'storage or was overwritten — not a rendering problem.');
    return { settings, profiles };
  }

  let listener = null;

  function watch() {
    if (listener) return console.log('already watching');
    listener = (changes, area) => {
      for (const [key, change] of Object.entries(changes)) {
        if (!/^profiles|^profile_|^userSettings$/.test(key)) continue;
        if (key === 'userSettings') {
          const before = change.oldValue || {}, after = change.newValue || {};
          const moved = ['activeProfileId', 'activeProfileAuto']
            .filter(k => before[k] !== after[k])
            .map(k => `${k}: ${before[k]} -> ${after[k]}`);
          if (moved.length) console.log(`[${area}] userSettings`, moved.join(', '));
          continue;
        }
        const size = v => (Array.isArray(v) ? v.length + ' items' : typeof v);
        console.log(`[${area}] ${key}`,
          size(change.oldValue), '->', size(change.newValue));
      }
    };
    api.storage.onChanged.addListener(listener);
    console.log('watching. Reproduce the problem, then read the log: the write ' +
      'that shrinks or reverts a list is the culprit.');
  }

  function stop() {
    if (!listener) return;
    api.storage.onChanged.removeListener(listener);
    listener = null;
    console.log('stopped');
  }

  globalThis.sftabsProfiles = { report, watch, stop };
  console.log('sftabsProfiles.report() | .watch() | .stop()');
})();
