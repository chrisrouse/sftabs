#!/usr/bin/env node
/**
 * Turning the page you are on into a tab.
 *
 * Two things capture a page now — Quick Add in the popup and the "+" at the end
 * of the Salesforce menu bar — and they have to agree completely. A tab named
 * one way from the toolbar and another way from the popup would look like a
 * bug in whichever you used second.
 *
 * So the parsing lives once, in shared utils. These cases were taken from the
 * implementation that shipped inside popup-tabs.js and checked against it
 * before the extraction, so this file also pins the behaviour that already
 * existed rather than only the behaviour I intended.
 *
 * Run: npm test
 */
const { parsePageToTab, DEFAULT_SETTINGS } = (() => ({
  ...require('../popup/js/shared/utils.js'),
  ...require('../popup/js/shared/constants.js'),
}))();

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

const HOST = 'https://acme.lightning.force.com';

// ── The setting ──
check('the menu-bar button is opt-in', DEFAULT_SETTINGS.menuBarQuickAdd === false);

// ── Pages it refuses ──
check('a non-Salesforce page yields nothing',
  parsePageToTab('https://example.com/anything', 'Example') === null);
check('no url yields nothing', parsePageToTab('', 'x') === null &&
  parsePageToTab(null, 'x') === null);
check('a Salesforce host with no usable path yields nothing',
  parsePageToTab(`${HOST}/lightning/setup/`, 'Setup') === null);

// ── Setup pages ──
const flows = parsePageToTab(`${HOST}/lightning/setup/Flows/home`, 'Flows | Salesforce');
check('a setup page keeps its path without the /home suffix', flows.path === 'Flows');
check('and takes its name from the page title', flows.label === 'Flows');
check('a setup page is neither an object nor a custom url',
  flows.isObject === false && flows.isCustomUrl === false && flows.isSetupObject === false);

check('/view is stripped the same way /home is',
  parsePageToTab(`${HOST}/lightning/setup/SomePage/view`, '').path === 'SomePage');
check('a query string is dropped from setup paths',
  parsePageToTab(`${HOST}/lightning/setup/Flows/home?x=1`, 'Flows').path === 'Flows');

// ── Object Manager ──
// The whole path is kept so the tab reopens the exact section, and the tab is
// flagged so it can carry a dropdown of the object's other sections.
const om = parsePageToTab(
  `${HOST}/lightning/setup/ObjectManager/Account/FieldsAndRelationships/view`, '');
check('ObjectManager keeps its full path',
  om.path === 'ObjectManager/Account/FieldsAndRelationships/view');
check('and is flagged as a setup object', om.isSetupObject === true);
check('its name is object then section, camel case split',
  om.label === 'Account - Fields And Relationships');
check('the Details section is left out of the name',
  parsePageToTab(`${HOST}/lightning/setup/ObjectManager/Account/Details/view`, '').label === 'Account');

// A custom object shows a record id in the URL, so the title supplies the name.
check('an id in the path defers to the page title',
  parsePageToTab(`${HOST}/lightning/setup/ObjectManager/01I5f000000abcd/Details/view`,
    'Setup: Widget | Salesforce').label === 'Widget');

// ── Object pages ──
const list = parsePageToTab(`${HOST}/lightning/o/Account/list?filterName=Recent`, 'Accounts | Salesforce');
check('an object page is flagged as one', list.isObject === true);
check('its query string is kept, since list views identify themselves with it',
  list.path === 'Account/list?filterName=Recent');
check('it takes its name from the title', list.label === 'Accounts');
check('without a title it falls back to the object and view',
  parsePageToTab(`${HOST}/lightning/o/Account/list`, '').label === 'Account List');

// ── Custom URLs ──
const apex = parsePageToTab(`${HOST}/apex/MyPage`, 'My Page | Salesforce');
check('anything else on the host is a custom url', apex.isCustomUrl === true);
check('its path is everything after the host', apex.path === 'apex/MyPage');
check('it prefers the page title', apex.label === 'My Page');
check('and falls back to the path when there is none',
  parsePageToTab(`${HOST}/apex/MyPage`, '').label === 'My Page');
check('my.salesforce.com counts as a custom url host',
  parsePageToTab('https://acme.my.salesforce.com/0015f00000abcde', 'Record').isCustomUrl === true);

// ── The shape the caller relies on ──
const keys = Object.keys(flows).sort().join(',');
check('every result carries the same fields',
  keys === 'isCustomUrl,isObject,isSetupObject,label,path', keys);
check('a name is never empty',
  [`${HOST}/lightning/setup/Flows/home`, `${HOST}/lightning/o/Account/list`,
   `${HOST}/apex/MyPage`, `${HOST}/lightning/setup/ObjectManager/Account/Details/view`]
    .every(url => (parsePageToTab(url, '')?.label || '').trim().length > 0));

console.log('\n' + passed + '/' + (passed + failed) + ' passed');
process.exit(failed ? 1 : 0);
