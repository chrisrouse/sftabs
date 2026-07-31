// content/header-menu.js
// Injects an SF Tabs item into Salesforce's own global header, styled to match
// the Favorites menu. An alternative to the floating drawer, not a replacement:
// settings.headerMenu.enabled is independent of settings.floatingButton.
//
// Design notes live in docs/mockups/global-header-menu.md.

(function () {
  'use strict';

  const ITEM_ID = 'sftabs-header-item';
  const MENU_ID = 'sftabs-header-menu';

  // SLDS bookmark, vendored to icons/slds/bookmark.svg. Inlined because the
  // header is Aura-rendered and an <img> here would flicker on every re-inject.
  const BOOKMARK = 'm373 496-99-99c-6-6-15-6-21 0L147 497c-7 6-17 2-17-7V60a40 40 0 0 1 40-40h180a40 40 0 0 1 40 40v429c0 9-11 14-17 7';
  // SLDS new_window, the same glyph Salesforce puts on menu items that leave the
  // page. Shown only on hover or focus, as theirs is.
  const NEW_WINDOW = 'M487 20H296c-8 0-16 5-16 13v30c0 8 7 17 16 17h79c9 0 14 10 7 16L212 266c-6 6-6 15 0 21l21 21c6 6 15 6 21 0l170-170c6-6 16-2 16 7v79c0 8 8 17 16 17h29c8 0 15-9 15-17V34c0-9-5-14-13-14M363 255l-34 35q-9 9-9 21v114c0 8-7 15-15 15H95c-8 0-15-7-15-15V215c0-8 7-15 15-15h115c8 0 16-3 21-9l34-34c6-6 2-17-7-17H60a40 40 0 0 0-40 40v280a40 40 0 0 0 40 40h280a40 40 0 0 0 40-40V262c0-9-11-13-17-7';
  // Disclosure chevron, matching the floating panel's .dropdown-indicator: a
  // stroked polyline rather than a filled path, rotated 90deg when open.
  const CHEVRON = '<svg class="sftabs-hm-chev-icon" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
    'aria-hidden="true" focusable="false"><polyline points="9 18 15 12 9 6"></polyline></svg>';
  const CLOSE = 'm310 254 130-131c6-6 6-15 0-21l-20-21c-6-6-15-6-21 0L268 212a10 10 0 0 1-14 0L123 80c-6-6-15-6-21 0l-21 21c-6 6-6 15 0 21l131 131c4 4 4 10 0 14L80 399c-6 6-6 15 0 21l21 21c6 6 15 6 21 0l131-131a10 10 0 0 1 14 0l131 131c6 6 15 6 21 0l21-21c6-6 6-15 0-21L310 268a10 10 0 0 1 0-14';

  // Native menus sit 12.8px below their trigger (margin-top on the popup), which
  // is the space the nubbin occupies. Measured, not guessed — see
  // docs/snippets/dump-menu-styles.js.
  const NUBBIN_GAP = 13;

  let observer = null;
  // Held so row rendering can read tabColors without another storage read
  let menuSettings = {};

  const msg = (key, subs) => {
    try {
      return chrome.i18n.getMessage(key, subs) || key;
    } catch {
      return key;
    }
  };

  function svg(path, cls) {
    return `<svg class="${cls}" viewBox="0 0 520 520" aria-hidden="true" focusable="false">
      <path d="${path}" fill="currentColor"></path></svg>`;
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** A tab's own children, whatever shape the stored data uses. */
  const childrenOf = tab => Array.isArray(tab && tab.dropdownItems) ? tab.dropdownItems : [];

  // ── Injection ────────────────────────────────────────────────────

  /**
   * Salesforce's global actions list. Anchored on the SLDS class only —
   * data-aura-rendered-by ids are regenerated per render and are never stable.
   */
  const actionsList = () => document.querySelector('ul.slds-global-actions');

  /**
   * Put our item first.
   *
   * Deliberately a prepend rather than an insert relative to Favorites: the row
   * varies by org — some carry an Agentforce item, some do not — so anchoring on
   * a sibling would break wherever the row differs. Prepending is indifferent to
   * what else is present.
   */
  function inject(tabs, settings) {
    const list = actionsList();
    if (!list) return false;                       // header not rendered yet
    if (document.getElementById(ITEM_ID)) return true;

    const li = document.createElement('li');
    li.id = ITEM_ID;
    li.className = 'slds-global-actions__item slds-dropdown-trigger slds-dropdown-trigger_click';
    li.innerHTML = `
      <button type="button" id="${ITEM_ID}-button" aria-haspopup="true" aria-expanded="false"
        title="${esc(msg('extensionName'))}"
        aria-label="${esc(msg('headerMenuAriaLabel'))}"
        class="slds-button slds-button_icon slds-button_icon-container slds-button_icon-small slds-global-actions__item-action">
        ${svg(BOOKMARK, 'slds-icon slds-icon_xx-small')}
      </button>`;
    list.insertBefore(li, list.firstChild);

    li.querySelector('button').addEventListener('click', event => {
      event.stopPropagation();
      toggleMenu(tabs);
    });
    return true;
  }

  // ── Menu ─────────────────────────────────────────────────────────

  function closeMenu() {
    const menu = document.getElementById(MENU_ID);
    if (menu) menu.remove();
    const button = document.getElementById(`${ITEM_ID}-button`);
    if (button) button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', onDocumentClick, true);
    document.removeEventListener('keydown', onKeydown, true);
  }

  const onDocumentClick = event => {
    const menu = document.getElementById(MENU_ID);
    if (menu && !menu.contains(event.target) && !event.target.closest(`#${ITEM_ID}`)) closeMenu();
  };

  /**
   * Keyboard handling, matching the Setup menu: the first item is focused on
   * open, arrows move the highlight, Home/End jump to the ends, Escape closes and
   * returns focus to the trigger. The highlight is focus itself, so no separate
   * selection state is tracked.
   */
  const onKeydown = event => {
    const menu = document.getElementById(MENU_ID);
    if (!menu) return;

    if (event.key === 'Escape') {
      closeMenu();
      const button = document.getElementById(`${ITEM_ID}-button`);
      if (button) button.focus();
      return;
    }

    const KEYS = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!KEYS.includes(event.key)) return;

    const items = [...menu.querySelectorAll('a[role="menuitem"]')];
    if (!items.length) return;
    event.preventDefault();   // stop the page scrolling under the menu

    const at = items.indexOf(document.activeElement);
    let next;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else if (event.key === 'ArrowDown') next = at < 0 ? 0 : (at + 1) % items.length;
    else next = at < 0 ? items.length - 1 : (at - 1 + items.length) % items.length;
    items[next].focus();      // scrolls itself into view
  };

  function toggleMenu(tabs) {
    if (document.getElementById(MENU_ID)) {
      closeMenu();
      return;
    }
    closeSalesforceMenus();
    openMenu(tabs);
  }

  /**
   * Dismiss any open Aura popup before showing ours, so two menus are never up
   * at once.
   *
   * Done by clicking the popup's own trigger — the popup points at it through
   * aria-labelledby — rather than by hiding the node. Hiding it would leave Aura
   * believing the menu is still open, and the next click on that trigger would
   * do nothing.
   */
  function closeSalesforceMenus() {
    document.querySelectorAll('.uiPopupTarget.visible').forEach(popup => {
      if (popup.id === MENU_ID) return;
      const triggerId = popup.getAttribute('aria-labelledby');
      const trigger = triggerId ? document.getElementById(triggerId) : null;
      if (trigger) trigger.click();
    });
  }

  /**
   * One menu row, mirroring the Setup menu's item structure:
   * li.slds-dropdown__item.uiMenuItem > a[role=menuitem] > .slds-grid, with a
   * 10/12 label column and a 2/12 column for a trailing affordance.
   *
   * A real href rather than a button, so middle-click and cmd-click behave the
   * way they do on Salesforce's own menu items.
   */
  /**
   * One row, at any depth.
   *
   * rowKey is a dotted path — "3", "3.0", "3.0.1" — which is what makes nesting
   * work: a row's descendants are exactly the rows whose key starts with its own
   * key plus a dot, so collapsing a branch is one selector regardless of how deep
   * it goes.
   */
  function itemHTML({ item, depth, rowKey, hasKids }) {
    const href = urlFor(item);
    const chevron = hasKids ? `<span class="sftabs-hm-chev">${CHEVRON}</span>` : '';
    const newTab = item.openInNewTab
      ? `<div class="slds-p-right_small slds-no-flex sftabs-hm-newtab">
           ${svg(NEW_WINDOW, 'slds-icon slds-icon_x-small')}
           <span class="slds-assistive-text">${esc(msg('opensInNewTabTitle'))}</span>
         </div>`
      : '';
    return `
      <li role="presentation" class="slds-dropdown__item uiMenuItem sftabs-hm-depth-${depth}"
          data-row-key="${rowKey}" data-depth="${depth}">
        <a role="menuitem" title="${esc(item.label)}"${href ? ` href="${esc(href)}"` : ''}${
          item.openInNewTab ? ' target="_blank" rel="noopener"' : ''}${
          hasKids ? ' aria-expanded="false"' : ''}>
          <div class="slds-grid">
            ${chevron}
            <span class="sftabs-tc-mark" aria-hidden="true"></span>
            <div class="slds-col slds-truncate">
              <span class="slds-align-middle">${esc(item.label)}</span>
            </div>
            ${newTab}
          </div>
        </a>
      </li>`;
  }

  /** Build a row element and wire it. Used for every level, so they cannot drift. */
  function buildRow(item, depth, rowKey) {
    const holder = document.createElement('ul');   // <li> only parses inside a list
    holder.innerHTML = itemHTML({
      item, depth, rowKey, hasKids: childrenOf(item).length > 0,
    });
    const li = holder.querySelector('li');
    paintRow(li, item);
    bindRow(li, item);
    return li;
  }

  /**
   * Optional per-tab colour. Menus always use the bead, whatever the tab bar is
   * set to: a 12px row filled with colour is harder to read, not easier.
   */
  function paintRow(li, item) {
    const utils = window.SFTabs && window.SFTabs.utils;
    if (!utils || !utils.applyTabColor) return;
    utils.applyTabColor(li, item.color, 'dot', !!(menuSettings.tabColors && menuSettings.tabColors.enabled));
  }

  function bindRow(li, item) {
    const link = li.querySelector('a');
    if (!link) return;
    link.addEventListener('click', event => {
      const kids = childrenOf(item);
      // The chevron expands; the label navigates. An item with children and no
      // destination of its own can only expand.
      if (kids.length && (event.target.closest('.sftabs-hm-chev') || !item.path)) {
        event.preventDefault();
        event.stopPropagation();
        toggleSubItems(li, item);
        return;
      }
      // Let the browser handle new-tab links and modified clicks natively
      if (item.openInNewTab || event.metaKey || event.ctrlKey || event.button === 1) {
        closeMenu();
        return;
      }
      event.preventDefault();
      closeMenu();
      navigate(item);
    });
  }

  /** URL for a tab or sub-item, empty for a folder with no path of its own. */
  function urlFor(item) {
    const floating = window.SFTabsFloating;
    return (floating && typeof floating.buildTabUrl === 'function')
      ? (floating.buildTabUrl(item) || '')
      : '';
  }

  function openMenu(tabs) {
    const item = document.getElementById(ITEM_ID);
    if (!item) return;

    const ordered = tabs.slice().sort((a, b) => (a.position || 0) - (b.position || 0));

    const menu = document.createElement('div');
    menu.id = MENU_ID;
    // Salesforce's own popup classes, so its CSS supplies the radius, shadow and
    // item treatment.
    menu.className = 'popupTargetContainer uiPopupTarget ' +
                     'uiMenuList uiMenuList--default visible positioned ' +
                     'sftabs-hm-menu';
    menu.setAttribute('aria-labelledby', ITEM_ID + '-button');

    // The header sits inside the scrollable ul, as it does in the Setup menu.
    menu.innerHTML = `
      <div role="menu">
        <ul role="presentation" class="scrollable">
          <div class="menu-header">
            <h2 class="header-text">${esc(msg('extensionName'))}</h2>
            <button type="button" title="${esc(msg('closeButton'))}"
              class="slds-button slds-button_icon close-button slds-button_icon-bare">
              ${svg(CLOSE, 'slds-button__icon slds-button__icon_small')}
              <span class="slds-assistive-text">${esc(msg('closeButton'))}</span>
            </button>
          </div>
        </ul>
      </div>`;

    const list = menu.querySelector('ul.scrollable');
    if (ordered.length) {
      ordered.forEach((tab, i) => list.appendChild(buildRow(tab, 0, String(i))));
    } else {
      const empty = document.createElement('li');
      empty.setAttribute('role', 'presentation');
      empty.className = 'slds-dropdown__item';
      empty.innerHTML = `<span class="sftabs-hm-empty">${esc(msg('floatingModalEmptyState'))}</span>`;
      list.appendChild(empty);
    }

    item.appendChild(menu);
    document.getElementById(ITEM_ID + '-button').setAttribute('aria-expanded', 'true');
    position(menu);
    menu.querySelector('.close-button').addEventListener('click', closeMenu);

    // Deferred so the click that opened this does not immediately close it
    setTimeout(() => {
      document.addEventListener('click', onDocumentClick, true);
      document.addEventListener('keydown', onKeydown, true);
    }, 0);

    const first = menu.querySelector('a[role="menuitem"]');
    if (first) first.focus();
  }

  /**
   * Place the menu against the trigger.
   *
   * Aura positions its popups by writing inline coordinates from its own layout
   * engine, which we are not using — so the uiMenuList classes alone leave the
   * menu wherever normal flow puts it, which is under the header rather than
   * under our button. Fixed positioning from the button's measured rect is
   * deterministic, and inline styles beat any class rule without !important.
   *
   * Prefers aligning the menu's left edge to the button, flipping to right-edge
   * alignment when that would overflow. The nubbin is ours, offset to the
   * button's measured centre, so it points at the button either way.
   */
  function position(menu) {
    const button = document.getElementById(ITEM_ID + '-button');
    if (!button) return;
    const rect = button.getBoundingClientRect();
    // Measured rather than assumed: the CSS width is fixed, but reading it back
    // keeps the flip decision honest if that value ever changes.
    const width = menu.getBoundingClientRect().width || 230;
    const margin = 8;

    const flip = rect.left + width + margin > window.innerWidth;
    menu.classList.toggle('uiMenuList--right', flip);
    menu.classList.toggle('uiMenuList--left', !flip);

    const left = flip
      ? Math.max(margin, rect.right - width)
      : Math.min(rect.left, window.innerWidth - width - margin);

    menu.style.position = 'fixed';
    menu.style.top = `${Math.round(rect.bottom + NUBBIN_GAP)}px`;
    menu.style.left = `${Math.round(left)}px`;
    menu.style.right = 'auto';
    menu.style.setProperty('--sftabs-hm-nubbin',
      `${Math.round(rect.left + rect.width / 2 - left)}px`);
  }

  /**
   * Reveal or hide one level of children.
   *
   * Only the immediate children are inserted. Rendering the whole subtree at once
   * is what made grandchildren appear without their own parent being expanded.
   * A child with children of its own gets a chevron and expands the same way.
   *
   * Collapsing removes the entire branch — every row whose key is prefixed by
   * this one — so a nested expansion cannot be orphaned.
   */
  function toggleSubItems(li, item) {
    const list = li.parentElement;
    const key = li.dataset.rowKey;
    const wasOpen = li.classList.contains('is-open');

    list.querySelectorAll(`[data-row-key^="${key}."]`).forEach(el => el.remove());
    li.classList.remove('is-open');
    const link = li.querySelector('a');
    if (link) link.setAttribute('aria-expanded', 'false');
    if (wasOpen) return;

    const kids = childrenOf(item);
    if (!kids.length) return;

    li.classList.add('is-open');
    if (link) link.setAttribute('aria-expanded', 'true');

    const depth = Number(li.dataset.depth) + 1;
    let cursor = li;
    kids.forEach((child, i) => {
      const el = buildRow(child, depth, `${key}.${i}`);
      cursor.insertAdjacentElement('afterend', el);
      cursor = el;
    });
  }

  /**
   * Reuses the floating modal's navigation, which already handles Lightning
   * navigation with fallbacks. Sub-items inherit the parent's path prefix the
   * same way the modal treats them.
   */
  function navigate(item) {
    const floating = window.SFTabsFloating;
    if (floating && typeof floating.navigateToTab === 'function') {
      floating.navigateToTab(item);
      return;
    }
    const utils = window.SFTabs && window.SFTabs.utils;
    if (utils && typeof utils.buildFullUrl === 'function') {
      window.location.href = utils.buildFullUrl(item);
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────────

  /**
   * The header is Aura-rendered and discards injected nodes on re-render, so the
   * item has to be re-added. Same problem tab-renderer.js solves for the Setup
   * nav bar.
   */
  function watch(tabs, settings) {
    if (observer) observer.disconnect();
    observer = new MutationObserver(() => {
      if (!document.getElementById(ITEM_ID)) inject(tabs, settings);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function teardown() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    closeMenu();
    const item = document.getElementById(ITEM_ID);
    if (item) item.remove();
  }

  async function init() {
    try {
      const loader = window.SFTabsFloating && window.SFTabsFloating.loadTabsAndSettings;
      if (typeof loader !== 'function') return;   // floating-button.js owns the read

      const { tabs, settings } = await loader();
      menuSettings = settings || {};
      if (!settings || !settings.headerMenu || !settings.headerMenu.enabled) {
        teardown();
        return;
      }
      if (inject(tabs, settings)) watch(tabs, settings);
      else {
        // Header not up yet. Watch for it, then inject once.
        watch(tabs, settings);
      }
    } catch {
      // A failure here must never take the page's own header with it
    }
  }

  if (browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' && area !== 'sync') return;
      const touched = changes.userSettings ||
        Object.keys(changes).some(k => k.startsWith('profile_') && k.includes('_tabs'));
      if (touched) {
        teardown();
        init();
      }
    });
  }

  const reposition = () => {
    const menu = document.getElementById(MENU_ID);
    if (menu) position(menu);
  };
  window.addEventListener('resize', reposition);
  window.addEventListener('scroll', reposition, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
