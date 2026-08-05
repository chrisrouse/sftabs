// content/floating-button.js
// Floating button for quick access to SF Tabs from anywhere in Salesforce

(function() {
  'use strict';

        /**
   * Tabs and settings for this page.
   *
   * Shared with the Setup tab bar rather than reimplemented. This copy read the
   * storage preference from sync, where it is not kept — the device-specific
   * value lives in local — so on a local-storage install this surface read an
   * area holding none of the user's data and rendered nothing, while the tab bar
   * on the same page rendered correctly.
   *
   * The floatingButton default is this surface's own concern: settings written
   * before the feature existed have no such key.
   */
  async function loadTabsAndSettings() {
    try {
      const { settings, tabs } = await window.SFTabs.utils.loadTabsForUrl(window.location.href);
      if (!settings.floatingButton) {
        settings.floatingButton = window.SFTabs.constants.DEFAULT_SETTINGS.floatingButton;
      }
      return { settings, tabs };
    } catch (error) {
      return {
        settings: { floatingButton: window.SFTabs.constants.DEFAULT_SETTINGS.floatingButton },
        tabs: []
      };
    }
  }

  /**
   * FloatingButton class - manages settings and initialization
   * (Button is now integrated into the modal itself)
   */
  class FloatingButton {
    constructor() {
      this.settings = null;
      this.tabs = [];
    }

    async init() {
      try {
        // Load settings and tabs
        const data = await loadTabsAndSettings();
        this.settings = data.settings;
        this.tabs = data.tabs;

        // Store for modal access
        // The modal will handle its own button/panel rendering
      } catch (error) {
        // Fail silently
      }
    }

    /**
     * Tear down the rendered UI. The button itself renders nothing — the modal
     * owns the trigger and panel — so this disposes of the modal. The storage
     * listener below has always called this; it simply never existed, so every
     * userSettings change threw here and the re-init never ran.
     */
    destroy() {
      const modal = window.SFTabsFloating?.modal;
      if (modal && typeof modal.destroy === 'function') {
        modal.destroy();
      }
      window.SFTabsFloating.modal = null;
    }

  }

  // Initialize floating button on page load
  function initFloatingButton() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        const floatingButton = new FloatingButton();
        floatingButton.init();

        // Export for use by other scripts
        window.SFTabsFloating = window.SFTabsFloating || {};
        window.SFTabsFloating.button = floatingButton;
      });
    } else {
      const floatingButton = new FloatingButton();
      floatingButton.init();

      // Export for use by other scripts
      window.SFTabsFloating = window.SFTabsFloating || {};
      window.SFTabsFloating.button = floatingButton;
    }
  }

  // Listen for storage changes to update button
  if (browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener(async (changes, area) => {
      const floatingButton = window.SFTabsFloating?.button;

      // endsWith('_tabs') used to be the test here, which is the one key that
      // stops existing once a profile is chunked — so a large profile's edits
      // never reached this surface.
      const tabsChanged = window.SFTabs?.utils?.tabStorageChanged(changes);

      if (tabsChanged && floatingButton) {
        // Reload tabs data
        const data = await loadTabsAndSettings();
        floatingButton.tabs = data.tabs;
        floatingButton.settings = data.settings;
      }

      // Check if settings changed
      if (changes.userSettings) {
        if (floatingButton) {
          floatingButton.destroy();
        }
        initFloatingButton();

        // The modal is the rendered artifact, so bring it back with the new
        // settings applied
        if (typeof window.SFTabsFloating?.initModal === 'function') {
          window.SFTabsFloating.initModal();
        }
      }
    });
  }

  // Share the loader: the modal needs settings, not our instance
  window.SFTabsFloating = window.SFTabsFloating || {};
  window.SFTabsFloating.loadTabsAndSettings = loadTabsAndSettings;

  // Start
  initFloatingButton();
})();
