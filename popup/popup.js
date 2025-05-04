// Reference to utils
let SFTabsUtils; // Will be initialized when available

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

// Settings Elements
let settingsButton;
let settingsPanel;
let mainContent;
let themeMode;
let settingsResetButton;

// State
let customTabs = [];
let editingTabId = null;
let userSettings = {  // Changed from const to let to avoid redeclaration
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
		position: 0
	},
	{
		id: 'default_tab_packages',
		label: 'Installed Packages',
		path: 'ImportedPackage',
		openInNewTab: false,
		position: 1
	},
	{
		id: 'default_tab_users',
		label: 'Users',
		path: 'ManageUsers',
		openInNewTab: false,
		position: 2
	},
	{
		id: 'default_tab_profiles',
		label: 'Profiles',
		path: 'EnhancedProfiles',
		openInNewTab: false,
		position: 3
	},
	{
		id: 'default_tab_permsets',
		label: 'Permission Sets',
		path: 'PermSets',
		openInNewTab: false,
		position: 4
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
	return SFTabsUtils.urlHelpers.formatObjectNameFromURL(objectNameFromURL);
}

// Default user settings
const defaultSettings = {
	themeMode: 'light',
	compactMode: false
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
	console.log('DOMContentLoaded event fired');
	
	// Ensure utils are available
	SFTabsUtils = window.SFTabsUtils || {};
  
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
  
	// Settings elements
	settingsButton = document.getElementById('settings-button');
	settingsPanel = document.getElementById('settings-panel');
	mainContent = document.getElementById('main-content');
	themeMode = document.getElementById('theme-mode');
	settingsResetButton = document.getElementById('settings-reset-button');
	
	// Quick add button
	quickAddButton = document.getElementById('quick-add-button');
  
	// Debug: Log all DOM elements
	console.log('DOM Elements initialized');
  
	// CRITICAL FIX: Always start with main content panel visible, settings panel hidden
	mainContent.style.display = 'block';
	mainContent.classList.add('active');
	settingsPanel.style.display = 'none';
	settingsPanel.classList.remove('active');
  
	// Load settings first with direct storage access
	browser.storage.sync.get('userSettings')
	  .then(result => {
		console.log('User settings loaded directly from storage:', result);
		if (result.userSettings) {
		  userSettings = result.userSettings;
		} else {
		  console.log('No user settings found, using defaults');
		  userSettings = defaultSettings;
		}
		
		// Update UI elements with loaded settings
		updateSettingsUI();
		
		// Apply theme immediately
		applyTheme();
		
		// Now load tabs with direct storage access
		return browser.storage.sync.get('customTabs');
	  })
	  .then(result => {
		console.log('Custom tabs loaded directly from storage:', result);
		if (result.customTabs && Array.isArray(result.customTabs) && result.customTabs.length > 0) {
		  customTabs = result.customTabs;
		  console.log('Found', customTabs.length, 'tabs in storage');
		} else {
		  console.log('No custom tabs found, using defaults');
		  customTabs = JSON.parse(JSON.stringify(defaultTabs));
		}
		
		// Render tabs immediately
		renderTabList();
		
		// Set up event listeners
		setupEventListeners();
	  })
	  .catch(error => {
		console.error('Error during popup initialization:', error);
		// Fallback to defaults if storage fails
		userSettings = defaultSettings;
		customTabs = JSON.parse(JSON.stringify(defaultTabs));
		updateSettingsUI();
		applyTheme();
		renderTabList();
		setupEventListeners();
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
	return SFTabsUtils.storageHelpers.loadSettings()
	  .then((settings) => {
		userSettings = settings;
		updateSettingsUI();
		return userSettings;
	  })
	  .catch((error) => {
		console.error('Error in loadUserSettings:', error);
		showStatus('Error loading settings', true);
		return SFTabsUtils.storageHelpers.getDefaultSettings();
	  });
}

// Save user settings to storage
function saveUserSettings() {
	console.log('Saving user settings to storage');
	return SFTabsUtils.storageHelpers.saveSettings(userSettings)
	  .then((success) => {
		if (success) {
		  showStatus('Settings saved', false);
		} else {
		  showStatus('Failed to save settings', true);
		}
	  })
	  .catch((error) => {
		console.error('Error in saveUserSettings:', error);
		showStatus('Error saving settings', true);
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
document.addEventListener('DOMContentLoaded', () => {
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
});

// Apply theme based on settings
function applyTheme() {
	SFTabsUtils.uiHelpers.applyTheme(userSettings.themeMode);
}

// Load tabs from storage
function loadTabsFromStorage() {
	console.log('Loading tabs from storage');
	SFTabsUtils.storageHelpers.loadTabs()
	  .then((tabs) => {
		customTabs = tabs;
		renderTabList();
	  })
	  .catch((error) => {
		console.error('Error in loadTabsFromStorage:', error);
		showStatus('Error loading tabs', true);
	  });
}

// Reset to default tabs
function resetToDefaults() {
	console.log('Resetting to default tabs');
	customTabs = JSON.parse(JSON.stringify(SFTabsUtils.storageHelpers.getDefaultTabs()));
	saveTabsToStorage();
	showStatus('Reset to default tabs', false);
}

// Save tabs to storage
function saveTabsToStorage() {
	console.log('Saving tabs to storage');
	SFTabsUtils.storageHelpers.saveTabs(customTabs)
	  .then((success) => {
		if (success) {
		  renderTabList();
		  showStatus('Settings saved', false);
		} else {
		  showStatus('Failed to save settings', true);
		}
	  })
	  .catch((error) => {
		console.error('Error in saveTabsToStorage:', error);
		showStatus('Error saving tabs', true);
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
	SFTabsUtils.uiHelpers.showModal(confirmModal, modalCancelButton, modalConfirmButton, onConfirm);
}

// Show main content panel
function showMainContent() {
	console.log('Showing main content');
	mainContent.style.display = 'block';
	mainContent.classList.add('active');
	settingsPanel.style.display = 'none';
	settingsPanel.classList.remove('active');
  }

// Show settings panel
function showSettingsPanel() {
	console.log('Showing settings panel');
	settingsPanel.style.display = 'block';
	settingsPanel.classList.add('active');
	mainContent.style.display = 'none';
	mainContent.classList.remove('active');
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
  
	// FIXED: Settings button - toggle between panels
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
	if (compactModeCheckbox) {
	  compactModeCheckbox.addEventListener('change', () => {
		console.log('Compact mode changed to:', compactModeCheckbox.checked);
		userSettings.compactMode = compactModeCheckbox.checked;
		saveUserSettings();
		renderTabList(); // Re-render tabs with new display mode
	  });c
	}
  
	// Enter key in form fields
	tabNameInput.addEventListener('keypress', (e) => {
	  if (e.key === 'Enter') saveTabForm();
	});
  
	tabPathInput.addEventListener('keypress', (e) => {
	  if (e.key === 'Enter') saveTabForm();
	});
  
	// Initialize theme selector
	initThemeSelector();
  
	// Add click handlers to tab items after rendering
	addTabItemEventListeners();
  
	console.log('Event listeners setup complete');
  }

  // New function to add event listeners to tab items
function addTabItemEventListeners() {
	// Add event listeners for edit actions
	document.querySelectorAll('[data-action="edit"]').forEach(el => {
	  el.addEventListener('click', () => {
		const tabId = el.getAttribute('data-tab-id');
		if (tabId) {
		  editTab(tabId);
		}
	  });
	});
  
	// Add event listeners for delete actions
	document.querySelectorAll('[data-action="delete"]').forEach(el => {
	  el.addEventListener('click', () => {
		const tabId = el.getAttribute('data-tab-id');
		if (tabId) {
		  deleteTab(tabId);
		}
	  });
	});
  
	// Add event listeners for toggle inputs
	document.querySelectorAll('input[data-input-type="openInNewTab"]').forEach(input => {
	  input.addEventListener('change', () => {
		const tabId = input.getAttribute('data-tab-id');
		if (tabId) {
		  const tab = customTabs.find(t => t.id === tabId);
		  if (tab) {
			tab.openInNewTab = input.checked;
			saveTabsToStorage();
		  }
		}
	  });
	});
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
			  
			  // Special case for ObjectManager: keep the /view suffix
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
			  // Get everything after /o/ and before any query parameters
			  const fullPath = urlParts[1].split('?')[0];
			  
			  // Standard object pages (remove trailing suffixes)
			  path = fullPath.replace(/\/(home|view)$/, '');
			  
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
			// Format the object name from the URL path
			name = formatObjectNameFromURL(path.split('/')[0]);
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
			
			// Extract section from either title or path
			let sectionName = "";
			
			// First try to extract from page title
			if (pageTitle) {
			  const titleParts = pageTitle.split(' | ');
			  
			  // Page title often has the format: "Section Name | Object Name | Object Manager"
			  if (titleParts.length >= 2) {
				// The section name is usually the first part
				sectionName = titleParts[0];
			  }
			}
			
			// If no section name from title, extract from path
			if (!sectionName && pathSegments.length >= 3) {
			  sectionName = pathSegments[2]
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
  
		  // For debugging
		  console.log('Creating tab with path:', path);
		  console.log('Is object page:', isObject);
		  console.log('Is custom URL:', isCustomUrl);
		  console.log('Tab label will be:', name);
  
		  // Create a new tab object
		  const newTab = {
			id: generateId(),
			label: name,
			path: path,
			openInNewTab: false,
			isObject: isObject,
			isCustomUrl: isCustomUrl,
			position: customTabs.length
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
	console.log('Rendering tab list with', customTabs.length, 'tabs');
	
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
		try {
		  const tabItem = createTabElement(tab);
		  tabList.appendChild(tabItem);
		} catch (err) {
		  console.error('Error creating tab element:', err, tab);
		}
	  });
  
	  // Setup drag and drop
	  setupDragAndDrop();
	  
	  // Add event listeners for new tab items
	  addTabItemEventListeners();
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
// Create tab list item element with proper badge alignment
function createTabElement(tab) {
	return SFTabsUtils.domHelpers.createTabElement(tab, userSettings.compactMode);
}

// Create drop indicator element
function createDropIndicator() {
	return SFTabsUtils.domHelpers.createDropIndicator();
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
	return SFTabsUtils.domHelpers.createDragClone(item, width);
}

// Move an element to specified coordinates
function moveElement(element, x, y) {
	SFTabsUtils.domHelpers.moveElement(element, x, y);
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
      // Update basic properties
      tab.label = name;
      tab.path = path;
      tab.openInNewTab = openInNewTabCheckbox.checked;
      
      // Explicitly set the type properties
      tab.isObject = isObject;
      tab.isCustomUrl = isCustomUrl;
      
      // Log the updated tab
      console.log('Updated tab:', tab);
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
      position: customTabs.length
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
	showDeleteConfirmModal(tabId);
}

// Use our custom modal instead of confirm()
function showDeleteConfirmModal(tabId) {
	SFTabsUtils.uiHelpers.showModal(
	  deleteConfirmModal,
	  deleteModalCancelButton,
	  deleteModalConfirmButton,
	  () => {
		console.log('Delete confirmed for tab', tabId);
		// Perform the actual deletion
		customTabs = customTabs.filter(tab => tab.id !== tabId);
		saveTabsToStorage();
	  }
	);
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
	return SFTabsUtils.generateId();
}

// Show status message
function showStatus(message, isError = false) {
	SFTabsUtils.uiHelpers.showStatus(message, isError);
}