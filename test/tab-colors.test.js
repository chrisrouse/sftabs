#!/usr/bin/env node
/**
 * Per-tab colors.
 *
 * The rule that matters most: switching the feature off must stop the rendering
 * and leave every stored tab.color alone, so switching it back on restores what
 * was there. Everything else is presentation.
 *
 * Run: npm test
 */
const { TAB_COLORS, tabColorVars, applyTabColor,
        settingsAffectTabBar } = require('../popup/js/shared/utils.js');
const { TAB_STRUCTURE, DEFAULT_SETTINGS } = require('../popup/js/shared/constants.js');

const results = [];
const check = (name, pass, detail = '') => {
  results.push(pass);
  console.log(`${pass ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

// Minimal element stand-in: classList and style.setProperty are all we use.
function fakeEl() {
  const classes = new Set();
  const props = new Map();
  return {
    classList: {
      add: (...c) => c.forEach(x => classes.add(x)),
      remove: (...c) => c.forEach(x => classes.delete(x)),
      contains: c => classes.has(c),
      get size() { return classes.size; },
      list: () => [...classes],
    },
    style: {
      setProperty: (k, v) => props.set(k, v),
      removeProperty: k => props.delete(k),
    },
    props,
  };
}

// ── Defaults ──
check('a tab has no color by default', TAB_STRUCTURE.color === null);
check('the feature is off by default', DEFAULT_SETTINGS.tabColors.enabled === false);
check('the default style is dot', DEFAULT_SETTINGS.tabColors.style === 'dot');

// ── Palette ──
const HUES = ['red', 'hot-orange', 'orange', 'yellow', 'green', 'teal',
              'cloud-blue', 'blue', 'indigo', 'violet', 'purple', 'pink'];
const pair = /^light-dark\(#[0-9a-f]{6}, #[0-9a-f]{6}\)$/;

check('twelve hues in three shades', Object.keys(TAB_COLORS).length === 36,
  String(Object.keys(TAB_COLORS).length));
check('every hue carries all three shades',
  HUES.every(h => TAB_COLORS[h] && TAB_COLORS[h + '-deep'] && TAB_COLORS[h + '-light']));

// The base shades keep their bare names, so a tab colored before the shades
// existed still resolves. Renaming them to 'teal-base' would have silently
// dropped the color off every tab already stored.
check('the base shade keeps the bare hue name, so stored colors survive',
  HUES.every(h => tabColorVars(h) !== null));

check('every shade has an accent, a wash and an ink',
  Object.values(TAB_COLORS).every(c => c.accent && c.wash && c.ink));
check('every value is a light-dark pair, so colors follow the theme',
  Object.values(TAB_COLORS).every(c =>
    pair.test(c.accent) && pair.test(c.wash) && pair.test(c.ink)));

// The light shade exists to be told apart as a dot, which only has to clear the
// contrast bar for a graphic. That is below what the same color would need as
// label text, so it carries a darker ink instead of reusing its accent.
check('deep and base label with their own accent',
  HUES.every(h => TAB_COLORS[h].ink === TAB_COLORS[h].accent &&
                  TAB_COLORS[h + '-deep'].ink === TAB_COLORS[h + '-deep'].accent));
check('light labels with a darker ink than its accent',
  HUES.every(h => TAB_COLORS[h + '-light'].ink !== TAB_COLORS[h + '-light'].accent));
check('no two shades of a hue share an accent',
  HUES.every(h => new Set([TAB_COLORS[h], TAB_COLORS[h + '-deep'], TAB_COLORS[h + '-light']]
    .map(c => c.accent)).size === 3));
check('an unknown hue resolves to nothing rather than throwing', tabColorVars('chartreuse') === null);
check('no color resolves to nothing', tabColorVars(null) === null);

// ── Rendering ──
let el = fakeEl();
applyTabColor(el, 'teal', 'dot', true);
check('the ink reaches the element too', (() => {
  const el = fakeEl();
  applyTabColor(el, 'teal-light', 'tint', true);
  return el.props.get('--sftabs-tc-ink') === TAB_COLORS['teal-light'].ink;
})());
check('clearing removes the ink with the rest', (() => {
  const el = fakeEl();
  applyTabColor(el, 'teal-light', 'tint', true);
  applyTabColor(el, 'teal-light', 'tint', false);
  return !el.props.has('--sftabs-tc-ink');
})());

check('enabled + colored: marked and given both properties',
  el.classList.contains('sftabs-tc') && el.classList.contains('sftabs-tc--dot') &&
  el.props.get('--sftabs-tc') === TAB_COLORS.teal.accent &&
  el.props.get('--sftabs-tc-wash') === TAB_COLORS.teal.wash);

el = fakeEl();
applyTabColor(el, 'teal', 'tint', true);
check('style selects the treatment', el.classList.contains('sftabs-tc--tint'));

el = fakeEl();
applyTabColor(el, 'teal', 'nonsense', true);
check('an unknown style falls back to dot', el.classList.contains('sftabs-tc--dot'));


el = fakeEl();
applyTabColor(el, null, 'tint', true);
check('enabled but colored: nothing applied',
  el.classList.size === 0 && el.props.size === 0);

// The headline requirement.
el = fakeEl();
applyTabColor(el, 'teal', 'tint', true);
applyTabColor(el, 'teal', 'tint', false);      // feature switched off
check('switching off removes every class and property',
  el.classList.size === 0 && el.props.size === 0, el.classList.list().join(' '));

const stored = { id: 't1', label: 'Flows', color: 'teal' };
applyTabColor(fakeEl(), stored.color, 'tint', false);
check('switching off does not touch the stored color', stored.color === 'teal');
applyTabColor(fakeEl(), stored.color, 'tint', true);
check('switching back on still finds it', tabColorVars(stored.color) !== null);

// Re-rendering a reused row must not accumulate state.
el = fakeEl();
applyTabColor(el, 'teal', 'dot', true);
applyTabColor(el, 'red', 'tint', true);
check('re-painting a row replaces rather than stacks',
  el.classList.contains('sftabs-tc--tint') &&
  !el.classList.contains('sftabs-tc--dot') &&
  el.props.get('--sftabs-tc') === TAB_COLORS.red.accent,
  el.classList.list().join(' '));


// ── Turning colours off has to reach the page ──
// The colour settings live in userSettings, which the tab-key storage predicate
// does not cover, so nothing told the Salesforce tab bar to redraw. Turning
// colours off left every tab coloured and switching dot/fill did nothing, both
// until the page was reloaded. The quick-add toggle worked only because its
// handler happened to broadcast a refresh — a call the colour handlers did not
// make, and should not have to.
const change = (before, after) => ({ oldValue: before, newValue: after });

check('turning colours off asks the bar to redraw',
  settingsAffectTabBar(change(
    { tabColors: { enabled: true, style: 'dot' } },
    { tabColors: { enabled: false, style: 'dot' } })) === true);

check('switching dot to fill asks the bar to redraw',
  settingsAffectTabBar(change(
    { tabColors: { enabled: true, style: 'dot' } },
    { tabColors: { enabled: true, style: 'fill' } })) === true);

check('so does the menu-bar quick add, which used to be the only one that did',
  settingsAffectTabBar(change({ menuBarQuickAdd: false }, { menuBarQuickAdd: true })) === true);

check('and switching profile, which changes which tabs belong here',
  settingsAffectTabBar(change({ activeProfileId: 'a' }, { activeProfileId: 'b' })) === true);

// The other half matters too: this runs on every settings write, and rebuilding
// the tab bar because someone changed the theme would be pure waste.
check('a theme change does not rebuild the tab bar',
  settingsAffectTabBar(change(
    { themeMode: 'light', tabColors: { enabled: true } },
    { themeMode: 'dark', tabColors: { enabled: true } })) === false);

check('nor does a floating-button change',
  settingsAffectTabBar(change(
    { floatingButton: { enabled: false } },
    { floatingButton: { enabled: true } })) === false);

check('a write that changed nothing relevant is not a redraw',
  settingsAffectTabBar(change(
    { tabColors: { enabled: true, style: 'dot' } },
    { tabColors: { enabled: true, style: 'dot' } })) === false);

check('a first write, with no previous value, counts as a change',
  settingsAffectTabBar({ newValue: { tabColors: { enabled: true } } }) === true);

check('a missing change object is not a crash',
  settingsAffectTabBar(undefined) === false && settingsAffectTabBar(null) === false);

const failed = results.filter(x => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
