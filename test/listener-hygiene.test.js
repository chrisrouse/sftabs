#!/usr/bin/env node
/**
 * Observers and listeners in the content scripts must be bounded.
 *
 * These run on every Salesforce page, in a tab that may stay open all day, and
 * nothing here is torn down by a page load. So the failure mode is not a crash
 * — it is a tab that gets slower the longer it lives, which nobody reports as a
 * bug and nothing in the suite would notice.
 *
 * Three shapes had gone wrong:
 *
 *   An observer created per call. monitorNativeTabActiveState built a fresh
 *   MutationObserver every time and never disconnected one, and it is called
 *   twice per initTabs — which runs on every URL change, storage change and
 *   refresh. After twenty navigations, forty observers watched the same nodes,
 *   and because the callback removes a class and a class change is an attribute
 *   mutation, each one's work re-triggered all the others.
 *
 *   Nodes parked outside what cleanup touches. Submenus are appended to
 *   document.body so the tab bar cannot clip them, which also puts them outside
 *   everything initTabs removes. Each carried an observer watching a menu that
 *   had just been detached.
 *
 *   Listeners on objects that outlive their owner. The floating modal attached
 *   handlers to document and to a matchMedia query but kept no reference, so
 *   destroy() could not remove them — and floating-button.js destroys and
 *   rebuilds that modal on every settings write.
 *
 * Asserted against the source: all of this is DOM lifetime behaviour with no
 * seam to observe from a unit test.
 *
 * Run: npm test
 */
const fs = require('fs');
const path = require('path');

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

const ROOT = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** One function or method body, by brace matching from its declaration. */
function bodyOf(src, pattern) {
  const decl = pattern.exec(src);
  if (!decl) return null;
  let i = src.indexOf('{', decl.index);
  for (let depth = 0; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(decl.index, i + 1);
  }
  return null;
}

// ── tab-renderer: the native-active observer is created once ──
const renderer = read('content/tab-renderer.js');

const monitor = bodyOf(renderer, /async function monitorNativeTabActiveState\s*\(/);
check('monitorNativeTabActiveState exists', Boolean(monitor));
check('it does not construct an observer itself',
  Boolean(monitor) && !/new MutationObserver/.test(monitor),
  'it is called twice per render; constructing here is how forty accumulated');

const ensure = bodyOf(renderer, /function ensureNativeActiveObserver\s*\(/);
check('a single observer is managed in one place', Boolean(ensure));
check('it returns early when already attached to the same nodes',
  Boolean(ensure) && /observedTabBar && .*observedPinned/.test(ensure));
check('and disconnects the old one before re-attaching',
  Boolean(ensure) && /disconnect\(\)/.test(ensure),
  'Salesforce replaces these containers; an observer on a detached node watches nothing');

// ── tab-renderer: body-level submenus are swept ──
check('submenu observers are tracked rather than dropped',
  /trackSubmenuObserver\(new MutationObserver/.test(renderer) &&
  (renderer.match(/const observer = new MutationObserver/g) || []).length === 0);
check('a sweep disconnects them and removes the orphaned nodes',
  /submenuObservers\.forEach\(observer => observer\.disconnect\(\)\)/.test(renderer) &&
  /querySelectorAll\('\.submenu-container, \.submenu-bridge'\)/.test(renderer));
check('and the sweep runs at the start of every render',
  /clearSubmenus\(\);/.test(bodyOf(renderer, /async function initTabs\s*\(/) || ''));

// ── tab-renderer: the reorder watcher does not pay storage on every mutation ──
const watcher = bodyOf(renderer, /function watchBarReorder\s*\(/);
check('the reorder watcher short-circuits before reading storage',
  Boolean(watcher) &&
  watcher.indexOf('sameOrder(order, lastRenderedOrder)') < watcher.indexOf('getTabsFromStorage'),
  'it fires on Salesforce\'s own mutations, not only on drags');
check('but stored order is still what decides a real reorder',
  Boolean(watcher) && /tabOrderMatches\(stored, order\)/.test(watcher),
  'comparing a drag against a snapshot is the bug that froze the bar');

// ── floating-modal: everything attached is releasable ──
const modal = read('content/floating-modal.js');

check('the modal declares destroy() exactly once',
  (modal.match(/^    destroy\(\) \{/gm) || []).length === 1,
  'two declarations meant the first was dead and read as if it were live');

const destroy = bodyOf(modal, /^    destroy\(\) \{/m);
const HANDLERS = ['resizeHandler', 'storageChangeHandler', 'themeStorageHandler',
                  'systemThemeHandler', 'escapeHandler', 'outsideClickHandler'];
for (const handler of HANDLERS) {
  check(`${handler} is released in destroy()`,
    Boolean(destroy) && destroy.includes(handler));
}
check('no anonymous document listeners remain on the modal',
  !/document\.addEventListener\('(keydown|click)',\s*\(/.test(modal),
  'document outlives every modal instance, so an unheld handler is permanent');
check('the system-theme query handler is held, not inline',
  /this\.systemThemeQuery\.addEventListener\('change', this\.systemThemeHandler\)/.test(modal));

// ── header-menu: the two hot paths ──
const header = read('content/header-menu.js');

check('the re-injection observer is debounced',
  /new MutationObserver\(debounce\(/.test(header),
  'Lightning mutates the body continuously');
check('and is scoped below document.body where possible',
  /querySelector\('\.slds-global-header'\) \|\| document\.body/.test(header));
check('the capture-phase scroll handler bails when the menu is closed',
  /if \(!menuIsOpen\) return;/.test(header),
  'capture phase means every scrollable descendant fires it');
check('and coalesces to one reposition per frame',
  /requestAnimationFrame\(/.test(header));
check('open state is a flag, not a DOM lookup per scroll event',
  /^  let menuIsOpen = false;/m.test(header));


// ── No surface rebuilds itself for a setting it does not use ──
// Every content surface listens to userSettings, and a settings write fires
// twice: once for sync, once for the local mirror saveUserSettings keeps. A
// surface reacting to the bare presence of changes.userSettings therefore tore
// itself down and rebuilt twice for any setting at all.
//
// That was visible. Toggling tab colours removed and re-inserted the
// header-menu <li> in ul.slds-global-actions, which reflows the header and
// shifted Salesforce's own global search bar, and destroyed and recreated the
// floating handle, which blinked. Neither surface uses that setting for its
// structure — only for what it lists.
const SURFACES = ['content/content-main.js', 'content/header-menu.js',
                  'content/floating-button.js', 'content/floating-modal.js'];

for (const rel of SURFACES) {
  const src = read(rel);
  const name = rel.split('/').pop();

  check(`${name} does not react to the bare presence of a settings write`,
    !/Boolean\(changes\.userSettings\)/.test(src) &&
    !/changes\.userSettings\s*\|\|/.test(src) &&
    !/if\s*\(changes\.userSettings\)/.test(src),
    'a settings write fires twice and most settings do not concern any one surface');

  check(`${name} names the settings it depends on`,
    /settingsChanged\(|settingsAffectTabBar\(/.test(src));

  check(`${name} debounces its storage listener`,
    /debounce\(/.test(src),
    'collapses the sync write and its local mirror into one response');
}

// The header item itself must survive a refresh — removing and re-adding it is
// what moved the search bar.
const headerListener = /const onChange = debounce\([\s\S]*?\}, \d+\);/.exec(header);
check('the header menu tears down only when the feature is switched off',
  Boolean(headerListener) &&
  /settingsChanged\(changes\.userSettings, \['headerMenu'\]\)[\s\S]{0,120}teardown\(\)/.test(headerListener[0]),
  'anything else changes the menu contents, not the injected element');
check('and refreshes its contents without touching the DOM otherwise',
  Boolean(headerListener) && /menuTabs = tabs/.test(headerListener[0]));
check('the menu reads those tabs at open time rather than closing over them',
  /toggleMenu\(menuTabs\)/.test(header),
  'closing over the list is why a refresh needed a re-inject');

// The floating surface: rebuild is for its own settings, everything else is a
// re-read.
const floatingButtonSrc = read('content/floating-button.js');
check('the floating button rebuilds only for floatingButton settings',
  /settingsChanged\(changes\.userSettings, \['floatingButton'\]\)[\s\S]{0,200}destroy\(\)/.test(floatingButtonSrc));
check('and leaves the panel to re-render itself',
  !/modal\.renderTabs\(\)/.test(floatingButtonSrc),
  'both doing it drew every row twice');


// ── Dismissing a menu when the click lands in an iframe ──
// A click inside an iframe never reaches the parent document, so a
// click-outside handler on `document` cannot see it. Experience Builder renders
// its canvas in one, so clicking the canvas left both the floating panel and
// the header menu sitting open on top of it — everywhere else on the page they
// closed correctly, which is what made it look like a Builder-specific quirk.
//
// Focus entering a frame does raise blur on the window, and activeElement then
// names the frame, which distinguishes it from switching to another window.
const DISMISSABLE = [
  ['content/floating-modal.js', 'frameBlurHandler'],
  ['content/header-menu.js', 'onWindowBlur'],
];

for (const [rel, handler] of DISMISSABLE) {
  const src = read(rel);
  const name = rel.split('/').pop();

  check(`${name} closes when focus moves into an iframe`,
    new RegExp("addEventListener\\('blur', (this\\.)?" + handler).test(src),
    'a document click listener cannot see a click inside a frame');

  check(`${name} checks it was a frame, not another window`,
    /activeElement\.tagName === 'IFRAME'/.test(src),
    'switching apps also blurs the window and must not close the menu');

  check(`${name} releases that listener`,
    new RegExp("removeEventListener\\('blur', (this\\.)?" + handler).test(src),
    'window outlives every instance');
}

console.log('\n' + passed + '/' + (passed + failed) + ' passed');
process.exit(failed ? 1 : 0);
