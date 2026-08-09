/**
 * Dump the computed styles of the native Favorites split button and ours, side
 * by side.
 *
 * Why: dump-menu-styles.js measures the open menu. This measures the trigger —
 * the two-part button in the global header — which is a different problem and
 * had been matched from screenshots instead, twice, wrongly.
 *
 * It reports both halves of each control and the inner div each button wraps
 * its icon in, so a difference can be read off as a delta rather than guessed.
 *
 * How to use
 *   1. Open any Salesforce page whose header shows both Favorites and SF Tabs.
 *      Nothing needs to be open or hovered.
 *   2. DevTools > Console. Paste this whole file and press Enter.
 *   3. Copy the JSON it prints and paste it back into the conversation.
 *
 * It reads only; nothing is changed.
 */
(() => {
  const PROPS = [
    'width', 'height', 'minWidth', 'boxSizing',
    'padding', 'margin', 'borderRadius',
    // Per side rather than the `border` shorthand, which computes to an empty
    // string when the four sides differ.
    'borderTop', 'borderRight', 'borderBottom', 'borderLeft',
    'backgroundColor', 'color', 'fill',
    'display', 'alignItems', 'justifyContent', 'position',
    'lineHeight', 'fontSize', 'verticalAlign',
  ];

  const styles = el => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const out = {};
    for (const p of PROPS) out[p] = cs[p];
    const r = el.getBoundingClientRect();
    out['__rect'] = `${Math.round(r.width)}x${Math.round(r.height)}`;
    out['__classes'] = el.getAttribute('class') || '';
    return out;
  };

  /** A button, the div it wraps its icon in, and the icon itself. */
  const describe = button => {
    if (!button) return null;
    return {
      button: styles(button),
      innerDiv: styles(button.querySelector(':scope > div')),
      icon: styles(button.querySelector('svg')),
    };
  };

  const favGroup = document.querySelector('.slds-global-actions__favorites');
  const favButtons = favGroup ? [...favGroup.querySelectorAll('button')] : [];

  const ours = document.getElementById('sftabs-header-item');
  const ourButtons = ours ? [...ours.querySelectorAll('button')] : [];

  const report = {
    found: {
      favorites: favButtons.length,
      sftabs: ourButtons.length,
    },
    favorites: {
      group: styles(favGroup),
      // In Salesforce's markup each button also sits inside a wrapper div.
      wrapper: styles(favButtons[0] ? favButtons[0].parentElement : null),
      action: describe(favButtons[0]),
      more: describe(favButtons[1]),
    },
    sftabs: {
      group: styles(ours ? ours.querySelector('[role="group"]') : null),
      li: styles(ours),
      add: describe(ourButtons[0]),
      more: describe(ourButtons[1]),
    },
  };

  if (!favGroup) {
    console.warn('No Favorites control found — open a record page, not Setup.');
  }
  if (!ours) {
    console.warn('No SF Tabs header item found — is the header menu switched on?');
  }

  console.log(JSON.stringify(report, null, 2));
  return report;
})();
