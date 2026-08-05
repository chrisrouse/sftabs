/**
 * test/content-scope.test.js
 *
 * Every file in one content_scripts entry shares a single global scope. Two
 * files declaring the same top-level name is therefore not two functions — it
 * is one function, whichever loaded last, silently replacing the other. Calls
 * written in the losing file resolve to the winner's body.
 *
 * That is invisible in review, invisible to `node --check`, and it has already
 * cost real time here twice: a tab-colour cache assignment that never ran, and
 * a refresh investigation where a shadowed storage reader was the first
 * suspect to rule out. Worse, the shadowing can be load-bearing — reordering
 * the manifest changes which body wins without a single line of code changing.
 *
 * So the rule is flat: within one entry, a top-level name is declared once.
 *
 * The second half of this file guards the other way content scripts go wrong
 * quietly: the same work triggered twice. Nothing errors, it just happens
 * again, and you see it as a flicker rather than a failure.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
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

/**
 * Top-level declarations in a classic script.
 *
 * Tracks brace depth so nested declarations are ignored, and strips comments
 * and string bodies first so braces inside them cannot skew the depth. Crude
 * next to a real parser, but it only has to be right about column-zero
 * declarations in this repo's own files.
 */
function topLevelDeclarations(file) {
  const out = [];
  let depth = 0;
  let inBlockComment = false;

  fs.readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
    let clean = line;

    if (inBlockComment) {
      const end = clean.indexOf('*/');
      if (end < 0) return;
      clean = clean.slice(end + 2);
      inBlockComment = false;
    }
    clean = clean.replace(/\/\*[\s\S]*?\*\//g, '');
    if (clean.includes('/*')) {
      inBlockComment = true;
      clean = clean.slice(0, clean.indexOf('/*'));
    }
    clean = clean
      .replace(/\\./g, '')
      .replace(/'[^']*'/g, "''")
      .replace(/"[^"]*"/g, '""')
      .replace(/`[^`]*`/g, '``')
      .replace(/\/\/.*$/, '');

    if (depth === 0) {
      const fn = clean.match(/^(?:async\s+)?function\s+([A-Za-z0-9_$]+)/);
      const bind = clean.match(/^(var|let|const)\s+([A-Za-z0-9_$]+)/);
      const cls = clean.match(/^class\s+([A-Za-z0-9_$]+)/);
      if (fn) out.push({ name: fn[1], kind: 'function', line: index + 1 });
      else if (bind) out.push({ name: bind[2], kind: bind[1], line: index + 1 });
      else if (cls) out.push({ name: cls[1], kind: 'class', line: index + 1 });
    }

    for (const ch of clean) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
  });

  return out;
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.base.json'), 'utf8'));

manifest.content_scripts.forEach((entry, index) => {
  const files = entry.js.filter(f => fs.existsSync(path.join(root, f)));
  const seen = new Map();

  files.forEach(f => {
    topLevelDeclarations(path.join(root, f)).forEach(decl => {
      if (!seen.has(decl.name)) seen.set(decl.name, []);
      seen.get(decl.name).push({ file: f, ...decl });
    });
  });

  const clashes = [...seen.entries()].filter(([, sites]) => sites.length > 1);
  const describe = ([name, sites]) =>
    name + ' (' + sites.map(s => s.file.split('/').pop() + ':' + s.line).join(', ') + ')';

  check(
    'entry ' + index + ' declares each top-level name once',
    clashes.length === 0,
    clashes.length ? clashes.map(describe).join('; ') : files.length + ' files'
  );
});

// ── Rebuilding the tab bar happens once per burst ──
// A storage write and the refresh_tabs broadcast that follows it arrive
// milliseconds apart, and each rebuild clears every custom tab before re-adding
// it. Answering both showed an add, a clear, and another add. Both paths must
// therefore share one debounced entry point — a direct initTabs from either is
// the regression.
const contentMain = fs.readFileSync(path.join(root, 'content/content-main.js'), 'utf8');

check('there is exactly one debounced rebuild',
  (contentMain.match(/const refreshTabsSoon = debounce\(/g) || []).length === 1);

const handler = /function handleRefreshTabs\([\s\S]*?\n\}/.exec(contentMain);
check('the message handler routes through it, and does not render directly',
  Boolean(handler) && /refreshTabsSoon\(\)/.test(handler[0]) && !/initTabs\(/.test(handler[0]));

const listener = /function setupStorageListeners\([\s\S]*?\n\}/.exec(contentMain);
check('the storage listener routes through it too, with no timer of its own',
  Boolean(listener) && /refreshTabsSoon\(\)/.test(listener[0]) &&
  !/debounce\(/.test(listener[0]) && !/initTabs\(/.test(listener[0]));


// ── The Chrome shim covers every browser.* API content scripts actually use ──
// Firefox has `browser` natively; Chrome does not, so browser-compat.js builds
// one. Content scripts from BOTH manifest entries share a single isolated
// world, and entry 0's match patterns are a superset of entry 1's — so
// browser-compat.js always defines `browser` first, and the fallback shim in
// content-main.js, guarded by `typeof browser === 'undefined'`, never runs on
// Chrome. Anything missing from browser-compat.js is therefore simply absent.
//
// That shipped: runtime.sendMessage was added to the content-main shim, which
// never executes, so the menu-bar "+" and tab-bar drag-reorder both threw on
// Chrome while working perfectly on Firefox. Every call listed here must be
// satisfied by browser-compat.js alone.
const vm = require('vm');

/**
 * Build the shim for real and look at what it produced.
 *
 * Parsing it was worse: `storage` is assembled by an IIFE, and `.addListener`
 * is a native method on an event object rather than a key in a literal, so a
 * textual scan reports both as missing. Running it in a sandbox with a stub
 * `chrome` and no `browser` reproduces Chrome exactly.
 */
function buildChromeShim() {
  const callable = () => {};
  const stub = () => new Proxy(callable, {
    get: (target, prop) => (prop in target ? target[prop] : stub()),
  });
  const window = {};
  const context = { window, chrome: stub(), console };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'popup/js/shared/browser-compat.js'), 'utf8'), context);
  return window.browser;
}

const shim = buildChromeShim();

const contentFiles = [...new Set(manifest.content_scripts.flatMap(e => e.js))]
  .filter(f => f.startsWith('content/'));

const used = new Set();
contentFiles.forEach(f => {
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  for (const m of src.matchAll(/\bbrowser\.([A-Za-z0-9_$]+)\.([A-Za-z0-9_$]+)/g)) {
    used.add(m[1] + '.' + m[2]);
  }
});

const missing = [...used].filter(chain =>
  chain.split('.').reduce((node, key) => (node == null ? undefined : node[key]), shim) === undefined);

check('the Chrome shim builds at all', Boolean(shim));
check('browser-compat.js defines every browser.* call the content scripts make',
  missing.length === 0,
  missing.length ? 'missing: ' + missing.join(', ') : [...used].length + ' calls checked');

check('runtime.sendMessage specifically — the menu-bar "+" and drag both need it',
  typeof shim?.runtime?.sendMessage === 'function');


// ── No file is injected by more than one entry ──
// Both entries share a single isolated world, so a file listed twice runs
// twice. Function declarations tolerate that; top-level `const` does not —
// re-running utils.js raised "Identifier 'ORG_PARTITIONS' has already been
// declared" on every Setup page, aborting that copy. It survived only because
// the other copy had already populated SFTabs.utils.
const injectedBy = new Map();
manifest.content_scripts.forEach((entry, index) => {
  entry.js.forEach(file => {
    if (!injectedBy.has(file)) injectedBy.set(file, []);
    injectedBy.get(file).push(index);
  });
});
const doubled = [...injectedBy.entries()].filter(([, entries]) => entries.length > 1);
check('no file is injected by more than one entry',
  doubled.length === 0,
  doubled.length ? doubled.map(([f, e]) => f + ' (entries ' + e.join(',') + ')').join('; ')
                 : injectedBy.size + ' files');

// ── Entries that rely on another entry's scripts must be covered by it ──
// Entry 1 lists none of the shared modules; it reaches debounce, SFTabs.utils
// and the rest through entry 0's copies. That only holds where entry 0 also
// matches, so entry 0's patterns must cover every page entry 1 runs on.
const prefixOf = pattern => pattern.replace(/\*$/, '');
const covers = (outer, inner) => inner.startsWith(prefixOf(outer));

const [broad, narrow] = manifest.content_scripts;
const usesSharedModules = narrow.js.some(f => f.startsWith('popup/js/shared/'));
check('the narrower entry carries no shared modules of its own', !usesSharedModules);

const uncovered = narrow.matches.filter(m => !broad.matches.some(b => covers(b, m)));
check('every page the narrow entry runs on is also matched by the broad one',
  uncovered.length === 0,
  uncovered.length ? 'not covered: ' + uncovered.join(', ') : narrow.matches.length + ' patterns');

check('and both run at the same time, so ordering is manifest order',
  (broad.run_at || 'document_idle') === (narrow.run_at || 'document_idle'));

console.log('\n' + passed + '/' + (passed + failed) + ' passed');
process.exit(failed ? 1 : 0);
