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
let panelHeight;
let panelHeightValue;
let settingsResetButton;

// State
let customTabs = [];
let editingTabId = null;
let userSettings = {
	themeMode: 'light',
	panelHeight: 500
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
	panelHeight: 500
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

	// Settings elements
	settingsButton = document.getElementById('settings-button');
	settingsPanel = document.getElementById('settings-panel');
	mainContent = document.getElementById('main-content');
	themeMode = document.getElementById('theme-mode');
	panelHeight = document.getElementById('panel-height');
	panelHeightValue = document.getElementById('panel-height-value');
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

		// Apply panel height
		applyPanelHeight();
	});
});

// Load user settings from storage
function loadUserSettings() {
	console.log('Loading user settings from storage');
	return browser.storage.sync.get('userSettings')
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
	return browser.storage.sync.set({ userSettings })
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
	// Update theme select
	themeMode.value = userSettings.themeMode;

	// Update panel height slider
	panelHeight.value = userSettings.panelHeight;
	panelHeightValue.textContent = `${userSettings.panelHeight}px`;
}

// Reset settings to defaults
function resetSettings() {
	userSettings = { ...defaultSettings };
	saveUserSettings();
	updateSettingsUI();
	applyTheme();
	applyPanelHeight();
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

// Apply panel height
function applyPanelHeight() {
	const container = document.querySelector('.container');
	container.style.minHeight = `${userSettings.panelHeight}px`;
}

// Load tabs from storage
function loadTabsFromStorage() {
	console.log('Loading tabs from storage');
	browser.storage.sync.get('customTabs')
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
	console.log('Saving tabs to storage:', customTabs);
	// Sort tabs by position before saving
	customTabs.sort((a, b) => a.position - b.position);

	browser.storage.sync.set({ customTabs })
		.then(() => {
			console.log('Tabs saved successfully');
			renderTabList();
			showStatus('Settings saved', false);
		})
		.catch((error) => {
			console.error('Error saving tabs to storage:', error);
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

	// Theme mode change
	themeMode.addEventListener('change', () => {
		console.log('Theme mode changed to:', themeMode.value);
		userSettings.themeMode = themeMode.value;
		saveUserSettings();
		applyTheme();
	});

	// Panel height change
	panelHeight.addEventListener('input', () => {
		panelHeightValue.textContent = `${panelHeight.value}px`;
	});

	panelHeight.addEventListener('change', () => {
		console.log('Panel height changed to:', panelHeight.value);
		userSettings.panelHeight = parseInt(panelHeight.value);
		saveUserSettings();
		applyPanelHeight();
	});

	// Enter key in form fields
	tabNameInput.addEventListener('keypress', (e) => {
		if (e.key === 'Enter') saveTabForm();
	});

	tabPathInput.addEventListener('keypress', (e) => {
		if (e.key === 'Enter') saveTabForm();
	});

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
		  // NEW: Handle custom URLs (any other Salesforce URL pattern)
		  else if (currentUrl.includes('.lightning.force.com/') || currentUrl.includes('.salesforce.com/')) {
			isCustomUrl = true;
			
			// Get base domain
			const urlParts = currentUrl.split('.com/');
			if (urlParts.length > 1) {
			  // Extract everything after the domain
			  path = urlParts[1].split('?')[0]; // Remove query parameters
			  
			  // Check for specific custom URL patterns 
			  // (e.g., interaction_explorer, console, visualforce pages, etc.)
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
		  } else {
			// Logic for setup page naming (existing code)
			if (path.startsWith('ObjectManager/')) {
			  // For ObjectManager paths, create a more descriptive label
			  const pathSegments = path.split('/').filter(segment => segment.length > 0);
			  
			  if (pathSegments.length >= 3) {
				// Format: "Object - Section"
				// e.g., "Account - Fields And Relationships"
				const objectName = formatObjectNameFromURL(pathSegments[1]);
				const sectionName = pathSegments[2]
				  .replace(/([A-Z])/g, ' $1') // Add space before uppercase letters
				  .trim();
				
				name = `${objectName} - ${sectionName}`;
			  } else if (pathSegments.length >= 2) {
				// Just the object name if there's no section
				name = formatObjectNameFromURL(pathSegments[1]);
			  } else {
				// Fallback to just "Object Manager"
				name = "Object Manager";
			  }
			} else {
			  // For standard setup pages, extract from the page title or path
			  
			  // Try to extract a better name from the page title if available
			  if (pageTitle) {
				// Remove " | Salesforce" or similar suffix from title
				let cleanTitle = pageTitle.split(' | ')[0];
  
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
			  
			  // If we couldn't get a good name from the title, use the last segment of the path
			  if (!name || name.length === 0) {
				// Get the last non-empty segment of the path
				const pathSegments = path.split('/').filter(segment => segment.length > 0);
				if (pathSegments.length > 0) {
				  name = pathSegments[pathSegments.length - 1]
					// Add space before uppercase letters
					.replace(/([A-Z])/g, ' $1')
					// Clean up any leading space and capitalize first letter
					.replace(/^./, str => str.toUpperCase())
					.trim();
				} else {
				  name = path; // Fallback to the full path
				}
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
// Function to create a tab element with improved layout
function createTabElement(tab) {
	// Create the tab item container
	const tabItem = document.createElement('div');
	tabItem.className = 'tab-item';
	tabItem.dataset.id = tab.id;
	
	// Create the drag handle
	const dragHandle = document.createElement('div');
	dragHandle.className = 'drag-handle';
	dragHandle.innerHTML = '⋮⋮';
	dragHandle.setAttribute('title', 'Drag to reorder');
	
	// Create content container for tab text content
	const contentContainer = document.createElement('div');
	contentContainer.className = 'tab-info'; // Use existing tab-info class for compatibility
	contentContainer.style.display = 'flex';
	contentContainer.style.flexDirection = 'column';
	contentContainer.style.flex = '1';
	contentContainer.style.minWidth = '0'; // Important for text overflow
	
	// Create tab title
	const tabTitle = document.createElement('div');
	tabTitle.className = 'tab-name';
	tabTitle.textContent = tab.label;
	
	// Create tab path container
	const tabPath = document.createElement('div');
	tabPath.className = 'tab-path';
	
	// Create a badge for path type
	const pathType = document.createElement('span');
	const isObject = tab.hasOwnProperty('isObject') ? tab.isObject : false;
	const isCustomUrl = tab.hasOwnProperty('isCustomUrl') ? tab.isCustomUrl : false;
	
	if (isCustomUrl) {
	  pathType.className = 'path-type custom';
	  pathType.textContent = 'Custom';
	} else if (isObject) {
	  pathType.className = 'path-type object';
	  pathType.textContent = 'Object';
	} else {
	  pathType.className = 'path-type setup';
	  pathType.textContent = 'Setup';
	}
	
	// Create path text element
	const pathTextElement = document.createElement('span');
	pathTextElement.className = 'path-text';
	pathTextElement.textContent = tab.path;
	
	// Add elements to tab path in correct order
	tabPath.appendChild(pathType);
	tabPath.appendChild(pathTextElement);
	
	// Add title and path to content container
	contentContainer.appendChild(tabTitle);
	contentContainer.appendChild(tabPath);
	
	// Create container for the toggle and delete buttons
	const actionsContainer = document.createElement('div');
	actionsContainer.className = 'tab-actions';
	
	// Create toggle for "open in new tab"
	const newTabToggle = document.createElement('label');
	newTabToggle.className = 'new-tab-toggle';
	newTabToggle.setAttribute('title', 'Open in new tab');
	
	const toggleInput = document.createElement('input');
	toggleInput.type = 'checkbox';
	toggleInput.checked = tab.openInNewTab;
	toggleInput.style.display = 'none';
	toggleInput.addEventListener('change', () => {
	  tab.openInNewTab = toggleInput.checked;
	  saveTabsToStorage();
	});
	
	const toggleSwitch = document.createElement('span');
	toggleSwitch.className = 'toggle-switch';
	
	newTabToggle.appendChild(toggleInput);
	newTabToggle.appendChild(toggleSwitch);
	
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
	actionsContainer.appendChild(newTabToggle);
	actionsContainer.appendChild(deleteButton);
	
	// Add click handler for editing
	contentContainer.addEventListener('click', () => {
	  editTab(tab.id);
	});
	
	// Add all elements to the tab item in the correct order
	tabItem.appendChild(dragHandle);
	tabItem.appendChild(contentContainer);
	tabItem.appendChild(actionsContainer);
	
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

// Save tab form data
function saveTabForm() {
	console.log('Saving tab form');
	const name = tabNameInput.value.trim();
	const path = tabPathInput.value.trim();
  
	if (!name || !path) {
	  showStatus('Tab name and path are required', true);
	  return;
	}
  
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
		tab.label = name;
		tab.path = path;
		tab.openInNewTab = openInNewTabCheckbox.checked;
		tab.isObject = isObject;
		tab.isCustomUrl = isCustomUrl;
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
	showModal(
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
	return 'tab_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
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