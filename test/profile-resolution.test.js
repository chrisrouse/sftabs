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
// An unlinked org has no opinion, so the profile you picked stands.
//
// This asserted the starred default before, and could not have caught the bug:
// ON.activeProfileId and the starred default are both p_default, so the check
// passed whichever the code returned. PICKED separates them.
const PICKED = { profilesEnabled: true, autoSwitchProfiles: true, activeProfileId: 'p_test', defaultProfileId: 'p_default' };
check('unlinked org keeps the profile you picked', r(OTHER, PICKED) === 'p_test', r(OTHER, PICKED));
check('a linked org still overrides what you picked', r(DEV1, PICKED) === 'p_default', r(DEV1, PICKED));
check('with nothing picked yet, the starred default answers',
  resolveProfileForUrl(OTHER, PROFILES, { profilesEnabled: true, autoSwitchProfiles: true }) === 'p_default');

// ── An auto-set profile belongs to the org that set it ──
// Reported as "orgs with similar names get confused": Prod was linked to
// `amplify`, and every `amplify--*` sandbox rendered Prod. The names were a red
// herring — matching is exact and `amplify` never matched `amplify--dev1`.
// Visiting `amplify` auto-switched to Prod and wrote it to storage, and the
// rule for an unlinked org was "leave the user's choice alone", so it followed
// them everywhere. One linked production org governed every sandbox beside it,
// and an unrelated dev org too.
//
// activeProfileId alone cannot tell the two cases apart, hence the flag.
const LINKED = [
  { id: 'p_default', name: 'Default', isDefault: true,  urlPatterns: [] },
  { id: 'p_prod',    name: 'Prod',    isDefault: false, urlPatterns: ['amplify'] },
];
const AMPLIFY  = 'https://amplify.my.salesforce-setup.com/lightning/setup/Home';
const SANDBOX  = 'https://amplify--dev1.sandbox.my.salesforce-setup.com/x';
const UNRELATED = 'https://smartbottechnology-dev-ed.my.salesforce-setup.com/x';
const auto   = { profilesEnabled: true, autoSwitchProfiles: true, activeProfileId: 'p_prod',
                 defaultProfileId: 'p_default', activeProfileAuto: true };
const byHand = { ...auto, activeProfileAuto: false };

check('the linked org still gets its own profile',
  resolveProfileForUrl(AMPLIFY, LINKED, auto) === 'p_prod');
check('a sandbox of that org does not inherit it',
  resolveProfileForUrl(SANDBOX, LINKED, auto) === 'p_default',
  resolveProfileForUrl(SANDBOX, LINKED, auto));
check('nor does an unrelated org',
  resolveProfileForUrl(UNRELATED, LINKED, auto) === 'p_default');

check('but a profile picked by hand does follow you',
  resolveProfileForUrl(SANDBOX, LINKED, byHand) === 'p_prod' &&
  resolveProfileForUrl(UNRELATED, LINKED, byHand) === 'p_prod',
  'this is the case that broke when unlinked orgs always took the default');
check('and a linked org still overrules a hand-picked one',
  resolveProfileForUrl(AMPLIFY, LINKED, byHand) === 'p_prod');

// Installs predating the flag have no such field. Reading absent as "by hand"
// keeps their behavior exactly as it was until the next auto-switch sets it.
const legacy = { profilesEnabled: true, autoSwitchProfiles: true,
                 activeProfileId: 'p_prod', defaultProfileId: 'p_default' };
check('an install predating the flag is unchanged',
  resolveProfileForUrl(SANDBOX, LINKED, legacy) === 'p_prod');
check('the flag ships defaulted to by-hand',
  require('../popup/js/shared/constants.js').DEFAULT_SETTINGS.activeProfileAuto === false);

// With no default to fall back to, keeping the current profile beats none.
check('no starred default leaves the active profile in place',
  resolveProfileForUrl(SANDBOX, [{ id: 'p_prod', urlPatterns: ['amplify'] }], auto) === 'p_prod');

// ── Switching a profile must not rewrite the profile list ──
// It used to, from the snapshot read at the top of checkAndSwitchProfile, in
// order to persist lastActive — a field written in four places and read in
// none. Anything the popup changed in the seconds between that read and the
// write was reverted: a rename, the linked orgs, the starred default, the order
// they are dragged into. The userSettings write beside it re-reads first to
// avoid exactly this; the profiles write never did.
//
// Now more dangerous than it was: since an auto-set profile gives way to the
// default on an unclaimed org, the worker switches — and so wrote the list —
// on far more navigations than before.
const bgSrc = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
const switcher = /async function checkAndSwitchProfile[\s\S]*?\n\}/.exec(bgSrc);

check('checkAndSwitchProfile exists', Boolean(switcher));
check('switching does not write the profile list back',
  Boolean(switcher) &&
  !/saveChunkedSync\('profiles'/.test(switcher[0]) &&
  !/storage\.local\.set\(\{ profiles \}\)/.test(switcher[0]),
  'a whole-array write from a stale snapshot reverts whatever was edited meanwhile');
check('and nothing sets the dead field it was written for',
  !/lastActive = new Date/.test(bgSrc),
  'lastActive is written in four places and read in none');
check('the settings write still re-reads and touches only its own fields',
  Boolean(switcher) &&
  /const current = \(await browser\.storage\.sync\.get\('userSettings'\)\)/.test(switcher[0]) &&
  /\.\.\.current,\s*\n\s*activeProfileId:/.test(switcher[0]));

// The worker has to mark its own writes, or the flag never becomes true.
check('the worker marks a profile it set as auto',
  /activeProfileAuto: true/.test(bgSrc));
check('and drops an auto-set profile on an org nothing claims',
  /else if \(settings\.activeProfileAuto\)[\s\S]{0,320}defaultProfile/.test(bgSrc));
check('while still leaving a hand-picked one alone',
  /The active profile was picked by hand, so it stands/.test(bgSrc));

const popupSrc = fs.readFileSync(path.join(__dirname, '..', 'js/popup.js'), 'utf8');
check('the popup marks a manual switch as manual',
  /activeProfileId: profileId, activeProfileAuto: false/.test(popupSrc));

// A surface that ignores the flag would render the pre-fix answer.
const { PROFILE_SETTINGS } = require('../popup/js/shared/utils.js');
check('content surfaces re-render when the flag alone changes',
  PROFILE_SETTINGS.includes('activeProfileAuto'),
  'the same activeProfileId resolves differently either side of it');


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
// The worker does not merely render the wrong profile on an unlinked org — it
// wrote activeProfileId back to storage, so a manual switch survived only until
// the next navigation. Pinned by absence: no default lookup on the no-match path.
// Narrowed: it leaves a HAND-PICKED profile alone on an unlinked org. An
// auto-set one is dropped there, which is the fix above.
check('background.js leaves a hand-picked profile alone on an unlinked org',
  /The active profile was picked by hand, so it stands/.test(bg));
check('and only reaches for the default when nothing has been picked',
  /else if \(!settings\.activeProfileId\)/.test(bg));
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


// ── An org is one org, whichever of its hosts you are on ──
// Experience Builder sits on a different domain from Lightning, so a profile
// configured against the org has to claim the builder page too — otherwise the
// floating panel and header menu fall back to whatever profile is globally
// active and list another org's tabs.
const SAME_ORG = [
  ['sandbox',   'https://acme--dev1.sandbox.my.salesforce.com/x',
                'https://acme--dev1.sandbox.builder.salesforce-experience.com/y'],
  ['production','https://acme.lightning.force.com/x',
                'https://acme.builder.salesforce-experience.com/y'],
];
for (const [label, lightning, builder] of SAME_ORG) {
  check(`a ${label} builder page is the same org as its Lightning page`,
    extractOrgIdentifier(lightning) === extractOrgIdentifier(builder) &&
    detectOrgEnvironment(lightning) === detectOrgEnvironment(builder),
    extractOrgIdentifier(builder) + '/' + detectOrgEnvironment(builder));
}

check('so a profile matching the org also matches its builder page',
  resolveProfileForUrl(
    'https://acme--dev1.sandbox.builder.salesforce-experience.com/sfsites/picasso/core/config/commeditor.jsp',
    [{ id: 'p1', name: 'Dev1', urlPatterns: ['acme--dev1'] }],
    { profilesEnabled: true, autoSwitchProfiles: true, activeProfileId: 'other' }) === 'p1');

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
  // Experience Builder is on its own domain. The manifest injects there, but
  // this list did not know the host, so every builder page resolved to no org:
  // no favicon tint, and no profile match either.
  ['acme.builder.salesforce-experience.com',            'acme',       'production'],
  ['acme--dev1.sandbox.builder.salesforce-experience.com', 'acme--dev1', 'sandbox'],
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

// Nor does a Developer Edition org, unless it moved. Salesforce appends -dev-ed
// to the My Domain of every DE org and reserves the suffix, so it is as reliable
// a signal as the partition word.
//
// This one mattered more than the sandbox case: with no partition and no --,
// a DE org fell through to `production` and was painted red — the one color
// whose whole job is to make you stop and check where you are.
for (const host of [
  'smartbottechnology-dev-ed.my.salesforce-setup.com',
  'smartbottechnology-dev-ed.my.salesforce.com',
  'smartbottechnology-dev-ed.lightning.force.com',
]) {
  check(`${host} is developer, not production`,
    detectOrgEnvironment(`https://${host}/x`) === 'developer',
    String(detectOrgEnvironment(`https://${host}/x`)));
}
check('and the identifier still carries the suffix, so per-org overrides match',
  extractOrgIdentifier('https://smartbottechnology-dev-ed.my.salesforce.com/x')
    === 'smartbottechnology-dev-ed');
check('a DE org that did move is unaffected',
  detectOrgEnvironment('https://chrisrousepw-dev-ed.develop.my.salesforce-setup.com/x') === 'developer');

// The suffix has to be the end of the identifier, not merely present in it.
check('a production org is not mistaken for one',
  detectOrgEnvironment('https://acme-development.my.salesforce.com/x') === 'production' &&
  detectOrgEnvironment('https://dev-ed-partners.my.salesforce.com/x') === 'production');

// Non-Salesforce and unrecognised shapes stay null rather than guessing.
for (const host of ['example.com', 'foo.bar.lightning.force.com', 'not a url']) {
  check(`${host} yields no identifier`, extractOrgIdentifier(`https://${host}/`) === null);
  check(`${host} yields no environment`, detectOrgEnvironment(`https://${host}/`) === null);
}

const failed = results.filter(x => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
