#!/usr/bin/env node
/**
 * Turning a stored tab path into a Setup URL.
 *
 * A Salesforce Setup node is addressed as `/lightning/setup/{node}/home`, and
 * the `/home` is not optional — `/lightning/setup/SalesCloudEverywhereSettings`
 * does not resolve. Two kinds of path are exceptions: an ObjectManager path is
 * already complete, and a path arriving fully qualified with `/lightning/` is a
 * link scraped from Salesforce's own nav and has to be used verbatim.
 *
 * That rule is written out in six separate functions. Duplication is the
 * whole reason this file exists. Moving a tab into a folder broke it, because
 * the one copy that folder children go through — navigateToNavigationItem —
 * had the bare form with no `/home`. The same tab worked at top level and 404'd
 * inside a folder, since the two go through different functions.
 *
 * So this is a source test rather than a behaviour test. Every copy reads
 * `window.location` and is wired into a DOM, which makes them all awkward to
 * call directly; but drift between them is a real defect that has now shipped
 * once, and drift is plainly visible in the source. The invariant is that each
 * builder states the whole rule: the exception and the `/home`. A builder that
 * mentions only one of the two has half the rule, which is how this broke.
 *
 * Adding a seventh builder means adding it to BUILDERS below. Better still,
 * don't add one.
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

/** Every function in the extension that turns a tab path into a Setup URL. */
const BUILDERS = [
  ['popup/js/shared/utils.js',   'buildFullUrl'],
  ['js/popup.js',                'navigateToTab'],
  ['content/content-main.js',    'createTabElementWithLightningAndDropdown'],
  ['content/content-main.js',    'navigateToNavigationItem'],
  ['content/content-main.js',    'handleNavigateToTab'],
  ['content/tab-renderer.js',    'buildTabBarUrl'],
  ['content/floating-modal.js',  'buildTabUrl'],
];

const APPENDS_HOME = /\/home`/;
const GUARDS_OBJECT_MANAGER = /ObjectManager\//;

/** The source of one function, by brace matching from its declaration. */
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

// ── Every builder states the whole rule ──
for (const [rel, name] of BUILDERS) {
  const body = bodyOf(rel, name);
  if (!body) {
    check(`${name} exists in ${rel}`, false, 'not found — renamed or removed?');
    continue;
  }
  const home = APPENDS_HOME.test(body);
  const guard = GUARDS_OBJECT_MANAGER.test(body);
  check(`${rel.split('/').pop()} ${name} appends /home to a bare setup node`, home);
  check(`${rel.split('/').pop()} ${name} exempts ObjectManager paths`, guard);
}

// ── The specific regression ──
// A tab at top level and the same tab inside a folder go through different
// functions, and must agree — otherwise moving a tab silently breaks it.
const topLevel = bodyOf('content/tab-renderer.js', 'buildTabBarUrl');
const inFolder = bodyOf('content/content-main.js', 'navigateToNavigationItem');

check('a folder child and a top-level tab both append /home',
  APPENDS_HOME.test(topLevel) && APPENDS_HOME.test(inFolder));
check('a folder child still passes a fully-qualified nav link through untouched',
  inFolder.includes("path.startsWith('/lightning/')"));

// Order matters. A scraped nav link such as /lightning/setup/Flows/page must
// leave before the /home branch, or it gets /home stapled onto the end of it.
check('and that check runs before the /home branch',
  inFolder.indexOf("startsWith('/lightning/')") < inFolder.search(APPENDS_HOME));

console.log('\n' + passed + '/' + (passed + failed) + ' passed');
process.exit(failed ? 1 : 0);
