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
  const CLOSE = 'm310 254 130-131c6-6 6-15 0-21l-20-21c-6-6-15-6-21 0L268 212a10 10 0 0 1-14 0L123 80c-6-6-15-6-21 0l-21 21c-6 6-6 15 0 21l131 131c4 4 4 10 0 14L80 399c-6 6-6 15 0 21l21 21c6 6 15 6 21 0l131-131a10 10 0 0 1 14 0l131 131c6 6 15 6 21 0l21-21c6-6 6-15 0-21L310 268a10 10 0 0 1 0-14';

  // Native menus sit 12.8px below their trigger (margin-top on the popup), which
  // is the space the nubbin occupies. Measured, not guessed — see
  // docs/snippets/dump-menu-styles.js.
  const NUBBIN_GAP = 13;

  let observer = null;

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

  const onKeydown = event => {
    if (event.key === 'Escape') {
      closeMenu();
      const button = document.getElementById(`${ITEM_ID}-button`);
      if (button) button.focus();
    }
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
  function rowHTML(tab, index) {
    const kids = childrenOf(tab);
    const href = urlFor(tab);
    const path = tab.path ? `<span class="sftabs-hm-path">${esc(tab.path)}</span>` : '';
    const trailing = kids.length
      ? `<div class="slds-p-right_small slds-p-left_small slds-no-flex slds-size_2-of-12">
           <span class="sftabs-hm-count">${kids.length} &rsaquo;</span>
         </div>`
      : '';
    return `
      <li role="presentation" class="slds-dropdown__item uiMenuItem" data-index="${index}">
        <a role="menuitem" title="${esc(tab.label)}"${href ? ` href="${esc(href)}"` : ''}${
          tab.openInNewTab ? ' target="_blank" rel="noopener"' : ''}>
          <div class="slds-grid">
            <div class="slds-col slds-size_${kids.length ? '10' : '12'}-of-12">
              <span class="slds-truncate">
                <span class="slds-align-middle">${esc(tab.label)}</span>
                ${path}
              </span>
            </div>
            ${trailing}
          </div>
        </a>
      </li>`;
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
    // Salesforce's own popup classes, so its CSS supplies the nubbin, radius,
    // shadow and item treatment. uiMenuList--right aligns the menu's right edge
    // to the trigger, which keeps it on screen: our item is the leftmost of a
    // cluster that sits at the right of the window.
    menu.className = 'popupTargetContainer menu--nubbin-top uiPopupTarget ' +
                     'uiMenuList uiMenuList--default visible positioned ' +
                     'sftabs-hm-menu';
    menu.setAttribute('aria-labelledby', ITEM_ID + '-button');

    const rows = ordered.length
      ? ordered.map((tab, i) => rowHTML(tab, i)).join('')
      : `<li role="presentation" class="slds-dropdown__item">
           <span class="sftabs-hm-empty">${esc(msg('floatingModalEmptyState'))}</span>
         </li>`;

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
          ${rows}
        </ul>
      </div>`;

    item.appendChild(menu);
    document.getElementById(ITEM_ID + '-button').setAttribute('aria-expanded', 'true');
    position(menu);
    menu.querySelector('.close-button').addEventListener('click', closeMenu);

    menu.querySelectorAll('li.uiMenuItem').forEach(li => {
      const tab = ordered[Number(li.dataset.index)];
      const link = li.querySelector('a');
      if (!link) return;
      link.addEventListener('click', event => {
        const kids = childrenOf(tab);
        // The count column, or a tab with children and no destination of its
        // own, expands the sub-items instead of navigating.
        if (kids.length && (event.target.closest('.sftabs-hm-count') || !tab.path)) {
          event.preventDefault();
          event.stopPropagation();
          toggleSubItems(li, tab);
          return;
        }
        // Let the browser handle new-tab links and modified clicks natively
        if (tab.openInNewTab || event.metaKey || event.ctrlKey || event.button === 1) {
          closeMenu();
          return;
        }
        event.preventDefault();
        closeMenu();
        navigate(tab);
      });
    });

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
   * Aura positions its popups by writing inline coordinates from its own
   * layout engine, which we are not using — so relying on the uiMenuList classes
   * alone leaves the menu wherever their default rules put it, which is not next
   * to our button. Fixed positioning from the button's own rect is deterministic,
   * and inline styles beat any class rule without needing !important.
   *
   * Prefers aligning the menu's left edge to the button and flips to right-edge
   * alignment when that would overflow. The nubbin itself is Salesforce's, drawn
   * by menu--nubbin-top at a fixed inset from whichever edge
   * uiMenuList--left/--right aligns to — so aligning an edge to the button is
   * what keeps the arrow over it, since the button is 32px wide and its centre
   * sits about that same inset in.
   */
  function position(menu) {
    const button = document.getElementById(ITEM_ID + '-button');
    if (!button) return;
    const rect = button.getBoundingClientRect();
    // Width is auto now, matching native, so this has to be the measured value
    const width = menu.getBoundingClientRect().width || 233;
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
  }

  /**
   * Sub-items expand in place beneath their parent as sibling menu items, with a
   * divider above, rather than cascading into a second popup. Grandchildren are
   * indented in the same block: a third floating layer on a page we do not own
   * is more trouble than it solves, and the depth limit is two anyway.
   */
  function toggleSubItems(li, tab) {
    const list = li.parentElement;
    const key = li.dataset.index;
    const open = list.querySelector(`[data-sub-of="${key}"]`);
    list.querySelectorAll('[data-sub-of]').forEach(el => el.remove());
    if (open) return;                                   // second click collapses

    const rows = [];
    childrenOf(tab).forEach(child => {
      rows.push({ item: child, depth: 0 });
      childrenOf(child).forEach(grand => rows.push({ item: grand, depth: 1 }));
    });
    if (!rows.length) return;

    const divider = document.createElement('li');
    divider.setAttribute('role', 'separator');
    divider.className = 'slds-has-divider_top-space';
    divider.dataset.subOf = key;

    const items = rows.map(({ item, depth }) => {
      const el = document.createElement('li');
      el.setAttribute('role', 'presentation');
      el.className = 'slds-dropdown__item uiMenuItem sftabs-hm-sub-item';
      el.dataset.subOf = key;
      const href = urlFor(item);
      el.innerHTML = `
        <a role="menuitem" title="${esc(item.label)}"${href ? ` href="${esc(href)}"` : ''}>
          <div class="slds-grid">
            <div class="slds-col slds-size_12-of-12" style="padding-left:${depth * 16}px">
              <span class="slds-truncate">
                <span class="slds-align-middle">${esc(item.label)}</span>
              </span>
            </div>
          </div>
        </a>`;
      el.querySelector('a').addEventListener('click', event => {
        if (event.metaKey || event.ctrlKey || event.button === 1) { closeMenu(); return; }
        event.preventDefault();
        closeMenu();
        navigate(item, tab);
      });
      return el;
    });

    // Insert divider then rows, each after the last thing inserted
    let cursor = li;
    for (const el of [divider, ...items]) {
      cursor.insertAdjacentElement('afterend', el);
      cursor = el;
    }
  }

  /**
   * Reuses the floating modal's navigation, which already handles Lightning
   * navigation with fallbacks. Sub-items inherit the parent's path prefix the
   * same way the modal treats them.
   */
  function navigate(tab, parent) {
    const floating = window.SFTabsFloating;
    if (floating && typeof floating.navigateToTab === 'function') {
      floating.navigateToTab(resolveTarget(tab, parent));
      return;
    }
    const utils = window.SFTabs && window.SFTabs.utils;
    if (utils && typeof utils.buildFullUrl === 'function') {
      window.location.href = utils.buildFullUrl(resolveTarget(tab, parent));
    }
  }

  /** Sub-items carry their own path; inherit the parent's open-in-new-tab flag. */
  function resolveTarget(item, parent) {
    if (!parent) return item;
    return { ...item, openInNewTab: parent.openInNewTab };
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
