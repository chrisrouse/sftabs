// docs/snippets/storage-report.js
//
// Paste into the extension's console to see which storage area is in use and
// whether the data is actually there. Written for testing sync <-> local
// switches, where the failure mode is silent: the preference flips, the data
// does not move, and the popup simply looks empty.
//
// WHERE TO RUN IT
//   Chrome   right-click the popup -> Inspect, or chrome://extensions -> the
//            extension's "service worker" link
//   Firefox  about:debugging#/runtime/this-firefox -> Inspect
//
// NOT in a Salesforce page's console. Content scripts run in an isolated world,
// so chrome.storage is not reachable from the page's own console.
//
// It reads only; nothing is written.

(async () => {
  const local = await chrome.storage.local.get(null);
  const sync  = await chrome.storage.sync.get(null);

  // The same three-priority rule the extension uses
  const [source, preferSync] =
    typeof local.deviceSettings?.useSyncStorage === 'boolean' ? ['deviceSettings (local)', local.deviceSettings.useSyncStorage] :
    typeof local.userSettings?.useSyncStorage   === 'boolean' ? ['userSettings (local, legacy)', local.userSettings.useSyncStorage] :
                                                                ['nothing stored, so the default', true];

  // Reassemble a value whether it is stored whole or split across chunks
  const read = (area, key) => {
    const meta = area[key + '_metadata'];
    if (meta && meta.chunked) {
      const parts = [];
      for (let i = 0; i < meta.chunkCount; i++) {
        const part = area[`${key}_chunk_${i}`];
        if (part === undefined) return { error: `missing chunk ${i} of ${meta.chunkCount}` };
        parts.push(part);
      }
      try { return { value: JSON.parse(parts.join('')), chunks: meta.chunkCount }; }
      catch { return { error: 'chunks present but unparseable' }; }
    }
    return key in area ? { value: area[key], chunks: 0 } : null;
  };

  const survey = area => {
    const keys = [...new Set(Object.keys(area)
      .filter(k => /^profile_.+_tabs(_metadata|_chunk_\d+)?$/.test(k))
      .map(k => k.replace(/_(metadata|chunk_\d+)$/, '')))];
    const profiles = read(area, 'profiles');
    let tabs = 0, chunked = 0, broken = [];
    for (const k of keys) {
      const r = read(area, k);
      if (!r) continue;
      if (r.error) { broken.push(`${k}: ${r.error}`); continue; }
      if (r.chunks) chunked++;
      tabs += Array.isArray(r.value) ? r.value.length : 0;
    }
    const list = Array.isArray(profiles?.value) ? profiles.value : [];
    return { keys, tabs, chunked, broken,
             profiles: list.length,
             profileIds: list.map(p => p && p.id).filter(Boolean) };
  };

  const L = survey(local), S = survey(sync);
  console.log('%cSF Tabs — storage', 'font-weight:bold;font-size:13px');
  console.log('  reading from:', preferSync ? 'SYNC' : 'LOCAL', '— from', source);
  console.table({
    local: { profiles: L.profiles, 'tab keys': L.keys.length, chunked: L.chunked, 'tabs total': L.tabs },
    sync:  { profiles: S.profiles, 'tab keys': S.keys.length, chunked: S.chunked, 'tabs total': S.tabs },
  });

  const live = preferSync ? S : L, other = preferSync ? L : S;
  [...L.broken, ...S.broken].forEach(b => console.error('  TORN:', b));

  // Judge by tabs, not by keys. A key holding an empty array is residue, not
  // data, and treating the two alike reads as "your tabs are in both places"
  // when one side is empty husks.
  const husks = other.keys.length && other.tabs === 0;

  if (!live.tabs && other.tabs) {
    console.error('  MISMATCH — the area in use holds no tabs and ' + other.tabs +
                  ' sit in the other one. A switch did not move the data.');
  } else if (husks) {
    // Whether a switch will clear them depends on who they belonged to. The
    // migration walks the profile list, so a key whose profile still exists gets
    // overwritten with real tabs — but one left by a deleted profile is never
    // visited, in either direction, and stays until it is removed by hand.
    const known = new Set((live.profileIds || []).map(id => `profile_${id}_tabs`));
    const orphans = other.keys.filter(k => !known.has(k));
    const area = preferSync ? 'local' : 'sync';

    console.log('  ' + other.keys.length + ' empty tab key(s) in ' + area + ' — residue, not data:');
    other.keys.forEach(k => console.log('      ' + k + (known.has(k) ? '   (profile still exists)' : '   (orphan)')));

    if (orphans.length !== other.keys.length) {
      console.log('  The ones with a live profile clear themselves on the next switch.');
    }
    if (orphans.length) {
      console.log('  The orphans will not: the migration only visits profiles in the list.');
      console.log('  Safe to remove — every one is empty:');
      console.log('      chrome.storage.' + area + '.remove(' + JSON.stringify(orphans) + ')');
    }
  } else if (live.tabs && other.tabs) {
    console.warn('  Tabs in BOTH areas. Expected right after switching to local — the sync ' +
                 'copies are left behind deliberately — but the live ones are the ' +
                 (preferSync ? 'sync' : 'local') + ' copies.');
  } else {
    console.log('%c  consistent — ' + live.tabs + ' tab(s) in the area actually in use', 'color:green');
  }
  if (live.chunked) console.log('  ' + live.chunked + ' profile(s) are chunked — the case worth switching with');
  return { preferSync, local: L, sync: S };
})();
