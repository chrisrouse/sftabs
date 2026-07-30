/**
 * Dump the computed styles of a Salesforce global-header menu.
 *
 * Why: matching Salesforce's menus by eye from screenshots is guesswork. This
 * reports the values the browser actually resolved, so padding, widths and type
 * can be copied rather than estimated.
 *
 * How to use
 *   1. Open the org, then open the menu you want to copy — the Setup gear or
 *      Favorites. It has to stay open.
 *   2. DevTools > Console. Paste this whole file and press Enter.
 *   3. Copy the JSON it prints and paste it back into the conversation.
 *
 * It reads only; nothing is changed. Run it a second time with our own menu open
 * to get both sides for comparison.
 */
(() => {
  const PROPS = [
    'width', 'minWidth', 'maxWidth', 'height', 'boxSizing',
    'padding', 'margin', 'border', 'borderRadius', 'boxShadow',
    'backgroundColor', 'color',
    'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textTransform',
    'display', 'alignItems', 'justifyContent', 'position', 'overflowY',
  ];

  // Every open popup: Salesforce's, and ours if it happens to be open too
  const popups = [...document.querySelectorAll('.uiPopupTarget.visible, #sftabs-header-menu')];
  if (!popups.length) {
    console.warn('No open menu found. Open the Setup or Favorites menu first, then re-run.');
    return;
  }

  const styles = el => {
    const cs = getComputedStyle(el);
    return PROPS.reduce((out, p) => {
      const v = cs[p];
      if (v && v !== 'none' && v !== 'normal' && v !== 'auto' && v !== '0px') out[p] = v;
      return out;
    }, {});
  };

  const describe = el => ({
    tag: el.tagName.toLowerCase(),
    classes: el.className && typeof el.className === 'string' ? el.className : '(none)',
    rect: (r => ({ w: Math.round(r.width), h: Math.round(r.height) }))(el.getBoundingClientRect()),
    css: styles(el),
  });

  // The parts worth copying, by role rather than by exact class, so this works
  // for both the Setup menu and Favorites.
  const PARTS = [
    ['menu',        el => el],
    ['scrollable',  el => el.querySelector('.scrollable')],
    ['header',      el => el.querySelector('.menu-header, .header')],
    ['headerText',  el => el.querySelector('.header-text, h2')],
    ['closeButton', el => el.querySelector('.close-button, button')],
    ['firstItem',   el => el.querySelector('li.slds-dropdown__item, li.uiMenuItem')],
    ['firstLink',   el => el.querySelector('li a[role="menuitem"]')],
    ['itemLabel',   el => el.querySelector('.slds-align-middle')],
    ['separator',   el => el.querySelector('li[role="separator"]')],
  ];

  const report = popups.map(popup => {
    const which = popup.id === 'sftabs-header-menu'
      ? 'SF Tabs (ours)'
      : (popup.textContent.trim().slice(0, 24) || 'Salesforce menu');
    const parts = {};
    for (const [name, find] of PARTS) {
      const el = find(popup);
      if (el) parts[name] = describe(el);
    }
    return { menu: which, viewport: { w: innerWidth, h: innerHeight }, parts };
  });

  const json = JSON.stringify(report, null, 2);
  console.log(json);
  try {
    copy(json);            // DevTools helper; puts it on the clipboard
    console.log('%cCopied to clipboard — paste it into the conversation.', 'font-weight:bold');
  } catch {
    console.log('Select the JSON above and copy it.');
  }
})();
