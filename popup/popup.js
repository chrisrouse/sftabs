// Browser compatibility layer - add this at the very top of popup.js
(function() {
  'use strict';
  
  console.log('SF Tabs: Initializing browser compatibility...');
  
  if (typeof browser === 'undefined' && typeof chrome !== 'undefined' && chrome.runtime) {
    console.log('SF Tabs: Setting up Chrome compatibility layer...');
    
    window.browser = {
      runtime: {
        getURL: chrome.runtime.getURL.bind(chrome.runtime),
        onMessage: chrome.runtime.onMessage,
        lastError: chrome.runtime.lastError
      },
      storage: {
        onChanged: chrome.storage.onChanged,
        local: {
          get: function(keys) {
            return new Promise((resolve, reject) => {
              chrome.storage.local.get(keys, (result) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve(result);
                }
              });
            });
          },
          set: function(items) {
            return new Promise((resolve, reject) => {
              chrome.storage.local.set(items, () => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve();
                }
              });
            });
          },
          clear: function() {
            return new Promise((resolve, reject) => {
              chrome.storage.local.clear(() => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve();
                }
              });
            });
          }
        },
        sync: {
          get: function(keys) {
            return new Promise((resolve, reject) => {
              chrome.storage.sync.get(keys, (result) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve(result);
                }
              });
            });
          }
        }
      },
      tabs: {
        query: function(queryInfo) {
          console.log('SF Tabs: Chrome tabs.query called with:', queryInfo);
          return new Promise((resolve, reject) => {
            chrome.tabs.query(queryInfo, (tabs) => {
              if (chrome.runtime.lastError) {
                console.error('SF Tabs: Tabs query error:', chrome.runtime.lastError);
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                console.log('SF Tabs: Tabs query result:', tabs);
                resolve(tabs);
              }
            });
          });
        },
        create: function(createProperties) {
          console.log('SF Tabs: Chrome tabs.create called with:', createProperties);
          return new Promise((resolve, reject) => {
            chrome.tabs.create(createProperties, (tab) => {
              if (chrome.runtime.lastError) {
                console.error('SF Tabs: Tabs create error:', chrome.runtime.lastError);
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                console.log('SF Tabs: Tab created:', tab);
                resolve(tab);
              }
            });
          });
        },
        sendMessage: function(tabId, message, options) {
          console.log('SF Tabs: Chrome tabs.sendMessage called');
          return new Promise((resolve) => {
            const callback = (response) => {
              if (chrome.runtime.lastError) {
                console.log('SF Tabs: Tab message expected error:', chrome.runtime.lastError.message);
                resolve(null);
              } else {
                console.log('SF Tabs: Tab message success:', response);
                resolve(response);
              }
            };
            
            if (options) {
              chrome.tabs.sendMessage(tabId, message, options, callback);
            } else {
              chrome.tabs.sendMessage(tabId, message, callback);
            }
          });
        }
      }
    };
    
    console.log('SF Tabs: Chrome compatibility layer complete');
  } else if (typeof browser !== 'undefined') {
    console.log('SF Tabs: Using native browser API (Firefox)');
  } else {
    console.error('SF Tabs: No compatible browser API found!');
  }
  
  // Test the setup
  console.log('SF Tabs: Final browser object:', window.browser);
})();

// DOM Elements - declare variables but don't initialize yet
let tabList;
let emptyState;
let tabForm;
let formTitle;
let tabNameInput;
let tabPathInput;
let openInNewTabCheckbox;
let addTabButton;
let saveButton;
let cancelButton;
let statusMessage;
let confirmModal;
let modalCancelButton;
let modalConfirmButton;
let deleteConfirmModal;
let deleteModalCancelButton;
let deleteModalConfirmButton;
let isObjectCheckbox;
let isCustomUrlCheckbox;
let objectDropdownSection;
let setupDropdownButton;
let dropdownItemsPreview;
let dropdownItemsList;
let dropdownCount;

// Settings Elements
let settingsButton;
let settingsPanel;
let mainContent;
let themeMode;
let settingsResetButton;

// State
let customTabs = [];
let editingTabId = null;
let userSettings = {
	themeMode: 'light',
	compactMode: false
  };
let quickAddButton;


// Default tabs configuration
const defaultTabs = [{
		id: 'default_tab_flows',
		label: 'Flows',
		path: 'Flows',
		openInNewTab: false,
		isObject: false,
		position: 0,
		hasDropdown: false,
		dropdownItems: []
	},
	{
		id: 'default_tab_packages',
		label: 'Installed Packages',
		path: 'ImportedPackage',
		openInNewTab: false,
		position: 1,
		hasDropdown: false,
		dropdownItems: []
	},
	{
		id: 'default_tab_users',
		label: 'Users',
		path: 'ManageUsers',
		openInNewTab: false,
		position: 2,
		hasDropdown: false,
		dropdownItems: []
	},
	{
		id: 'default_tab_profiles',
		label: 'Profiles',
		path: 'EnhancedProfiles',
		openInNewTab: false,
		position: 3,
		hasDropdown: false,
		dropdownItems: []
	},
	{
		id: 'default_tab_permsets',
		label: 'Permission Sets',
		path: 'PermSets',
		openInNewTab: false,
		position: 4,
		hasDropdown: false,
		dropdownItems: []
	}
];

/**
 * This function formats a Salesforce object name from URL format
 * Examples: 
 * - "Study_Group__c" becomes "Study Group"
 * - "Campaign" stays "Campaign"
 * - "ProductTransfer" becomes "Product Transfer"
 * @param {string} objectNameFromURL - The object name from the URL path
 * @return {string} The formatted, human-readable object name
 */
function formatObjectNameFromURL(objectNameFromURL) {
	if (!objectNameFromURL) {
	  return 'Object';
	}
	
	// First, remove any __c or similar custom object suffix
	let cleanName = objectNameFromURL.replace(/__c$/g, '');
	
	// Replace underscores with spaces
	cleanName = cleanName.replace(/_/g, ' ');
	
	// Insert spaces between camelCase words (ProductTransfer -> Product Transfer)
	cleanName = cleanName.replace(/([a-z])([A-Z])/g, '$1 $2');
	
	// Ensure proper capitalization
	cleanName = cleanName.replace(/\b\w/g, letter => letter.toUpperCase());
	
	return cleanName;
  }

// Default user settings
const defaultSettings = {
	themeMode: 'light',
	compactMode: false,
	skipDeleteConfirmation: false,
	lightningNavigation: true
  };

// Initialize
document.addEventListener('DOMContentLoaded', () => {
	console.log('DOMContentLoaded event fired');

	// Initialize all DOM elements after the DOM is fully loaded
	tabList = document.getElementById('tab-list');
	emptyState = document.getElementById('empty-state');
	tabForm = document.getElementById('tab-form');
	formTitle = document.getElementById('form-title');
	tabNameInput = document.getElementById('tab-name');
	tabPathInput = document.getElementById('tab-path');
	openInNewTabCheckbox = document.getElementById('open-in-new-tab');
	addTabButton = document.getElementById('add-tab-button');
	saveButton = document.getElementById('save-button');
	cancelButton = document.getElementById('cancel-button');
	statusMessage = document.getElementById('status-message');
	confirmModal = document.getElementById('confirm-modal');
	modalCancelButton = document.getElementById('modal-cancel-button');
	modalConfirmButton = document.getElementById('modal-confirm-button');
	deleteConfirmModal = document.getElementById('delete-confirm-modal');
	deleteModalCancelButton = document.getElementById('delete-modal-cancel-button');
	deleteModalConfirmButton = document.getElementById('delete-modal-confirm-button');
	isObjectCheckbox = document.getElementById('is-object');
	isCustomUrlCheckbox = document.getElementById('is-custom-url');

	// Object dropdown elements
	objectDropdownSection = document.getElementById('object-dropdown-section');
	setupDropdownButton = document.getElementById('setup-dropdown-button');
	dropdownItemsPreview = document.getElementById('dropdown-items-preview');
	dropdownItemsList = document.getElementById('dropdown-items-list');
	dropdownCount = document.getElementById('dropdown-count');

	// Settings elements
	settingsButton = document.getElementById('settings-button');
	settingsPanel = document.getElementById('settings-panel');
	mainContent = document.getElementById('main-content');
	themeMode = document.getElementById('theme-mode');
	settingsResetButton = document.getElementById('settings-reset-button');

	// Debug: Log all DOM elements
	console.log('DOM Elements initialized');

	// Apply initial visibility to ensure content shows up
	mainContent.style.display = 'block';
	mainContent.classList.add('active');
	settingsPanel.style.display = 'none';

	// Load settings first
	loadUserSettings().then(() => {
		// Then load tabs
		loadTabsFromStorage();
		setupEventListeners();

		// Show main content by default
		showMainContent();

		// Apply theme based on settings
		applyTheme();

	});
});

// Initialize the theme selector
function initThemeSelector() {
	const themeOptions = document.querySelectorAll('.theme-option');
	
	// Get current theme from user settings (which was loaded during initialization)
	const currentTheme = userSettings.themeMode || 'light';
	console.log('Current theme from settings:', currentTheme);
	
	// Add click handlers to theme options
	themeOptions.forEach(option => {
		// Add click handler
		option.addEventListener('click', () => {
		const themeValue = option.getAttribute('data-theme-value');
		console.log('Theme option clicked:', themeValue);
		
		// Update userSettings
		userSettings.themeMode = themeValue;
		
		// Save the updated settings
		saveUserSettings().then(() => {
			// After saving, apply the theme and update UI
			applyTheme();
			setSelectedTheme(themeValue);
		});
		});
	});
	
	// Set initial selection based on current theme
	setSelectedTheme(currentTheme);
  }
  
  // Set the selected theme in the UI
  function setSelectedTheme(theme) {
	console.log('Setting selected theme in UI:', theme);
	const themeOptions = document.querySelectorAll('.theme-option');
	
	// First remove selected class from all options
	themeOptions.forEach(option => {
	  option.classList.remove('selected');
	});
	
	// Find the option that matches the current theme
	const selectedOption = document.querySelector(`.theme-option[data-theme-value="${theme}"]`);
	if (selectedOption) {
	  selectedOption.classList.add('selected');
	  console.log('Applied selected class to:', theme);
	} else {
	  console.warn('Could not find option for theme:', theme);
	}
  }

// Load user settings from storage
function loadUserSettings() {
	console.log('Loading user settings from storage');
	return browser.storage.local.get('userSettings')
		.then((result) => {
			console.log('Settings result:', result);
			if (result.userSettings) {
				userSettings = { ...defaultSettings, ...result.userSettings };
			} else {
				userSettings = { ...defaultSettings };
				saveUserSettings();
			}

			// Update UI to reflect loaded settings
			updateSettingsUI();

			return userSettings;
		})
		.catch((error) => {
			console.error('Error loading settings from storage:', error);
			showStatus('Error loading settings: ' + error.message, true);
			return defaultSettings;
		});
}

// Save user settings to storage
function saveUserSettings() {
	console.log('Saving user settings to storage:', userSettings);
	return browser.storage.local.set({ userSettings })
		.then(() => {
			console.log('Settings saved successfully');
			showStatus('Settings saved', false);
		})
		.catch((error) => {
			console.error('Error saving settings to storage:', error);
			showStatus('Error saving settings: ' + error.message, true);
		});
}

// Update settings UI to reflect current settings
function updateSettingsUI() {
	// Set the hidden select value to match current settings
	const themeSelect = document.getElementById('theme-mode');
	if (themeSelect) {
	  themeSelect.value = userSettings.themeMode;
	  
	  // Update the visual theme selector
	  setSelectedTheme(userSettings.themeMode);
	}
	
	// Update compact mode checkbox
	const compactModeCheckbox = document.getElementById('compact-mode');
	if (compactModeCheckbox) {
	  compactModeCheckbox.checked = userSettings.compactMode;
	}

	  // Update skip delete confirmation checkbox
	  const skipDeleteConfirmationCheckbox = document.getElementById('skip-delete-confirmation');
	  if (skipDeleteConfirmationCheckbox) {
		skipDeleteConfirmationCheckbox.checked = userSettings.skipDeleteConfirmation || false;
	  }

	// Update Lightning Navigation checkbox
	const lightningNavigationCheckbox = document.getElementById('lightning-navigation');
	if (lightningNavigationCheckbox) {
		lightningNavigationCheckbox.checked = userSettings.lightningNavigation !== false; // Default to true
	}
  }

// Reset settings to defaults
function resetSettings() {
	userSettings = { ...defaultSettings };
	saveUserSettings();
	updateSettingsUI();
	applyTheme();
	showStatus('Settings reset to defaults', false);
  }

// Add an event listener for the manage-config button
const manageConfigButton = document.getElementById('manage-config-button');
if (manageConfigButton) {
	manageConfigButton.addEventListener('click', () => {
		console.log('Opening import/export page');
		browser.tabs.create({ url: "/popup/import_export.html" }).then(() => {
			// Close the popup after opening the new tab
			window.close();
		});
	});
} else {
	console.error('Manage config button not found!');
}

// Apply theme based on settings
function applyTheme() {
	if (userSettings.themeMode === 'system') {
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
		document.documentElement.setAttribute('data-theme', userSettings.themeMode);
	}
}

// Migrate data from storage.sync to storage.local (one-time migration)
async function migrateFromSyncToLocal() {
	console.log('🔄 Checking for data migration from sync to local...');

	try {
		// Check if we already have data in local storage
		const localData = await browser.storage.local.get(['customTabs', 'userSettings', 'migrated']);

		// If already migrated or has data in local, skip migration
		if (localData.migrated || (localData.customTabs && localData.customTabs.length > 0)) {
			console.log('✅ Already using local storage or already migrated');
			return;
		}

		console.log('📦 Migrating data from storage.sync to storage.local...');

		// Get data from sync storage
		const syncData = await browser.storage.sync.get(['customTabs', 'userSettings']);

		if (syncData.customTabs || syncData.userSettings) {
			console.log('📋 Found data to migrate:', {
				tabs: syncData.customTabs?.length || 0,
				hasSettings: !!syncData.userSettings
			});

			// Copy to local storage
			const dataToMigrate = {
				migrated: true,
				migrationDate: new Date().toISOString()
			};

			if (syncData.customTabs) {
				dataToMigrate.customTabs = syncData.customTabs;
			}

			if (syncData.userSettings) {
				dataToMigrate.userSettings = syncData.userSettings;
			}

			await browser.storage.local.set(dataToMigrate);
			console.log('✅ Migration complete! Data copied to local storage');
		} else {
			console.log('ℹ️ No data to migrate from sync storage');
			// Mark as migrated so we don't check again
			await browser.storage.local.set({ migrated: true, migrationDate: new Date().toISOString() });
		}
	} catch (error) {
		console.error('❌ Error during migration:', error);
		// Don't block the app if migration fails
	}
}

// Load tabs from storage
async function loadTabsFromStorage() {
	console.log('Loading tabs from storage');

	// First, attempt migration from sync to local
	await migrateFromSyncToLocal();

	browser.storage.local.get('customTabs')
		.then((result) => {
			console.log('Storage result:', result);
			if (result.customTabs && Array.isArray(result.customTabs) && result.customTabs.length > 0) {
				customTabs = result.customTabs;
				renderTabList();
			} else {
				console.log('No tabs found in storage, using defaults');
				// Initialize with default tabs if no saved tabs
				resetToDefaults();
			}
		})
		.catch((error) => {
			console.error('Error loading tabs from storage:', error);
			showStatus('Error loading tabs: ' + error.message, true);
		});
}

// Reset to default tabs
function resetToDefaults() {
	console.log('Resetting to default tabs');
	// Create deep copy of default tabs to avoid reference issues
	customTabs = JSON.parse(JSON.stringify(defaultTabs));
	saveTabsToStorage();
	showStatus('Reset to default tabs', false);
}

// Save tabs to storage
function saveTabsToStorage() {
	console.log('💾 Saving tabs to storage...');

	// Log dropdown status for debugging
	const tabsWithDropdowns = customTabs.filter(t => t.hasDropdown);
	if (tabsWithDropdowns.length > 0) {
		console.log('📋 Tabs with dropdowns:', tabsWithDropdowns.map(t => ({
			id: t.id,
			label: t.label,
			hasDropdown: t.hasDropdown,
			itemCount: t.dropdownItems?.length || 0
		})));
	}

	// Sort tabs by position before saving
	customTabs.sort((a, b) => a.position - b.position);

	browser.storage.local.set({ customTabs })
		.then(() => {
			console.log('✅ Tabs saved successfully to storage');
			renderTabList();
			showStatus('Settings saved', false);
		})
		.catch((error) => {
			console.error('❌ Error saving tabs to storage:', error);
			showStatus('Error saving tabs: ' + error.message, true);
		});
}

/**
 * Generic modal display function
 * @param {HTMLElement} modalElement - The modal DOM element
 * @param {HTMLElement} cancelButton - The cancel button in the modal
 * @param {HTMLElement} confirmButton - The confirm button in the modal
 * @param {Function} onConfirm - Callback to execute on confirmation
 */
function showModal(modalElement, cancelButton, confirmButton, onConfirm) {
	console.log(`Showing modal: ${modalElement.id}`);

	if (!modalElement) {
		console.error('Modal element not found!');
		return;
	}

	// Show the modal
	modalElement.classList.add('show');

	// Handle Cancel button
	cancelButton.onclick = function() {
		console.log('Cancel button clicked');
		modalElement.classList.remove('show');
	};

	// Handle Confirm button
	confirmButton.onclick = function() {
		console.log('Confirm button clicked');
		modalElement.classList.remove('show');
		if (typeof onConfirm === 'function') {
			onConfirm();
		}
	};

	// Close modal when clicking outside
	modalElement.onclick = function(event) {
		if (event.target === modalElement) {
			console.log('Clicked outside modal');
			modalElement.classList.remove('show');
		}
	};
}

// Show the confirmation modal
function showConfirmModal(onConfirm) {
	showModal(
		confirmModal,
		modalCancelButton,
		modalConfirmButton,
		onConfirm
	);
}

// Show main content panel
function showMainContent() {
	console.log('Showing main content');
	mainContent.classList.add('active');
	mainContent.style.display = 'block'; // Add this line
	settingsPanel.classList.remove('active');
	settingsPanel.style.display = 'none'; // Add this line
}

// Show settings panel
function showSettingsPanel() {
	console.log('Showing settings panel');
	mainContent.classList.remove('active');
	mainContent.style.display = 'none'; // Add this line
	settingsPanel.classList.add('active');
	settingsPanel.style.display = 'block'; // Add this line
}

// Setup event listeners
function setupEventListeners() {
	console.log('Setting up event listeners');

	// Add quick add button
	quickAddButton = document.getElementById('quick-add-button');
	quickAddButton.addEventListener('click', () => {
		console.log('Quick add button clicked');
		addTabForCurrentPage();
	});

	// Add tab button
	addTabButton.addEventListener('click', () => {
		console.log('Add tab button clicked');
		showTabForm();
	});

	// Save button
	saveButton.addEventListener('click', () => {
		console.log('Save button clicked');
		saveTabForm();
	});

	// Cancel button
	cancelButton.addEventListener('click', () => {
		console.log('Cancel button clicked');
		hideTabForm();
	});

	// Setup Dropdown button
	setupDropdownButton.addEventListener('click', async () => {
		console.log('Setup Dropdown button clicked');
		await setupObjectDropdown();
	});

	// Settings button - toggle between panels
	settingsButton.addEventListener('click', () => {
		console.log('Settings button clicked');
		if (mainContent.classList.contains('active')) {
			showSettingsPanel();
		} else {
			showMainContent();
		}
	});

	// Settings reset button
	settingsResetButton.addEventListener('click', () => {
		console.log('Settings reset button clicked');
		showConfirmModal(() => {
			resetToDefaults();
			resetSettings();
		});
	});

	// Compact mode change
	const compactModeCheckbox = document.getElementById('compact-mode');
		compactModeCheckbox.addEventListener('change', () => {
		console.log('Compact mode changed to:', compactModeCheckbox.checked);
		userSettings.compactMode = compactModeCheckbox.checked;
		saveUserSettings();
		renderTabList(); // Re-render tabs with new display mode
	});

	// Skip delete confirmation change
	const skipDeleteConfirmationCheckbox = document.getElementById('skip-delete-confirmation');
		if (skipDeleteConfirmationCheckbox) {
		skipDeleteConfirmationCheckbox.addEventListener('change', () => {
			console.log('Skip delete confirmation changed to:', skipDeleteConfirmationCheckbox.checked);
			userSettings.skipDeleteConfirmation = skipDeleteConfirmationCheckbox.checked;
			saveUserSettings();
		});
	}

// Lightning Navigation change
const lightningNavigationCheckbox = document.getElementById('lightning-navigation');
if (lightningNavigationCheckbox) {
  lightningNavigationCheckbox.addEventListener('change', () => {
    console.log('Lightning Navigation changed to:', lightningNavigationCheckbox.checked);
    userSettings.lightningNavigation = lightningNavigationCheckbox.checked;
    
    // Save to both browser storage and localStorage immediately
    saveUserSettings();
    localStorage.setItem("lightningNavigation", JSON.stringify(lightningNavigationCheckbox.checked));
    
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
    showStatus(`Lightning Navigation ${lightningNavigationCheckbox.checked ? 'enabled' : 'disabled'}`, false);
  });
}

	// Enter key in form fields
	tabNameInput.addEventListener('keypress', (e) => {
		if (e.key === 'Enter') saveTabForm();
	});

	tabPathInput.addEventListener('keypress', (e) => {
		if (e.key === 'Enter') saveTabForm();
	});

	initThemeSelector();

	console.log('Event listeners setup complete');
}

// Handle Quick Add
function addTabForCurrentPage() {
	// Get the current active tab in the browser
	browser.tabs.query({ active: true, currentWindow: true })
	  .then(tabs => {
		if (tabs.length > 0) {
		  const currentUrl = tabs[0].url;
		  const pageTitle = tabs[0].title;
		  console.log('Current URL:', currentUrl);
		  console.log('Page title:', pageTitle);
		  
		  let isObject = false;
		  let isCustomUrl = false;
		  let path = '';
		  let urlBase = '';
  
		  // Check if this is a Salesforce setup page
		  if (currentUrl.includes('/lightning/setup/')) {
			// Extract the full path component (after /setup/)
			const urlParts = currentUrl.split('/lightning/setup/');
			if (urlParts.length > 1) {
			  // Get everything after /setup/ and before any query parameters
			  const fullPath = urlParts[1].split('?')[0]; 
			  
			  // Special case for ObjectManager: keep the full path
			  if (fullPath.startsWith('ObjectManager/')) {
				path = fullPath;
				isObject = false; // Mark ObjectManager paths as Setup type
			  } else {
				// For other setup pages, remove trailing '/home' or '/view' if present
				path = fullPath.replace(/\/(home|view)$/, '');
			  }
			  
			  urlBase = '/lightning/setup/';
			}
		  } 
		  // Check if this is a Salesforce object page
		  else if (currentUrl.includes('/lightning/o/')) {
			isObject = true; // Mark as object page
			// Extract the path component (after /o/)
			const urlParts = currentUrl.split('/lightning/o/');
			if (urlParts.length > 1) {
			  // Get everything after /o/ until query parameters
			  // Don't remove trailing /list, /home, or other valid suffixes for objects
			  const fullPath = urlParts[1].split('?')[0];
			  path = fullPath; // Keep the full path
			  urlBase = '/lightning/o/';
			}
		  }
		  // Handle custom URLs (any other Salesforce URL pattern)
		  else if (currentUrl.includes('.lightning.force.com/') || currentUrl.includes('.salesforce.com/')) {
			isCustomUrl = true;
			
			// Get base domain
			const urlParts = currentUrl.split('.com/');
			if (urlParts.length > 1) {
			  // Extract everything after the domain
			  path = urlParts[1].split('?')[0]; // Remove query parameters
			  
			  // Check for specific custom URL patterns 
			  console.log('Detected custom URL path:', path);
			}
		  }
		  
		  // If no valid path was found, show an error
		  if (!path) {
			showStatus('Not a recognized Salesforce page', true);
			return;
		  }
  
		  // Determine an appropriate name for the tab
		  let name = '';
		  if (isCustomUrl) {
			// For custom URLs, try to extract a meaningful name
			if (pageTitle) {
			  // Remove " | Salesforce" or similar suffix from title
			  let cleanTitle = pageTitle.split(' | ')[0];
			  name = cleanTitle;
			}
			
			// If we couldn't get a good name from the title, use a path segment
			if (!name || name.length === 0) {
			  const pathSegments = path.split('/');
			  // Look for the most meaningful segment (typically the app name)
			  for (const segment of pathSegments) {
				if (segment && segment.length > 0 && segment !== 'apex' && segment !== 'lightning') {
				  name = segment
					// Clean up the name - replace camelCase with spaces
					.replace(/([A-Z])/g, ' $1')
					// Remove file extensions
					.replace(/\.(app|jsp|page)$/, '')
					// Clean up any leading space and capitalize first letter
					.replace(/^./, str => str.toUpperCase())
					.trim();
				  break;
				}
			  }
			  
			  // If still no name, use generic name with path
			  if (!name || name.length === 0) {
				name = 'Custom Page';
			  }
			}
		  } else if (isObject) {
			// For object pages, extract both the object name and the view type
			const pathSegments = path.split('/');
			if (pathSegments.length > 0) {
			  // Get object name
			  const objectName = formatObjectNameFromURL(pathSegments[0]);
			  
			  // Try to get view type (list, home, etc.)
			  let viewType = '';
			  if (pathSegments.length > 1) {
				viewType = pathSegments[1].charAt(0).toUpperCase() + pathSegments[1].slice(1);
			  }
			  
			  // Combine for complete name
			  name = viewType ? `${objectName} ${viewType}` : objectName;
			}
		  } else if (path.startsWith('ObjectManager/')) {
			// Special handling for ObjectManager paths
			const pathSegments = path.split('/').filter(segment => segment.length > 0);
			
			// Extract object name from path
			let objectName = "";
			if (pathSegments.length >= 2) {
			  objectName = formatObjectNameFromURL(pathSegments[1]);
			} else {
			  objectName = "Object Manager";
			}
			
			// Extract section name directly from the URL path (third segment)
			let sectionName = "";
			if (pathSegments.length >= 3) {
			  // Get the section name (e.g., "PageLayouts", "FieldsAndRelationships")
			  let pathSection = pathSegments[2];
			  
			  // Format the section name with spaces
			  sectionName = pathSection
				.replace(/([A-Z])/g, ' $1') // Add space before uppercase letters
				.trim();
			}
			
			// Combine object name and section
			if (sectionName) {
			  name = `${objectName} - ${sectionName}`;
			} else {
			  name = objectName;
			}
			
			console.log('ObjectManager path detected. Object name:', objectName, 'Section:', sectionName);
		  } else {
			// Logic for standard setup page naming
			// Try to extract a better name from the page title if available
			if (pageTitle) {
			  // Remove " | Salesforce" or similar suffix from title
			  let titleParts = pageTitle.split(' | ');
			  let cleanTitle = titleParts[0];
			  
			  console.log('Clean title extracted:', cleanTitle);
			  
			  // If the title includes "Setup", try to get a cleaner name
			  if (cleanTitle.includes('Setup')) {
				const setupParts = cleanTitle.split('Setup: ');
				if (setupParts.length > 1) {
				  cleanTitle = setupParts[1];
				}
			  }
  
			  // Use the cleaned title if we got something reasonable
			  if (cleanTitle && cleanTitle.length > 0) {
				name = cleanTitle;
			  }
			}
			
			// If we couldn't get a good name from the title, use the path
			if (!name || name.length === 0) {
			  console.log('Using path for name. Path:', path);
			  
			  // Try to format the path to get a readable name
			  if (path && path.length > 0) {
				// Get the last non-empty segment of the path
				const pathSegments = path.split('/').filter(segment => segment.length > 0);
				
				if (pathSegments.length > 0) {
				  let lastSegment = pathSegments[pathSegments.length - 1];
				  
				  // Format the path segment for readability
				  name = lastSegment
					// Add space before uppercase letters
					.replace(/([A-Z])/g, ' $1')
					// Clean up any leading space and capitalize first letter
					.replace(/^./, str => str.toUpperCase())
					.trim();
				  
				  // If name is still empty or just spaces, try another approach
				  if (!name.trim()) {
					// Try to use the whole path
					name = path
					  .replace(/([A-Z])/g, ' $1')
					  .replace(/^./, str => str.toUpperCase())
					  .trim();
				  }
				}
			  }
			  
			  // Final fallback - use a generic name with the path
			  if (!name || !name.trim()) {
				name = 'Setup: ' + path;
			  }
			}
		  }
  
		  // Create a new tab object
		  const newTab = {
			id: generateId(),
			label: name,
			path: path,
			openInNewTab: false,
			isObject: isObject,
			isCustomUrl: isCustomUrl,
			position: customTabs.length,
			hasDropdown: false,
			dropdownItems: []
		  };
  
		  // Add the new tab
		  customTabs.push(newTab);
		  saveTabsToStorage();
  
		  // Show success message with the type of page
		  let pageType = isObject ? 'object' : (isCustomUrl ? 'custom' : 'setup');
		  showStatus(`Added ${pageType} tab for "${name}"`, false);
		}
	  })
	  .catch(error => {
		console.error('Error accessing current tab:', error);
		showStatus('Error accessing current tab', true);
	  });
  }

// Render the tab list
function renderTabList() {
	console.log('Rendering tab list');
	// Clear existing list
	while (tabList.firstChild) {
		tabList.removeChild(tabList.firstChild);
	}

	// Show empty state if no tabs
	if (customTabs.length === 0) {
		emptyState.style.display = 'block';
	} else {
		emptyState.style.display = 'none';

		// Create tab items
		customTabs.forEach((tab) => {
			const tabItem = createTabElement(tab);
			tabList.appendChild(tabItem);
		});

		// Setup drag and drop
		setupDragAndDrop();
	}
}

// Setup drag and drop functionality
function setupDragAndDrop() {
	const tabItems = document.querySelectorAll('.tab-item');
	const dragHandles = document.querySelectorAll('.drag-handle');
  
	// Create drop indicator element
	const dropIndicator = createDropIndicator();
  
	// Add event listeners to drag handles
	dragHandles.forEach((handle, index) => {
	  const item = tabItems[index];
	  handle.addEventListener('mousedown', (e) => handleDragStart(e, item, dropIndicator));
	});
  }

// Create tab list item element
function createTabElement(tab) {
	const tabItem = document.createElement('div');
	tabItem.className = 'tab-item';
	tabItem.dataset.id = tab.id;
	
	const dragHandle = document.createElement('div');
	dragHandle.className = 'drag-handle';
	dragHandle.innerHTML = '⋮⋮';
	dragHandle.setAttribute('title', 'Drag to reorder');
	
	const contentContainer = document.createElement('div');
	contentContainer.className = 'tab-info';
	
	// Determine the tab type - force correct type detection
	let isObject = false;
	let isCustomUrl = false;
	
	// Check for explicit properties first
	if (tab.hasOwnProperty('isObject') && tab.isObject === true) {
	  isObject = true;
	} else if (tab.hasOwnProperty('isCustomUrl') && tab.isCustomUrl === true) {
	  isCustomUrl = true;
	} 
	// Then check the path if properties aren't set
	else if (tab.path) {
	  // Check for ObjectManager paths
	  if (!tab.path.startsWith('ObjectManager/') && 
      (tab.path.includes('/o/') || tab.path.endsWith('/view'))) {
    isObject = true;

	  } 
	  // Check for custom URL patterns
	  else if (tab.path.includes('interaction_explorer') || 
			   tab.path.endsWith('.app') ||
			   tab.path.includes('apex/')) {
		isCustomUrl = true;
	  }
	}
	
	// Set badge type based on detected tab type
	let badgeText = 'Setup';
	let badgeClass = 'setup';
	
	if (isCustomUrl) {
	  badgeText = 'Custom';
	  badgeClass = 'custom';
	} else if (isObject) {
	  badgeText = 'Object';
	  badgeClass = 'object';
	}
	
	// Create tab name
	const tabName = document.createElement('div');
	tabName.className = 'tab-name';
	tabName.textContent = tab.label;
	
	// Setup different layout based on compact mode
	if (userSettings.compactMode) {
	  // Compact mode specific setup
	  tabItem.classList.add('compact-mode');
	  
	  // In compact mode, badge is a single letter
	  const badgeShort = badgeText.charAt(0);
	  
	  // Create the badge element for compact mode
	  const pathType = document.createElement('span');
	  pathType.className = 'path-type-compact ' + badgeClass;
	  pathType.textContent = badgeShort;
	  
	  // Create a wrapper div for proper alignment
	  const badgeWrapper = document.createElement('div'); 
	  badgeWrapper.style.display = 'flex';
	  badgeWrapper.style.alignItems = 'flex-start';
	  badgeWrapper.style.paddingTop = '3px'; // Align with drag handle
	  badgeWrapper.appendChild(pathType);
	  
	  // Configure content container for compact mode
	  contentContainer.style.display = 'flex';
	  contentContainer.style.flexDirection = 'row';
	  contentContainer.style.flex = '1';
	  contentContainer.style.minWidth = '0';
	  contentContainer.style.alignItems = 'flex-start'; // Align items to the top
	  
	  // Add badge directly to content container
	  contentContainer.appendChild(badgeWrapper);
	  
	  // Create text container for name that allows wrapping
	  const textContainer = document.createElement('div');
	  textContainer.style.marginLeft = '8px';
	  textContainer.style.flex = '1';
	  textContainer.style.minWidth = '0';
	  textContainer.appendChild(tabName);
	  
	  // Add text to content container
	  contentContainer.appendChild(textContainer);
	  
	  // Style the tab name for wrapping
	  tabName.style.wordBreak = 'break-word';
	  tabName.style.overflow = 'hidden';
	  tabName.style.paddingTop = '3px'; // Align with badge and drag handle
	} else {
	  // Regular mode - keep original structure
	  contentContainer.style.display = 'flex';
	  contentContainer.style.flexDirection = 'column';
	  contentContainer.style.flex = '1';
	  contentContainer.style.minWidth = '0';
	  
	  // Add tab name first
	  contentContainer.appendChild(tabName);
	  
	  // Create tab path container
	  const tabPath = document.createElement('div');
	  tabPath.className = 'tab-path';
	  
	  // Create the badge element for regular mode
	  const pathType = document.createElement('span');
	  pathType.className = 'path-type ' + badgeClass;
	  pathType.textContent = badgeText;
	  
	  // Create path text element
	  const pathTextElement = document.createElement('span');
	  pathTextElement.className = 'path-text';
	  pathTextElement.textContent = tab.path;
	  
	  // Add badge and path to tab path container
	  tabPath.appendChild(pathType);
	  tabPath.appendChild(pathTextElement);
	  
	  // Add tab path to content container
	  contentContainer.appendChild(tabPath);
	}

	// Create actions container
	const actionsContainer = document.createElement('div');
	actionsContainer.className = 'tab-actions';
	
// Create new tab icon button - simplified with CSS styling
const newTabButton = document.createElement('button');
newTabButton.className = 'new-tab-button';

// Set initial state classes
if (tab.openInNewTab) {
	newTabButton.classList.add('new-tab-enabled');
	newTabButton.setAttribute('title', 'Opens in new tab (click to change)');
} else {
	newTabButton.classList.add('new-tab-disabled');
	newTabButton.setAttribute('title', 'Opens in same tab (click to change)');
}

// Use simplified external-link icon with stroke styling
newTabButton.innerHTML = `
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
		<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
		<polyline points="15 3 21 3 21 9"></polyline>
		<line x1="10" y1="14" x2="21" y2="3"></line>
	</svg>
`;

newTabButton.addEventListener('click', (e) => {
	e.stopPropagation();
	tab.openInNewTab = !tab.openInNewTab;
	
	// Update button appearance by toggling classes
	if (tab.openInNewTab) {
		newTabButton.classList.remove('new-tab-disabled');
		newTabButton.classList.add('new-tab-enabled');
		newTabButton.setAttribute('title', 'Opens in new tab (click to change)');
	} else {
		newTabButton.classList.remove('new-tab-enabled');
		newTabButton.classList.add('new-tab-disabled');
		newTabButton.setAttribute('title', 'Opens in same tab (click to change)');
	}
	
	saveTabsToStorage();
});
	
	// Create delete button
	const deleteButton = document.createElement('button');
	deleteButton.className = 'delete-button';
	deleteButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path fill-rule="evenodd" d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.405 15h5.19c.9 0 1.652-.681 1.741-1.576l.66-6.6a.75.75 0 00-1.492-.149l-.66 6.6a.25.25 0 01-.249.225h-5.19a.25.25 0 01-.249-.225l-.66-6.6z"></path></svg>';
	deleteButton.setAttribute('title', 'Remove tab');
	deleteButton.addEventListener('click', (e) => {
	  e.stopPropagation();
	  deleteTab(tab.id);
	});
	
	// Add buttons to actions container
actionsContainer.appendChild(newTabButton);
	actionsContainer.appendChild(deleteButton);
	
	// Add click handler for editing
	contentContainer.addEventListener('click', () => {
	  editTab(tab.id);
	});
	
	// Assemble final tab layout
	tabItem.appendChild(dragHandle);
	tabItem.appendChild(contentContainer);
	tabItem.appendChild(actionsContainer);
	
	// For debugging - log the tab type detection
	console.log(`Tab "${tab.label}" - isObject: ${isObject}, isCustomUrl: ${isCustomUrl}, badge: ${badgeText}`);
	
	return tabItem;
  }

// Create drop indicator element
function createDropIndicator() {
	const dropIndicator = document.createElement('div');
	dropIndicator.className = 'drop-indicator';
	return dropIndicator;
}

// Handle the start of dragging
function handleDragStart(e, item, dropIndicator) {
	e.preventDefault();

	// Get container width before starting drag
	const tabItemWidth = item.offsetWidth;

	// Create and setup the clone/ghost element
	const clone = createDragClone(item, tabItemWidth);

	// Mark the original item as being dragged
	item.style.opacity = 0.3;
	item.classList.add('being-dragged');

	// Store original positions
	const rect = item.getBoundingClientRect();
	const shiftX = e.clientX - rect.left;
	const shiftY = e.clientY - rect.top;

	// Move the clone element to initial position
	moveElement(clone, e.pageX - shiftX, e.pageY - shiftY);

	// Add drop indicator to the DOM
	tabList.appendChild(dropIndicator);

	// Set up move and drop handlers
	setupDragHandlers(item, clone, dropIndicator, shiftX, shiftY, tabItemWidth);
}

// Create a clone of the element being dragged
function createDragClone(item, width) {
	const clone = item.cloneNode(true);
	clone.classList.add('tab-item-clone');
	clone.style.width = width + 'px'; // This one style might still be needed since it's dynamic

	// Add clone to the DOM
	document.body.appendChild(clone);

	return clone;
}

// Move an element to specified coordinates
function moveElement(element, x, y) {
	element.style.top = y + 'px';
	element.style.left = x + 'px';
}

// Set up handlers for dragging movement and dropping
function setupDragHandlers(item, clone, dropIndicator, shiftX, shiftY, tabItemWidth) {
	// Define mousemove handler
	function onMouseMove(event) {
		moveElement(clone, event.pageX - shiftX, event.pageY - shiftY);

		// Hide clone temporarily to get element underneath
		clone.style.display = 'none';
		const elemBelow = document.elementFromPoint(event.clientX, event.clientY);
		clone.style.display = '';

		// Reset drop indicator visibility
		dropIndicator.style.display = 'none';

		if (!elemBelow) return;

		// Handle drop indicator positioning
		updateDropIndicator(elemBelow, item, event, dropIndicator, tabItemWidth);
	}

	// Define mouseup/drop handler
	function onMouseUp(event) {
		// Clean up event listeners
		document.removeEventListener('mousemove', onMouseMove);
		document.removeEventListener('mouseup', onMouseUp);

		// Clean up DOM
		document.body.removeChild(clone);
		item.style.opacity = '';
		item.classList.remove('being-dragged');

		if (dropIndicator.parentNode) {
			dropIndicator.parentNode.removeChild(dropIndicator);
		}

		// Handle final positioning
		finalizeDrop(event, item);

		// Update the tab positions in storage
		updateTabPositions();
	}

	// Add the event listeners
	document.addEventListener('mousemove', onMouseMove);
	document.addEventListener('mouseup', onMouseUp);
}

// Update the drop indicator position
function updateDropIndicator(elemBelow, draggedItem, event, dropIndicator, tabItemWidth) {
	// Check if we're over another tab item
	const droppableItem = elemBelow.closest('.tab-item');
	if (droppableItem && droppableItem !== draggedItem) {
		// Determine if we should place above or below
		const rect = droppableItem.getBoundingClientRect();
		const middle = rect.top + rect.height / 2;

		// Show the drop indicator
		dropIndicator.style.display = 'block';
		dropIndicator.style.width = tabItemWidth + 'px'; // This might still be needed as it's dynamic

		if (event.clientY < middle) {
			// Place above the droppable item
			tabList.insertBefore(dropIndicator, droppableItem);
		} else {
			// Place below the droppable item
			tabList.insertBefore(dropIndicator, droppableItem.nextSibling);
		}
	}
}

// Finalize the drop position
function finalizeDrop(event, draggedItem) {
	const elemBelow = document.elementFromPoint(event.clientX, event.clientY);

	if (elemBelow) {
		const droppableItem = elemBelow.closest('.tab-item');
		if (droppableItem && droppableItem !== draggedItem) {
			// Determine if we should place above or below
			const rect = droppableItem.getBoundingClientRect();
			const middle = rect.top + rect.height / 2;

			if (event.clientY < middle) {
				tabList.insertBefore(draggedItem, droppableItem);
			} else {
				tabList.insertBefore(draggedItem, droppableItem.nextSibling);
			}
		}
	}
}


// Update tab positions after dragging
function updateTabPositions() {
	const tabItems = document.querySelectorAll('.tab-item');

	tabItems.forEach((item, index) => {
		const tabId = item.dataset.id;
		const tab = customTabs.find(t => t.id === tabId);
		if (tab) {
			tab.position = index;
		}
	});

	saveTabsToStorage();
}

// Show tab form for adding or editing
function showTabForm(tabId = null) {
	console.log('Showing tab form', { tabId });
  
	// Reset form
	tabNameInput.value = '';
	tabPathInput.value = '';
	openInNewTabCheckbox.checked = false;
	isObjectCheckbox.checked = false;
	isCustomUrlCheckbox.checked = false;

  
	if (tabId) {
	  // Edit mode
	  editingTabId = tabId;
	  formTitle.textContent = 'Edit Tab';

	  // Populate form with existing data
	  const tab = customTabs.find(t => t.id === tabId);
	  if (tab) {
		tabNameInput.value = tab.label;
		tabPathInput.value = tab.path;
		openInNewTabCheckbox.checked = tab.openInNewTab;
		isObjectCheckbox.checked = tab.isObject || false;
		isCustomUrlCheckbox.checked = tab.isCustomUrl || false;
		isCustomUrlCheckbox.checked = tab.isCustomUrl || false;

		// Show dropdown section if editing and show preview if tab has dropdown items
		objectDropdownSection.style.display = 'block';
		if (tab.dropdownItems && tab.dropdownItems.length > 0) {
			showDropdownPreview(tab.dropdownItems);
		} else {
			dropdownItemsPreview.style.display = 'none';
		}
	  }
  
	  // Find the tab element
	  const tabElement = document.querySelector(`.tab-item[data-id="${tabId}"]`);
	  if (tabElement) {
		// Insert the form right after this tab
		tabElement.after(tabForm);
  
		// Show the form
		tabForm.style.display = 'block';
  
		// Scroll to make the form fully visible
		ensureFormVisible(tabElement);
	  } else {
		// Fallback to default position
		tabList.after(tabForm);
		tabForm.style.display = 'block';
	  }
	} else {
	  // Add mode
	  editingTabId = null;
	  formTitle.textContent = 'Add New Tab';

	  // Hide dropdown section when adding new tab
	  objectDropdownSection.style.display = 'none';

	  // Show form at the default position (at the end)
	  tabList.after(tabForm);
	  tabForm.style.display = 'block';
  
	  // Ensure the Add button is visible
	  const addButton = document.getElementById('add-tab-button');
	  if (addButton) {
		addButton.scrollIntoView({ behavior: 'smooth', block: 'end' });
	  }
	}
  
	// Focus on the first field
	tabNameInput.focus();
  }

// Function to ensure the form is fully visible
function ensureFormVisible(tabElement) {
	// Use a slightly longer delay to ensure DOM is fully updated
	setTimeout(() => {
		// Get the main scrollable container
		const mainContent = document.getElementById('main-content');

		// Calculate positions
		const formRect = tabForm.getBoundingClientRect();
		const containerRect = mainContent.getBoundingClientRect();
		const containerHeight = mainContent.clientHeight;
		const scrollTop = mainContent.scrollTop;

		// Calculate how much of the form is out of view
		const formBottom = formRect.bottom - containerRect.top;
		const overflow = formBottom - containerHeight;

		console.log('Form dimensions:', {
			formBottom,
			containerHeight,
			overflow,
			scrollTop
		});

		// If form extends below the visible area, scroll it into view
		if (overflow > 0) {
			console.log('Scrolling to show form, overflow:', overflow);

			// Scroll the container to bring the form into view
			mainContent.scrollTo({
				top: scrollTop + overflow + 30, // Add padding
				behavior: 'smooth'
			});
		}
	}, 100);
}

// Hide tab form
function hideTabForm() {
	console.log('Hiding tab form');
	tabForm.style.display = 'none';
	editingTabId = null;

	// Move the form back to its default container if needed
	// This ensures it's ready for the next use
	if (tabForm.parentElement !== document.getElementById('main-content')) {
		const mainContent = document.getElementById('main-content');
		if (mainContent) {
			mainContent.appendChild(tabForm);
		}
	}
}

function saveTabForm() {
  console.log('Saving tab form');
  const name = tabNameInput.value.trim();
  const path = tabPathInput.value.trim();

  if (!name || !path) {
    showStatus('Tab name and path are required', true);
    return;
  }

  // Get the checkbox values for tab type
  const isObject = isObjectCheckbox.checked;
  const isCustomUrl = isCustomUrlCheckbox.checked;

  // If both object and custom URL are checked, warn the user
  if (isObject && isCustomUrl) {
    showStatus('Tab cannot be both Object and Custom URL', true);
    return;
  }

  if (editingTabId) {
    // Update existing tab
    const tab = customTabs.find(t => t.id === editingTabId);
    if (tab) {
      console.log('📝 Updating tab before save:', {
        id: tab.id,
        hasDropdown: tab.hasDropdown,
        dropdownItemsCount: tab.dropdownItems?.length || 0
      });

      // Update basic properties
      tab.label = name;
      tab.path = path;
      tab.openInNewTab = openInNewTabCheckbox.checked;

      // Explicitly set the type properties
      tab.isObject = isObject;
      tab.isCustomUrl = isCustomUrl;

      // NOTE: hasDropdown and dropdownItems are NOT modified here
      // They should be preserved from when setupObjectDropdown() was called

      // Log the updated tab
      console.log('✅ Tab updated, dropdown preserved:', {
        id: tab.id,
        label: tab.label,
        hasDropdown: tab.hasDropdown,
        dropdownItemsCount: tab.dropdownItems?.length || 0
      });
    }
  } else {
    // Add new tab
    const newTab = {
      id: generateId(),
      label: name,
      path: path,
      openInNewTab: openInNewTabCheckbox.checked,
      isObject: isObject,
      isCustomUrl: isCustomUrl,
      position: customTabs.length,
      hasDropdown: false,
      dropdownItems: []
    };

    // Log the new tab for debugging
    console.log('Created new tab:', newTab);

    customTabs.push(newTab);
  }

  saveTabsToStorage();
  hideTabForm();
}

// Delete tab

function deleteTab(tabId) {
	console.log('Delete tab requested', { tabId });
  
	// Check if we should skip the confirmation
	if (userSettings.skipDeleteConfirmation) {
	  // Directly delete the tab without confirmation
	  customTabs = customTabs.filter(tab => tab.id !== tabId);
	  saveTabsToStorage();
	  showStatus('Tab removed', false);
	} else {
	  // Show confirmation dialog
	  showDeleteConfirmModal(tabId);
	}
  }

// Add this function to your code - it's a diagnostic helper
function diagnoseDeleteModal() {
	console.log("--- Modal Diagnostic Report ---");
	
	// Check if modal elements exist
	const modal = document.getElementById('delete-confirm-modal');
	const cancelBtn = document.getElementById('delete-modal-cancel-button');
	const confirmBtn = document.getElementById('delete-modal-confirm-button');
	
	console.log("Elements found:", {
	  modal: !!modal,
	  cancelBtn: !!cancelBtn, 
	  confirmBtn: !!confirmBtn
	});
	
	if (modal) {
	  // Check current modal styling
	  const computedStyle = window.getComputedStyle(modal);
	  console.log("Modal current styles:", {
		display: computedStyle.display,
		visibility: computedStyle.visibility,
		opacity: computedStyle.opacity,
		zIndex: computedStyle.zIndex,
		position: computedStyle.position
	  });
	  
	  // Check if modal has show class
	  console.log("Modal has 'show' class:", modal.classList.contains('show'));
	  
	  // Try to force show the modal
	  modal.style.display = 'flex';
	  modal.style.zIndex = '9999';
	  modal.classList.add('show');
	  console.log("Attempted to force show modal");
	}
	
	console.log("--- End Diagnostic Report ---");
  }
  
  // Replace your showDeleteConfirmModal function with this one
  function showDeleteConfirmModal(tabId) {
	console.log('Showing delete confirm modal for tab', tabId);
	
	// Get references to modal elements
	const modal = document.getElementById('delete-confirm-modal');
	const cancelBtn = document.getElementById('delete-modal-cancel-button');
	const confirmBtn = document.getElementById('delete-modal-confirm-button');
	
	if (!modal) {
	  console.error('Delete modal element not found');
	  return;
	}
	
	// Fix for new fixed header layout
	// 1. Reset any problematic positioning from container
	modal.style.position = 'fixed';
	modal.style.zIndex = '2000'; // Higher than header's z-index
	
	// 2. Make sure modal is a direct child of body to avoid stacking context issues
	if (modal.parentElement !== document.body) {
	  document.body.appendChild(modal);
	}
	
	// Show the modal
	modal.classList.add('show');
	
	// Define action handlers
	const handleCancel = () => {
	  modal.classList.remove('show');
	  cleanupEventListeners();
	};
	
	const handleConfirm = () => {
	  // Perform deletion
	  customTabs = customTabs.filter(tab => tab.id !== tabId);
	  saveTabsToStorage();
	  modal.classList.remove('show');
	  cleanupEventListeners();
	};
	
	const handleOutsideClick = (event) => {
	  if (event.target === modal) {
		handleCancel();
	  }
	};
	
	// Clean up function to remove event listeners
	const cleanupEventListeners = () => {
	  cancelBtn.removeEventListener('click', handleCancel);
	  confirmBtn.removeEventListener('click', handleConfirm);
	  modal.removeEventListener('click', handleOutsideClick);
	};
	
	// Add event listeners
	cancelBtn.addEventListener('click', handleCancel);
	confirmBtn.addEventListener('click', handleConfirm);
	modal.addEventListener('click', handleOutsideClick);
  }


// Edit tab
function editTab(tabId) {
	console.log('Edit tab requested', { tabId });

	// First, hide the form if it's already visible
	if (tabForm.style.display === 'block') {
		hideTabForm();
	}

	// Then show it in the right position
	showTabForm(tabId);
}

// Generate a unique ID
function generateId() {
	return 'tab_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
}

/**
 * Setup Object Dropdown - Parse navigation from current page
 */
async function setupObjectDropdown() {
	console.log('Setting up object dropdown...');

	// Show loading state
	setupDropdownButton.disabled = true;
	setupDropdownButton.textContent = 'Loading...';

	try {
		// Get the active tab (the Salesforce page)
		const tabs = await browser.tabs.query({ active: true, currentWindow: true });

		if (tabs.length === 0) {
			throw new Error('No active tab found');
		}

		const activeTab = tabs[0];

		// Send message to content script to parse navigation
		const response = await browser.tabs.sendMessage(activeTab.id, {
			action: 'parse_navigation'
		});

		console.log('Navigation parse response:', response);

		if (response && response.success && response.items) {
			// Update the current tab being edited with dropdown items
			if (editingTabId) {
				const tab = customTabs.find(t => t.id === editingTabId);
				if (tab) {
					// Clean up old dropdown properties from previous implementation
					delete tab.autoSetupDropdown;
					delete tab.children;
					delete tab.parentId;
					delete tab.isExpanded;
					delete tab.cachedNavigation;
					delete tab.navigationLastUpdated;
					delete tab.needsNavigationRefresh;

					// Set new dropdown properties
					tab.hasDropdown = true;
					tab.dropdownItems = response.items;

					console.log('✅ Dropdown setup complete!', {
						tabId: tab.id,
						label: tab.label,
						hasDropdown: tab.hasDropdown,
						itemCount: tab.dropdownItems.length,
						firstItem: tab.dropdownItems[0]?.label
					});

					// Show preview
					showDropdownPreview(response.items);

					// Save to storage
					await saveTabsToStorage();

					showStatus('Dropdown menu created successfully!');
				} else {
					console.error('❌ Tab not found in customTabs array:', editingTabId);
				}
			} else {
				console.error('❌ No editingTabId set');
			}
		} else {
			throw new Error(response?.error || 'Failed to parse navigation');
		}

	} catch (error) {
		console.error('Error setting up dropdown:', error);
		showStatus('Failed to create dropdown: ' + error.message, true);
	} finally {
		// Reset button state
		setupDropdownButton.disabled = false;
		setupDropdownButton.textContent = 'Setup as Object Dropdown';
	}
}

/**
 * Show dropdown items preview
 */
function showDropdownPreview(items) {
	if (!items || items.length === 0) {
		dropdownItemsPreview.style.display = 'none';
		return;
	}

	// Update count
	dropdownCount.textContent = items.length;

	// Clear existing items
	dropdownItemsList.innerHTML = '';

	// Add items
	items.forEach((item, index) => {
		const itemDiv = document.createElement('div');
		itemDiv.style.padding = '4px 0';
		itemDiv.style.borderBottom = index < items.length - 1 ? '1px solid #dddbda' : 'none';
		itemDiv.textContent = `${index + 1}. ${item.label}`;
		dropdownItemsList.appendChild(itemDiv);
	});

	// Show preview
	dropdownItemsPreview.style.display = 'block';
}

// Show status message
function showStatus(message, isError = false) {
	console.log('Showing status message', { message, isError });
	statusMessage.textContent = message;

	// Apply appropriate class
	statusMessage.classList.remove('success', 'error');
	if (isError) {
		statusMessage.classList.add('error');
	} else if (message) {
		statusMessage.classList.add('success');
	}

	// Clear message after a delay
	setTimeout(() => {
		statusMessage.textContent = '';
		statusMessage.classList.remove('success', 'error');
	}, 3000);
}