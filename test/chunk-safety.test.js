#!/usr/bin/env node
/**
 * Writing and reading chunked sync values without losing them.
 *
 * Sync storage caps a single value, so anything larger is split across
 * `${key}_chunk_N` with a `${key}_metadata` record giving the count. Two rules
 * keep that safe, and both were once broken in ways that destroyed data rather
 * than reporting a problem.
 *
 * ORDER. Saving used to clear the old value and then write the new one. Between
 * those two awaits the value does not exist. In the background worker that
 * window is real — Chrome terminates MV3 workers whenever it likes — so a
 * quick-add that lost the race took a profile's whole tab list with it, with
 * nothing to recover from.
 *
 * A TORN READ IS NOT AN EMPTY VALUE. One reader returned null when reassembly
 * failed, and callers coalesce null to []. So "a chunk is missing" became "this
 * profile has no tabs", and the next write made it true.
 *
 * This was a source test while there were two implementations — the popup's and
 * a copy in background.js — because neither could be called. There is one now,
 * in shared/utils.js, so it is exercised against a fake storage area instead.
 * The fake records the order of operations, which is the only way to assert the
 * part that mattered: the new value lands before anything is removed.
 *
 * Run: npm test
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0;
let failed = 0;

function check(label, ok, detail) {
  if (ok) {
    passed++;
    console.log('ok    ' + label + (detail ? '  — ' + detail : ''));
  } else {
    failed++;
    console.log('FAIL  ' + label + (detail ? '  — ' + detail : ''));
  }
}

const ROOT = path.join(__dirname, '..');

/** A sync area that remembers every call, in order. */
function makeStorage() {
  const data = {};
  const log = [];
  return {
    data,
    log,
    area: {
      get(keys) {
        const wanted = keys === null || keys === undefined
          ? Object.keys(data)
          : (Array.isArray(keys) ? keys : [keys]);
        const out = {};
        for (const key of wanted) if (key in data) out[key] = data[key];
        return Promise.resolve(out);
      },
      set(values) {
        log.push({ op: 'set', keys: Object.keys(values) });
        Object.assign(data, values);
        return Promise.resolve();
      },
      remove(keys) {
        const list = Array.isArray(keys) ? keys : [keys];
        log.push({ op: 'remove', keys: list });
        for (const key of list) delete data[key];
        return Promise.resolve();
      },
    },
  };
}

/** utils.js in a scope with a fake sync area and a small chunk size. */
function loadUtils(chunkSize) {
  const storage = makeStorage();
  const context = { console, Blob, JSON, Math, Date, Array, Object, Error, String, Number };
  context.globalThis = context;
  context.browser = { storage: { sync: storage.area, local: makeStorage().area } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'popup/js/shared/constants.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'popup/js/shared/utils.js'), 'utf8'), context);
  if (chunkSize) context.SFTabs.constants.CHUNK_SIZE = chunkSize;
  return { utils: context.SFTabs.utils, storage };
}

const big = n => Array.from({ length: n }, (_, i) => ({ id: 'tab' + i, label: 'Tab ' + i }));

(async () => {
  // ── A small value is stored whole ──
  {
    const { utils, storage } = loadUtils(7000);
    const result = await utils.writeChunkedSyncValue('k', [{ id: 'a' }]);
    check('a small value is stored under its own key',
      result.chunked === false && Array.isArray(storage.data.k));
    check('and its metadata says so', storage.data.k_metadata.chunked === false);
    check('reading it back gives what went in',
      JSON.stringify(await utils.readChunkedSyncValue('k')) === JSON.stringify([{ id: 'a' }]));
  }

  // ── A large value is split ──
  {
    const { utils, storage } = loadUtils(200);
    const value = big(40);
    const result = await utils.writeChunkedSyncValue('k', value);
    check('a large value is split into chunks', result.chunked === true && result.chunkCount > 1,
      result.chunkCount + ' chunks');
    check('the direct key is not left holding a partial value', !('k' in storage.data));
    check('the metadata records the count',
      storage.data.k_metadata.chunkCount === result.chunkCount);
    check('reading it back reassembles it exactly',
      JSON.stringify(await utils.readChunkedSyncValue('k')) === JSON.stringify(value));
  }

  // ── The ordering that cost a profile ──
  {
    const { utils, storage } = loadUtils(200);
    await utils.writeChunkedSyncValue('k', big(40));
    storage.log.length = 0;
    await utils.writeChunkedSyncValue('k', big(60));

    const firstSet = storage.log.findIndex(entry => entry.op === 'set');
    const firstRemove = storage.log.findIndex(entry => entry.op === 'remove');
    check('rewriting sets before it removes',
      firstSet !== -1 && (firstRemove === -1 || firstSet < firstRemove),
      'clear-then-write left a window with no value at all');
    check('and the value is never absent, even mid-write',
      JSON.stringify(await utils.readChunkedSyncValue('k')).length > 0);
  }

  // ── Shrinking prunes the tail, growing prunes the direct key ──
  {
    const { utils, storage } = loadUtils(200);
    await utils.writeChunkedSyncValue('k', big(60));
    const wide = storage.data.k_metadata.chunkCount;
    await utils.writeChunkedSyncValue('k', big(10));
    const narrow = storage.data.k_metadata.chunkCount;
    check('a shorter value drops the chunks it no longer uses',
      narrow < wide && !(`k_chunk_${narrow}` in storage.data),
      `${wide} chunks down to ${narrow}`);
    check('reading the shorter value is not confused by what came before',
      JSON.stringify(await utils.readChunkedSyncValue('k')) === JSON.stringify(big(10)));
  }
  {
    const { utils, storage } = loadUtils(200);
    await utils.writeChunkedSyncValue('k', [{ id: 'a' }]);   // small: direct key
    await utils.writeChunkedSyncValue('k', big(40));         // large: chunked
    check('growing past the limit removes the stale direct key', !('k' in storage.data),
      'left in place, a reader falling back to it would get the old value');
  }

  // ── A torn read is reported ──
  {
    const { utils, storage } = loadUtils(200);
    await utils.writeChunkedSyncValue('k', big(40));
    delete storage.data.k_chunk_1;
    let threw = false;
    try { await utils.readChunkedSyncValue('k'); } catch { threw = true; }
    check('a missing chunk throws rather than returning null', threw,
      'null coalesces to [] upstream, and the next write persists it');
  }
  {
    const { utils } = loadUtils(200);
    check('an absent key returns null without throwing',
      (await utils.readChunkedSyncValue('nothing')) === null);
  }

  // ── No speculative sweeping on the write path ──
  {
    const { utils, storage } = loadUtils(7000);
    storage.log.length = 0;
    await utils.writeChunkedSyncValue('k', [{ id: 'a' }]);
    const removed = storage.log.filter(e => e.op === 'remove').flatMap(e => e.keys);
    check('a first write removes nothing speculatively', removed.length === 0,
      'the old cleanup listed fifty chunk keys on every save; Chrome allows 120 sync writes a minute');
  }

  // ── One implementation, two facades ──
  const facades = [
    ['popup/js/storage-chunking.js', 'readChunkedSyncValue', 'writeChunkedSyncValue'],
    ['background.js', 'readChunkedSyncValue', 'writeChunkedSyncValue'],
  ];
  for (const [rel, reader, writer] of facades) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    check(`${rel.split('/').pop()} delegates rather than reimplementing`,
      src.includes(`utils.${reader}`) && src.includes(`utils.${writer}`) &&
      !/JSON\.stringify\(data\)[\s\S]{0,200}new Blob/.test(src),
      'two implementations is how the torn-read behaviour came to differ');
  }

  console.log('\n' + passed + '/' + (passed + failed) + ' passed');
  process.exit(failed ? 1 : 0);
})();
