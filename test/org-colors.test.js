#!/usr/bin/env node
/**
 * Coloring the browser tab icon per org.
 *
 * Neither browser lets an extension color a tab or style the tab strip, so the
 * favicon is the only surface available. Two layers decide what goes in it: an
 * org's environment supplies a color, and a per-org entry overrides it.
 *
 * The override layer is not a nicety. Salesforce does not put the sandbox tier
 * in the hostname — Full Copy, Partial Copy, Developer and Developer Pro all
 * arrive as `--name.sandbox` — so three sandboxes in one org are identical to
 * anything reading the URL. Telling them apart is only possible by hand.
 *
 * Run: npm test
 */
const { resolveOrgColor, orgColorFor, orgBannerColor, readableInk,
        orgFaviconDataUrl, DEFAULT_ENV_COLORS, DEFAULT_SETTINGS } = (() => ({
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

const PROD  = 'https://acme.lightning.force.com/lightning/setup/Flows/home';
const DEV1  = 'https://acme--dev1.sandbox.lightning.force.com/x';
const DEV2  = 'https://acme--dev2.sandbox.lightning.force.com/x';
const UAT   = 'https://acme--uat.sandbox.lightning.force.com/x';
const DE    = 'https://acme.develop.lightning.force.com/x';
const on = extra => ({ enabled: true, environments: {}, orgs: [], ...extra });

// ── Off, and off-limits ──
check('the feature ships off', DEFAULT_SETTINGS.orgColors.enabled === false);
check('no environments or orgs are preconfigured',
  Object.keys(DEFAULT_SETTINGS.orgColors.environments).length === 0 &&
  DEFAULT_SETTINGS.orgColors.orgs.length === 0);
check('disabled paints nothing', resolveOrgColor(PROD, { enabled: false }) === null);
check('missing config paints nothing',
  resolveOrgColor(PROD, null) === null && resolveOrgColor(PROD, undefined) === null);
check('a non-Salesforce page paints nothing',
  resolveOrgColor('https://example.com/', on()) === null);

// ── The environment layer ──
check('production takes its environment color',
  resolveOrgColor(PROD, on()) === DEFAULT_ENV_COLORS.production);
check('a developer edition org is not production',
  resolveOrgColor(DE, on()) === DEFAULT_ENV_COLORS.developer &&
  DEFAULT_ENV_COLORS.developer !== DEFAULT_ENV_COLORS.production);
check('an environment color can be overridden wholesale',
  resolveOrgColor(PROD, on({ environments: { production: '#000000' } })) === '#000000');
check('overriding one environment leaves the others on their defaults',
  resolveOrgColor(DEV1, on({ environments: { production: '#000000' } })) === DEFAULT_ENV_COLORS.sandbox);
check('every environment has a default',
  ['production', 'sandbox', 'developer', 'scratch', 'demo', 'playground', 'patch']
    .every(env => /^#[0-9a-f]{6}$/i.test(DEFAULT_ENV_COLORS[env] || '')));
check('no two environments share a default',
  new Set(Object.values(DEFAULT_ENV_COLORS)).size === Object.keys(DEFAULT_ENV_COLORS).length);

// ── Why the override layer exists ──
// This is the case that motivated the feature: three sandboxes, one org, and a
// hostname that says "sandbox" for all three.
check('sandboxes in one org are identical to the environment layer',
  resolveOrgColor(DEV1, on()) === resolveOrgColor(DEV2, on()) &&
  resolveOrgColor(DEV2, on()) === resolveOrgColor(UAT, on()));

const separated = on({
  orgs: [
    { identifier: 'acme--dev2', environment: 'sandbox', color: '#8430ce' },
    { identifier: 'acme--uat',  environment: 'sandbox', color: '#b06000' },
  ],
});
check('an override beats the environment', resolveOrgColor(DEV2, separated) === '#8430ce');
check('a second override is independent', resolveOrgColor(UAT, separated) === '#b06000');
check('an unlisted sibling keeps the environment color',
  resolveOrgColor(DEV1, separated) === DEFAULT_ENV_COLORS.sandbox);
check('all three now differ',
  new Set([DEV1, DEV2, UAT].map(u => resolveOrgColor(u, separated))).size === 3);

// ── Identity ──
// `acme.lightning.force.com` and `acme.develop.lightning.force.com` both reduce
// to `acme`, so an entry keyed on the identifier alone would color both.
const prodOnly = on({ orgs: [{ identifier: 'acme', environment: 'production', color: '#111111' }] });
check('an override is scoped to its environment', resolveOrgColor(PROD, prodOnly) === '#111111');
check('and does not leak to another org sharing the identifier',
  resolveOrgColor(DE, prodOnly) === DEFAULT_ENV_COLORS.developer);

check('matching an identifier ignores case',
  resolveOrgColor(DEV2, on({ orgs: [{ identifier: 'ACME--DEV2', environment: 'sandbox', color: '#abcdef' }] }))
    === '#abcdef');
check('an entry with no color falls through to the environment',
  resolveOrgColor(DEV2, on({ orgs: [{ identifier: 'acme--dev2', environment: 'sandbox' }] }))
    === DEFAULT_ENV_COLORS.sandbox);
check('a malformed entry does not throw',
  resolveOrgColor(DEV2, on({ orgs: [null, undefined, {}] })) === DEFAULT_ENV_COLORS.sandbox);

// ── Resetting the environment layer ──
// Clearing `environments` is the whole reset: an empty map means the shipped
// colors are in force, which is also how the feature starts. Per-org entries
// are untouched, because each was set deliberately and a button labelled
// "defaults" has no business discarding them.
const customised = on({
  environments: { production: '#000000', sandbox: '#111111' },
  orgs: [{ identifier: 'acme--dev2', environment: 'sandbox', color: '#8430ce' }],
});
const afterReset = { ...customised, environments: {} };

check('a reset returns every environment to its default',
  resolveOrgColor(PROD, afterReset) === DEFAULT_ENV_COLORS.production &&
  resolveOrgColor(DEV1, afterReset) === DEFAULT_ENV_COLORS.sandbox);
check('and leaves per-org colors alone',
  resolveOrgColor(DEV2, afterReset) === '#8430ce');
check('an empty environments map behaves exactly like a fresh install',
  resolveOrgColor(PROD, afterReset) === resolveOrgColor(PROD, on()));

// ── The favicon itself ──
const url = orgFaviconDataUrl('#c5221f');
check('the favicon is an SVG data URL', url.startsWith('data:image/svg+xml,'));
const svg = decodeURIComponent(url.slice('data:image/svg+xml,'.length));
check('carrying the requested color', svg.includes('fill="#c5221f"'));
check('and one path, so nothing has to be fetched or decoded',
  (svg.match(/<path/g) || []).length === 1);
check('it declares the SVG namespace, or the browser will not render it',
  svg.includes('xmlns="http://www.w3.org/2000/svg"'));
check('the URL is escaped — a raw # would truncate it at the fragment',
  !url.includes('#'));


// ── Experience Builder ──
// The reported case: builder pages showed no tint at all. The manifest injects
// there, but the host matcher did not know builder.salesforce-experience.com,
// so the page belonged to no org and the favicon was left alone. Both real URLs
// from the report:
const BUILD_PROD = 'https://amplify.builder.salesforce-experience.com/sfsites/picasso/core/config/commeditor.jsp';
const BUILD_SBX  = 'https://amplify--dev1.sandbox.builder.salesforce-experience.com/sfsites/picasso/core/config/commeditor.jsp';

check('a production builder page takes the production color',
  resolveOrgColor(BUILD_PROD, on()) === DEFAULT_ENV_COLORS.production);
check('a sandbox builder page takes the sandbox color',
  resolveOrgColor(BUILD_SBX, on()) === DEFAULT_ENV_COLORS.sandbox);
check('so the two are told apart, which is the whole point',
  resolveOrgColor(BUILD_PROD, on()) !== resolveOrgColor(BUILD_SBX, on()));

// A per-org override set from a Lightning URL has to apply on the builder too —
// the identifier is the same org either way.
check('a per-org override reaches the builder page as well',
  resolveOrgColor(BUILD_SBX, on({
    orgs: [{ identifier: 'amplify--dev1', environment: 'sandbox', color: '#8430ce' }],
  })) === '#8430ce');


// ── Two surfaces, one palette ──
// The favicon tint and the page banner each have their own switch, and both
// draw the org's color. That means "which color is this org" and "should the
// favicon be tinted" cannot be the same question — they were, and the banner
// could not have got a color with tinting off.
const cfg = extra => ({ environments: {}, orgs: [], ...extra });

check('the banner ships off, like the tint',
  DEFAULT_SETTINGS.orgColors.banner === false);
check('and shows the org name by default when it is on',
  DEFAULT_SETTINGS.orgColors.bannerShowOrgName === true,
  'two sandboxes of one org are indistinguishable without it');

check('the lookup itself does not care which surface is asking',
  orgColorFor(DEV1, cfg()) === DEFAULT_ENV_COLORS.sandbox);

check('the banner works with the favicon tint switched off',
  orgBannerColor(DEV1, cfg({ enabled: false, banner: true })) === DEFAULT_ENV_COLORS.sandbox);
check('and the tint works with the banner off',
  resolveOrgColor(DEV1, cfg({ enabled: true, banner: false })) === DEFAULT_ENV_COLORS.sandbox);
check('each surface stays dark when only the other is on',
  resolveOrgColor(DEV1, cfg({ enabled: false, banner: true })) === null &&
  orgBannerColor(DEV1, cfg({ enabled: true, banner: false })) === null);

check('with both on they agree exactly',
  resolveOrgColor(DEV1, cfg({ enabled: true, banner: true })) ===
  orgBannerColor(DEV1, cfg({ enabled: true, banner: true })));

// A per-org override is the whole point of the feature; it has to reach both.
const overridden = cfg({ enabled: true, banner: true,
  orgs: [{ identifier: 'acme--dev2', environment: 'sandbox', color: '#8430ce' }] });
check('a per-org override reaches the banner as well as the favicon',
  orgBannerColor(DEV2, overridden) === '#8430ce' &&
  resolveOrgColor(DEV2, overridden) === '#8430ce');

check('a page belonging to no org gets no banner',
  orgBannerColor('https://example.com/', cfg({ banner: true })) === null);

// ── The banner's text has to stay legible on any color ──
// The palette is configurable, so white-on-anything is not safe: the extension
// this grew from had two fixed colors and could hardcode white.
check('white on the darker defaults',
  ['production', 'scratch', 'demo', 'patch'].every(e => readableInk(DEFAULT_ENV_COLORS[e]) === '#ffffff'));
check('near-black on the lighter ones',
  ['sandbox', 'developer', 'playground'].every(e => readableInk(DEFAULT_ENV_COLORS[e]) === '#181818'));
check('a pale color someone might pick gets dark text',
  readableInk('#ffe680') === '#181818' && readableInk('#ffffff') === '#181818');
check('and a very dark one gets white',
  readableInk('#000000') === '#ffffff' && readableInk('#1a1a1a') === '#ffffff');
check('a malformed color falls back rather than throwing',
  readableInk('nope') === '#ffffff' && readableInk('') === '#ffffff' && readableInk(null) === '#ffffff');
// Three-digit hex used to fail the length check and fall back to white, which
// is the wrong guess for exactly the shorthand a person is most likely to type.
check('shorthand hex is expanded, not rejected',
  readableInk('#ffc') === readableInk('#ffffcc') && readableInk('#ffc') === '#181818');
check('and a stray space or missing hash is tolerated',
  readableInk(' #000000 ') === '#ffffff' && readableInk('ffe680') === '#181818');


// ── Where the banner appears ──
// The same everywhere / Setup only / outside Setup choice the floating button
// offers, resolved by the same locationAllows() — two copies of "what counts as
// a Setup page" would eventually disagree, and the popup shows one label for
// both.
const SETUP  = 'https://acme--dev1.sandbox.my.salesforce-setup.com/lightning/setup/Flows/home';
const RECORD = 'https://acme--dev1.sandbox.lightning.force.com/lightning/r/Account/001/view';
const banner = (location, url) =>
  orgBannerColor(url, cfg({ banner: true, bannerLocation: location }));

check('everywhere shows on both', Boolean(banner('everywhere', SETUP) && banner('everywhere', RECORD)));
check('Setup only shows in Setup and nowhere else',
  Boolean(banner('setup-only', SETUP)) && banner('setup-only', RECORD) === null);
check('outside Setup is the exact inverse',
  banner('outside-setup', SETUP) === null && Boolean(banner('outside-setup', RECORD)));
check('an install predating the setting shows everywhere',
  Boolean(banner(undefined, SETUP)) && Boolean(banner(undefined, RECORD)),
  'a stored config with no bannerLocation must not hide a banner already in use');
check('and so does a value nothing recognises',
  Boolean(banner('somewhere-else', SETUP)),
  'hiding a feature the user switched on is the worse failure');
check('the default is everywhere',
  DEFAULT_SETTINGS.orgColors.bannerLocation === 'everywhere');
check('the location gate cannot switch the banner on by itself',
  banner('everywhere', SETUP) !== null &&
  orgBannerColor(SETUP, cfg({ banner: false, bannerLocation: 'everywhere' })) === null);

// Both surfaces read the one rule.
const { locationAllows, floatingButtonAllowedHere } = require('../popup/js/shared/utils.js');
check('the floating button resolves location through the same rule',
  ['everywhere', 'setup-only', 'outside-setup', undefined].every(where =>
    [SETUP, RECORD].every(url =>
      floatingButtonAllowedHere(url, { enabled: true, location: where }) ===
      locationAllows(url, where))));

console.log('\n' + passed + '/' + (passed + failed) + ' passed');
process.exit(failed ? 1 : 0);
