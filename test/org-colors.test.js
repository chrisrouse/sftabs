#!/usr/bin/env node
/**
 * Colouring the browser tab icon per org.
 *
 * Neither browser lets an extension colour a tab or style the tab strip, so the
 * favicon is the only surface available. Two layers decide what goes in it: an
 * org's environment supplies a colour, and a per-org entry overrides it.
 *
 * The override layer is not a nicety. Salesforce does not put the sandbox tier
 * in the hostname — Full Copy, Partial Copy, Developer and Developer Pro all
 * arrive as `--name.sandbox` — so three sandboxes in one org are identical to
 * anything reading the URL. Telling them apart is only possible by hand.
 *
 * Run: npm test
 */
const { resolveOrgColor, orgFaviconDataUrl, DEFAULT_ENV_COLORS, DEFAULT_SETTINGS } = (() => ({
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
check('production takes its environment colour',
  resolveOrgColor(PROD, on()) === DEFAULT_ENV_COLORS.production);
check('a developer edition org is not production',
  resolveOrgColor(DE, on()) === DEFAULT_ENV_COLORS.developer &&
  DEFAULT_ENV_COLORS.developer !== DEFAULT_ENV_COLORS.production);
check('an environment colour can be overridden wholesale',
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
check('an unlisted sibling keeps the environment colour',
  resolveOrgColor(DEV1, separated) === DEFAULT_ENV_COLORS.sandbox);
check('all three now differ',
  new Set([DEV1, DEV2, UAT].map(u => resolveOrgColor(u, separated))).size === 3);

// ── Identity ──
// `acme.lightning.force.com` and `acme.develop.lightning.force.com` both reduce
// to `acme`, so an entry keyed on the identifier alone would colour both.
const prodOnly = on({ orgs: [{ identifier: 'acme', environment: 'production', color: '#111111' }] });
check('an override is scoped to its environment', resolveOrgColor(PROD, prodOnly) === '#111111');
check('and does not leak to another org sharing the identifier',
  resolveOrgColor(DE, prodOnly) === DEFAULT_ENV_COLORS.developer);

check('matching an identifier ignores case',
  resolveOrgColor(DEV2, on({ orgs: [{ identifier: 'ACME--DEV2', environment: 'sandbox', color: '#abcdef' }] }))
    === '#abcdef');
check('an entry with no colour falls through to the environment',
  resolveOrgColor(DEV2, on({ orgs: [{ identifier: 'acme--dev2', environment: 'sandbox' }] }))
    === DEFAULT_ENV_COLORS.sandbox);
check('a malformed entry does not throw',
  resolveOrgColor(DEV2, on({ orgs: [null, undefined, {}] })) === DEFAULT_ENV_COLORS.sandbox);

// ── The favicon itself ──
const url = orgFaviconDataUrl('#c5221f');
check('the favicon is an SVG data URL', url.startsWith('data:image/svg+xml,'));
const svg = decodeURIComponent(url.slice('data:image/svg+xml,'.length));
check('carrying the requested colour', svg.includes('fill="#c5221f"'));
check('and one path, so nothing has to be fetched or decoded',
  (svg.match(/<path/g) || []).length === 1);
check('it declares the SVG namespace, or the browser will not render it',
  svg.includes('xmlns="http://www.w3.org/2000/svg"'));
check('the URL is escaped — a raw # would truncate it at the fragment',
  !url.includes('#'));

console.log('\n' + passed + '/' + (passed + failed) + ' passed');
process.exit(failed ? 1 : 0);
