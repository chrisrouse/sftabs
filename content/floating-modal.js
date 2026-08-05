// content/floating-modal.js
// Modal UI for displaying SF Tabs list from floating button

(function() {
  'use strict';

  /**
   * Tabs + settings, without depending on the FloatingButton *instance*.
   * Previously the modal was only built if window.SFTabsFloating.button.settings
   * happened to exist, and it gave up silently after 2s — so if that instance
   * was ever missing, no modal was created and nothing could open.
   */
  async function resolveFloatingData() {
    const btn = window.SFTabsFloating?.button;
    if (btn?.settings) {
      return { tabs: btn.tabs || [], settings: btn.settings };
    }
    if (typeof window.SFTabsFloating?.loadTabsAndSettings === 'function') {
      try {
        return await window.SFTabsFloating.loadTabsAndSettings();
      } catch (e) { /* fall through */ }
    }
    return { tabs: [], settings: {} };
  }

  /**
   * Build full URL for a tab (matches tab-renderer.js buildFullUrl logic)
   */
  function buildTabUrl(tab) {
    const baseUrl = window.location.origin;

    // Check if path already includes full Lightning URL (nested navigation items)
    if (tab.path && tab.path.startsWith('/lightning/')) {
      return `${baseUrl}${tab.path}`;
    }

    // For custom URLs
    if (tab.isCustomUrl) {
      let formattedPath = tab.path || '';
      if (!formattedPath.startsWith('/')) {
        formattedPath = '/' + formattedPath;
      }
      return `${baseUrl}${formattedPath}`;
    }

    // For Object URLs
    if (tab.isObject) {
      return `${baseUrl}/lightning/o/${tab.path}`;
    }

    // For ObjectManager URLs
    if (tab.path && tab.path.includes('ObjectManager/')) {
      return `${baseUrl}/lightning/setup/${tab.path}`;
    }

    // For Setup URLs (add /home at the end)
    if (tab.path) {
      return `${baseUrl}/lightning/setup/${tab.path}/home`;
    }

    // No path - return null (folder-style tab)
    return null;
  }

  /**
   * Navigate to a tab using Lightning navigation
   */
  function navigateToTab(tab) {
    const url = buildTabUrl(tab);

    // Don't navigate if no URL (folder-style tab)
    if (!url) {
      return;
    }

    // Check if in Setup and the full lightningNavigate function is available
    // (content-main.js is only loaded on Setup pages)
    if (typeof window.lightningNavigate === 'function') {
      // Use the full Lightning navigation with all fallbacks
      window.lightningNavigate({
        navigationType: "url",
        url: url
      }, url);
      return;
    }

    // Outside Setup or lightningNavigate not available - use simpler approach
    // Try inject.js window function approach first (most reliable)
    if (window.sfTabsLightningNav) {
      const success = window.sfTabsLightningNav({
        navigationType: "url",
        url: url
      });

      if (success) {
        return;
      }
    }

    // Fallback: use window.location
    window.location.href = url;
  }

  /**
   * FloatingModal class - manages the modal overlay
   */
  class FloatingModal {
    constructor() {
      this.modal = null;
      this.isOpen = false;
      this.tabs = [];
      this.settings = null;

      // Initialize immediately
      this.init();
    }

    async init() {
      await this.loadData();
      this.createModal();
      await this.applyTheme();
    }

    async open() {
      // Refresh tabs in case they changed
      await this.loadData();
      if (!this.modal) return; // destroyed while awaiting
      this.renderTabs();

      // Update position and panel direction in case viewport changed
      this.updatePosition();

      this.modal.classList.add('open');
      this.isOpen = true;

      // Focus management - focus first tab
      setTimeout(() => {
        const firstTab = this.modal.querySelector('.tab-item');
        if (firstTab) {
          firstTab.focus();
        }
      }, 100);
    }

    close() {
      if (this.modal) {
        this.modal.classList.remove('open');
        this.isOpen = false;

        // Return focus to toggle button
        const toggleButton = this.modal.querySelector('.modal-toggle-button');
        if (toggleButton) {
          toggleButton.focus();
        }
      }
    }

    toggle() {
      // Derive state from the DOM rather than trusting this.isOpen. If the flag
      // ever drifts out of sync — a re-init, an element replaced underneath us —
      // the toggle silently does the opposite of what the user expects.
      const openNow = !!this.modal && this.modal.classList.contains('open');
      this.isOpen = openNow;
      if (openNow) {
        this.close();
      } else {
        this.open();
      }
    }

    /** Remove our DOM and listeners so a fresh instance can replace us. */
    destroy() {
      if (this.resizeHandler) {
        window.removeEventListener('resize', this.resizeHandler);
        this.resizeHandler = null;
      }
      if (this.modal && this.modal.parentNode) {
        this.modal.parentNode.removeChild(this.modal);
      }
      this.modal = null;
      this.isOpen = false;
    }

    async loadData() {
      try {
        const data = await resolveFloatingData();
        this.tabs = data.tabs || [];
        this.settings = data.settings || {};
      } catch (error) {
        this.tabs = [];
        this.settings = {};
      }
    }

    async applyTheme() {
      try {
        // Read theme preference from storage (same as popup does)
        const result = await browser.storage.local.get('userSettings');
        const userSettings = result.userSettings || {};
        const themeMode = userSettings.themeMode || 'system';

        if (themeMode === 'system') {
          // Check system preference
          if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            this.modal.setAttribute('data-theme', 'dark');
          } else {
            this.modal.setAttribute('data-theme', 'light');
          }

          // Listen for changes in system theme
          window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            const newTheme = e.matches ? 'dark' : 'light';
            if (this.modal) {
              this.modal.setAttribute('data-theme', newTheme);
            }
          });
        } else {
          // Apply user selected theme
          this.modal.setAttribute('data-theme', themeMode);
        }

        // Listen for theme changes in storage
        browser.storage.onChanged.addListener((changes, area) => {
          if (changes.userSettings && changes.userSettings.newValue) {
            const newThemeMode = changes.userSettings.newValue.themeMode;
            if (newThemeMode && this.modal) {
              if (newThemeMode === 'system') {
                const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                this.modal.setAttribute('data-theme', isDark ? 'dark' : 'light');
              } else {
                this.modal.setAttribute('data-theme', newThemeMode);
              }
            }
          }
        });
      } catch (error) {
        // Fail gracefully - default to light theme
        if (this.modal) {
          this.modal.setAttribute('data-theme', 'light');
        }
      }
    }

    createModal() {
      // Create modal structure with integrated button
      this.modal = document.createElement('div');
      this.modal.className = 'sftabs-floating-modal';
      this.modal.setAttribute('role', 'dialog');
      this.modal.setAttribute('aria-modal', 'true');
      this.modal.setAttribute('aria-label', chrome.i18n.getMessage('extensionName'));

      // Always use right edge
      this.modal.setAttribute('data-edge', 'right');

      // Get logo URL
      const logoUrl = browser.runtime.getURL('icons/sftabs-logo.svg');

      const modalContent = document.createElement('div');
      modalContent.className = 'modal-content';

      const toggleButton = document.createElement('button');
      toggleButton.className = 'modal-toggle-button';
      toggleButton.setAttribute('aria-label', chrome.i18n.getMessage('floatingModalToggleAriaLabel'));
      toggleButton.title = chrome.i18n.getMessage('extensionName');

      const logoImg = document.createElement('img');
      logoImg.src = logoUrl;
      logoImg.alt = chrome.i18n.getMessage('extensionName');
      toggleButton.appendChild(logoImg);

      const modalPanel = document.createElement('div');
      modalPanel.className = 'modal-panel';

      const tabListContainer = document.createElement('div');
      tabListContainer.className = 'tab-list-container';
      tabListContainer.setAttribute('role', 'list');
      modalPanel.appendChild(tabListContainer);

      modalContent.appendChild(toggleButton);
      modalContent.appendChild(modalPanel);
      this.modal.appendChild(modalContent);

      document.body.appendChild(this.modal);

      // Apply vertical position along right edge within viewport bounds
      this.updatePosition();

      // Render tabs
      this.renderTabs();

      // Attach events
      this.attachEvents();
    }

    /**
     * Resolve which edge to dock to and how far down, falling back to the
     * legacy percentage. Legacy `position` is a share of viewport height, which
     * is exactly why the button drifted when devtools opened — convert it once
     * to pixels.
     *
     * The edge itself is resolved in shared utils, so this and the settings
     * screen cannot drift apart on how a legacy `anchor` is read.
     */
    getPlacement() {
      const fb = this.settings?.floatingButton || {};
      const side = window.SFTabs?.utils?.resolveFloatingSide
        ? window.SFTabs.utils.resolveFloatingSide(fb)
        : 'right';
      let offset = Number(fb.offset) || 0;

      if (!offset) {
        // Convert the legacy percentage ONCE per page load and cache it.
        // Recomputing per call would reintroduce the original bug, since
        // updatePosition() also runs on resize — the moment devtools opens,
        // window.innerHeight shrinks and the button would move again.
        if (this._legacyOffset == null) {
          const pct = Number(fb.position);
          const legacy = Number.isFinite(pct) ? pct : 25;
          this._legacyOffset = Math.round((legacy / 100) * window.innerHeight);
        }
        offset = this._legacyOffset;
      }
      return { side, offset, layout: fb.layout || 'handle' };
    }

    updatePosition() {
      if (!this.modal) return;

      try {
        const { side, offset, layout } = this.getPlacement();

        // These drive every mirrored rule in CSS: handle radii, which side the
        // panel opens on, and flyout direction.
        this.modal.dataset.layout = layout;
        this.modal.dataset.side = side;

        // Detached layouts sit inside the edge; the drawer stays flush to it
        const inset = layout === 'handle' ? 0 : 16;

        // Clear anything a previous placement set
        this.modal.style.top = '';
        this.modal.style.bottom = '';
        this.modal.style.left = '';
        this.modal.style.right = '';
        this.modal.style.transform = '';

        if (side === 'left') {
          this.modal.style.left = `${inset}px`;
          this.modal.style.right = 'auto';   // override the stylesheet's right: 0
        } else {
          this.modal.style.right = `${inset}px`;
          this.modal.style.left = 'auto';
        }

        // Pixels down from the top, never a percentage of the viewport. Clamped
        // so a tall offset cannot push the button off a short window.
        this.modal.style.top =
          `${Math.max(0, Math.min(offset, Math.max(0, window.innerHeight - 80)))}px`;

        this.updatePanelDirection();
      } catch (error) {
        if (this.modal) {
          this.modal.style.top = '120px';
          this.modal.style.right = '0px';
        }
      }
    }

    updatePanelDirection() {
      if (!this.modal) {
        return;
      }

      try {
        const viewport = document.querySelector('div.viewport');
        if (!viewport) {
          // Fallback: use default downward with standard max-height
          const panel = this.modal.querySelector('.modal-panel');
          if (panel) {
            this.modal.classList.remove('open-upward');
            panel.style.maxHeight = '400px';
          }
          return;
        }

        const viewportRect = viewport.getBoundingClientRect();
        const modalRect = this.modal.getBoundingClientRect();
        const panel = this.modal.querySelector('.modal-panel');

        if (!panel) {
          return;
        }

        const buttonHeight = 40;
        const padding = 8;
        const minHeight = 150; // Minimum height to ensure usability

        // Calculate space available below and above button relative to viewport
        const spaceBelow = viewportRect.bottom - modalRect.top - buttonHeight - padding;
        const spaceAbove = modalRect.top - viewportRect.top - padding;

        // Determine direction and set max-height (ensure minimum height)
        if (spaceBelow < 200 && spaceAbove > spaceBelow) {
          // Open upward
          const maxHeight = Math.max(minHeight, Math.min(400, spaceAbove));
          this.modal.classList.add('open-upward');
          panel.style.maxHeight = `${maxHeight}px`;
        } else {
          // Open downward (default)
          const maxHeight = Math.max(minHeight, Math.min(400, spaceBelow));
          this.modal.classList.remove('open-upward');
          panel.style.maxHeight = `${maxHeight}px`;
        }
      } catch (error) {
        // Fail gracefully - use default settings
        const panel = this.modal.querySelector('.modal-panel');
        if (panel) {
          this.modal.classList.remove('open-upward');
          panel.style.maxHeight = '400px';
        }
      }
    }

    isTabActive(tab) {
      const currentUrl = window.location.href;
      const tabUrl = buildTabUrl(tab);

      if (!tabUrl) {
        return false;
      }

      // Match based on URL prefix (similar to main navigation logic)
      const baseTabUrl = tabUrl.split('/Details')[0];
      return currentUrl.startsWith(baseTabUrl);
    }

    renderTabs() {
      if (!this.modal) return; // destroyed between a storage event and this call
      const container = this.modal.querySelector('.tab-list-container');
      if (!container) return;


      container.innerHTML = '';

      // Show only top-level tabs (no parentId) - matches primary navigation
      const displayTabs = this.tabs.filter(tab => !tab.parentId);

      // Show empty state if no tabs
      if (displayTabs.length === 0) {
        container.innerHTML = `<div class="empty-state">${chrome.i18n.getMessage('floatingModalEmptyState')}</div>`;
        return;
      }

      // Sort by position
      displayTabs.sort((a, b) => (a.position || 0) - (b.position || 0));

      // Render each tab
      displayTabs.forEach(tab => {
        const tabEl = this.createTabElement(tab);
        container.appendChild(tabEl);
      });
    }

    createTabElement(tab) {
      const tabEl = document.createElement('div');
      tabEl.className = 'tab-item';
      tabEl.setAttribute('role', 'listitem');
      tabEl.setAttribute('tabindex', '0');

      // Check if this tab is active (matches current URL)
      const isActive = this.isTabActive(tab);
      if (isActive) {
        tabEl.classList.add('active');
      }

      // Check if tab is navigable (has a URL)
      const tabUrl = buildTabUrl(tab);
      if (tabUrl) {
        tabEl.classList.add('navigable');
      }

      const hasDropdown = tab.dropdownItems && tab.dropdownItems.length > 0;

      // Create tab row (label + chevron wrapper)
      const rowEl = document.createElement('div');
      rowEl.className = 'tab-row';

      // Label container
      const labelContainer = document.createElement('div');
      labelContainer.style.flex = '1';
      labelContainer.style.minWidth = '0';

      // Tab name
      const labelEl = document.createElement('div');
      labelEl.className = 'tab-label';
      labelEl.textContent = tab.label;
      labelContainer.appendChild(labelEl);

      rowEl.appendChild(labelContainer);

      // Add dropdown indicator (chevron) if has dropdown
      if (hasDropdown) {
        const indicator = document.createElement('span');
        indicator.className = 'dropdown-indicator';
        indicator.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        `;
        rowEl.appendChild(indicator);
      }

      // Optional per-tab color, always as a bead here — see header-menu.js
      const utils = window.SFTabs && window.SFTabs.utils;
      if (utils && utils.applyTabColor) {
        const on = !!(this.settings && this.settings.tabColors && this.settings.tabColors.enabled);
        utils.applyTabColor(tabEl, tab.color, 'dot', on);
        if (tabEl.classList.contains('sftabs-tc--dot')) {
          const bead = document.createElement('span');
          bead.className = 'sftabs-tc-mark';
          bead.setAttribute('aria-hidden', 'true');
          rowEl.insertBefore(bead, rowEl.firstChild);
        }
      }

      tabEl.appendChild(rowEl);

      // The chevron expands; the label navigates. Previously any tab with
      // children only ever toggled, which made a parent that has its own
      // destination unreachable from this menu.
      const activateTab = (e, fromChevron) => {
        const url = buildTabUrl(tab);
        if (fromChevron || !url) {
          if (hasDropdown) tabEl.classList.toggle('expanded');
          return;
        }
        this.navigateToTab(tab);
      };

      rowEl.addEventListener('click', (e) => {
        e.stopPropagation();
        activateTab(e, hasDropdown && !!e.target.closest('.dropdown-indicator'));
      });

      // Keyboard handler (Enter or Space). Enter follows the label; Space, which
      // reads as "operate the control", expands.
      tabEl.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        activateTab(e, hasDropdown && e.key === ' ');
      });

      // Render dropdown children if has dropdown
      if (hasDropdown) {
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'dropdown-children';

        tab.dropdownItems.forEach(childTab => {
          const childEl = this.createDropdownChildElement(childTab);
          childrenContainer.appendChild(childEl);
        });

        tabEl.appendChild(childrenContainer);
      }

      return tabEl;
    }

    createDropdownChildElement(childTab) {
      const childEl = document.createElement('div');
      childEl.className = 'dropdown-child-item';
      childEl.setAttribute('tabindex', '0');

      // Check if this child tab is active (matches current URL)
      const isActive = this.isTabActive(childTab);
      if (isActive) {
        childEl.classList.add('active');
      }

      // Check if child tab is navigable (has a URL)
      const childUrl = buildTabUrl(childTab);
      if (childUrl) {
        childEl.classList.add('navigable');
      }

      const hasDropdown = childTab.dropdownItems && childTab.dropdownItems.length > 0;

      // Create child row (label + chevron wrapper)
      const rowEl = document.createElement('div');
      rowEl.className = 'dropdown-child-row';

      // Label container
      const labelContainer = document.createElement('div');
      labelContainer.style.flex = '1';
      labelContainer.style.minWidth = '0';

      const labelEl = document.createElement('div');
      labelEl.className = 'dropdown-child-label';
      labelEl.textContent = childTab.label;
      labelContainer.appendChild(labelEl);

      rowEl.appendChild(labelContainer);

      // Add dropdown indicator (chevron) if has nested dropdown
      if (hasDropdown) {
        const indicator = document.createElement('span');
        indicator.className = 'dropdown-indicator';
        indicator.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        `;
        rowEl.appendChild(indicator);
      }

      childEl.appendChild(rowEl);

      // Same rule as the top level: chevron expands, label navigates.
      const activateChild = (e, fromChevron) => {
        const url = buildTabUrl(childTab);
        if (fromChevron || !url) {
          if (hasDropdown) childEl.classList.toggle('expanded');
          return;
        }
        this.navigateToTab(childTab);
      };

      rowEl.addEventListener('click', (e) => {
        e.stopPropagation();
        activateChild(e, hasDropdown && !!e.target.closest('.dropdown-indicator'));
      });

      childEl.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        activateChild(e, hasDropdown && e.key === ' ');
      });

      // Render nested dropdown children if has dropdown (third level)
      if (hasDropdown) {
        const nestedContainer = document.createElement('div');
        nestedContainer.className = 'dropdown-nested-children';

        childTab.dropdownItems.forEach(nestedTab => {
          const nestedEl = this.createNestedDropdownElement(nestedTab);
          nestedContainer.appendChild(nestedEl);
        });

        childEl.appendChild(nestedContainer);
      }

      return childEl;
    }

    createNestedDropdownElement(nestedTab) {
      const nestedEl = document.createElement('div');
      nestedEl.className = 'dropdown-nested-item';
      nestedEl.setAttribute('tabindex', '0');

      // Check if this nested tab is active (matches current URL)
      const isActive = this.isTabActive(nestedTab);
      if (isActive) {
        nestedEl.classList.add('active');
      }

      // Check if nested tab is navigable (has a URL)
      const nestedUrl = buildTabUrl(nestedTab);
      if (nestedUrl) {
        nestedEl.classList.add('navigable');
      }

      // Label container
      const labelContainer = document.createElement('div');
      labelContainer.style.flex = '1';
      labelContainer.style.minWidth = '0';

      const labelEl = document.createElement('div');
      labelEl.className = 'dropdown-nested-label';
      labelEl.textContent = nestedTab.label;
      labelContainer.appendChild(labelEl);

      nestedEl.appendChild(labelContainer);

      // Click handler
      nestedEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = buildTabUrl(nestedTab);
        if (url) {
          this.navigateToTab(nestedTab);
        }
      });

      // Keyboard handler
      nestedEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const url = buildTabUrl(nestedTab);
          if (url) {
            this.navigateToTab(nestedTab);
          }
        }
      });

      return nestedEl;
    }

    navigateToTab(tab) {
      navigateToTab(tab);
      this.close();
    }

    attachEvents() {
      // Toggle button
      const toggleButton = this.modal.querySelector('.modal-toggle-button');
      if (toggleButton) {
        toggleButton.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggle();
        });
      }

      // ESC key to close
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          e.preventDefault();
          this.close();
        }
      });

      // Click outside to close
      document.addEventListener('click', (e) => {
        if (!this.isOpen) return;

        // Don't close if clicking within the modal content
        const modalContent = this.modal.querySelector('.modal-content');
        if (modalContent && modalContent.contains(e.target)) {
          return;
        }

        // Click was outside - close the modal
        this.close();
      });

      // Trap focus within modal when open
      this.modal.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && this.isOpen) {
          this.handleTabKey(e);
        }
      });

      // Window resize - reposition button and update panel direction
      let resizeTimeout;
      const resizeHandler = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          // Check if modal still exists in DOM before updating
          if (this.modal && document.body.contains(this.modal)) {
            this.updatePosition();
          }
        }, 100);
      };

      window.addEventListener('resize', resizeHandler);

      // Store handler for cleanup
      this.resizeHandler = resizeHandler;

      // Listen for storage changes to update tabs in real-time
      const storageChangeHandler = async (changes, areaName) => {
        // Check if tabs or settings changed
        const tabsChanged = Object.keys(changes).some(key =>
          key.startsWith('profile_') && key.endsWith('_tabs') ||
          key === 'customTabs' ||
          key === 'userSettings'
        );

        if (tabsChanged) {
          // Reload data and re-render tabs
          await this.loadData();
          this.renderTabs();

          // Update position in case settings changed
          this.updatePosition();
        }
      };

      browser.storage.onChanged.addListener(storageChangeHandler);

      // Store handler for cleanup
      this.storageChangeHandler = storageChangeHandler;
    }

    handleTabKey(e) {
      const focusableElements = this.modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }

    destroy() {
      // Clean up resize event listener
      if (this.resizeHandler) {
        window.removeEventListener('resize', this.resizeHandler);
        this.resizeHandler = null;
      }

      // Clean up storage change listener
      if (this.storageChangeHandler) {
        browser.storage.onChanged.removeListener(this.storageChangeHandler);
        this.storageChangeHandler = null;
      }

      if (this.modal) {
        this.modal.remove();
        this.modal = null;
      }
      this.isOpen = false;
    }
  }

  // Initialize and export modal
  async function initFloatingModal() {
    window.SFTabsFloating = window.SFTabsFloating || {};

    // Never leave a second copy behind: an orphaned element keeps its click
    // listener bound to the old instance, so clicking it toggles a modal that
    // is no longer the one on screen.
    if (window.SFTabsFloating.modal && typeof window.SFTabsFloating.modal.destroy === 'function') {
      window.SFTabsFloating.modal.destroy();
    }
    window.SFTabsFloating.modal = null;
    document.querySelectorAll('.sftabs-floating-modal').forEach(el => el.remove());

    const { settings } = await resolveFloatingData();
    // Honours everywhere / Setup only / outside Setup. The rule lives in shared
    // utils; it also covers the enabled flag, so this is the whole gate.
    if (window.SFTabs?.utils?.floatingButtonAllowedHere(window.location.href, settings?.floatingButton)) {
      window.SFTabsFloating.modal = new FloatingModal();
    }
  }

  /**
   * Re-evaluate on navigation.
   *
   * "Setup only" and "outside Setup" are decided from the URL, and Lightning is
   * a single-page app — crossing between Setup and an app page never reloads.
   * Without this the choice would be honoured where you happened to land and
   * then go stale for the rest of the session.
   *
   * popstate plus a <title> observer, the same event-driven pair
   * content-main.js uses. Deliberately no polling: favicon.js already runs a
   * 1s interval for its own copy of this problem and a second one is not
   * wanted. Only re-inits when the answer actually changes, so ordinary
   * navigation within Setup costs one boolean.
   */
  function watchLocationForVisibility() {
    let lastUrl = window.location.href;
    let lastAllowed = null;

    const recheck = async () => {
      if (window.location.href === lastUrl) return;
      lastUrl = window.location.href;
      const { settings } = await resolveFloatingData();
      const allowed = !!window.SFTabs?.utils?.floatingButtonAllowedHere(lastUrl, settings?.floatingButton);
      if (allowed === lastAllowed) return;
      lastAllowed = allowed;
      initFloatingModal();
    };

    window.addEventListener('popstate', recheck);
    const title = document.querySelector('title');
    if (title) new MutationObserver(recheck).observe(title, { childList: true });
  }

  // Let floating-button.js rebuild us after a settings change
  window.SFTabsFloating = window.SFTabsFloating || {};
  window.SFTabsFloating.initModal = initFloatingModal;
  // Shared with content/header-menu.js so URL building and Lightning navigation
  // have one implementation rather than a copy per surface.
  window.SFTabsFloating.buildTabUrl = buildTabUrl;
  window.SFTabsFloating.navigateToTab = navigateToTab;

  watchLocationForVisibility();

  // Initialize on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFloatingModal);
  } else {
    initFloatingModal();
  }
})();
