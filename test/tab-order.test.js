#!/usr/bin/env node
/**
 * Dragging tabs in the Salesforce menu bar.
 *
 * Our injected tabs carry navexConsoleTabItem, which is what makes Salesforce's
 * own console drag work on them for free. But that only moves DOM nodes — the
 * next render rebuilds from stored `position` and puts them back. This is the
 * rule that turns a bar order into stored positions, shared by the content
 * script and the background worker so the two cannot disagree.
 *
 * Two things it must not do:
 *
 *   Renumber nested tabs. Only top-level tabs appear in the bar, and a child
 *   keeps its position inside its parent. Renumbering the array by index would
 *   reshuffle children nobody dragged.
 *
 *   Write on a repaint. Our own render reorders nodes too, so the watcher needs
 *   to tell "someone dragged this" from "we just drew this" — otherwise every
 *   render writes back what was already there, forever.
 *
 * Run: npm test
 */
const { reorderTopLevelTabs, tabOrderMatches } = require('../popup/js/shared/utils.js');

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

const tabs = () => [
  { id: 'a', label: 'Flows', position: 0 },
  { id: 'b', label: 'Users', position: 1 },
  { id: 'c', label: 'Profiles', position: 2 },
  { id: 'c1', label: 'Child one', parentId: 'c', position: 0 },
  { id: 'c2', label: 'Child two', parentId: 'c', position: 1 },
];

const topOrder = list => list
  .filter(t => !t.parentId)
  .sort((x, y) => x.position - y.position)
  .map(t => t.id)
  .join(' ');

// ── Applying a dragged order ──
check('a dragged order becomes the stored order',
  topOrder(reorderTopLevelTabs(tabs(), ['c', 'a', 'b'])) === 'c a b');
check('reversing works too',
  topOrder(reorderTopLevelTabs(tabs(), ['c', 'b', 'a'])) === 'c b a');
check('an unchanged order stays unchanged',
  topOrder(reorderTopLevelTabs(tabs(), ['a', 'b', 'c'])) === 'a b c');

// ── Children are not in the bar and must not move ──
const moved = reorderTopLevelTabs(tabs(), ['c', 'a', 'b']);
check('nested tabs keep their positions',
  moved.filter(t => t.parentId).map(t => `${t.id}:${t.position}`).join(' ') === 'c1:0 c2:1');
check('a nested id in the order is ignored, not promoted',
  topOrder(reorderTopLevelTabs(tabs(), ['c1', 'a', 'b', 'c'])) === 'a b c');

// ── The input is never mutated ──
const source = tabs();
reorderTopLevelTabs(source, ['c', 'b', 'a']);
check('the source array is left alone', topOrder(source) === 'a b c');
check('unchanged tabs are returned by identity, so callers can skip a write',
  (() => { const t = tabs(); return reorderTopLevelTabs(t, ['a', 'b', 'c']).every((x, i) => x === t[i]); })());

// ── Partial and junk input ──
// The bar can be showing a subset — overflow, or a render racing a write — and
// a tab missing from the order must keep its place rather than be flung to 0.
check('a single-tab order changes nothing, rather than colliding at 0',
  topOrder(reorderTopLevelTabs(tabs(), ['c'])) === 'a b c');
check('a partial order permutes only its own slots',
  topOrder(reorderTopLevelTabs(tabs(), ['c', 'a'])) === 'c b a');
check('and never produces two tabs at the same position', (() => {
  const out = reorderTopLevelTabs(tabs(), ['c', 'a']).filter(t => !t.parentId);
  return new Set(out.map(t => t.position)).size === out.length;
})());
check('an empty order changes nothing',
  topOrder(reorderTopLevelTabs(tabs(), [])) === 'a b c');
check('missing arguments do not throw',
  Array.isArray(reorderTopLevelTabs(null, null)) &&
  reorderTopLevelTabs(undefined, ['a']).length === 0);
check('malformed entries do not throw',
  reorderTopLevelTabs([null, undefined, { id: 'a', position: 0 }], ['a']).length === 3);

// ── Telling a drag from a repaint ──
// This is what stops the watcher writing on every render.
check('the rendered order reports as matching', tabOrderMatches(tabs(), ['a', 'b', 'c']));
check('a dragged order reports as different', !tabOrderMatches(tabs(), ['c', 'a', 'b']));
check('nested ids in the bar order do not confuse the comparison',
  tabOrderMatches(tabs(), ['a', 'b', 'c', 'c1']));
check('a short order is not a match',
  !tabOrderMatches(tabs(), ['a', 'b']));

// ── Round trip ──
// Apply a drag, then ask whether the result matches the order that produced it.
const after = reorderTopLevelTabs(tabs(), ['b', 'c', 'a']);
check('after applying, the same order now matches', tabOrderMatches(after, ['b', 'c', 'a']));
check('and the previous order no longer does', !tabOrderMatches(after, ['a', 'b', 'c']));

console.log('\n' + passed + '/' + (passed + failed) + ' passed');
process.exit(failed ? 1 : 0);
