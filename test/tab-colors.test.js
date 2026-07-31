#!/usr/bin/env node
/**
 * Per-tab colours.
 *
 * The rule that matters most: switching the feature off must stop the rendering
 * and leave every stored tab.color alone, so switching it back on restores what
 * was there. Everything else is presentation.
 *
 * Run: npm test
 */
const { TAB_COLORS, tabColorVars, applyTabColor } = require('../popup/js/shared/utils.js');
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
check('a tab has no colour by default', TAB_STRUCTURE.color === null);
check('the feature is off by default', DEFAULT_SETTINGS.tabColors.enabled === false);
check('the default style is dot', DEFAULT_SETTINGS.tabColors.style === 'dot');

// ── Palette ──
check('twelve hues', Object.keys(TAB_COLORS).length === 12, String(Object.keys(TAB_COLORS).length));
check('every hue has an accent and a wash',
  Object.values(TAB_COLORS).every(c => c.accent && c.wash));
check('every value is a light-dark pair, so colours follow the theme',
  Object.values(TAB_COLORS).every(c =>
    /^light-dark\(#[0-9a-f]{6}, #[0-9a-f]{6}\)$/.test(c.accent) &&
    /^light-dark\(#[0-9a-f]{6}, #[0-9a-f]{6}\)$/.test(c.wash)));
check('an unknown hue resolves to nothing rather than throwing', tabColorVars('chartreuse') === null);
check('no colour resolves to nothing', tabColorVars(null) === null);

// ── Rendering ──
let el = fakeEl();
applyTabColor(el, 'teal', 'dot', true);
check('enabled + coloured: marked and given both properties',
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
applyTabColor(el, 'teal', 'underline', true);
check('the retired underline style falls back rather than rendering nothing',
  el.classList.contains('sftabs-tc--dot') && !el.classList.contains('sftabs-tc--underline'));

el = fakeEl();
applyTabColor(el, null, 'tint', true);
check('enabled but uncoloured: nothing applied',
  el.classList.size === 0 && el.props.size === 0);

// The headline requirement.
el = fakeEl();
applyTabColor(el, 'teal', 'tint', true);
applyTabColor(el, 'teal', 'tint', false);      // feature switched off
check('switching off removes every class and property',
  el.classList.size === 0 && el.props.size === 0, el.classList.list().join(' '));

const stored = { id: 't1', label: 'Flows', color: 'teal' };
applyTabColor(fakeEl(), stored.color, 'tint', false);
check('switching off does not touch the stored colour', stored.color === 'teal');
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

const failed = results.filter(x => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
