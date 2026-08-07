// docs/snippets/purge-orphan-tabs.js
//
// Removes tab keys left behind by profiles that no longer exist, in both
// storage areas. Only ever removes a key it has read and found empty, so there
// is nothing to lose by running it.
//
// Companion to storage-report.js, which finds them. A switch between sync and
// local cannot clear these: the migration walks the profile list, and these
// belong to profiles that have been deleted, so it never visits them.
//
// Run in the extension's console — the popup's devtools or the background
// worker's, NOT a Salesforce page. It prints before and after, so if nothing
// changes you will see that rather than assume it worked.

(async () => {
  const read = (area, key) => {
    const meta = area[key + '_metadata'];
    if (meta && meta.chunked) {
      const parts = [];
      for (let i = 0; i < meta.chunkCount; i++) {
        if (area[`${key}_chunk_${i}`] === undefined) return { error: true };
        parts.push(area[`${key}_chunk_${i}`]);
      }
      try { return { value: JSON.parse(parts.join('')) }; } catch { return { error: true }; }
    }
    return { value: area[key] };
  };

  const survey = async () => {
    const areas = { local: await chrome.storage.local.get(null), sync: await chrome.storage.sync.get(null) };
    // The live profile list, from whichever area holds one
    const ids = new Set();
    for (const a of Object.values(areas)) {
      const list = read(a, 'profiles').value;
      if (Array.isArray(list)) list.forEach(p => p && p.id && ids.add(p.id));
    }

    const doomed = { local: [], sync: [] };
    const kept = [];
    for (const [name, area] of Object.entries(areas)) {
      const bases = [...new Set(Object.keys(area)
        .filter(k => /^profile_.+_tabs(_metadata|_chunk_\d+)?$/.test(k))
        .map(k => k.replace(/_(metadata|chunk_\d+)$/, '')))];
      for (const base of bases) {
        const id = base.replace(/^profile_/, '').replace(/_tabs$/, '');
        const r = read(area, base);
        const empty = Array.isArray(r.value) ? r.value.length === 0 : r.value === undefined;
        if (ids.has(id)) { kept.push(`${name}/${base} — profile still exists`); continue; }
        if (r.error)     { kept.push(`${name}/${base} — unreadable, left alone`); continue; }
        if (!empty)      { kept.push(`${name}/${base} — ORPHAN BUT NOT EMPTY, left alone`); continue; }
        // every sibling key, so no metadata or chunk is stranded
        doomed[name].push(base, base + '_metadata',
          ...Array.from({ length: 30 }, (_, i) => `${base}_chunk_${i}`).filter(k => k in area));
      }
    }
    return { doomed, kept };
  };

  const { doomed, kept } = await survey();
  kept.forEach(k => console.log('  keeping  ' + k));

  const total = doomed.local.length + doomed.sync.length;
  if (!total) { console.log('%c  nothing to remove', 'color:green'); return; }

  console.log('  removing', total, 'key(s):', { ...doomed });
  for (const area of ['local', 'sync']) {
    if (!doomed[area].length) continue;
    try {
      await chrome.storage[area].remove(doomed[area]);
    } catch (e) { console.error(`  ${area}.remove failed:`, e); }
  }
  if (chrome.runtime.lastError) console.error('  lastError:', chrome.runtime.lastError.message);

  const after = await survey();
  const left = after.doomed.local.length + after.doomed.sync.length;
  console.log(left
    ? '%c  STILL PRESENT — the remove did not take. Wrong console, or the context closed mid-call.'
    : '%c  done — orphans gone', left ? 'color:red;font-weight:bold' : 'color:green');
})();
