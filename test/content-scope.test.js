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

console.log('\n' + passed + '/' + (passed + failed) + ' passed');
process.exit(failed ? 1 : 0);
