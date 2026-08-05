#!/usr/bin/env node
/**
 * The shared modules export themselves twice, and both lists must agree.
 *
 * `utils.js` and `constants.js` are loaded two ways: `require`d by the tests
 * and the build scripts, and injected as classic scripts into the popup, the
 * settings page, both content-script entries and the background worker. So each
 * ends in a branch — `module.exports = {...}` for the first, a
 * `globalThis.SFTabs.* = {...}` literal for the second — and every export is
 * named twice, by hand, in two places.
 *
 * Adding a function to one list and not the other produces the worst kind of
 * failure: the test suite imports the CommonJS side and passes, while the
 * browser reads `undefined` off the other. That shipped — `floatingButtonAllowedHere`
 * went into the CommonJS list only, so the gate it controls silently evaluated
 * falsy and the floating button disappeared for everyone, with a green suite.
 *
 * Optional chaining makes it worse, not better: `utils?.thing?.(x)` on a
 * missing export yields `undefined` rather than throwing, so the mistake reads
 * as a legitimate negative answer.
 *
 * The browser branch is evaluated in a sandbox with no `module`, which is what
 * makes it take that path.
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

/** What the file attaches to SFTabs when there is no `module` to export to. */
function browserExports(rel, namespace) {
  const context = { console };
  context.globalThis = context;
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), context);
  return context.SFTabs && context.SFTabs[namespace];
}

const MODULES = [
  ['popup/js/shared/utils.js', 'utils'],
  ['popup/js/shared/constants.js', 'constants'],
];

for (const [rel, namespace] of MODULES) {
  const name = rel.split('/').pop();
  const browser = browserExports(rel, namespace);

  check(`${name} attaches SFTabs.${namespace} in a browser scope`, Boolean(browser));
  if (!browser) continue;

  const fromNode = new Set(Object.keys(require(path.join(ROOT, rel))));
  const fromBrowser = new Set(Object.keys(browser));

  const missingInBrowser = [...fromNode].filter(k => !fromBrowser.has(k));
  const missingInNode = [...fromBrowser].filter(k => !fromNode.has(k));

  check(`${name}: everything require() exposes is on SFTabs.${namespace} too`,
    missingInBrowser.length === 0,
    missingInBrowser.length ? 'browser is missing: ' + missingInBrowser.join(', ')
                            : fromNode.size + ' exports');

  check(`${name}: everything on SFTabs.${namespace} is require()-able too`,
    missingInNode.length === 0,
    missingInNode.length ? 'CommonJS is missing: ' + missingInNode.join(', ') : 'in step');
}

// ── The specific regression ──
// The floating button's visibility gate reads this off the browser object. When
// it was absent the call returned undefined, the gate read falsy, and the
// button vanished no matter what the user had chosen.
const utils = browserExports('popup/js/shared/utils.js', 'utils');
check('floatingButtonAllowedHere is reachable the way the content script reaches it',
  typeof utils.floatingButtonAllowedHere === 'function');
check('and answers true for an enabled button set to everywhere',
  typeof utils.floatingButtonAllowedHere === 'function' &&
  utils.floatingButtonAllowedHere('https://acme.lightning.force.com/lightning/o/Account/list',
    { enabled: true, location: 'everywhere' }) === true);

// Same shape, same hazard: these are read off SFTabs.utils by content scripts.
for (const fn of ['resolveFloatingSide', 'resolveOrgColor', 'reorderTopLevelTabs',
                  'tabOrderMatches', 'parsePageToTab', 'orgFaviconDataUrl']) {
  check(`${fn} is reachable off SFTabs.utils`, typeof utils[fn] === 'function');
}


// ── The modules the background worker loads must survive having no window ──
// A service worker has no `window`. utils.js has always exported via globalThis
// for that reason; constants.js used `window.SFTabs` and only got away with it
// because the worker did not load it. The moment it did, `window is not
// defined` killed the worker outright — no listeners, no quick-add, no
// auto-switch, and nothing in the popup to hint at why.
//
// The list comes from the manifest, so adding a file to the worker's scripts
// automatically brings it under this check.
const workerScripts = (() => {
  // Two mechanisms, one per browser. Firefox lists them in the manifest's
  // background.scripts; Chrome's service worker pulls them in with
  // importScripts. Both must be checked, or a module added to only one of them
  // escapes.
  const built = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const fromManifest = (built.background || {}).scripts || [];

  const background = fs.readFileSync(path.join(ROOT, 'background.js'), 'utf8');
  const call = /importScripts\(([^)]*)\)/.exec(background);
  const fromImport = call ? [...call[1].matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1]) : [];

  return [...new Set([...fromManifest, ...fromImport])];
})().filter(f => f.startsWith('popup/js/shared/'));

check('the worker loads at least one shared module', workerScripts.length > 0,
  workerScripts.join(', '));

for (const rel of workerScripts) {
  let error = null;
  try {
    const context = { console };
    context.globalThis = context;          // deliberately no `window`
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), context);
  } catch (e) {
    error = e.message;
  }
  check(`${rel.split('/').pop()} loads in a worker scope`, error === null,
    error || 'no window needed');
}

console.log('\n' + passed + '/' + (passed + failed) + ' passed');
process.exit(failed ? 1 : 0);
