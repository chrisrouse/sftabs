#!/usr/bin/env node
/**
 * Profile-per-page resolution.
 *
 * Two orgs open at once must each render their own tabs. That only works if the
 * profile is a function of the page's URL rather than the single global
 * activeProfileId — with the global value, whichever org was activated last
 * governed every page, so two windows (and two tabs) fought over it.
 *
 * The matching here has to stay identical to checkAndSwitchProfile in
 * background.js. If they drift, a page renders one profile while the popup
 * claims another.
 *
 * Run: npm test
 */
const { extractOrgIdentifier, resolveProfileForUrl } = require('../popup/js/shared/utils.js');
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

// The reported bug: same behaviour whether the orgs are in one window or two,
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

// And the two implementations must still agree.
const bg = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
check('background.js still compares org identifiers by exact equality',
  /pattern\.toLowerCase\(\) === orgIdentifier\.toLowerCase\(\)/.test(bg));
for (const url of [DEV1, QA, OTHER]) {
  const org = extractOrgIdentifier(url);
  const bgMatch = PROFILES.find(p => (p.urlPatterns || []).some(x => x.toLowerCase() === String(org).toLowerCase()));
  const bgTarget = bgMatch || PROFILES.find(p => p.isDefault) || PROFILES.find(p => p.id === ON.defaultProfileId);
  check(`resolver agrees with background for ${org}`, bgTarget.id === r(url, ON));
}

const failed = results.filter(x => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
