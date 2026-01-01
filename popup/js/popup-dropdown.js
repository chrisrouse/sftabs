// popup/js/popup-dropdown.js
// Dropdown functionality for Object Manager navigation

/**
 * Setup Object Dropdown - Parse navigation from current page
 */
async function setupObjectDropdown() {

	// Get UI elements from the action panel (not the old tab-form)
	const setupDropdownButton = document.querySelector('#action-object-dropdown-section #setup-dropdown-button');

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


		// Accept both 'items' and 'navigation' response formats
		const navigationItems = response.items || response.navigation;

		if (response && response.success && navigationItems && navigationItems.length > 0) {
			// Check if the current page is an ObjectManager page
			if (!response.pageInfo || response.pageInfo.type !== 'objectManager') {
				const objectName = response.objectName || response.pageInfo?.objectName || 'the object';
				throw new Error(`Go to ${objectName} in Setup to refresh the list.`);
			}

			// Get all tabs
			const tabs = SFTabs.main.getTabs();


			// Find the tab being edited
			const editingTabId = SFTabs.main.editingTabId || SFTabs.main.getEditingTabId();
			let currentTab = null;

			// Primary approach: Use currentActionPanelTab (for action panel workflow)
			currentTab = SFTabs.main.getCurrentActionPanelTab();
			if (currentTab) {
			}

			// Fallback: Use editingTabId (set when clicking on a tab to edit it in old form)
			if (!currentTab && editingTabId) {
				currentTab = tabs.find(t => t.id === editingTabId);
				if (currentTab) {
					// Store this as the current action panel tab so we can save to it later
					SFTabs.main.setCurrentActionPanelTab(currentTab);
				}
			}

			// Last resort: Match by URL or objectName
			if (!currentTab && response.objectName) {
				const objectManagerPath = `ObjectManager/${response.objectName}`;
				currentTab = tabs.find(t => t.path && t.path.includes(objectManagerPath));
				if (currentTab) {
				}
			}

			if (!currentTab && response.currentUrl) {
				const urlMatch = response.currentUrl.match(/\/lightning\/setup\/(.+?)(\?|$)/);
				if (urlMatch) {
					const urlPath = urlMatch[1];
					currentTab = tabs.find(t => t.path && urlPath.startsWith(t.path));
					if (currentTab) {
					}
				}
			}

			if (!currentTab) {
			}

			if (currentTab) {
				// Validate that the current page matches the tab being edited
				// Extract object name from the current page
				const currentObjectName = response.pageInfo?.objectName;

				// Check if the tab's path matches the current Object Manager page
				let tabMatchesCurrentPage = false;
				if (currentTab.path && currentTab.path.includes('ObjectManager/')) {
					const tabObjectName = currentTab.path.split('ObjectManager/')[1]?.split('/')[0];
					tabMatchesCurrentPage = tabObjectName === currentObjectName;
				}

				if (!tabMatchesCurrentPage) {
					throw new Error(`This tab is for "${currentTab.label}" but you're viewing the "${currentObjectName}" Object Manager page. Please navigate to the correct Object Manager page for this tab before setting up the dropdown.`);
				}

				// Store the parsed navigation items temporarily (not saved until user clicks Save)
				// We'll use the currentActionPanelTab reference to hold this temporarily

				// Show preview with the parsed items
				showDropdownPreview(navigationItems);

				// Store the pending dropdown items in a temporary property on the current tab reference
				// This will be saved when the user clicks Save in the action panel
				const actionPanelTab = SFTabs.main.getCurrentActionPanelTab();
				if (actionPanelTab) {
					actionPanelTab.pendingDropdownItems = navigationItems;
				} else {
				}

				// Scroll the dropdown preview into view so user can see it immediately
				const dropdownPreview = document.getElementById('dropdown-items-preview');
				if (dropdownPreview) {
					setTimeout(() => {
						dropdownPreview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
					}, 100);
				}

				SFTabs.main.showStatus('Navigation items loaded. Click Save to apply changes.');
			} else {
				const objectName = response.objectName || 'Unknown';
				throw new Error(`No tab found for ${objectName}. Please create a tab for this page first using the Quick Add (⚡) button.`);
			}
		} else {
			throw new Error(response?.error || 'Failed to parse navigation - no items found');
		}

	} catch (error) {
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

	// Get the setup button and help text elements FROM THE ACTION PANEL (not the old tab-form)
	// The action panel uses #action-object-dropdown-section, not #object-dropdown-section
	const setupButton = document.querySelector('#action-object-dropdown-section #setup-dropdown-button');
	const helpText = document.querySelector('#action-object-dropdown-section .help-text');

	if (!items || items.length === 0) {
		dropdownItemsPreview.style.display = 'none';
		// Show button and help text when no items exist
		if (setupButton) {
			setupButton.style.display = 'block';
		}
		if (helpText) {
			helpText.style.display = 'block';
		}
		return;
	}

	// Hide the setup button and help text when items exist
	if (setupButton) {
		setupButton.style.display = 'none';
	}
	if (helpText) {
		helpText.style.display = 'none';
	}

	// Update count
	dropdownCount.textContent = items.length;

	// Clear existing items
	dropdownItemsList.innerHTML = '';

	// Add items with delete buttons
	items.forEach((item, index) => {
		const itemDiv = document.createElement('div');
		itemDiv.className = 'dropdown-item-draggable';
		itemDiv.dataset.index = index;
		itemDiv.style.padding = '4px 0';
		itemDiv.style.borderBottom = index < items.length - 1 ? '1px solid #dddbda' : 'none';
		itemDiv.style.display = 'flex';
		itemDiv.style.justifyContent = 'space-between';
		itemDiv.style.alignItems = 'center';
		itemDiv.style.cursor = 'grab';

		// Drag handle
		const dragHandle = SFTabs.shared.createDragHandle();

		const labelSpan = document.createElement('span');
		labelSpan.className = 'dropdown-item-label';
		labelSpan.textContent = `${index + 1}. ${item.label}`;
		labelSpan.style.flex = '1';

		// Button container
		const buttonContainer = SFTabs.shared.createButtonContainer();

		// Edit button
		const editButton = SFTabs.shared.createListActionButton('edit', {
			text: 'Edit',
			title: 'Edit this item',
			onClick: () => editObjectDropdownItem(index)
		});

		// Promote button
		const promoteButton = SFTabs.shared.createListActionButton('promote', {
			text: '↑',
			title: 'Promote to main tab',
			onClick: () => promoteObjectDropdownItem(index)
		});

		// Delete button
		const deleteButton = SFTabs.shared.createListActionButton('delete', {
			text: '×',
			title: 'Remove this item',
			onClick: () => removeDropdownItem(index)
		});

		buttonContainer.appendChild(editButton);
		buttonContainer.appendChild(promoteButton);
		buttonContainer.appendChild(deleteButton);

		itemDiv.appendChild(dragHandle);
		itemDiv.appendChild(labelSpan);
		itemDiv.appendChild(buttonContainer);
		dropdownItemsList.appendChild(itemDiv);

		// Add drag-and-drop support
		setupObjectDropdownItemDragHandlers(itemDiv);
	});

	// Show preview
	dropdownItemsPreview.style.display = 'block';
}

/**
 * Remove a dropdown item by index
 */
function removeDropdownItem(index) {

	const currentTab = SFTabs.main.getCurrentActionPanelTab();

	if (!currentTab) {
		return;
	}

	// Check if we have pending dropdown items (not yet saved - from "Setup as Object Dropdown")
	if (currentTab.pendingDropdownItems && currentTab.pendingDropdownItems.length > 0) {
		// Remove from pending items
		currentTab.pendingDropdownItems.splice(index, 1);
		showDropdownPreview(currentTab.pendingDropdownItems);
	} else if (currentTab.stagedDropdownItems && currentTab.stagedDropdownItems.length > 0) {
		// Remove from staged items (user is editing existing dropdown)
		currentTab.stagedDropdownItems.splice(index, 1);
		showDropdownPreview(currentTab.stagedDropdownItems);
	} else {
		// Fallback: Remove from saved dropdown items directly
		const tabs = SFTabs.main.getTabs();
		const tab = tabs.find(t => t.id === currentTab.id);
		if (!tab || !tab.dropdownItems) {
			return;
		}

		// Create staged items from existing and remove the item
		currentTab.stagedDropdownItems = JSON.parse(JSON.stringify(tab.dropdownItems));
		currentTab.stagedDropdownItems.splice(index, 1);

		// Update the preview
		showDropdownPreview(tab.dropdownItems);
	}

	// Don't save immediately - let the user click Save button to commit changes
	// This allows removing multiple items before saving
}

/**
 * Edit an object dropdown item by index
 */
function editObjectDropdownItem(index) {

	const currentTab = SFTabs.main.getCurrentActionPanelTab();
	if (!currentTab) {
		return;
	}

	// Get the item from either pending or saved dropdown items
	let dropdownItem;
	if (currentTab.pendingDropdownItems && currentTab.pendingDropdownItems.length > 0) {
		dropdownItem = currentTab.pendingDropdownItems[index];
	} else {
		const tabs = SFTabs.main.customTabs;
		const tab = tabs.find(t => t.id === currentTab.id);
		if (tab && tab.dropdownItems) {
			dropdownItem = tab.dropdownItems[index];
		}
	}

	if (!dropdownItem) {
		SFTabs.main.showStatus('Dropdown item not found', true);
		return;
	}

	// Create a temporary tab object for editing
	const tempTab = {
		id: `dropdown-${currentTab.id}-${index}`,
		label: dropdownItem.label,
		path: dropdownItem.path || '',
		openInNewTab: false,
		isObject: dropdownItem.isObject || false,
		isCustomUrl: dropdownItem.isCustomUrl || false,
		isSetupObject: false,
		_isDropdownItemEdit: true,
		_parentTabId: currentTab.id,
		_dropdownItemIndex: index
	};

	// Open the action panel with this temp tab
	if (SFTabs.main && SFTabs.main.showActionPanel) {
		SFTabs.main.showActionPanel(tempTab);
	}
}

/**
 * Promote an object dropdown item to main tab by index
 */
function promoteObjectDropdownItem(index) {

	const currentTab = SFTabs.main.getCurrentActionPanelTab();
	if (!currentTab) {
		return;
	}

	// Get the item from either pending or saved dropdown items
	let dropdownItems;
	let dropdownItem;
	if (currentTab.pendingDropdownItems && currentTab.pendingDropdownItems.length > 0) {
		dropdownItems = currentTab.pendingDropdownItems;
		dropdownItem = dropdownItems[index];
	} else {
		const tabs = SFTabs.main.customTabs;
		const tab = tabs.find(t => t.id === currentTab.id);
		if (tab && tab.dropdownItems) {
			dropdownItems = tab.dropdownItems;
			dropdownItem = dropdownItems[index];
		}
	}

	if (!dropdownItem) {
		SFTabs.main.showStatus('Dropdown item not found', true);
		return;
	}

	// Initialize stagedDropdownItems if needed
	if (!currentTab.stagedDropdownItems) {
		currentTab.stagedDropdownItems = dropdownItems ? [...dropdownItems] : [];
	}

	// Remove the item from staged dropdown items
	currentTab.stagedDropdownItems.splice(index, 1);

	// Store the promoted item temporarily so we can apply it on Save
	if (!currentTab.stagedPromotions) {
		currentTab.stagedPromotions = [];
	}
	currentTab.stagedPromotions.push({
		label: dropdownItem.label,
		path: dropdownItem.path || '',
		isObject: dropdownItem.isObject || false,
		isCustomUrl: dropdownItem.isCustomUrl || false,
		dropdownItems: dropdownItem.dropdownItems || []
	});

	// Show status message
	SFTabs.main.showStatus(`"${dropdownItem.label}" will be promoted when you click Save`);

	// Refresh the preview with staged items
	showDropdownPreview(currentTab.stagedDropdownItems);
}

/**
 * Setup drag-and-drop handlers for object dropdown items
 */
function setupObjectDropdownItemDragHandlers(itemDiv) {
	let draggedItem = null;

	itemDiv.addEventListener('mousedown', (e) => {
		// Don't start drag if clicking on buttons
		if (e.target.closest('button')) {
			return;
		}

		// Prevent text selection during drag
		e.preventDefault();

		draggedItem = itemDiv;
		itemDiv.style.cursor = 'grabbing';
		itemDiv.style.opacity = '0.5';
		itemDiv.style.userSelect = 'none';

		const container = itemDiv.parentElement;

		// Disable text selection on the document during drag
		document.body.style.userSelect = 'none';

		function onMouseMove(event) {
			event.preventDefault();

			// Find which item we're hovering over
			const afterElement = getObjectDropdownDragAfterElement(container, event.clientY);

			if (afterElement == null) {
				container.appendChild(draggedItem);
			} else {
				container.insertBefore(draggedItem, afterElement);
			}
		}

		function onMouseUp() {
			itemDiv.style.cursor = 'grab';
			itemDiv.style.opacity = '1';
			itemDiv.style.userSelect = '';

			// Re-enable text selection
			document.body.style.userSelect = '';

			document.removeEventListener('mousemove', onMouseMove);
			document.removeEventListener('mouseup', onMouseUp);

			// Save the new order
			saveObjectDropdownItemOrder(container);
		}

		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseup', onMouseUp);
	});
}

/**
 * Get the element to insert before during drag
 */
function getObjectDropdownDragAfterElement(container, y) {
	const draggableElements = [...container.querySelectorAll('.dropdown-item-draggable:not([style*="opacity: 0.5"])')]
		.filter(el => el.style.opacity !== '0.5');

	return draggableElements.reduce((closest, child) => {
		const box = child.getBoundingClientRect();
		const offset = y - box.top - box.height / 2;

		if (offset < 0 && offset > closest.offset) {
			return { offset: offset, element: child };
		} else {
			return closest;
		}
	}, { offset: Number.NEGATIVE_INFINITY }).element;
}

/**
 * Save the new object dropdown item order after drag-and-drop
 */
function saveObjectDropdownItemOrder(container) {
	const items = Array.from(container.querySelectorAll('.dropdown-item-draggable'));
	const newOrder = items.map(item => parseInt(item.dataset.index));

	// Get current tab
	const currentTab = SFTabs.main.getCurrentActionPanelTab();
	if (!currentTab) {
		return;
	}

	let reorderedItems;

	// Check if we have pending dropdown items (not yet saved)
	if (currentTab.pendingDropdownItems && currentTab.pendingDropdownItems.length > 0) {
		// Reorder pending items
		reorderedItems = newOrder.map(oldIndex => currentTab.pendingDropdownItems[oldIndex]);
		currentTab.pendingDropdownItems = reorderedItems;
	} else if (currentTab.stagedDropdownItems && currentTab.stagedDropdownItems.length > 0) {
		// Reorder staged items (user is editing existing dropdown)
		reorderedItems = newOrder.map(oldIndex => currentTab.stagedDropdownItems[oldIndex]);
		currentTab.stagedDropdownItems = reorderedItems;
	} else if (currentTab.dropdownItems && currentTab.dropdownItems.length > 0) {
		// Reorder saved items - create staged items first
		reorderedItems = newOrder.map(oldIndex => currentTab.dropdownItems[oldIndex]);
		currentTab.stagedDropdownItems = reorderedItems;
	}

	// Update the numbering and dataset.index without re-rendering the entire list
	if (reorderedItems) {
		items.forEach((itemDiv, newIndex) => {
			// Update the dataset.index to reflect new position
			itemDiv.dataset.index = newIndex;

			// Update the label text with new numbering
			const labelSpan = itemDiv.querySelector('.dropdown-item-label');
			if (labelSpan && reorderedItems[newIndex]) {
				labelSpan.textContent = `${newIndex + 1}. ${reorderedItems[newIndex].label}`;
			}
		});
	}
}

/**
 * Initialize dropdown event listeners
 */
function initDropdownListeners() {
	// Get buttons from the action panel (not the old tab-form)
	const setupDropdownButton = document.querySelector('#action-object-dropdown-section #setup-dropdown-button');
	const refreshDropdownButton = document.getElementById('refresh-dropdown-button');

	// Setup Dropdown button
	if (setupDropdownButton) {
		setupDropdownButton.addEventListener('click', async () => {
			await setupObjectDropdown();
		});
	}

	// Refresh Dropdown button
	if (refreshDropdownButton) {
		refreshDropdownButton.addEventListener('click', async () => {
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
