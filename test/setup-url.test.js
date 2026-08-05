#!/usr/bin/env node
/**
 * Where a tab points.
 *
 * A Salesforce Setup node lives at `/lightning/setup/{node}/home` and the
 * `/home` is not optional — `/lightning/setup/SalesCloudEverywhereSettings`
 * does not resolve. Three kinds of path are exceptions: an ObjectManager path
 * is already complete, a fully-qualified `/lightning/…` path is a link scraped
 * from Salesforce's own navigation and must be used verbatim, and a custom URL
 * may be absolute and point at another host entirely.
 *
 * This rule was written out five times, and every copy had drifted. One omitted
 * the `/home`, so any tab moved into a folder 404'd — that shipped. One omitted
 * the `/lightning/` passthrough, so a promoted nav item got double-prefixed.
 * Two omitted the absolute-URL check, turning a custom `https://example.com`
 * link into `https://org.lightning.force.com/https://example.com`.
 *
 * This file used to check that all five *stated* the rule, because none of them
 * could be called: each read window.location and expected a DOM. There is one
 * now, it takes an origin, and it can simply be tested. The last section guards
 * against a sixth appearing.
 *
 * Run: npm test
 */
const fs = require('fs');
const path = require('path');
const { tabDestinationUrl } = require('../popup/js/shared/utils.js');

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

const ORIGIN = 'https://acme.my.salesforce-setup.com';
const url = (tab, origin = ORIGIN) => tabDestinationUrl(tab, origin);

// ── The rule ──
check('a bare Setup node gets /home',
  url({ path: 'SalesCloudEverywhereSettings' }) === ORIGIN + '/lightning/setup/SalesCloudEverywhereSettings/home',
  'without it the page does not resolve');

check('an ObjectManager path is already complete',
  url({ path: 'ObjectManager/Account/Details/view' }) === ORIGIN + '/lightning/setup/ObjectManager/Account/Details/view');

check('an object tab goes to /lightning/o/',
  url({ path: 'Account/list', isObject: true }) === ORIGIN + '/lightning/o/Account/list');

check('a scraped nav link is used verbatim',
  url({ path: '/lightning/setup/Flows/page?address=%2F300' }) === ORIGIN + '/lightning/setup/Flows/page?address=%2F300',
  'appending /home to one of these breaks it');

check('a relative custom URL gets a leading slash',
  url({ path: 'apex/MyPage', isCustomUrl: true }) === ORIGIN + '/apex/MyPage');
check('a rooted custom URL is left as-is',
  url({ path: '/apex/MyPage', isCustomUrl: true }) === ORIGIN + '/apex/MyPage');
check('an absolute custom URL keeps its own host',
  url({ path: 'https://example.com/x', isCustomUrl: true }) === 'https://example.com/x',
  'prefixing the org origin produced https://org/https://example.com');

// ── Precedence, which is where copies disagreed ──
check('custom beats everything, even an ObjectManager-looking path',
  url({ path: 'https://example.com/ObjectManager/x', isCustomUrl: true }) === 'https://example.com/ObjectManager/x');
check('a fully-qualified path beats the object branch',
  url({ path: '/lightning/o/Account/list', isObject: true }) === ORIGIN + '/lightning/o/Account/list',
  'and is not re-prefixed');
check('the object branch beats the ObjectManager check',
  url({ path: 'ObjectManager/list', isObject: true }) === ORIGIN + '/lightning/o/ObjectManager/list');

// ── Folders have no destination ──
check('a folder tab returns null', url({ path: '' }) === null);
check('whitespace is not a path', url({ path: '   ' }) === null);
check('a missing path returns null', url({}) === null);
check('no tab at all returns null', url(null) === null && url(undefined) === null);

// ── The origin is the caller's business ──
// The popup acts on another tab, and its own origin is an extension URL.
check('the supplied origin is used',
  url({ path: 'Flows' }, 'https://other.lightning.force.com') === 'https://other.lightning.force.com/lightning/setup/Flows/home');

// ── One copy, and it stays that way ──
// Every file that used to build this URL now delegates. A new inline copy is
// how the /home bug got in, so it is worth failing loudly on.
const CALLERS = ['content/tab-renderer.js', 'content/content-main.js',
                 'content/floating-modal.js', 'js/popup.js'];
const INLINE_RULE = /\/lightning\/setup\/\$\{[^}]*\}\/home/;

for (const rel of CALLERS) {
  const src = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  check(`${rel.split('/').pop()} delegates rather than rebuilding the rule`,
    !INLINE_RULE.test(code),
    'add a case to tabDestinationUrl instead of a sixth copy');
}

const utils = fs.readFileSync(path.join(__dirname, '..', 'popup/js/shared/utils.js'), 'utf8');
check('and utils.js holds exactly one implementation',
  (utils.match(INLINE_RULE) || []).length === 1);

console.log('\n' + passed + '/' + (passed + failed) + ' passed');
process.exit(failed ? 1 : 0);
