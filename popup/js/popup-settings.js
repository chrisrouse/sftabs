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
  console.log('Current theme from settings:', currentTheme);
  
  // Add click handlers to theme options
  themeOptions.forEach(option => {
    option.addEventListener('click', () => {
      const themeValue = option.getAttribute('data-theme-value');
      console.log('Theme option clicked:', themeValue);
      
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
  console.log('Setting selected theme in UI:', theme);
  const themeOptions = document.querySelectorAll('.theme-option');
  
  // Remove selected class from all options
  themeOptions.forEach(option => {
    option.classList.remove('selected');
  });
  
  // Find and select the matching option
  const selectedOption = document.querySelector(`.theme-option[data-theme-value="${theme}"]`);
  if (selectedOption) {
    selectedOption.classList.add('selected');
    console.log('Applied selected class to:', theme);
  } else {
    console.warn('Could not find option for theme:', theme);
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

  // Update Lightning Navigation checkbox
  if (domElements.lightningNavigationCheckbox) {
    domElements.lightningNavigationCheckbox.checked = settings.lightningNavigation !== false; // Default to true
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
      console.log('Settings button clicked');
      if (domElements.mainContent.classList.contains('active')) {
        SFTabs.main.showSettingsPanel();
      } else {
        SFTabs.main.showMainContent();
      }
    });
  }

  // Settings reset button
  if (domElements.settingsResetButton) {
    domElements.settingsResetButton.addEventListener('click', () => {
      console.log('Settings reset button clicked');
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
      console.log('Compact mode changed to:', domElements.compactModeCheckbox.checked);
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
      console.log('Skip delete confirmation changed to:', domElements.skipDeleteConfirmationCheckbox.checked);
      const settings = SFTabs.main.getUserSettings();
      settings.skipDeleteConfirmation = domElements.skipDeleteConfirmationCheckbox.checked;
      SFTabs.storage.saveUserSettings(settings);
    });
  }

  // Lightning Navigation change
  if (domElements.lightningNavigationCheckbox) {
    domElements.lightningNavigationCheckbox.addEventListener('change', () => {
      console.log('Lightning Navigation changed to:', domElements.lightningNavigationCheckbox.checked);
      const settings = SFTabs.main.getUserSettings();
      settings.lightningNavigation = domElements.lightningNavigationCheckbox.checked;
      
      // Save to both browser storage and localStorage immediately
      SFTabs.storage.saveUserSettings(settings);
      localStorage.setItem("lightningNavigation", JSON.stringify(domElements.lightningNavigationCheckbox.checked));
      
      // Send message to content script to refresh tabs immediately
      browser.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
          browser.tabs.sendMessage(tabs[0].id, {action: 'refresh_tabs'}, function(response) {
            if (browser.runtime.lastError) {
              console.log("Could not send message to content script:", browser.runtime.lastError.message);
            } else {
              console.log("Successfully refreshed tabs after Lightning Navigation change");
            }
          });
        }
      });
      
      // Show immediate feedback
      SFTabs.main.showStatus(`Lightning Navigation ${domElements.lightningNavigationCheckbox.checked ? 'enabled' : 'disabled'}`, false);
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

  // Manage config button
  const manageConfigButton = document.getElementById('manage-config-button');
  if (manageConfigButton) {
    manageConfigButton.addEventListener('click', () => {
      console.log('Opening import/export page');
      browser.tabs.create({ url: "/popup/import_export.html" }).then(() => {
        // Close the popup after opening the new tab
        window.close();
      });
    });
  }

  console.log('Settings event listeners setup complete');
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