// popup/js/popup-dropdown.js
// Dropdown functionality for Object Manager navigation

/**
 * Setup Object Dropdown - Parse navigation from current page
 */
async function setupObjectDropdown() {
	console.log('Setting up object dropdown...');
	console.log('Editing tab ID:', SFTabs.main.editingTabId);
	console.log('Current action panel tab:', SFTabs.main.currentActionPanelTab);

	// Get UI elements
	const setupDropdownButton = document.getElementById('setup-dropdown-button');

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
		console.log('Response structure:', {
			success: response.success,
			navigationCount: response.navigation?.length,
			objectName: response.objectName,
			pageInfo: response.pageInfo,
			currentUrl: response.currentUrl
		});

		// Accept both 'items' and 'navigation' response formats
		const navigationItems = response.items || response.navigation;

		if (response && response.success && navigationItems && navigationItems.length > 0) {
			// Get all tabs
			const tabs = SFTabs.main.getTabs();

			console.log('Available tabs:', tabs.length);
			console.log('Response:', response);
			console.log('Response object name:', response.objectName);
			console.log('Response current URL:', response.currentUrl);

			// Find the tab being edited
			const editingTabId = SFTabs.main.editingTabId || SFTabs.main.getEditingTabId();
			let currentTab = null;

			// Primary approach: Use editingTabId (set when clicking on a tab to edit it inline)
			if (editingTabId) {
				currentTab = tabs.find(t => t.id === editingTabId);
				if (currentTab) {
					console.log('✓ Using editingTabId:', currentTab.label);
				}
			}

			// Fallback: Try other approaches if editingTabId not set
			if (!currentTab) {
				// Try currentActionPanelTab (for action panel workflow)
				currentTab = SFTabs.main.currentActionPanelTab || SFTabs.main.getCurrentActionPanelTab();
				if (currentTab) {
					console.log('✓ Using currentActionPanelTab:', currentTab.label);
				}
			}

			// Last resort: Match by URL or objectName
			if (!currentTab && response.objectName) {
				const objectManagerPath = `ObjectManager/${response.objectName}`;
				currentTab = tabs.find(t => t.path && t.path.includes(objectManagerPath));
				if (currentTab) {
					console.log('✓ Found tab by objectName:', currentTab.label, currentTab.path);
				}
			}

			if (!currentTab && response.currentUrl) {
				const urlMatch = response.currentUrl.match(/\/lightning\/setup\/(.+?)(\?|$)/);
				if (urlMatch) {
					const urlPath = urlMatch[1];
					console.log('Extracted URL path:', urlPath);
					currentTab = tabs.find(t => t.path && urlPath.startsWith(t.path));
					if (currentTab) {
						console.log('✓ Found tab by URL match:', currentTab.label, currentTab.path);
					}
				}
			}

			if (!currentTab) {
				console.log('✗ No matching tab found');
				console.log('editingTabId:', editingTabId);
				console.log('Available tabs:', tabs.map(t => ({ id: t.id, label: t.label, path: t.path })));
			}

			if (currentTab) {
				const tab = tabs.find(t => t.id === currentTab.id);
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
					tab.dropdownItems = navigationItems;

					console.log('✅ Dropdown setup complete!', {
						tabId: tab.id,
						label: tab.label,
						hasDropdown: tab.hasDropdown,
						itemCount: tab.dropdownItems.length,
						firstItem: tab.dropdownItems[0]?.label
					});

					// Show preview
					showDropdownPreview(navigationItems);

					// Save to storage
					await SFTabs.storage.saveTabs(tabs);

					// Update the current action panel tab reference
					SFTabs.main.setCurrentActionPanelTab(tab);

					SFTabs.main.showStatus('Dropdown menu created successfully!');
				} else {
					console.error('❌ Tab not found in customTabs array:', currentTab.id);
					throw new Error('Tab not found in storage');
				}
			} else {
				console.error('❌ No matching tab found for this Object Manager page');
				const objectName = response.objectName || 'Unknown';
				throw new Error(`No tab found for ${objectName}. Please create a tab for this page first using the Quick Add (⚡) button.`);
			}
		} else {
			throw new Error(response?.error || 'Failed to parse navigation - no items found');
		}

	} catch (error) {
		console.error('Error setting up dropdown:', error);
		const errorMessage = error.message.includes('settings panel')
			? error.message
			: 'Failed to create dropdown: ' + error.message;
		SFTabs.main.showStatus(errorMessage, true);
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
	const dropdownItemsPreview = document.getElementById('dropdown-items-preview');
	const dropdownItemsList = document.getElementById('dropdown-items-list');
	const dropdownCount = document.getElementById('dropdown-count');

	if (!items || items.length === 0) {
		dropdownItemsPreview.style.display = 'none';
		return;
	}

	// Update count
	dropdownCount.textContent = items.length;

	// Clear existing items
	dropdownItemsList.innerHTML = '';

	// Add items with delete buttons
	items.forEach((item, index) => {
		const itemDiv = document.createElement('div');
		itemDiv.style.padding = '4px 0';
		itemDiv.style.borderBottom = index < items.length - 1 ? '1px solid #dddbda' : 'none';
		itemDiv.style.display = 'flex';
		itemDiv.style.justifyContent = 'space-between';
		itemDiv.style.alignItems = 'center';

		const labelSpan = document.createElement('span');
		labelSpan.textContent = `${index + 1}. ${item.label}`;
		labelSpan.style.flex = '1';

		const deleteButton = document.createElement('button');
		deleteButton.type = 'button'; // Prevent form submission
		deleteButton.textContent = '×';
		deleteButton.style.background = 'none';
		deleteButton.style.border = 'none';
		deleteButton.style.color = '#c23934';
		deleteButton.style.fontSize = '18px';
		deleteButton.style.cursor = 'pointer';
		deleteButton.style.padding = '0 4px';
		deleteButton.style.lineHeight = '1';
		deleteButton.title = 'Remove this item';

		deleteButton.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			removeDropdownItem(index);
		});

		itemDiv.appendChild(labelSpan);
		itemDiv.appendChild(deleteButton);
		dropdownItemsList.appendChild(itemDiv);
	});

	// Show preview
	dropdownItemsPreview.style.display = 'block';
}

/**
 * Remove a dropdown item by index
 */
function removeDropdownItem(index) {
	const currentTab = SFTabs.main.currentActionPanelTab;
	if (!currentTab) return;

	const tabs = SFTabs.main.customTabs;
	const tab = tabs.find(t => t.id === currentTab.id);
	if (!tab || !tab.dropdownItems) return;

	// Remove the item
	tab.dropdownItems.splice(index, 1);

	// Update the preview
	showDropdownPreview(tab.dropdownItems);

	// Don't save immediately - let the user click Save button to commit changes
	// This allows removing multiple items before saving
}

/**
 * Initialize dropdown event listeners
 */
function initDropdownListeners() {
	const setupDropdownButton = document.getElementById('setup-dropdown-button');
	const refreshDropdownButton = document.getElementById('refresh-dropdown-button');

	// Setup Dropdown button
	if (setupDropdownButton) {
		setupDropdownButton.addEventListener('click', async () => {
			console.log('Setup Dropdown button clicked');
			await setupObjectDropdown();
		});
	}

	// Refresh Dropdown button
	if (refreshDropdownButton) {
		refreshDropdownButton.addEventListener('click', async () => {
			console.log('Refresh Dropdown button clicked');
			await setupObjectDropdown();
		});
	}
}

// Export to SFTabs namespace
window.SFTabs = window.SFTabs || {};
window.SFTabs.dropdowns = {
	setupObjectDropdown,
	showDropdownPreview,
	removeDropdownItem,
	setupEventListeners: initDropdownListeners
};
