// popup/js/popup-ui.js
// UI rendering and form handling

/**
 * Render the main tab list
 */
function renderTabList() {
  const domElements = SFTabs.main.getDOMElements();
  console.log('Rendering enhanced tab list');
  
  // Clear existing list
  while (domElements.tabList.firstChild) {
    domElements.tabList.removeChild(domElements.tabList.firstChild);
  }

  // Get only top-level tabs
  const topLevelTabs = SFTabs.utils.getTopLevelTabs(SFTabs.main.getTabs());

  // Show empty state if no tabs
  if (topLevelTabs.length === 0) {
    domElements.emptyState.style.display = 'block';
  } else {
    domElements.emptyState.style.display = 'none';

    // Create tab items (including their dropdown functionality)
    topLevelTabs.forEach((tab) => {
      const tabItem = createTabElement(tab);
      domElements.tabList.appendChild(tabItem);
    });

    // Setup drag and drop functionality
    setupDragAndDrop();
  }
}

/**
 * Create a complete tab element with enhanced dropdown functionality
 */
function createTabElement(tab) {
  const tabItem = document.createElement('div');
  tabItem.className = 'tab-item';
  tabItem.dataset.id = tab.id;
  
  // Check if this tab should have a dropdown (using dropdownItems for object-dropdowns implementation)
  const hasAnyDropdown = tab.hasDropdown && tab.dropdownItems && tab.dropdownItems.length > 0;
  
  if (hasAnyDropdown) {
    tabItem.classList.add('has-dropdown');
  }

  // Create drag handle
  const dragHandle = document.createElement('div');
  dragHandle.className = 'drag-handle';
  dragHandle.innerHTML = '⋮⋮';
  dragHandle.setAttribute('title', 'Drag to reorder');
  
  // Create content container
  const contentContainer = createTabContent(tab, hasAnyDropdown);
  
  // Create actions container
  const actionsContainer = createTabActions(tab);
  
  // Assemble tab
  tabItem.appendChild(dragHandle);
  tabItem.appendChild(contentContainer);
  tabItem.appendChild(actionsContainer);
  
  // Note: Dropdown functionality is handled in the content script on the Salesforce page,
  // not in the popup UI for the object-dropdowns implementation
  
  return tabItem;
}


/**
 * Create tab content area
 */
function createTabContent(tab, hasDropdown) {
  const contentContainer = document.createElement('div');
  contentContainer.className = 'tab-info';
  
  const tabName = document.createElement('div');
  tabName.className = 'tab-name';
  tabName.textContent = tab.label;
  
  const badgeInfo = getTabBadgeInfo(tab);
  const settings = SFTabs.main.getUserSettings();
  
  if (settings.compactMode) {
    createCompactTabContent(contentContainer, tab, tabName, badgeInfo, hasDropdown);
  } else {
    createRegularTabContent(contentContainer, tab, tabName, badgeInfo, hasDropdown);
  }

  // Add click handlers
  addTabContentClickHandlers(tab, contentContainer, tabName, hasDropdown);
  
  return contentContainer;
}

/**
 * Create compact mode tab content
 */
function createCompactTabContent(container, tab, tabName, badgeInfo, hasDropdown) {
  const tabItem = container.closest('.tab-item');
  if (tabItem) {
    tabItem.classList.add('compact-mode');
  }
  
  const badgeShort = badgeInfo.text.charAt(0);
  const pathType = document.createElement('span');
  pathType.className = 'path-type-compact ' + badgeInfo.class;
  pathType.textContent = badgeShort;
  
  const badgeWrapper = document.createElement('div');
  badgeWrapper.style.display = 'flex';
  badgeWrapper.style.alignItems = 'flex-start';
  badgeWrapper.style.paddingTop = '3px';
  badgeWrapper.appendChild(pathType);
  
  container.style.display = 'flex';
  container.style.flexDirection = 'row';
  container.style.flex = '1';
  container.style.minWidth = '0';
  container.style.alignItems = 'flex-start';
  
  container.appendChild(badgeWrapper);

  const textContainer = document.createElement('div');
  textContainer.style.marginLeft = '8px';
  textContainer.style.flex = '1';
  textContainer.style.minWidth = '0';
  textContainer.appendChild(tabName);

  container.appendChild(textContainer);
  
  tabName.style.wordBreak = 'break-word';
  tabName.style.overflow = 'hidden';
  tabName.style.paddingTop = '3px';
}

/**
 * Create regular mode tab content
 */
function createRegularTabContent(container, tab, tabName, badgeInfo, hasDropdown) {
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.flex = '1';
  container.style.minWidth = '0';
  container.appendChild(tabName);
  
  // Add path display
  const tabPath = document.createElement('div');
  tabPath.className = 'tab-path';
  
  const pathType = document.createElement('span');
  pathType.className = 'path-type ' + badgeInfo.class;
  pathType.textContent = badgeInfo.text;
  
  const pathTextElement = document.createElement('span');
  pathTextElement.className = 'path-text';
  pathTextElement.textContent = tab.path;
  
  tabPath.appendChild(pathType);
  tabPath.appendChild(pathTextElement);
  container.appendChild(tabPath);
}

/**
 * Add click handlers to tab content
 */
function addTabContentClickHandlers(tab, contentContainer, tabName, hasDropdown) {
  // For all tabs:
  // - Single click opens edit form
  // - Double click navigates to the tab
  contentContainer.addEventListener('click', (e) => {
    e.stopPropagation();
    editTab(tab.id);
  });

  // Double click for navigation
  contentContainer.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    navigateToTab(tab);
  });
}

/**
 * Navigate to a tab 
 */
function navigateToTab(tab) {
  console.log('Navigating to tab:', tab.label);
  
  // Build URL based on tab type - using the working logic from original
  const currentUrl = window.location.href;
  const baseUrlSetup = currentUrl.split('/lightning/setup/')[0] + '/lightning/setup/';
  const baseUrlObject = currentUrl.split('/lightning/setup/')[0] + '/lightning/o/';
  const baseUrlRoot = currentUrl.split('/lightning/setup/')[0];
  
  let fullUrl = '';
  const isObject = tab.hasOwnProperty('isObject') ? tab.isObject : false;
  const isCustomUrl = tab.hasOwnProperty('isCustomUrl') ? tab.isCustomUrl : false;
  
  if (isCustomUrl) {
    // For custom URLs, ensure there's a leading slash
    let formattedPath = tab.path;
    
    if (!formattedPath.startsWith('/')) {
      formattedPath = '/' + formattedPath;
    }
    
    fullUrl = `${baseUrlRoot}${formattedPath}`;
  } else if (isObject) {
    // Object URLs: don't add /home suffix - use the path as is
    fullUrl = `${baseUrlObject}${tab.path}`;
  } else if (tab.path.includes('ObjectManager/')) {
    // ObjectManager URLs don't need /home
    fullUrl = `${baseUrlSetup}${tab.path}`;
  } else {
    // Setup URLs need /home at the end
    fullUrl = `${baseUrlSetup}${tab.path}/home`;
  }
  
  console.log('Generated URL:', fullUrl);
  
  if (tab.openInNewTab) {
    window.open(fullUrl, '_blank');
  } else {
    // Check Lightning Navigation setting
    const lightningEnabled = SFTabs.main.getUserSettings().lightningNavigation;
    
    if (lightningEnabled) {
      // For same-tab navigation, send message to content script
      browser.tabs.query({ active: true, currentWindow: true })
        .then(tabs => {
          if (tabs[0]) {
            browser.tabs.sendMessage(tabs[0].id, {
              action: 'navigate_to_url',
              url: fullUrl,
              useLightning: true
            });
          }
        })
        .catch(() => {
          // Fallback: direct navigation
          window.location.href = fullUrl;
        });
    } else {
      // Regular navigation
      window.location.href = fullUrl;
    }
  }
  
  // Close popup
  window.close();
}

/**
 * Fallback URL builder if utils not available
 */
function buildFullUrlFallback(tab) {
  const baseUrl = window.location.origin;
  
  if (tab.isCustomUrl) {
    let formattedPath = tab.path;
    if (!formattedPath.startsWith('/')) {
      formattedPath = '/' + formattedPath;
    }
    return `${baseUrl}${formattedPath}`;
  } else if (tab.isObject) {
    return `${baseUrl}/lightning/o/${tab.path}`;
  } else {
    let fullPath;
    if (tab.path.includes('ObjectManager/')) {
      fullPath = tab.path;
    } else {
      fullPath = `${tab.path}/home`;
    }
    return `${baseUrl}/lightning/setup/${fullPath}`;
  }
}

/**
 * Create tab actions (action panel button, new tab toggle and delete button)
 */
function createTabActions(tab) {
  const actionsContainer = document.createElement('div');
  actionsContainer.className = 'tab-actions';

  // Create action panel button (new + icon button)
  const actionPanelButton = document.createElement('button');
  actionPanelButton.className = 'action-panel-button';
  actionPanelButton.setAttribute('title', 'Tab actions');
  actionPanelButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  `;

  actionPanelButton.addEventListener('click', (e) => {
    e.stopPropagation();
    console.log('Action panel button clicked for tab:', tab);
    if (SFTabs.main && SFTabs.main.showActionPanel) {
      // Pass the tab object to the action panel
      console.log('Calling showActionPanel with tab:', tab);
      SFTabs.main.showActionPanel(tab);
    } else {
      console.error('SFTabs.main.showActionPanel not available!');
    }
  });

  // Create new tab toggle button
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

  newTabButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
      <polyline points="15 3 21 3 21 9"></polyline>
      <line x1="10" y1="14" x2="21" y2="3"></line>
    </svg>
  `;

  newTabButton.addEventListener('click', (e) => {
    e.stopPropagation();

    const newOpenInNewTab = !tab.openInNewTab;

    // Update button appearance
    if (newOpenInNewTab) {
      newTabButton.classList.remove('new-tab-disabled');
      newTabButton.classList.add('new-tab-enabled');
      newTabButton.setAttribute('title', 'Opens in new tab (click to change)');
    } else {
      newTabButton.classList.remove('new-tab-enabled');
      newTabButton.classList.add('new-tab-disabled');
      newTabButton.setAttribute('title', 'Opens in same tab (click to change)');
    }

    // Update tab and save
    SFTabs.tabs.updateTab(tab.id, { openInNewTab: newOpenInNewTab });
  });

  // Create delete button
  const deleteButton = document.createElement('button');
  deleteButton.className = 'delete-button';
  deleteButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
      <path fill-rule="evenodd" d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.405 15h5.19c.9 0 1.652-.681 1.741-1.576l.66-6.6a.75.75 0 00-1.492-.149l-.66 6.6a.25.25 0 01-.249.225h-5.19a.25.25 0 01-.249-.225l-.66-6.6z"></path>
    </svg>
  `;
  deleteButton.setAttribute('title', 'Remove tab');
  deleteButton.addEventListener('click', (e) => {
    e.stopPropagation();
    SFTabs.tabs.deleteTab(tab.id);
  });

  // Add buttons to actions container
  actionsContainer.appendChild(actionPanelButton);
  actionsContainer.appendChild(newTabButton);
  actionsContainer.appendChild(deleteButton);

  return actionsContainer;
}

/**
 * Get badge information for a tab
 */
function getTabBadgeInfo(tab) {
  let badgeText = 'Setup';
  let badgeClass = 'setup';
  
  if (tab.isCustomUrl) {
    badgeText = 'Custom';
    badgeClass = 'custom';
  } else if (tab.isObject) {
    badgeText = 'Object';
    badgeClass = 'object';
  } else if (tab.isSetupObject) {
    badgeText = 'Setup';
    badgeClass = 'setup';
  }
  
  return { text: badgeText, class: badgeClass };
}

/**
 * Show tab form
 */
function showTabForm(tabId = null) {
  const domElements = SFTabs.main.getDOMElements();
  console.log('Showing tab form', { tabId });

  // Reset form
  resetTabForm();

  if (tabId) {
    // Edit mode
    populateFormForEdit(tabId);
    
    // Position form after the tab element
    const tabElement = document.querySelector(`.tab-item[data-id="${tabId}"]`);
    if (tabElement) {
      tabElement.after(domElements.tabForm);
      ensureFormVisible(tabElement);
    } else {
      domElements.tabList.after(domElements.tabForm);
    }
  } else {
    // Add mode
    SFTabs.main.setEditingTabId(null);

    // Set form title if it exists (optional element)
    if (domElements.formTitle) {
      domElements.formTitle.textContent = 'Add New Tab';
    }

    // Auto-detect current page for setup objects
    autoDetectCurrentPage();

    domElements.tabList.after(domElements.tabForm);
  }

  // Update dropdown control visibility and show form
  updateDropdownControlVisibility();
  domElements.tabForm.style.display = 'block';

  // No need to focus since all main fields are now in action panel
  // Dropdown form is for advanced settings only
}

/**
 * Reset the tab form to initial state
 */
function resetTabForm() {
  // All form fields have been moved to action panel
  // Only need to hide dropdown preview
  const dropdownItemsPreview = document.getElementById('dropdown-items-preview');
  if (dropdownItemsPreview) {
    dropdownItemsPreview.style.display = 'none';
  }
}

/**
 * Populate form for editing a tab
 */
function populateFormForEdit(tabId) {
  const domElements = SFTabs.main.getDOMElements();
  const tab = SFTabs.tabs.getTabById(tabId);

  if (!tab) {
    SFTabs.main.showStatus('Tab not found', true);
    return;
  }

  SFTabs.main.setEditingTabId(tabId);

  // Set the tab as currentActionPanelTab so dropdown operations work
  // This is needed for removing dropdown items in the old form
  SFTabs.main.setCurrentActionPanelTab(tab);
  console.log('Set currentActionPanelTab for old form edit:', tab.id);

  // Set form title if it exists (optional element)
  if (domElements.formTitle) {
    domElements.formTitle.textContent = 'Edit Tab';
  }

  // All form fields have been moved to action panel
  // Nothing to populate in the dropdown form anymore
}

/**
 * Auto-detect current page for setup object detection
 */
function autoDetectCurrentPage() {
  // No auto-detection needed for the object-dropdowns implementation
  // Users manually click "Setup as Object Dropdown" button
}

/**
 * Update dropdown control visibility based on form state
 */
function updateDropdownControlVisibility() {
  const objectDropdownSection = document.getElementById('object-dropdown-section');
  const editingTabId = SFTabs.main.getEditingTabId();

  // Show dropdown section only when editing a tab
  if (objectDropdownSection) {
    if (editingTabId) {
      objectDropdownSection.style.display = 'block';

      // Show preview if tab has dropdown items
      const tab = SFTabs.tabs.getTabById(editingTabId);
      if (tab && tab.dropdownItems && tab.dropdownItems.length > 0) {
        showDropdownPreview(tab.dropdownItems);
      }
    } else {
      objectDropdownSection.style.display = 'none';
    }
  }
}

/**
 * Hide tab form
 */
function hideTabForm() {
  const domElements = SFTabs.main.getDOMElements();
  console.log('Hiding tab form');
  
  domElements.tabForm.style.display = 'none';
  SFTabs.main.setEditingTabId(null);

  // Move the form back to its default container
  if (domElements.tabForm.parentElement !== domElements.mainContent) {
    domElements.mainContent.appendChild(domElements.tabForm);
  }
}

/**
 * Save tab form
 */
function saveTabForm() {
  const domElements = SFTabs.main.getDOMElements();
  console.log('Saving tab form');

  const editingTabId = SFTabs.main.getEditingTabId();

  // All editable fields have been moved to action panel
  // The dropdown form now only handles Object Dropdown settings
  if (!editingTabId) {
    SFTabs.main.showStatus('No tab selected for editing', true);
    return;
  }

  // Get dropdown-related checkbox values (if they exist)
  const isSetupObject = domElements.isSetupObjectCheckbox?.checked || false;
  const hasDropdown = domElements.hasDropdownCheckbox?.checked || false;
  const autoSetupDropdown = domElements.autoSetupDropdownCheckbox?.checked || false;

  // Validation for dropdown settings
  if (autoSetupDropdown && !isSetupObject) {
    SFTabs.main.showStatus('Auto Setup Dropdown requires Setup Object to be enabled', true);
    return;
  }

  // Only update dropdown-related fields
  const tabData = {
    isSetupObject: isSetupObject,
    hasDropdown: hasDropdown,
    autoSetupDropdown: autoSetupDropdown
  };

  // Check if there are pending dropdown items to save
  const currentActionPanelTab = SFTabs.main.getCurrentActionPanelTab();
  if (currentActionPanelTab && currentActionPanelTab.pendingDropdownItems && currentActionPanelTab.pendingDropdownItems.length > 0) {
    console.log('✅ Applying pending dropdown items from old form:', currentActionPanelTab.pendingDropdownItems.length);
    tabData.hasDropdown = true;
    tabData.dropdownItems = currentActionPanelTab.pendingDropdownItems;

    // Clean up old dropdown properties from previous implementation
    tabData.autoSetupDropdown = undefined;
    tabData.children = undefined;
    tabData.parentId = undefined;
    tabData.isExpanded = undefined;
    tabData.cachedNavigation = undefined;
    tabData.navigationLastUpdated = undefined;
    tabData.needsNavigationRefresh = undefined;
  }

  // Update existing tab
  SFTabs.tabs.updateTab(editingTabId, tabData).then(() => {
    console.log('Tab updated successfully');

    // Clear pending dropdown items after successful save
    if (currentActionPanelTab && currentActionPanelTab.pendingDropdownItems) {
      delete currentActionPanelTab.pendingDropdownItems;
      console.log('Cleared pending dropdown items from old form');
    }

    hideTabForm();
  }).catch(error => {
    console.error('Error updating tab:', error);
    SFTabs.main.showStatus('Error updating tab: ' + error.message, true);
  });
}

/**
 * Edit a tab
 */
function editTab(tabId) {
  console.log('Edit tab requested', { tabId });
  const domElements = SFTabs.main.getDOMElements();

  // Hide form if already visible
  if (domElements.tabForm.style.display === 'block') {
    hideTabForm();
  }

  // Show form for editing
  showTabForm(tabId);
}

/**
 * Ensure the form is fully visible after positioning
 */
function ensureFormVisible(tabElement) {
  setTimeout(() => {
    const mainContent = document.getElementById('main-content');
    const domElements = SFTabs.main.getDOMElements();
    const formRect = domElements.tabForm.getBoundingClientRect();
    const containerRect = mainContent.getBoundingClientRect();
    const containerHeight = mainContent.clientHeight;
    const scrollTop = mainContent.scrollTop;

    const formBottom = formRect.bottom - containerRect.top;
    const overflow = formBottom - containerHeight;

    if (overflow > 0) {
      console.log('Scrolling to show form, overflow:', overflow);
      mainContent.scrollTo({
        top: scrollTop + overflow + 30,
        behavior: 'smooth'
      });
    }
  }, 100);
}

/**
 * Setup drag and drop functionality for tab reordering
 */
function setupDragAndDrop() {
  const domElements = SFTabs.main.getDOMElements();
  const tabItems = domElements.tabList.querySelectorAll('.tab-item');
  const dragHandles = domElements.tabList.querySelectorAll('.drag-handle');
  
  // Create drop indicator element
  const dropIndicator = createDropIndicator();
  
  // Add event listeners to drag handles
  dragHandles.forEach((handle, index) => {
    const item = tabItems[index];
    handle.addEventListener('mousedown', (e) => handleDragStart(e, item, dropIndicator));
  });
}

/**
 * Create drop indicator element
 */
function createDropIndicator() {
  const dropIndicator = document.createElement('div');
  dropIndicator.className = 'drop-indicator';
  return dropIndicator;
}

/**
 * Handle drag start (properly implemented)
 */
function handleDragStart(e, item, dropIndicator) {
  e.preventDefault();
  console.log('Drag started for:', item.dataset.id);
  
  const domElements = SFTabs.main.getDOMElements();
  
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
  domElements.tabList.appendChild(dropIndicator);

  // Set up move and drop handlers
  setupDragHandlers(item, clone, dropIndicator, shiftX, shiftY, tabItemWidth);
}

/**
 * Create a clone of the element being dragged
 */
function createDragClone(item, width) {
  const clone = item.cloneNode(true);
  clone.classList.add('tab-item-clone');
  clone.style.width = width + 'px';
  clone.style.position = 'absolute';
  clone.style.zIndex = '1000';
  clone.style.opacity = '0.7';

  // Add clone to the DOM
  document.body.appendChild(clone);

  return clone;
}

/**
 * Move an element to specified coordinates
 */
function moveElement(element, x, y) {
  element.style.top = y + 'px';
  element.style.left = x + 'px';
}

/**
 * Set up handlers for dragging movement and dropping
 */
function setupDragHandlers(item, clone, dropIndicator, shiftX, shiftY, tabItemWidth) {
  const domElements = SFTabs.main.getDOMElements();
  let dropTarget = null; // Track the target tab for dropdown creation

  // Define mousemove handler
  function onMouseMove(event) {
    moveElement(clone, event.pageX - shiftX, event.pageY - shiftY);

    // Hide clone temporarily to get element underneath
    clone.style.display = 'none';
    const elemBelow = document.elementFromPoint(event.clientX, event.clientY);
    clone.style.display = '';

    // Reset drop indicator visibility
    dropIndicator.style.display = 'none';

    // Remove previous dropdown target highlight
    document.querySelectorAll('.tab-item.drop-target-dropdown').forEach(el => {
      el.classList.remove('drop-target-dropdown');
    });
    dropTarget = null;

    if (!elemBelow) return;

    // Check if we're over another tab item
    const droppableItem = elemBelow.closest('.tab-item');

    if (droppableItem && droppableItem !== item) {
      const rect = droppableItem.getBoundingClientRect();
      const middle = rect.top + rect.height / 2;
      const distanceFromMiddle = Math.abs(event.clientY - middle);
      const threshold = rect.height * 0.25; // 25% of tab height for center zone

      // If we're in the center zone, highlight for dropdown creation
      if (distanceFromMiddle < threshold) {
        droppableItem.classList.add('drop-target-dropdown');
        dropTarget = droppableItem;
      } else {
        // Otherwise, show reorder indicator
        updateDropIndicator(elemBelow, item, event, dropIndicator, tabItemWidth);
      }
    }
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

    // Remove dropdown target highlight
    document.querySelectorAll('.tab-item.drop-target-dropdown').forEach(el => {
      el.classList.remove('drop-target-dropdown');
    });

    // Check if we're dropping onto a tab for dropdown creation
    if (dropTarget) {
      handleDropdownCreation(item, dropTarget);
    } else {
      // Handle final positioning for reordering
      finalizeDrop(event, item);
      // Update the tab positions in storage
      updateTabPositions();
    }
  }

  // Add the event listeners
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

/**
 * Update the drop indicator position
 */
function updateDropIndicator(elemBelow, draggedItem, event, dropIndicator, tabItemWidth) {
  const domElements = SFTabs.main.getDOMElements();
  
  // Check if we're over another tab item
  const droppableItem = elemBelow.closest('.tab-item');
  if (droppableItem && droppableItem !== draggedItem) {
    // Determine if we should place above or below
    const rect = droppableItem.getBoundingClientRect();
    const middle = rect.top + rect.height / 2;

    // Show the drop indicator
    dropIndicator.style.display = 'block';
    dropIndicator.style.width = tabItemWidth + 'px';

    if (event.clientY < middle) {
      // Place above the droppable item
      domElements.tabList.insertBefore(dropIndicator, droppableItem);
    } else {
      // Place below the droppable item
      domElements.tabList.insertBefore(dropIndicator, droppableItem.nextSibling);
    }
  }
}

/**
 * Finalize the drop position
 */
function finalizeDrop(event, draggedItem) {
  const domElements = SFTabs.main.getDOMElements();
  const elemBelow = document.elementFromPoint(event.clientX, event.clientY);

  if (elemBelow) {
    const droppableItem = elemBelow.closest('.tab-item');
    if (droppableItem && droppableItem !== draggedItem) {
      // Determine if we should place above or below
      const rect = droppableItem.getBoundingClientRect();
      const middle = rect.top + rect.height / 2;

      if (event.clientY < middle) {
        domElements.tabList.insertBefore(draggedItem, droppableItem);
      } else {
        domElements.tabList.insertBefore(draggedItem, droppableItem.nextSibling);
      }
    }
  }
}

/**
 * Handle dropdown creation by dropping one tab onto another
 */
function handleDropdownCreation(draggedItem, targetItem) {
  console.log('Creating dropdown: dragging', draggedItem.dataset.id, 'onto', targetItem.dataset.id);

  const tabs = SFTabs.main.getTabs();
  const draggedTab = tabs.find(t => t.id === draggedItem.dataset.id);
  const targetTab = tabs.find(t => t.id === targetItem.dataset.id);

  if (!draggedTab || !targetTab) {
    console.error('Could not find tabs for dropdown creation');
    return;
  }

  // Initialize dropdownItems array if it doesn't exist
  if (!targetTab.dropdownItems) {
    targetTab.dropdownItems = [];
  }

  // Create a dropdown item from the dragged tab
  const dropdownItem = {
    label: draggedTab.label,
    path: draggedTab.path,
    url: draggedTab.isCustomUrl ? draggedTab.path : null,
    isObject: draggedTab.isObject || false,
    isCustomUrl: draggedTab.isCustomUrl || false
  };

  // Add to dropdown items
  targetTab.dropdownItems.push(dropdownItem);
  targetTab.hasDropdown = true;

  // Remove the dragged tab from the main list
  const draggedIndex = tabs.findIndex(t => t.id === draggedTab.id);
  if (draggedIndex > -1) {
    tabs.splice(draggedIndex, 1);
  }

  // Save and refresh
  SFTabs.storage.saveTabs(tabs).then(() => {
    console.log('Dropdown created successfully');
    SFTabs.main.showStatus(`Added "${draggedTab.label}" as dropdown item to "${targetTab.label}"`);
    renderTabList();
  });
}

/**
 * Update tab positions after dragging
 */
function updateTabPositions() {
  const domElements = SFTabs.main.getDOMElements();
  const tabItems = domElements.tabList.querySelectorAll('.tab-item');
  const tabs = SFTabs.main.getTabs();

  tabItems.forEach((item, index) => {
    const tabId = item.dataset.id;
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      tab.position = index;
    }
  });

  SFTabs.storage.saveTabs(tabs);
}

/**
 * Setup UI-related event listeners
 */
function setupEventListeners() {
  const domElements = SFTabs.main.getDOMElements();
  
  // Form buttons
  if (domElements.saveButton) {
    domElements.saveButton.addEventListener('click', saveTabForm);
  }
  
  if (domElements.cancelButton) {
    domElements.cancelButton.addEventListener('click', hideTabForm);
  }
  
  // Form field changes for dynamic visibility
  if (domElements.isSetupObjectCheckbox) {
    domElements.isSetupObjectCheckbox.addEventListener('change', () => {
      updateDropdownControlVisibility();
      
      // Auto-enable dropdown options when Setup Object is checked
      if (domElements.isSetupObjectCheckbox.checked) {
        if (domElements.hasDropdownCheckbox) domElements.hasDropdownCheckbox.checked = true;
        if (domElements.autoSetupDropdownCheckbox) domElements.autoSetupDropdownCheckbox.checked = true;
      }
    });
  }
  
  // Other checkboxes that affect visibility
  [domElements.hasDropdownCheckbox, domElements.autoSetupDropdownCheckbox, 
   domElements.isObjectCheckbox, domElements.isCustomUrlCheckbox].forEach(checkbox => {
    if (checkbox) {
      checkbox.addEventListener('change', updateDropdownControlVisibility);
    }
  });
  
  // Refresh Navigation button
  if (domElements.refreshNavButton) {
    domElements.refreshNavButton.addEventListener('click', () => {
      const editingTabId = SFTabs.main.getEditingTabId();
      if (editingTabId && SFTabs.dropdowns) {
        SFTabs.dropdowns.manualRefreshTabNavigation(editingTabId);
      }
    });
  }
  
  // Enter key in form fields
  if (domElements.tabNameInput) {
    domElements.tabNameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') saveTabForm();
    });
  }
  
  if (domElements.tabPathInput) {
    domElements.tabPathInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') saveTabForm();
    });
  }
  
  console.log('UI event listeners setup complete');
}

// Export UI functions
window.SFTabs = window.SFTabs || {};
window.SFTabs.ui = {
  renderTabList,
  createTabElement,
  showTabForm,
  hideTabForm,
  saveTabForm,
  editTab,
  navigateToTab,
  setupEventListeners
};