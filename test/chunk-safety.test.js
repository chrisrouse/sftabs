#!/usr/bin/env node
/**
 * Writing and reading chunked sync values without losing them.
 *
 * Sync storage caps a single value, so anything larger is split across
 * `${key}_chunk_N` with a `${key}_metadata` record saying how many parts there
 * are. Two rules keep that safe, and both were broken in ways that destroyed
 * data rather than reporting a problem.
 *
 * ORDER. Saving used to clear the old value and then write the new one. Between
 * those two awaits the value does not exist. In the background worker that
 * window is real — Chrome terminates MV3 workers whenever it likes — so a
 * quick-add that lost the race took a profile's whole tab list with it and left
 * nothing to recover from. Writing first and pruning afterwards makes the worst
 * interruption leave orphan chunks, which readers skip because the metadata
 * states the count.
 *
 * A TORN READ IS NOT AN EMPTY VALUE. The worker's reader returned null when
 * reassembly failed, and callers coalesce null to []. So "a chunk is missing"
 * became "this profile has no tabs", and the next write made it true. The popup
 * copy rethrew; the worker copy did not; nothing compared them.
 *
 * These are asserted against the source because both functions are pure
 * browser-storage plumbing with no seam to call them through. The duplication
 * between the two copies is itself the hazard being guarded.
 *
 * Run: npm test
 */
const fs = require('fs');
const path = require('path');

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

/** Comments removed, so prose about throwing is not mistaken for code. */
function codeOnly(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/([^:])\/\/.*$/gm, '$1');
}

/** One function's source, by brace matching from its declaration. */
function bodyOf(rel, name) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const decl = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(').exec(src);
  if (!decl) return null;
  let i = src.indexOf('{', decl.index);
  for (let depth = 0; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(decl.index, i + 1);
  }
  return null;
}

/** Both implementations of the chunk layer. */
const COPIES = [
  ['popup/js/storage-chunking.js', 'the popup copy'],
  ['background.js', 'the worker copy'],
];

// ── Order: the new value lands before anything is deleted ──
for (const [rel, label] of COPIES) {
  const save = bodyOf(rel, 'saveChunkedSync');
  check(`${label} has saveChunkedSync`, Boolean(save));
  if (!save) continue;

  const firstSet = save.search(/storage\.sync\.set\(/);
  const firstRemove = save.search(/storage\.sync\.remove\(|clearChunkedSync\(/);

  check(`${label} writes the new value before removing anything`,
    firstSet !== -1 && (firstRemove === -1 || firstSet < firstRemove),
    firstRemove === -1 ? 'no removal inside the write at all' : 'set at ' + firstSet + ', removal at ' + firstRemove);

  check(`${label} prunes the stale tail after writing`,
    /pruneChunks\(/.test(save));
}

// ── A failed reassembly is reported, not flattened to "empty" ──
for (const [rel, label] of COPIES) {
  const read = bodyOf(rel, 'readChunkedSync');
  check(`${label} has readChunkedSync`, Boolean(read));
  if (!read) continue;

  const katch = /catch\s*\([^)]*\)\s*\{([\s\S]*)\}$/.exec(codeOnly(read).trim());
  check(`${label} does not swallow a torn read into null`,
    Boolean(katch) && !/return\s+null/.test(katch[1]),
    'a null here reads downstream as "no tabs" and the next write persists it');
  check(`${label} rethrows instead`, Boolean(katch) && /throw/.test(katch[1]));
}

// ── Pruning must never fail a write that already succeeded ──
for (const [rel, label] of COPIES) {
  const prune = bodyOf(rel, 'pruneChunks');
  check(`${label} has pruneChunks`, Boolean(prune));
  if (!prune) continue;
  const katch = /catch\s*\([^)]*\)\s*\{([\s\S]*)\}$/.exec(codeOnly(prune).trim());
  check(`${label} treats pruning as best-effort`,
    Boolean(katch) && !/throw/.test(katch[1]));
}

// ── The caller that could overwrite a profile with a single tab ──
// quickAddTabToProfiles appends to what it read. If the read failed and came
// back empty, the append becomes a replace, and the profile is gone.
const quickAdd = bodyOf('background.js', 'quickAddTabToProfiles');
check('quickAddTabToProfiles exists', Boolean(quickAdd));
if (quickAdd) {
  check('quick-add guards the read it appends to',
    /try\s*\{[\s\S]*readChunkedSync[\s\S]*?\}\s*catch/.test(quickAdd));
  check('and skips the profile rather than writing over it',
    /catch[\s\S]*continue;/.test(quickAdd));
}

// reorderTabsForProfile has the same shape and the same exposure.
const reorder = bodyOf('background.js', 'reorderTabsForProfile');
check('reorderTabsForProfile guards its read too',
  Boolean(reorder) && /try\s*\{[\s\S]*readChunkedSync[\s\S]*?\}\s*catch/.test(reorder));

// ── No speculative sweeping on the write path ──
// The old cleanup listed fifty chunk keys on every save. Chrome allows 120 sync
// writes a minute and a removal counts, so housekeeping alone could hit it.
for (const [rel, label] of COPIES) {
  const save = bodyOf(rel, 'saveChunkedSync');
  if (!save) continue;
  check(`${label} does not sweep speculative chunk keys on every save`,
    !/i\s*<\s*50/.test(save));
}

console.log('\n' + passed + '/' + (passed + failed) + ' passed');
process.exit(failed ? 1 : 0);
