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
    return { keys, tabs, chunked, broken,
             profiles: profiles?.value?.length ?? 0 };
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

  if (!live.keys.length && other.keys.length) {
    console.error('  MISMATCH — the area in use is empty and ' + other.tabs +
                  ' tab(s) sit in the other one. A switch did not move the data.');
  } else if (live.keys.length && other.keys.length) {
    console.warn('  Tabs in BOTH areas. Expected right after switching to local — sync copies ' +
                 'are left behind deliberately — but the ones in use are the ' +
                 (preferSync ? 'sync' : 'local') + ' copies.');
  } else {
    console.log('%c  consistent — ' + live.tabs + ' tab(s) in the area actually in use', 'color:green');
  }
  if (live.chunked) console.log('  ' + live.chunked + ' profile(s) are chunked — the case worth switching with');
  return { preferSync, local: L, sync: S };
})();
