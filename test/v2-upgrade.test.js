#!/usr/bin/env node
/**
 * What 3.0.0 does to a 2.1.1 install it has never seen.
 *
 * This path cannot be rehearsed after release and cannot be reached by using
 * the extension normally — you would have to run 2.1.1 for a while, then
 * upgrade over it. So the install is built from a fixture instead and v3's own
 * readers are run over it, unmodified.
 *
 * There is no schema migration between the two: v3 reads v2's keys as they are.
 * That makes the risk quieter, not smaller. What can go wrong is a v3 reader
 * meeting a field v2 never wrote and getting `undefined` — and `undefined` in a
 * boolean position is a silently-off feature, while `undefined` in a colour or
 * a profile id is a surface that renders nothing and says nothing.
 *
 * Six settings keys are new in 3.0.0: activeProfileAuto, headerMenu,
 * menuBarQuickAdd, orgColors, quickAddAllProfiles, tabColors. None was removed.
 * floatingButton gained side, offset and layout on top of the legacy `position`
 * percentage.
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
const FIXTURE = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'docs/test-fixtures/v2-install.json'), 'utf8'));

const utils = require('../popup/js/shared/utils.js');
const { DEFAULT_SETTINGS } = require('../popup/js/shared/constants.js');

const PROD_ID = '1699999999999_prodv2';
const DEFAULT_ID = '1699999999998_defaultv2';

// ── The upgrade reads through mergeUserSettings, as getUserSettings does ──
const stored = FIXTURE.sync.userSettings;
const merged = utils.mergeUserSettings(DEFAULT_SETTINGS, stored);

check('every key 3.0.0 added arrives with its default',
  ['activeProfileAuto', 'headerMenu', 'menuBarQuickAdd', 'orgColors',
   'quickAddAllProfiles', 'tabColors'].every(key => merged[key] !== undefined),
  'undefined in a boolean position is a feature that is off and cannot be turned on');

check('and nothing the user had configured is disturbed',
  merged.themeMode === 'dark' &&
  merged.skipDeleteConfirmation === true &&
  merged.activeProfileId === PROD_ID &&
  merged.defaultProfileId === DEFAULT_ID &&
  merged.profilesEnabled === true &&
  merged.autoSwitchProfiles === true);

// The new on-page surfaces must not appear uninvited. Someone upgrading has not
// asked for a banner across every Salesforce page.
check('the new surfaces are all off until switched on',
  merged.orgColors.enabled === false && merged.orgColors.banner === false &&
  merged.tabColors.enabled === false && merged.headerMenu.enabled === false &&
  merged.menuBarQuickAdd === false);

// Nested defaults are the case a one-level spread gets wrong, and orgColors is
// the branch where getting it wrong loses data rather than a preference.
check('nested defaults fill in without flattening the branch',
  Array.isArray(merged.orgColors.orgs) &&
  typeof merged.orgColors.environments === 'object' &&
  merged.orgColors.bannerLocation === 'everywhere' &&
  merged.tabColors.style === 'dot');

// ── The floating button, written before three of its fields existed ──
check('the legacy button keeps the edge it had',
  utils.resolveFloatingSide(merged.floatingButton) === 'right',
  'no side was ever stored, and defaulting to nothing hides the button');
check('and its location choice still applies',
  utils.floatingButtonAllowedHere(
    'https://acme.my.salesforce-setup.com/lightning/setup/Flows/home', merged.floatingButton) === true &&
  utils.floatingButtonAllowedHere(
    'https://acme.lightning.force.com/lightning/r/Account/001/view', merged.floatingButton) === false,
  'setup-only was stored in v2 and must survive');
check('the legacy percentage is preserved for the popup to convert',
  merged.floatingButton.position === 40 && merged.floatingButton.offset === 0,
  'offset 0 is what tells the popup to derive pixels from the percentage');

// ── Profiles resolve, including the chunked one ──
const profiles = FIXTURE.sync.profiles;
check('a linked org still resolves to its profile',
  utils.resolveProfileForUrl(
    'https://acme.my.salesforce-setup.com/lightning/setup/Flows/home', profiles, merged) === PROD_ID);

// activeProfileAuto is absent on every upgraded install. Reading absent as
// "picked by hand" is what keeps day-one behaviour identical to 2.1.1.
check('an unclaimed org behaves exactly as it did in 2.1.1',
  utils.resolveProfileForUrl(
    'https://other.my.salesforce.com/x', profiles, merged) === PROD_ID,
  'the active profile stands, because nothing has auto-switched yet');
check('and once it has, the org stops inheriting it',
  utils.resolveProfileForUrl(
    'https://other.my.salesforce.com/x', profiles,
    { ...merged, activeProfileAuto: true }) === DEFAULT_ID);

// ── The chunked profile is readable ──
// v2 wrote these chunks; v3 reassembles them with a different implementation.
// A profile that outgrew a single sync value is the one whose tabs go missing
// silently, because a plain get returns undefined and every caller coalesces
// that to an empty list.
(async () => {
  const area = data => ({
    get: keys => {
      const want = keys == null ? Object.keys(data) : (Array.isArray(keys) ? keys : [keys]);
      const out = {};
      for (const key of want) if (key in data) out[key] = data[key];
      return Promise.resolve(out);
    },
    set: values => { Object.assign(data, values); return Promise.resolve(); },
    remove: keys => {
      for (const key of (Array.isArray(keys) ? keys : [keys])) delete data[key];
      return Promise.resolve();
    },
  });

  // URL included deliberately: without it every `new URL()` in splitOrgHost
  // throws, org detection returns null, and the profile assertions below pass
  // by falling back to the active profile rather than by matching anything.
  const context = { console, Blob, JSON, Math, Date, Array, Object, Error,
                    String, Number, URL };
  context.globalThis = context;
  context.browser = {
    storage: {
      sync: area(JSON.parse(JSON.stringify(FIXTURE.sync))),
      local: area(JSON.parse(JSON.stringify(FIXTURE.local))),
    },
  };
  vm.createContext(context);
  for (const file of ['popup/js/shared/constants.js', 'popup/js/shared/utils.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context);
  }
  const live = context.SFTabs.utils;

  check('the storage preference is read from where v2 put it',
    (await live.storagePreference()) === true,
    'deviceSettings.useSyncStorage, written by v2 and unchanged');

  const prodTabs = await live.readChunkedSyncValue(`profile_${PROD_ID}_tabs`);
  check('a profile v2 chunked reassembles intact',
    Array.isArray(prodTabs) && prodTabs.length === 3,
    Array.isArray(prodTabs) ? prodTabs.map(t => t.label).join(' · ') : String(prodTabs));
  check('and the awkward tab in it survives the round trip',
    prodTabs?.[2]?.isCustomUrl === true && prodTabs[2].openInNewTab === true &&
    prodTabs[2].path === 'https://status.salesforce.com');

  const both = await live.loadTabsForUrl(
    'https://acme.my.salesforce-setup.com/lightning/setup/Flows/home');
  check('loadTabsForUrl picks the linked profile and its chunked tabs',
    both.profileId === PROD_ID && both.tabs.length === 3);

  const unclaimed = await live.loadTabsForUrl('https://other.my.salesforce.com/x');
  check('an unclaimed org gets the same profile 2.1.1 would have shown',
    unclaimed.profileId === PROD_ID && unclaimed.tabs.length === 3);

  // Nested tabs are stored as dropdownItems on the parent, not as siblings.
  const defaultTabs = await live.readChunkedSyncValue(`profile_${DEFAULT_ID}_tabs`);
  check('a nested tab keeps its parent',
    defaultTabs[2].dropdownItems?.[0]?.parentId === defaultTabs[2].id);
  check('and its URL still builds',
    live.tabDestinationUrl(defaultTabs[2].dropdownItems[0], 'https://acme.my.salesforce-setup.com')
      === 'https://acme.my.salesforce-setup.com/lightning/setup/ObjectManager/Account/FieldsAndRelationships/view');

  // ── The org an upgraded user is most likely to open first ──
  // orgColors ships off, so nothing should paint. The point is that asking is
  // safe on a config that has never heard of the feature.
  check('the colour lookup copes with a settings object predating it',
    live.resolveOrgColor('https://acme.my.salesforce.com/x', merged.orgColors) === null &&
    live.orgBannerColor('https://acme.my.salesforce.com/x', merged.orgColors) === null);
  check('and would answer correctly once switched on',
    live.orgBannerColor('https://acme.my.salesforce.com/x',
      { ...merged.orgColors, banner: true }) === live.DEFAULT_ENV_COLORS.production);

  // ── The seeding snippet must stay in step with this fixture ──
  // It is the manual half of the same test: paste it into a fresh browser
  // profile, install 3.0.0 over it, and walk the upgrade. If the two drift, the
  // path being walked by hand is not the path being asserted here.
  const snippet = fs.readFileSync(path.join(ROOT, 'docs/snippets/seed-v2-install.js'), 'utf8');
  const inlined = /const V2_INSTALL = (\{[\s\S]*?\n\s*\});/.exec(snippet);
  check('the seeding snippet carries a copy of the fixture', Boolean(inlined));
  if (inlined) {
    const copy = JSON.parse(inlined[1]);
    const strip = o => { const { _comment, ...rest } = o; return rest; };
    check('and it has not drifted from it',
      JSON.stringify(strip(copy)) === JSON.stringify(strip(FIXTURE)),
      'the hand-walked upgrade and the asserted one must be the same install');
  }

  console.log('\n' + passed + '/' + (passed + failed) + ' passed');
  process.exit(failed ? 1 : 0);
})();
