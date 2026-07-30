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
      toggleMenu(tabs, settings);
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

  function toggleMenu(tabs, settings) {
    if (document.getElementById(MENU_ID)) {
      closeMenu();
      return;
    }
    openMenu(tabs, settings);
  }

  function rowHTML(tab, index) {
    const kids = childrenOf(tab);
    const path = tab.path ? `<span class="sftabs-hm-sub">${esc(tab.path)}</span>` : '';
    const count = kids.length
      ? `<span class="sftabs-hm-count" aria-hidden="true">${kids.length} &rsaquo;</span>`
      : '';
    return `
      <li role="presentation">
        <button type="button" class="sftabs-hm-item" role="menuitem" data-index="${index}"
          ${kids.length ? 'aria-haspopup="true" aria-expanded="false"' : ''}>
          <span class="sftabs-hm-text">
            <span class="sftabs-hm-name">${esc(tab.label)}</span>
            ${path}
          </span>
          ${count}
        </button>
      </li>`;
  }

  function openMenu(tabs, settings) {
    const item = document.getElementById(ITEM_ID);
    if (!item) return;

    const menu = document.createElement('div');
    menu.id = MENU_ID;
    menu.className = 'sftabs-hm-menu';
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-label', msg('extensionName'));

    const rows = tabs.length
      ? tabs.slice().sort((a, b) => (a.position || 0) - (b.position || 0))
          .map((tab, i) => rowHTML(tab, i)).join('')
      : `<li class="sftabs-hm-empty">${esc(msg('floatingModalEmptyState'))}</li>`;

    menu.innerHTML = `
      <button type="button" class="sftabs-hm-close" aria-label="${esc(msg('closeButton'))}">
        ${svg(CLOSE, 'sftabs-hm-close-icon')}
      </button>
      <div class="sftabs-hm-label">${esc(msg('extensionName'))}</div>
      <ul class="sftabs-hm-list" role="menu">${rows}</ul>`;

    item.appendChild(menu);
    document.getElementById(`${ITEM_ID}-button`).setAttribute('aria-expanded', 'true');

    menu.querySelector('.sftabs-hm-close').addEventListener('click', closeMenu);

    const ordered = tabs.slice().sort((a, b) => (a.position || 0) - (b.position || 0));
    menu.querySelectorAll('.sftabs-hm-item').forEach(button => {
      const tab = ordered[Number(button.dataset.index)];
      button.addEventListener('click', event => {
        event.stopPropagation();
        const kids = childrenOf(tab);
        // A tab with children and no destination of its own is a folder: it can
        // only open its flyout.
        if (kids.length && (event.target.closest('.sftabs-hm-count') || !tab.path)) {
          toggleFlyout(button, tab);
          return;
        }
        closeMenu();
        navigate(tab);
      });
    });

    // Deferred so this click does not immediately close what it just opened
    setTimeout(() => {
      document.addEventListener('click', onDocumentClick, true);
      document.addEventListener('keydown', onKeydown, true);
    }, 0);

    const first = menu.querySelector('.sftabs-hm-item');
    if (first) first.focus();
  }

  /**
   * Sub-items open to the left: the menu sits at the right-hand end of the
   * header, so a flyout to the right would run off screen.
   */
  function toggleFlyout(button, tab) {
    const existing = button.parentElement.querySelector('.sftabs-hm-flyout');
    button.parentElement.parentElement
      .querySelectorAll('.sftabs-hm-flyout').forEach(el => el.remove());
    button.parentElement.parentElement
      .querySelectorAll('[aria-expanded="true"]').forEach(el => el.setAttribute('aria-expanded', 'false'));
    if (existing) return;

    const flyout = document.createElement('ul');
    flyout.className = 'sftabs-hm-flyout';
    flyout.setAttribute('role', 'menu');

    // Grandchildren are indented in the same flyout rather than cascading again;
    // a third floating layer in a page we do not own is more trouble than it
    // solves, and the depth limit is two.
    const rows = [];
    childrenOf(tab).forEach(child => {
      rows.push({ item: child, depth: 0 });
      childrenOf(child).forEach(grand => rows.push({ item: grand, depth: 1 }));
    });

    flyout.innerHTML = rows.map(({ item, depth }, i) => `
      <li role="presentation">
        <button type="button" class="sftabs-hm-item sftabs-hm-item_nested" role="menuitem"
          data-row="${i}" style="padding-left:${12 + depth * 16}px">
          <span class="sftabs-hm-text"><span class="sftabs-hm-name">${esc(item.label)}</span></span>
        </button>
      </li>`).join('');

    button.parentElement.appendChild(flyout);
    button.setAttribute('aria-expanded', 'true');

    flyout.querySelectorAll('.sftabs-hm-item').forEach(el => {
      el.addEventListener('click', event => {
        event.stopPropagation();
        closeMenu();
        navigate(rows[Number(el.dataset.row)].item, tab);
      });
    });
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
