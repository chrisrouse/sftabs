#!/usr/bin/env node
/**
 * Profile-per-page resolution.
 *
 * Two orgs open at once must each render their own tabs. That only works if the
 * profile is a function of the page's URL rather than the single global
 * activeProfileId — with the global value, whichever org was activated last
 * governed every page, so two windows (and two tabs) fought over it.
 *
 * The background worker used to keep its own copy of extractOrgIdentifier, and
 * this file existed partly to catch the two drifting. They now share the one in
 * shared utils, so what is pinned instead is that the sharing holds — plus the
 * org-host shapes themselves, since a host that resolves to nothing silently
 * resolves to no profile either.
 *
 * Run: npm test
 */
const { extractOrgIdentifier, detectOrgEnvironment, resolveProfileForUrl } =
  require('../popup/js/shared/utils.js');
const fs = require('fs');
const path = require('path');

const PROFILES = [
  { id: 'p_default', name: 'Default', isDefault: true,  urlPatterns: ['amplify--dev1'] },
  { id: 'p_test',    name: 'test',    isDefault: false, urlPatterns: ['amplify--qa'] },
];
const ON  = { profilesEnabled: true, autoSwitchProfiles: true,  activeProfileId: 'p_default', defaultProfileId: 'p_default' };
const OFF = { profilesEnabled: true, autoSwitchProfiles: false, activeProfileId: 'p_test',    defaultProfileId: 'p_default' };

const DEV1  = 'https://amplify--dev1.sandbox.my.salesforce-setup.com/lightning/setup/Home';
const QA    = 'https://amplify--qa.sandbox.my.salesforce-setup.com/lightning/setup/IntegrationConfiguration/home';
const OTHER = 'https://acme.my.salesforce.com/lightning/setup/Home';

const results = [];
const check = (name, pass, detail = '') => {
  results.push(pass);
  console.log(`${pass ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};
const r = (url, s) => resolveProfileForUrl(url, PROFILES, s);

// The reported bug: same behavior whether the orgs are in one window or two,
// because nothing here depends on window or focus.
check('linked org resolves to its own profile', r(DEV1, ON) === 'p_default', r(DEV1, ON));
check('a second linked org resolves independently', r(QA, ON) === 'p_test', r(QA, ON));
check('two orgs do not share one profile', r(DEV1, ON) !== r(QA, ON));
check('unlinked org falls back to the starred default', r(OTHER, ON) === 'p_default', r(OTHER, ON));

// Anyone not using linked orgs must see no change at all.
check('auto-switch off: global active profile governs', r(DEV1, OFF) === 'p_test' && r(QA, OFF) === 'p_test');
check('profiles disabled: global active profile governs',
  r(DEV1, { ...ON, profilesEnabled: false }) === 'p_default');

// Degenerate inputs must not throw or invent a profile.
check('no profiles: returns the active id', r(DEV1, ON) && resolveProfileForUrl(DEV1, [], ON) === 'p_default');
check('non-Salesforce host: falls back', resolveProfileForUrl('https://example.com/x', PROFILES, ON) === 'p_default');
check('junk url does not throw', (() => {
  try { resolveProfileForUrl('not a url', PROFILES, ON); return true; } catch { return false; }
})());
check('missing settings does not throw', (() => {
  try { return resolveProfileForUrl(DEV1, PROFILES, undefined) === null; } catch { return false; }
})());

// Case-insensitive, matching background.js.
check('pattern match is case-insensitive',
  resolveProfileForUrl(DEV1, [{ id: 'x', urlPatterns: ['AMPLIFY--DEV1'] }], ON) === 'x');

// ── The background worker shares this matching rather than copying it ──
const bg = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
check('background.js still compares org identifiers by exact equality',
  /pattern\.toLowerCase\(\) === orgIdentifier\.toLowerCase\(\)/.test(bg));
check('background.js has no copy of extractOrgIdentifier',
  !/^function extractOrgIdentifier/m.test(bg));
check('background.js calls the shared one',
  /SFTabs\.utils\.extractOrgIdentifier\(/.test(bg));
// Both mechanisms must list it — Chrome imports, Firefox declares. Asserted by
// membership rather than exact text, because the worker now loads constants.js
// alongside it for the shared chunk layer.
const builder = fs.readFileSync(path.join(__dirname, '..', 'build-manifest.js'), 'utf8');
const imported = /importScripts\(([^)]*)\)/.exec(bg);
const declared = /scripts: \[([^\]]*)\]/.exec(builder);
check('and can load it — Chrome imports, Firefox lists it first',
  Boolean(imported) && imported[1].includes('popup/js/shared/utils.js') &&
  Boolean(declared) && declared[1].includes('popup/js/shared/utils.js'));
check('utils.js is listed before background.js for Firefox',
  Boolean(declared) &&
  declared[1].indexOf('utils.js') < declared[1].indexOf('background.js'));

// ── Every org host shape Salesforce hands out ──
// A shape that resolves to no identifier resolves to no profile, silently. Four
// of these returned null until the matcher was rewritten: Developer Edition on
// its main domain, plus scratch, demo, patch and Trailhead Playground orgs.
const HOSTS = [
  ['acme.my.salesforce.com',                     'acme',       'production'],
  ['acme.lightning.force.com',                   'acme',       'production'],
  ['acme.my.salesforce-setup.com',               'acme',       'production'],
  ['acme.salesforce.com',                        'acme',       'production'],
  ['acme--dev1.sandbox.my.salesforce.com',       'acme--dev1', 'sandbox'],
  ['acme--dev1.sandbox.lightning.force.com',     'acme--dev1', 'sandbox'],
  ['acme--dev1.sandbox.my.salesforce-setup.com', 'acme--dev1', 'sandbox'],
  ['acme.develop.my.salesforce.com',             'acme',       'developer'],
  ['acme.develop.lightning.force.com',           'acme',       'developer'],
  ['acme.scratch.my.salesforce.com',             'acme',       'scratch'],
  ['acme.demo.my.salesforce.com',                'acme',       'demo'],
  ['acme.trailblaze.my.salesforce.com',          'acme',       'playground'],
  ['acme.patch.my.salesforce.com',               'acme',       'patch'],
];
for (const [host, id, env] of HOSTS) {
  const url = `https://${host}/lightning/setup/Flows/home`;
  check(`${host} -> ${id}`, extractOrgIdentifier(url) === id, String(extractOrgIdentifier(url)));
  check(`${host} is ${env}`, detectOrgEnvironment(url) === env, String(detectOrgEnvironment(url)));
}

// A sandbox on an org that never moved to enhanced domains has no partition
// word, only the -- in its name.
check('-- means sandbox even without a partition word',
  detectOrgEnvironment('https://acme--dev1.lightning.force.com/x') === 'sandbox');

// Non-Salesforce and unrecognised shapes stay null rather than guessing.
for (const host of ['example.com', 'foo.bar.lightning.force.com', 'not a url']) {
  check(`${host} yields no identifier`, extractOrgIdentifier(`https://${host}/`) === null);
  check(`${host} yields no environment`, detectOrgEnvironment(`https://${host}/`) === null);
}

const failed = results.filter(x => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
