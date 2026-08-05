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

console.log('\n' + passed + '/' + (passed + failed) + ' passed');
process.exit(failed ? 1 : 0);
