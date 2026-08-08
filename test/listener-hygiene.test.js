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
// That was visible. Toggling tab colors removed and re-inserted the
// header-menu <li> in ul.slds-global-actions, which reflows the header and
// shifted Salesforce's own global search bar, and destroyed and recreated the
// floating handle, which blinked. Neither surface uses that setting for its
// structure — only for what it lists.
const SURFACES = ['content/content-main.js', 'content/header-menu.js',
                  'content/floating-button.js', 'content/floating-modal.js',
                  'content/env-banner.js'];

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


// ── One flyout builder, not two ──
// The submenu machinery existed twice — inside renderDropdownItemsRecursive for
// nested items and as createOverflowSubmenu for the chevron — at roughly 240
// lines each. They had already diverged on two things the nested copy got
// wrong, which is what duplication of this size does.
const rendererSrc = read('content/tab-renderer.js');

check('there is one submenu builder',
  (rendererSrc.match(/submenuContainer\.className = 'submenu-container/g) || []).length === 1,
  'two copies is how the nesting bug survived in only one of them');

// Calls open the object on a new line; the declaration destructures inline.
check('both call sites go through it',
  (rendererSrc.match(/attachSubmenu\(\{\n/g) || []).length === 2);

// bodyOf would brace-match the destructured parameter list, so skip past it.
const attach = (() => {
  const decl = /function attachSubmenu\([^)]*\)\s*\{/.exec(rendererSrc);
  if (!decl) return null;
  let i = decl.index + decl[0].length - 1;
  for (let depth = 0; i < rendererSrc.length; i++) {
    if (rendererSrc[i] === '{') depth++;
    else if (rendererSrc[i] === '}' && --depth === 0) return rendererSrc.slice(decl.index, i + 1);
  }
  return null;
})();
check('attachSubmenu exists', Boolean(attach));

// The nested copy passed the grandparent menu down, so a third level positioned
// against the wrong element and could not hold its parent open.
check('a flyout gives its own container to whatever nests inside it',
  /fill\(ul, submenuContainer\)/.test(attach || ''),
  'passing the level above is why a third level opened beside the wrong menu');

// Measured, not guessed: offsetHeight is 0 while display is none.
check('the flyout height is measured before the off-screen clamp',
  /visibility', 'hidden', 'important'\)[\s\S]{0,140}offsetHeight/.test(attach || ''));

// The bridge is what lets the pointer travel to the flyout without crossing the
// page. Once the flyout is pushed up to fit, that path is diagonal.
check('the bridge spans the row and the flyout, not just the row',
  /Math\.min\(itemRect\.top, top\)/.test(attach || '') &&
  /Math\.max\(itemRect\.bottom, top \+ submenuHeight\)/.test(attach || ''));

check('the two call sites differ only in which side they try first',
  /preferSide: 'right'/.test(rendererSrc) && /preferSide: 'left'/.test(rendererSrc),
  'nested prefers right; the chevron sits at the end of the bar so it prefers left');


// ── The environment banner leaves the page as it found it ──
// It pushes the page down with padding on body, which is the one thing it does
// that outlives the element itself. Removing the bar without restoring that
// padding would leave a strip of blank page at the top for the rest of the
// session, on a surface the user has just switched off.
const banner = read('content/env-banner.js');
const bannerCss = read('content/env-banner.css');

check('the banner records the padding it replaced',
  /appliedPadding = document\.body\.style\.paddingTop/.test(banner));
check('and puts it back on removal, rather than clearing outright',
  /removeProperty\('padding-top'\)/.test(banner) &&
  /setProperty\('padding-top', appliedPadding\)/.test(banner),
  'Salesforce sets its own padding on body in some layouts');
check('removal runs before every draw, so nothing stacks',
  /function draw\([^)]*\) \{\s*\n\s*remove\(\);/.test(banner));
check('and the bar is removed when no color applies',
  (banner.match(/remove\(\); return;/g) || []).length >= 2,
  'switching the banner off has to take it away, not just stop redrawing it');
check('it never intercepts clicks meant for the header beneath it',
  /pointer-events: none/.test(bannerCss));

// On a Lightning page the bar goes INSIDE the global header, where Salesforce
// puts its own system messages. The first attempt overlaid the top of the page
// and padded body, and Lightning lays out inside a full-height container that
// body padding does not shift — so the bar sat on top of the Agentforce notice
// and the DevOps Center strip rather than moving them down.
check('the bar prefers to sit inside the global header',
  /#oneHeader/.test(banner) && /insertBefore\(bar, header\.firstChild\)/.test(banner),
  'the header sizes itself around its own banners, so nothing gets covered');
check('and only overlays the page where there is no such header',
  /placement = 'fixed'[\s\S]{0,80}padBody\(bar\)/.test(banner),
  'Experience Builder renders its own chrome');
check('the two placements are distinguishable in CSS',
  /\[data-placement="inline"\]/.test(bannerCss) && /\[data-placement="fixed"\]/.test(bannerCss));
const bannerBase = /^#sftabs-env-banner \{[^}]*\}/m.exec(bannerCss);
check('only the overlay is positioned and stacked',
  /\[data-placement="fixed"\][\s\S]{0,200}position: fixed/.test(bannerCss) &&
  Boolean(bannerBase) && !/position:|z-index:/.test(bannerBase[0]),
  'an in-flow bar that is also position:fixed would cover the header again');

// Placement has to survive Aura, and the search for the header has to end.
check('the placement watch is debounced and off the body',
  /new MutationObserver\(debounce\(/.test(banner) &&
  /observe\(header, \{ childList: true \}\)/.test(banner),
  'Aura discards injected nodes; a subtree watch on body fires continuously');
check('it watches the header and its parent, since Aura replaces either',
  /observe\(header\.parentNode, \{ childList: true \}\)/.test(banner));
check('waiting for Aura to boot gives up rather than polling forever',
  /POLL_TRIES = \d+/.test(banner) && /pollsLeft-- <= 0/.test(banner),
  'a page with no Lightning header must not be polled for the life of the tab');
check('and removal stops both the poll and the observer',
  /function remove\(\) \{[\s\S]{0,300}stopPolling\(\);[\s\S]{0,200}placementObserver\.disconnect\(\)/.test(banner));
check('a pending debounced callback cannot resurrect a removed bar',
  /if \(!active\) return;/.test(banner));

console.log('\n' + passed + '/' + (passed + failed) + ' passed');
process.exit(failed ? 1 : 0);
