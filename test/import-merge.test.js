#!/usr/bin/env node
/**
 * Importing settings must not quietly delete the ones already there.
 *
 * Every import site merged with a spread — `{...current, ...incoming}` — which
 * is one level deep. Scalars behave, but a nested object in the file replaces
 * the live one whole rather than merging into it, and the settings that matter
 * most here are all nested: orgColors, floatingButton, headerMenu, tabColors.
 *
 * The concrete loss: turn org colours off and export, and `orgColors`
 * serialises as `{enabled: false}` — the environments map and every per-org
 * override are simply not in the file. Import that anywhere and a spread
 * replaces the live orgColors with `{enabled: false}`, so the overrides are
 * gone from storage too. Same for a file exported before the feature existed.
 * The user asked to import settings, not to discard the colours they had, and
 * the standing rule for this extension is that turning a feature off never
 * removes its data.
 *
 * One level of merging is the whole intent, not a step towards a general deep
 * merge. Arrays are replaced wholesale, which is what importing a list should
 * do — merging `orgs` element-wise would invent entries nobody exported.
 *
 * Run: npm test
 */
const { mergeUserSettings } = require('../popup/js/shared/utils.js');

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

/** What a user has configured. */
const live = () => ({
  themeMode: 'dark',
  profilesEnabled: true,
  orgColors: {
    enabled: true,
    environments: { production: '#c5221f', sandbox: '#8430ce' },
    orgs: [
      { identifier: 'acme--dev2', environment: 'sandbox', color: '#8430ce' },
      { identifier: 'acme--uat', environment: 'sandbox', color: '#b06000' },
    ],
  },
  floatingButton: { enabled: true, side: 'left', offset: 40, location: 'setup-only' },
});

// ── The regression ──
// A file exported with the feature switched off carries only the flag.
const offExport = { orgColors: { enabled: false } };
const afterOff = mergeUserSettings(live(), offExport);

check('the imported flag wins', afterOff.orgColors.enabled === false);
check('but the per-org overrides survive it',
  afterOff.orgColors.orgs.length === 2,
  afterOff.orgColors.orgs.length + ' of 2 kept');
check('and so does the environment map',
  afterOff.orgColors.environments.production === '#c5221f');
check('switching the feature back on restores what was there',
  mergeUserSettings(afterOff, { orgColors: { enabled: true } }).orgColors.orgs.length === 2);

// A file exported before org colours existed mentions them not at all.
const legacy = { themeMode: 'light', profilesEnabled: false };
const afterLegacy = mergeUserSettings(live(), legacy);
check('a file predating the feature leaves it entirely alone',
  afterLegacy.orgColors.orgs.length === 2 && afterLegacy.orgColors.enabled === true);
check('while still applying what it does carry',
  afterLegacy.themeMode === 'light' && afterLegacy.profilesEnabled === false);

// ── Ordinary merging ──
check('a scalar is overwritten', mergeUserSettings(live(), { themeMode: 'light' }).themeMode === 'light');
check('an untouched branch is untouched',
  mergeUserSettings(live(), { themeMode: 'light' }).floatingButton.offset === 40);
check('a partial nested object merges rather than replaces',
  (() => {
    const out = mergeUserSettings(live(), { floatingButton: { side: 'right' } }).floatingButton;
    return out.side === 'right' && out.offset === 40 && out.location === 'setup-only';
  })());
check('a key only the import knows about is added',
  mergeUserSettings(live(), { brandNew: 42 }).brandNew === 42);
check('a nested key only the import knows about is added',
  mergeUserSettings(live(), { orgColors: { newThing: true } }).orgColors.newThing === true);

// ── Arrays replace, deliberately ──
check('an imported list replaces rather than concatenating',
  mergeUserSettings(live(), { orgColors: { orgs: [{ identifier: 'x' }] } }).orgColors.orgs.length === 1);
check('an explicitly empty list is honoured, not treated as absent',
  mergeUserSettings(live(), { orgColors: { orgs: [] } }).orgColors.orgs.length === 0);

// ── Degenerate input ──
check('no incoming settings changes nothing',
  JSON.stringify(mergeUserSettings(live(), null)) === JSON.stringify(live()) &&
  JSON.stringify(mergeUserSettings(live(), undefined)) === JSON.stringify(live()));
check('no current settings is not a crash',
  mergeUserSettings(null, { themeMode: 'dark' }).themeMode === 'dark');
check('null does not merge as an object',
  mergeUserSettings(live(), { orgColors: null }).orgColors === null);
check('the inputs are not mutated', (() => {
  const source = live();
  mergeUserSettings(source, { orgColors: { enabled: false, orgs: [] } });
  return source.orgColors.enabled === true && source.orgColors.orgs.length === 2;
})());

console.log('\n' + passed + '/' + (passed + failed) + ' passed');
process.exit(failed ? 1 : 0);
