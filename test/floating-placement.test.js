#!/usr/bin/env node
/**
 * Where the floating button docks.
 *
 * Placement used to be a nine-cell {top|middle|bottom}-{left|center|right}
 * grid, but only about half of it did anything. The JS read
 * `vertical === 'bottom' ? bottom : top`, so 'top' and 'middle' were the same
 * placement under two names, and 'center' had no CSS at all under the default
 * drawer layout — an edge drawer cannot dock to the middle of the screen. The
 * vertical axis is now the offset slider, which expresses it better than three
 * fixed rows did, and the only remaining choice is which edge.
 *
 * The resolver is shared because the page and the settings screen must agree.
 * If they read a stored value differently, the settings screen highlights one
 * edge while the button appears on the other.
 *
 * Run: npm test
 */
const { resolveFloatingSide, DEFAULT_SETTINGS } = (() => ({
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

function sideOf(fb) {
  return resolveFloatingSide(fb);
}

// ── The current setting ──
check('an explicit left docks left', sideOf({ side: 'left' }) === 'left');
check('an explicit right docks right', sideOf({ side: 'right' }) === 'right');
check('the default is the right edge', sideOf({}) === 'right');
check('the shipped default agrees', DEFAULT_SETTINGS.floatingButton.side === 'right');

// ── Reading the retired anchor grid ──
// Every left-hand cell keeps its edge; everything else lands on the right,
// which is where the old default (middle-right) already was.
['top-left', 'middle-left', 'bottom-left'].forEach(anchor =>
  check('legacy ' + anchor + ' keeps the left edge', sideOf({ anchor }) === 'left'));

['top-right', 'middle-right', 'bottom-right'].forEach(anchor =>
  check('legacy ' + anchor + ' keeps the right edge', sideOf({ anchor }) === 'right'));

// 'center' never rendered under the default drawer layout, so there is no
// placement to preserve — it falls to the default rather than guessing.
['top-center', 'bottom-center'].forEach(anchor =>
  check('legacy ' + anchor + ' falls back to the default edge', sideOf({ anchor }) === 'right'));

// ── Precedence and junk ──
check('an explicit side beats a stale anchor',
  sideOf({ side: 'left', anchor: 'top-right' }) === 'left');
check('an unrecognised side falls back rather than passing through',
  sideOf({ side: 'centre' }) === 'right');
check('no settings at all resolves rather than throwing', sideOf(null) === 'right');
check('an empty anchor string resolves rather than throwing', sideOf({ anchor: '' }) === 'right');

// ── The vertical axis is gone from the schema ──
check('no anchor field ships in the defaults',
  !('anchor' in DEFAULT_SETTINGS.floatingButton));
check('offset still ships, since it now carries the whole vertical axis',
  DEFAULT_SETTINGS.floatingButton.offset === 0);
check('legacy position still ships, so an upgrade can derive its offset',
  DEFAULT_SETTINGS.floatingButton.position === 25);

console.log('\n' + passed + '/' + (passed + failed) + ' passed');
process.exit(failed ? 1 : 0);
