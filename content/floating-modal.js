// content/floating-modal.js
// Modal UI for displaying SF Tabs list from floating button

(function() {
  'use strict';

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
    }

    async open() {
      // Refresh tabs in case they changed
      await this.loadData();
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
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
    }

    async loadData() {
      try {
        // Use the same loading function from floating-button.js
        // We need to access it from the button instance
        const floatingButton = window.SFTabsFloating?.button;
        if (floatingButton) {
          this.tabs = floatingButton.tabs || [];
          this.settings = floatingButton.settings || {};
        }
      } catch (error) {
        this.tabs = [];
        this.settings = {};
      }
    }

    createModal() {
      // Create modal structure with integrated button
      this.modal = document.createElement('div');
      this.modal.className = 'sftabs-floating-modal';
      this.modal.setAttribute('role', 'dialog');
      this.modal.setAttribute('aria-modal', 'true');
      this.modal.setAttribute('aria-labelledby', 'sftabs-modal-title');

      // Always use right edge
      this.modal.setAttribute('data-edge', 'right');

      // Get logo URL
      const logoUrl = browser.runtime.getURL('icons/sftabs-icon-16.png');

      this.modal.innerHTML = `
        <div class="modal-content">
          <button class="modal-toggle-button" aria-label="Toggle SF Tabs" title="SF Tabs">
            <img src="${logoUrl}" alt="SF Tabs" />
          </button>
          <div class="modal-panel">
            <div class="tab-list-container" role="list"></div>
          </div>
        </div>
      `;

      document.body.appendChild(this.modal);

      // Apply vertical position along right edge within viewport bounds
      this.updatePosition();

      // Render tabs
      this.renderTabs();

      // Attach events
      this.attachEvents();
    }

    updatePosition() {
      if (!this.modal) return;

      try {
        const position = this.settings?.floatingButton?.position ?? 25;

        // Use simple percentage positioning
        // This automatically adjusts during window resize
        this.modal.style.top = `${position}%`;

        // Determine if panel should open upward or downward
        this.updatePanelDirection();
      } catch (error) {
        // Fail gracefully
        if (this.modal) {
          this.modal.style.top = '25%';
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
        console.error('[SF Tabs Floating] Error in updatePanelDirection', error);
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
      const container = this.modal.querySelector('.tab-list-container');
      if (!container) return;

      container.innerHTML = '';

      // Show only top-level tabs (no parentId) - matches primary navigation
      const displayTabs = this.tabs.filter(tab => !tab.parentId);

      // Show empty state if no tabs
      if (displayTabs.length === 0) {
        container.innerHTML = '<div class="empty-state">No tabs available. Add tabs in the extension popup.</div>';
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

      const hasDropdown = tab.hasDropdown || (tab.dropdownItems && tab.dropdownItems.length > 0);

      // Create tab row (label + chevron wrapper)
      const rowEl = document.createElement('div');
      rowEl.className = 'tab-row';

      // Label container
      const labelContainer = document.createElement('div');
      labelContainer.style.flex = '1';

      // Tab name
      const labelEl = document.createElement('div');
      labelEl.className = 'tab-label';
      labelEl.textContent = tab.label;
      labelContainer.appendChild(labelEl);

      // Tab path (only if not in compact mode and has path)
      const isCompactMode = this.settings.compactMode || false;
      if (!isCompactMode && tab.path) {
        const pathEl = document.createElement('div');
        pathEl.className = 'tab-path';
        pathEl.textContent = tab.path;
        labelContainer.appendChild(pathEl);
      }

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

      tabEl.appendChild(rowEl);

      // Click handler for tab row
      rowEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (hasDropdown) {
          // Always toggle dropdown if it has items
          tabEl.classList.toggle('expanded');
        } else {
          // Only navigate if tab has a path (not a folder-style tab)
          const url = buildTabUrl(tab);
          if (url) {
            this.navigateToTab(tab);
          }
        }
      });

      // Keyboard handler (Enter or Space)
      tabEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (hasDropdown) {
            tabEl.classList.toggle('expanded');
          } else {
            const url = buildTabUrl(tab);
            if (url) {
              this.navigateToTab(tab);
            }
          }
        }
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

      const hasDropdown = childTab.hasDropdown || (childTab.dropdownItems && childTab.dropdownItems.length > 0);

      // Create child row (label + chevron wrapper)
      const rowEl = document.createElement('div');
      rowEl.className = 'dropdown-child-row';

      // Label container
      const labelContainer = document.createElement('div');
      labelContainer.style.flex = '1';

      const labelEl = document.createElement('div');
      labelEl.className = 'dropdown-child-label';
      labelEl.textContent = childTab.label;
      labelContainer.appendChild(labelEl);

      // Child path (only if not in compact mode and has path)
      const isCompactMode = this.settings.compactMode || false;
      if (!isCompactMode && childTab.path) {
        const pathEl = document.createElement('div');
        pathEl.className = 'dropdown-child-path';
        pathEl.textContent = childTab.path;
        labelContainer.appendChild(pathEl);
      }

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

      // Click handler for child row
      rowEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (hasDropdown) {
          // Toggle nested dropdown if it has items
          childEl.classList.toggle('expanded');
        } else {
          // Only navigate if child tab has a path (not a folder-style tab)
          const url = buildTabUrl(childTab);
          if (url) {
            this.navigateToTab(childTab);
          }
        }
      });

      // Keyboard handler (Enter or Space)
      childEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (hasDropdown) {
            childEl.classList.toggle('expanded');
          } else {
            const url = buildTabUrl(childTab);
            if (url) {
              this.navigateToTab(childTab);
            }
          }
        }
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

      const labelEl = document.createElement('div');
      labelEl.className = 'dropdown-nested-label';
      labelEl.textContent = nestedTab.label;
      labelContainer.appendChild(labelEl);

      // Nested path (only if not in compact mode and has path)
      const isCompactMode = this.settings.compactMode || false;
      if (!isCompactMode && nestedTab.path) {
        const pathEl = document.createElement('div');
        pathEl.className = 'dropdown-nested-path';
        pathEl.textContent = nestedTab.path;
        labelContainer.appendChild(pathEl);
      }

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

    // Wait for settings to be loaded
    let attempts = 0;
    const maxAttempts = 20;

    const checkSettings = () => {
      if (window.SFTabsFloating.button?.settings) {
        const settings = window.SFTabsFloating.button.settings;

        // Only create modal if floating button is enabled and not setup-only
        if (settings.floatingButton?.enabled &&
            settings.floatingButton?.displayMode !== 'setup-only') {
          window.SFTabsFloating.modal = new FloatingModal();
        }
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(checkSettings, 100);
      }
    };

    checkSettings();
  }

  // Initialize on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFloatingModal);
  } else {
    initFloatingModal();
  }
})();
