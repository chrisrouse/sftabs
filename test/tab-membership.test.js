#!/usr/bin/env node
/**
 * One tab, several profiles.
 *
 * Tabs are stored per profile — `profile_<id>_tabs` — so there is no shared tab
 * record to point at. Putting "the same" tab in two profiles means writing a
 * copy into each, sharing an id. Ids only have to be unique within a profile,
 * so reusing one across profiles costs nothing, and it is the only thing that
 * makes "which profiles hold this tab" answerable at all.
 *
 * The rules that matter, and what breaks if they slip:
 *
 *   append, never insert  — a tab arriving in a profile must not displace an
 *                           order someone arranged there
 *   copy, never alias     — two profiles sharing one object means editing a tab
 *                           in one silently edits it in the other
 *   dense positions       — a gap left by a removal reorders the list on the
 *                           next position-sorted read
 *   identity on no-op     — the caller skips the storage write when nothing
 *                           changed, so an unchanged list must be the same array
 *
 * Run: npm test
 */
const { withTabMembership, DEFAULT_SETTINGS } = (() => ({
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

const tab = () => ({
  id: 'new',
  label: 'Flows',
  path: 'Flows',
  position: 0,
  dropdownItems: [{ label: 'Failed', path: 'x' }],
});
const listOf = (...ids) => ids.map((id, i) => ({ id, label: id, position: i }));
const shape = list => list.map(t => `${t.id}:${t.position}`).join(' ');

// ── The setting ──
check('Quick Add stays in the active profile unless asked otherwise',
  DEFAULT_SETTINGS.quickAddAllProfiles === false);

// ── Adding ──
const two = listOf('a', 'b');
const added = withTabMembership(two, tab(), true);
check('the tab lands at the end', shape(added) === 'a:0 b:1 new:2');
check('the profile\'s own order is untouched',
  added.slice(0, 2).map(t => t.id).join() === 'a,b');
check('the source list is not mutated', shape(two) === 'a:0 b:1');
check('position is renumbered for its new home, not carried over',
  added[2].position === 2 && tab().position === 0);

check('an empty profile takes the tab as its first',
  shape(withTabMembership([], tab(), true)) === 'new:0');
check('a missing list is treated as empty rather than throwing',
  shape(withTabMembership(null, tab(), true)) === 'new:0' &&
  shape(withTabMembership(undefined, tab(), true)) === 'new:0');

// Aliasing would make an edit in one profile silently rewrite another.
const source = tab();
const copied = withTabMembership([], source, true)[0];
check('the copy is deep, sharing no nested structure',
  copied !== source && copied.dropdownItems !== source.dropdownItems);
copied.dropdownItems[0].label = 'changed';
check('editing the copy leaves the original alone',
  source.dropdownItems[0].label === 'Failed');

// ── Already a member ──
const has = withTabMembership(listOf('a', 'new', 'b'), tab(), true);
check('a tab already there is not duplicated',
  has.filter(t => t.id === 'new').length === 1);
check('and its position is left where the profile had it',
  shape(has) === 'a:0 new:1 b:2');
check('the identical array comes back, so no write happens',
  (() => { const l = listOf('a', 'new'); return withTabMembership(l, tab(), true) === l; })());

// ── Removing ──
const pruned = withTabMembership(listOf('a', 'new', 'b'), tab(), false);
check('unticking removes it', !pruned.some(t => t.id === 'new'));
check('and closes the gap it left', shape(pruned) === 'a:0 b:1');
check('removing from the front renumbers everything after',
  shape(withTabMembership(listOf('new', 'a', 'b'), tab(), false)) === 'a:0 b:1');
check('removing what was never there is the identical array',
  (() => { const l = listOf('a', 'b'); return withTabMembership(l, tab(), false) === l; })());
check('removing the only tab empties the profile',
  withTabMembership(listOf('new'), tab(), false).length === 0);

// ── Round trip ──
// Tick, untick, tick again: the profile ends where it started plus the tab.
const start = listOf('a', 'b');
const roundTrip = withTabMembership(
  withTabMembership(withTabMembership(start, tab(), true), tab(), false),
  tab(), true);
check('tick, untick and tick again is stable', shape(roundTrip) === 'a:0 b:1 new:2');

// A list with holes is what a previous buggy removal would leave behind.
check('a sparse list is made dense on the next removal',
  shape(withTabMembership(
    [{ id: 'a', position: 0 }, { id: 'new', position: 7 }, { id: 'b', position: 9 }],
    tab(), false)) === 'a:0 b:1');

console.log('\n' + passed + '/' + (passed + failed) + ' passed');
process.exit(failed ? 1 : 0);
