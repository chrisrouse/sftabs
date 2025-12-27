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

      this.modal.classList.add('open');
      this.isOpen = true;

      // Focus management - focus close button
      setTimeout(() => {
        const closeButton = this.modal.querySelector('.close-button');
        if (closeButton) {
          closeButton.focus();
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

      const edge = this.settings?.floatingButton?.edge || 'right';
      this.modal.setAttribute('data-edge', edge);

      this.modal.innerHTML = `
        <div class="modal-content">
          <button class="modal-toggle-button" aria-label="Toggle SF Tabs" title="SF Tabs">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"></path>
              <polyline points="13 11 9 17 15 17 11 23"></polyline>
            </svg>
          </button>
          <div class="modal-panel">
            <div class="modal-header">
              <h2 id="sftabs-modal-title">SF Tabs</h2>
              <button class="close-button" aria-label="Close" title="Close (Esc)">×</button>
            </div>
            <div class="modal-body">
              <div class="tab-list-container" role="list"></div>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(this.modal);

      // Render tabs
      this.renderTabs();

      // Attach events
      this.attachEvents();
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

      const hasDropdown = tab.hasDropdown && tab.dropdownItems && tab.dropdownItems.length > 0;

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

      childEl.appendChild(labelContainer);

      // Click handler
      childEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = buildTabUrl(childTab);
        if (url) {
          this.navigateToTab(childTab);
        }
      });

      // Keyboard handler
      childEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const url = buildTabUrl(childTab);
          if (url) {
            this.navigateToTab(childTab);
          }
        }
      });

      return childEl;
    }

    navigateToTab(tab) {
      navigateToTab(tab);
      this.close();
    }

    attachEvents() {
      // Toggle button
      const toggleButton = this.modal.querySelector('.modal-toggle-button');
      if (toggleButton) {
        toggleButton.addEventListener('click', () => this.toggle());
      }

      // Close button
      const closeButton = this.modal.querySelector('.close-button');
      if (closeButton) {
        closeButton.addEventListener('click', () => this.close());
      }

      // ESC key to close
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          e.preventDefault();
          this.close();
        }
      });

      // Trap focus within modal when open
      this.modal.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && this.isOpen) {
          this.handleTabKey(e);
        }
      });
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
