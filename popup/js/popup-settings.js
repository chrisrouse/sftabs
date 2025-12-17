// popup/js/popup-settings.js
// Settings management and theme handling

/**
 * Apply theme based on current settings
 */
function applyTheme() {
  const settings = SFTabs.main.getUserSettings();
  
  if (settings.themeMode === 'system') {
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }

    // Listen for changes in system theme
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      const newTheme = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
    });
  } else {
    // Apply user selected theme
    document.documentElement.setAttribute('data-theme', settings.themeMode);
  }
}

/**
 * Initialize the theme selector UI
 */
function initThemeSelector() {
  const themeOptions = document.querySelectorAll('.theme-option');
  
  // Get current theme from user settings
  const currentTheme = SFTabs.main.getUserSettings().themeMode || 'light';
  
  // Add click handlers to theme options
  themeOptions.forEach(option => {
    option.addEventListener('click', () => {
      const themeValue = option.getAttribute('data-theme-value');
      
      // Update settings
      const settings = SFTabs.main.getUserSettings();
      settings.themeMode = themeValue;
      
      // Save the updated settings
      SFTabs.storage.saveUserSettings(settings).then(() => {
        // Update UI
        setSelectedTheme(themeValue);
      });
    });
  });
  
  // Set initial selection
  setSelectedTheme(currentTheme);
}

/**
 * Set the selected theme in the UI
 */
function setSelectedTheme(theme) {
  const themeOptions = document.querySelectorAll('.theme-option');
  
  // Remove selected class from all options
  themeOptions.forEach(option => {
    option.classList.remove('selected');
  });
  
  // Find and select the matching option
  const selectedOption = document.querySelector(`.theme-option[data-theme-value="${theme}"]`);
  if (selectedOption) {
    selectedOption.classList.add('selected');
  } else {
  }
}

/**
 * Update settings UI to reflect current settings
 */
function updateSettingsUI() {
  const settings = SFTabs.main.getUserSettings();
  const domElements = SFTabs.main.getDOMElements();

  // Update theme selector
  setSelectedTheme(settings.themeMode);

  // Update compact mode checkbox
  if (domElements.compactModeCheckbox) {
    domElements.compactModeCheckbox.checked = settings.compactMode;
  }

  // Update skip delete confirmation checkbox
  if (domElements.skipDeleteConfirmationCheckbox) {
    domElements.skipDeleteConfirmationCheckbox.checked = settings.skipDeleteConfirmation || false;
  }

  // Update use sync storage checkbox
  if (domElements.useSyncStorageCheckbox) {
    domElements.useSyncStorageCheckbox.checked = settings.useSyncStorage !== false; // Default to true
  }
}

/**
 * Reset settings to defaults
 */
function resetSettings() {
  const defaultSettings = { ...SFTabs.constants.DEFAULT_SETTINGS };
  
  SFTabs.storage.saveUserSettings(defaultSettings).then(() => {
    updateSettingsUI();
    SFTabs.main.showStatus('Settings reset to defaults', false);
  });
}

/**
 * Setup settings-related event listeners
 */
function setupEventListeners() {
  const domElements = SFTabs.main.getDOMElements();
  
  // Settings button - toggle between panels
  if (domElements.settingsButton) {
    domElements.settingsButton.addEventListener('click', () => {
      if (domElements.mainContent.classList.contains('active')) {
        SFTabs.main.showSettingsPanel();
      } else {
        SFTabs.main.showMainContent();
      }
    });
  }

  // Action panel close button
  if (domElements.actionPanelCloseButton) {
    domElements.actionPanelCloseButton.addEventListener('click', () => {
      SFTabs.main.showMainContent();
    });
  }

  // Action panel save button
  if (domElements.actionPanelSaveButton) {
    domElements.actionPanelSaveButton.addEventListener('click', () => {
      if (SFTabs.main && SFTabs.main.saveActionPanelChanges) {
        SFTabs.main.saveActionPanelChanges();
      }
    });
  }

  // Enter key in action panel input fields
  if (domElements.actionTabNameInput) {
    domElements.actionTabNameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && SFTabs.main && SFTabs.main.saveActionPanelChanges) {
        SFTabs.main.saveActionPanelChanges();
      }
    });
  }

  if (domElements.actionTabPathInput) {
    domElements.actionTabPathInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && SFTabs.main && SFTabs.main.saveActionPanelChanges) {
        SFTabs.main.saveActionPanelChanges();
      }
    });
  }

  // Settings reset button
  if (domElements.settingsResetButton) {
    domElements.settingsResetButton.addEventListener('click', () => {
      const modalElements = getModalElements();
      SFTabs.main.showModal(
        domElements.confirmModal,
        modalElements.cancelButton,
        modalElements.confirmButton,
        () => {
          // Reset both tabs and settings
          if (SFTabs.tabs && SFTabs.tabs.resetToDefaults) {
            SFTabs.tabs.resetToDefaults();
          }
          resetSettings();
        }
      );
    });
  }

  // Compact mode change
  if (domElements.compactModeCheckbox) {
    domElements.compactModeCheckbox.addEventListener('change', () => {
      const settings = SFTabs.main.getUserSettings();
      settings.compactMode = domElements.compactModeCheckbox.checked;
      SFTabs.storage.saveUserSettings(settings).then(() => {
        if (SFTabs.ui && SFTabs.ui.renderTabList) {
          SFTabs.ui.renderTabList(); // Re-render tabs with new display mode
        }
      });
    });
  }

  // Skip delete confirmation change
  if (domElements.skipDeleteConfirmationCheckbox) {
    domElements.skipDeleteConfirmationCheckbox.addEventListener('change', () => {
      const settings = SFTabs.main.getUserSettings();
      settings.skipDeleteConfirmation = domElements.skipDeleteConfirmationCheckbox.checked;
      SFTabs.storage.saveUserSettings(settings);
    });
  }

  // Use sync storage checkbox change
  if (domElements.useSyncStorageCheckbox) {
    domElements.useSyncStorageCheckbox.addEventListener('change', async () => {
      const newValue = domElements.useSyncStorageCheckbox.checked;

      // Show confirmation dialog
      const confirmed = confirm(
        newValue
          ? 'Enable cross-device sync?\n\nYour tabs will be synced across all your computers using browser sync. This allows you to access your custom tabs on any device where you\'re signed in.\n\nNote: Large configurations (>100KB) may not sync properly. Click OK to continue.'
          : 'Disable cross-device sync?\n\nYour tabs will only be stored on this computer. They will not sync to other devices.\n\nClick OK to continue.'
      );

      if (confirmed) {
        const settings = SFTabs.main.getUserSettings();
        settings.useSyncStorage = newValue;

        try {
          // saveUserSettings will handle the migration automatically
          await SFTabs.storage.saveUserSettings(settings);
          SFTabs.main.showStatus(
            newValue ? 'Sync enabled - tabs will now sync across devices' : 'Sync disabled - tabs stored locally only',
            false
          );
        } catch (error) {
          SFTabs.main.showStatus('Error: ' + error.message, true);
          // Revert checkbox state on error
          domElements.useSyncStorageCheckbox.checked = !newValue;
        }
      } else {
        // User cancelled - revert checkbox state
        domElements.useSyncStorageCheckbox.checked = !newValue;
      }
    });
  }

  // Changelog link
  const changelogLink = document.getElementById('changelog-link');
  if (changelogLink) {
    changelogLink.addEventListener('click', (e) => {
      e.preventDefault();
      browser.tabs.create({ 
        url: 'https://github.com/chrisrouse/sftabs/blob/main/CHANGELOG.md' 
      }).then(() => {
        // Close the popup after opening the link
        window.close();
      });
    });
  }

  // Keyboard shortcuts button
  const keyboardShortcutsButton = document.getElementById('keyboard-shortcuts-button');
  if (keyboardShortcutsButton) {
    keyboardShortcutsButton.addEventListener('click', () => {
      openKeyboardShortcutsPage();
    });
  }

  // Manage config button
  const manageConfigButton = document.getElementById('manage-config-button');
  if (manageConfigButton) {
    manageConfigButton.addEventListener('click', () => {
      browser.tabs.create({ url: "/popup/import_export.html" }).then(() => {
        // Close the popup after opening the new tab
        window.close();
      });
    });
  }

  // Open full settings page button
  const openFullSettingsButton = document.getElementById('open-full-settings-button');
  if (openFullSettingsButton) {
    openFullSettingsButton.addEventListener('click', () => {
      browser.tabs.create({ url: "/popup/settings.html" }).then(() => {
        // Close the popup after opening the new tab
        window.close();
      });
    });
  }

}

/**
 * Open the browser's keyboard shortcuts configuration page
 */
function openKeyboardShortcutsPage() {
  // Detect browser and open appropriate shortcuts page
  const isFirefox = typeof browser !== 'undefined' && browser.runtime && browser.runtime.getBrowserInfo;
  const isChrome = typeof chrome !== 'undefined' && chrome.runtime && !isFirefox;

  if (isFirefox) {
    // Firefox: Open the addons page
    // Note: Firefox doesn't have a direct link to shortcuts, so we open the main addons page
    browser.tabs.create({ url: 'about:addons' }).then(() => {
      window.close();
    }).catch(err => {
      SFTabs.main.showStatus('Could not open shortcuts page', true);
    });
  } else if (isChrome) {
    // Chrome/Edge: Open the extensions shortcuts page
    browser.tabs.create({ url: 'chrome://extensions/shortcuts' }).then(() => {
      window.close();
    }).catch(err => {
      SFTabs.main.showStatus('Could not open shortcuts page', true);
    });
  } else {
    SFTabs.main.showStatus('Could not detect browser type', true);
  }
}

/**
 * Get modal elements for settings operations
 */
function getModalElements() {
  return {
    cancelButton: document.getElementById('modal-cancel-button'),
    confirmButton: document.getElementById('modal-confirm-button')
  };
}

// Export settings functions
window.SFTabs = window.SFTabs || {};
window.SFTabs.settings = {
  applyTheme,
  initThemeSelector,
  setSelectedTheme,
  updateSettingsUI,
  resetSettings,
  setupEventListeners
};