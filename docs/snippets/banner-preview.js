// docs/snippets/banner-preview.js
//
// Try the environment banner on a live Salesforce page before it is built.
// Paste into the page's own console (F12 on the Salesforce tab — this one IS
// meant for the page console, unlike the storage snippets).
//
// Nothing is stored and nothing is installed. It draws, you look, you undo.
//
//   sftabsPreview.bar()     fixed bar across the top, the chosen approach
//   sftabsPreview.tint()    recolour Salesforce's own header instead
//   sftabsPreview.both()
//   sftabsPreview.colour('#8430ce')   try a different colour
//   sftabsPreview.off()     put everything back
//
// Environment detection and the default palette are copied from the extension,
// so the colour you see is the colour it would use.

window.sftabsPreview = (() => {
  const ORG_PARTITIONS = { sandbox:'sandbox', develop:'developer', patch:'patch',
                           scratch:'scratch', demo:'demo', trailblaze:'playground' };
  const SUFFIXES = ['builder.salesforce-experience.com','my.salesforce-setup.com',
                    'my.salesforce.com','lightning.force.com','salesforce-setup.com','salesforce.com'];
  const COLOURS = { production:'#c5221f', sandbox:'#1e8e3e', developer:'#1a73e8',
                    scratch:'#7526e3', demo:'#b06000', patch:'#5c5c5c', playground:'#0d9dda' };
  const LABELS = { production:'Production', sandbox:'Sandbox', developer:'Developer Edition',
                   scratch:'Scratch org', demo:'Demo org', playground:'Trailhead Playground',
                   patch:'Patch org' };

  function org() {
    const host = location.hostname.toLowerCase();
    const suffix = SUFFIXES.find(s => host.endsWith('.' + s));
    if (!suffix) return null;
    const labels = host.slice(0, -(suffix.length + 1)).split('.');
    if (labels.length === 1) return { id: labels[0], env: 'production' };
    if (labels.length === 2 && ORG_PARTITIONS[labels[1]]) {
      return { id: labels[0], env: ORG_PARTITIONS[labels[1]] };
    }
    return null;
  }

  const BAR_ID = 'sftabs-preview-bar';
  let tinted = [];          // [element, originalInlineBackground]
  let override = null;

  const current = () => {
    const o = org();
    if (!o) { console.warn('[preview] not a Salesforce org host:', location.hostname); return null; }
    return { ...o, colour: override || COLOURS[o.env] };
  };

  function bar(showOrgName = true) {
    const o = current(); if (!o) return;
    off_bar();
    const el = document.createElement('div');
    el.id = BAR_ID;
    el.textContent = showOrgName
      ? `${o.id.toUpperCase()} · ${LABELS[o.env].toUpperCase()}`
      : LABELS[o.env].toUpperCase();
    el.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; z-index: 999999;
      display: flex; align-items: center; justify-content: center;
      padding: 0.5rem 1rem;
      font-family: 'Salesforce Sans', Arial, sans-serif;
      font-size: 0.8125rem; font-weight: 700; letter-spacing: 0.025rem;
      color: #fff; background: ${o.colour};`;
    document.body.appendChild(el);
    // What the banner extension does today, and the part most likely to fight
    // Lightning: the page is pushed down by overriding its padding.
    document.body.style.setProperty('padding-top', el.offsetHeight + 'px', 'important');
    console.log('[preview] bar:', o.id, o.env, o.colour);
  }

  function tint() {
    const o = current(); if (!o) return;
    off_tint();
    // The header, plus the bar beneath it that carries the app name
    for (const sel of ['.slds-global-header', '.slds-global-header__container',
                       '.slds-context-bar', '.oneAppNavContainer']) {
      document.querySelectorAll(sel).forEach(el => {
        tinted.push([el, el.style.background]);
        el.style.setProperty('background', o.colour, 'important');
      });
    }
    console.log('[preview] tinted', tinted.length, 'element(s):', o.id, o.env, o.colour);
    if (!tinted.length) console.warn('[preview] no header found — is this an Experience Builder page?');
  }

  function off_bar() {
    document.getElementById(BAR_ID)?.remove();
    document.body.style.removeProperty('padding-top');
  }
  function off_tint() {
    tinted.forEach(([el, prev]) => { el.style.background = prev || ''; });
    tinted = [];
  }

  return {
    bar, tint,
    both: () => { bar(); tint(); },
    colour: c => { override = c; if (document.getElementById(BAR_ID)) bar(); if (tinted.length) tint(); },
    off: () => { off_bar(); off_tint(); override = null; console.log('[preview] reverted'); },
    org: current,
  };
})();

console.log('%c[preview] ready — sftabsPreview.bar() / .tint() / .both() / .off()',
            'font-weight:bold');
sftabsPreview.org();
