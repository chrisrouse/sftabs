// content/floating-button.js
// Floating button for quick access to SF Tabs from anywhere in Salesforce

(function() {
  'use strict';

  /**
   * Get storage preference from settings
   * @returns {Promise<boolean>} true for sync storage, false for local
   */
  async function getStoragePreference() {
    try {
      const result = await browser.storage.sync.get('userSettings');
      if (result.userSettings && typeof result.userSettings.useSyncStorage === 'boolean') {
        return result.userSettings.useSyncStorage;
      }
      return true; // Default to sync
    } catch (error) {
      return true;
    }
  }

  /**
   * Read tabs from chunked sync storage
   */
  async function readChunkedSync(baseKey) {
    try {
      const metadataKey = `${baseKey}_metadata`;
      const metadataResult = await browser.storage.sync.get(metadataKey);
      const metadata = metadataResult[metadataKey];

      if (!metadata || !metadata.chunked) {
        const directResult = await browser.storage.sync.get(baseKey);
        return directResult[baseKey] || null;
      }

      const chunkCount = metadata.chunkCount;
      const chunkKeys = [];
      for (let i = 0; i < chunkCount; i++) {
        chunkKeys.push(`${baseKey}_chunk_${i}`);
      }

      const chunksResult = await browser.storage.sync.get(chunkKeys);
      const chunks = [];
      for (let i = 0; i < chunkCount; i++) {
        const chunkKey = `${baseKey}_chunk_${i}`;
        if (!chunksResult[chunkKey]) {
          throw new Error(`Missing chunk ${i} of ${chunkCount}`);
        }
        chunks.push(chunksResult[chunkKey]);
      }

      const combinedString = chunks.join('');
      return JSON.parse(combinedString);
    } catch (error) {
      return null;
    }
  }

  /**
   * Load tabs and settings from storage
   */
  async function loadTabsAndSettings() {
    try {
      const useSyncStorage = await getStoragePreference();
      const settingsKey = 'userSettings';

      // Load settings
      let settings;
      if (useSyncStorage) {
        const settingsData = await readChunkedSync(settingsKey);
        settings = settingsData || {};
      } else {
        const result = await browser.storage.local.get(settingsKey);
        settings = result[settingsKey] || {};
      }

      // Merge with defaults
      if (!settings.floatingButton) {
        settings.floatingButton = window.SFTabs.constants.DEFAULT_SETTINGS.floatingButton;
      }

      // Always load from profile storage if activeProfileId exists
      // (profiles are used internally even if UI is disabled)
      let tabs = [];
      if (settings.activeProfileId) {
        const profileTabsKey = `profile_${settings.activeProfileId}_tabs`;
        if (useSyncStorage) {
          tabs = await readChunkedSync(profileTabsKey) || [];
        } else {
          const result = await browser.storage.local.get(profileTabsKey);
          tabs = result[profileTabsKey] || [];
        }
      } else {
        // Fallback to legacy customTabs key (for very old installations)
        if (useSyncStorage) {
          tabs = await readChunkedSync('customTabs') || [];
        } else {
          const result = await browser.storage.local.get('customTabs');
          tabs = result.customTabs || [];
        }
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

    shouldShow() {
      if (!this.settings.floatingButton.enabled) {
        return false;
      }

      // Check location setting
      const location = this.settings.floatingButton.location || 'everywhere';
      const currentUrl = window.location.href;
      const isInSetup = currentUrl.includes('/lightning/setup/');

      if (location === 'setup-only') {
        // Only show in Setup pages
        return isInSetup;
      } else if (location === 'outside-setup') {
        // Only show outside Setup pages
        return !isInSetup;
      }

      // 'everywhere' or any other value - show everywhere
      return true;
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

      // Check if tabs or settings changed
      const tabsChanged = Object.keys(changes).some(key =>
        key.startsWith('profile_') && key.endsWith('_tabs') ||
        key === 'customTabs'
      );

      if (tabsChanged && floatingButton) {
        // Reload tabs data
        const data = await loadTabsAndSettings();
        floatingButton.tabs = data.tabs;
        floatingButton.settings = data.settings;
      }

      // Check if settings changed
      if (changes.userSettings) {
        // Reload button
        if (floatingButton) {
          floatingButton.destroy();
        }
        initFloatingButton();
      }
    });
  }

  // Start
  initFloatingButton();
})();
