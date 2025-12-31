// popup/js/popup-ui.js
// UI rendering and form handling

/**
 * Render the main tab list
 */
function renderTabList() {
  const domElements = SFTabs.main.getDOMElements();

  // Check if action panel is currently open - if so, we'll preserve it
  const currentActionPanelTab = SFTabs.main.getCurrentActionPanelTab();
  const isActionPanelOpen = currentActionPanelTab !== null;

  if (isActionPanelOpen) {
  }

  // Clear existing tab items only (preserve empty-state and profile-init-options)
  const tabItems = domElements.tabList.querySelectorAll('.tab-item');
  tabItems.forEach(item => item.remove());

  // Get all tabs (sorted by position)
  const allTabs = SFTabs.main.getTabs().sort((a, b) => a.position - b.position);

  // Check if profiles are enabled and this is a new empty profile
  const settings = SFTabs.main.getUserSettings();
  const isProfilesEnabled = settings.profilesEnabled;
  const profileInitOptions = document.querySelector('#profile-init-options');


  // Show empty state if no tabs
  if (allTabs.length === 0) {
    // If profiles are enabled, show profile initialization options
    if (isProfilesEnabled && profileInitOptions) {
      domElements.emptyState.style.display = 'none';
      profileInitOptions.style.display = 'block';
    } else {
      // Otherwise show generic empty state
      domElements.emptyState.style.display = 'block';
      if (profileInitOptions) {
        profileInitOptions.style.display = 'none';
      }
    }
  } else {
    domElements.emptyState.style.display = 'none';
    if (profileInitOptions) {
      profileInitOptions.style.display = 'none';
    }

    // Create tab items (including their dropdown functionality)
    allTabs.forEach((tab) => {
      const tabItem = createTabElement(tab);
      domElements.tabList.appendChild(tabItem);
    });

    // Setup drag and drop functionality
    setupDragAndDrop();
  }

  // Note: We no longer need to preserve action panel state here because
  // delete/promote operations now stage changes instead of saving immediately.
  // The form stays open naturally since storage isn't updated until Save is clicked.
}

/**
 * Create drag handle with dots in a grid pattern
 * @param {boolean} isCompact - Whether the tab is in compact mode
 * @returns {HTMLElement} The drag handle element
 */
function createDragHandle(isCompact) {
  const dragHandle = document.createElement('div');
  dragHandle.className = 'drag-handle';
  dragHandle.setAttribute('title', 'Drag to reorder');

  // Add dots based on display mode (2 column grid)
  // Compact mode: 6 dots (2x3 grid)
  // Regular mode: 10 dots (2x5 grid)
  const dotCount = isCompact ? 6 : 10;

  for (let i = 0; i < dotCount; i++) {
    const dot = document.createElement('div');
    dot.className = 'drag-handle-dot';
    dragHandle.appendChild(dot);
  }

  return dragHandle;
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

  // Create drag handle (colored left edge with dots)
  const settings = SFTabs.main.getUserSettings();
  const dragHandle = createDragHandle(settings.compactMode);
  
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

  // Add dropdown indicator icon if tab has dropdown items
  if (hasDropdown) {
    const indicator = document.createElement('span');
    indicator.className = 'dropdown-indicator';

    // Use folder icon for tabs without path, chevron for tabs with path
    const isFolder = !tab.path || !tab.path.trim();

    if (isFolder) {
      // Folder icon for folder-style tabs (no path)
      indicator.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-folder"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
    } else {
      // Chevron-down icon for tabs with path + dropdown
      indicator.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-chevron-down"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
    }

    tabName.appendChild(indicator);
  }

  const settings = SFTabs.main.getUserSettings();

  if (settings.compactMode) {
    createCompactTabContent(contentContainer, tab, tabName, hasDropdown);
  } else {
    createRegularTabContent(contentContainer, tab, tabName, hasDropdown);
  }

  // Add click handlers
  addTabContentClickHandlers(tab, contentContainer, tabName, hasDropdown);

  return contentContainer;
}

/**
 * Create compact mode tab content
 */
function createCompactTabContent(container, tab, tabName, hasDropdown) {
  const tabItem = container.closest('.tab-item');
  if (tabItem) {
    tabItem.classList.add('compact-mode');
  }

  container.style.display = 'flex';
  container.style.flexDirection = 'row';
  container.style.flex = '1';
  container.style.minWidth = '0';
  container.style.alignItems = 'flex-start';

  const textContainer = document.createElement('div');
  textContainer.style.flex = '1';
  textContainer.style.minWidth = '0';
  textContainer.appendChild(tabName);

  container.appendChild(textContainer);

  tabName.style.wordBreak = 'break-word';
  tabName.style.overflow = 'hidden';
}

/**
 * Create regular mode tab content
 */
function createRegularTabContent(container, tab, tabName, hasDropdown) {
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.flex = '1';
  container.style.minWidth = '0';
  container.appendChild(tabName);

  // Add path display (without badge)
  const tabPath = document.createElement('div');
  tabPath.className = 'tab-path';

  const pathTextElement = document.createElement('span');
  pathTextElement.className = 'path-text';
  pathTextElement.textContent = tab.path;

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
    // Only navigate if tab has a path (skip folder-style tabs without URLs)
    if (tab.path && tab.path.trim()) {
      navigateToTab(tab);
    } else {
    }
  });
}

/**
 * Navigate to a tab 
 */
function navigateToTab(tab) {
  
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
  
  
  if (tab.openInNewTab) {
    window.open(fullUrl, '_blank');
  } else {
    // Lightning Navigation is always enabled
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
  }
  
  // Close popup
  window.close();
}

/**
 * Create tab actions (action panel button, new tab toggle and delete button)
 */
function createTabActions(tab) {
  const actionsContainer = document.createElement('div');
  actionsContainer.className = 'tab-actions';

  // Create action panel button (edit/pencil icon button)
  const actionPanelButton = document.createElement('button');
  actionPanelButton.className = 'action-panel-button';
  actionPanelButton.setAttribute('title', 'Edit tab');
  actionPanelButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit-2">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
    </svg>
  `;

  actionPanelButton.addEventListener('click', (e) => {
    e.stopPropagation();
    if (SFTabs.main && SFTabs.main.showActionPanel) {
      // Pass the tab object to the action panel
      SFTabs.main.showActionPanel(tab);
    } else {
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
 * Show tab form
 */
function showTabForm(tabId = null) {
  const domElements = SFTabs.main.getDOMElements();

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

  // Create a staged copy of dropdown items for editing
  // Changes will only be saved when user clicks Save button
  if (tab.dropdownItems && tab.dropdownItems.length > 0) {
    tab.stagedDropdownItems = JSON.parse(JSON.stringify(tab.dropdownItems));
  } else {
    tab.stagedDropdownItems = [];
  }

  // Set the tab as currentActionPanelTab so dropdown operations work
  // This is needed for removing dropdown items in the old form
  SFTabs.main.setCurrentActionPanelTab(tab);

  // Set form title if it exists (optional element)
  if (domElements.formTitle) {
    domElements.formTitle.textContent = 'Edit Tab';
  }

  // Show/hide appropriate dropdown section based on tab type
  const isObjectManagerTab = tab.path && tab.path.includes('ObjectManager/');

  if (domElements.objectDropdownSection && domElements.manualDropdownSection) {
    if (isObjectManagerTab) {
      // Show Object Dropdown section for ObjectManager tabs
      // Force hide the Manual Dropdown section first
      domElements.manualDropdownSection.style.display = 'none';
      domElements.manualDropdownSection.style.visibility = 'hidden';
      domElements.manualDropdownSection.style.height = '0';
      domElements.manualDropdownSection.style.margin = '0';
      domElements.manualDropdownSection.style.padding = '0';
      domElements.manualDropdownSection.style.overflow = 'hidden';

      // Then show the Object Dropdown section
      domElements.objectDropdownSection.style.display = 'block';
      domElements.objectDropdownSection.style.visibility = 'visible';
      domElements.objectDropdownSection.style.height = '';
      domElements.objectDropdownSection.style.margin = '';
      domElements.objectDropdownSection.style.padding = '';
      domElements.objectDropdownSection.style.overflow = '';

      // Show dropdown items if they exist
      if (SFTabs.dropdowns && SFTabs.dropdowns.showDropdownPreview) {
        if (tab.pendingDropdownItems && tab.pendingDropdownItems.length > 0) {
          SFTabs.dropdowns.showDropdownPreview(tab.pendingDropdownItems);
        } else if (tab.dropdownItems && tab.dropdownItems.length > 0) {
          SFTabs.dropdowns.showDropdownPreview(tab.dropdownItems);
        }
      }
    } else {
      // Show Manual Dropdown section for non-ObjectManager tabs
      // Force hide the Object Dropdown section first
      domElements.objectDropdownSection.style.display = 'none';
      domElements.objectDropdownSection.style.visibility = 'hidden';
      domElements.objectDropdownSection.style.height = '0';
      domElements.objectDropdownSection.style.margin = '0';
      domElements.objectDropdownSection.style.padding = '0';
      domElements.objectDropdownSection.style.overflow = 'hidden';

      // Then show the Manual Dropdown section
      domElements.manualDropdownSection.style.display = 'block';
      domElements.manualDropdownSection.style.visibility = 'visible';
      domElements.manualDropdownSection.style.height = '';
      domElements.manualDropdownSection.style.margin = '';
      domElements.manualDropdownSection.style.padding = '';
      domElements.manualDropdownSection.style.overflow = '';

      // Show existing dropdown items in the manage dropdown panel
      showManageDropdownPanelItems(tab);
    }
  }
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

  // Clear any staged changes when canceling
  const currentActionPanelTab = SFTabs.main.getCurrentActionPanelTab();
  if (currentActionPanelTab) {
    if (currentActionPanelTab.stagedDropdownItems || currentActionPanelTab.stagedPromotions) {
      delete currentActionPanelTab.stagedDropdownItems;
      delete currentActionPanelTab.stagedPromotions;
    }
  }

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

  // Only update dropdown-related fields
  const tabData = {
    isSetupObject: isSetupObject,
    hasDropdown: hasDropdown
  };

  // Get the tab being edited
  const tabs = SFTabs.main.getTabs();
  const tab = tabs.find(t => t.id === editingTabId);

  if (!tab) {
    SFTabs.main.showStatus('Tab not found', true);
    return;
  }

  // Check if there are staged changes to apply
  const currentActionPanelTab = SFTabs.main.getCurrentActionPanelTab();

  // Apply dropdown items in priority order:
  // 1. stagedDropdownItems (manual edits/deletions) - highest priority
  // 2. pendingDropdownItems (from Object Dropdown setup)
  // 3. existing dropdownItems (no changes)
  if (currentActionPanelTab && currentActionPanelTab.stagedDropdownItems !== undefined) {
    // Staged items from manual edits (removing, reordering) take precedence
    tabData.dropdownItems = JSON.parse(JSON.stringify(currentActionPanelTab.stagedDropdownItems));  // Make a deep copy
    tabData.hasDropdown = currentActionPanelTab.stagedDropdownItems.length > 0;
  } else if (currentActionPanelTab && currentActionPanelTab.pendingDropdownItems && currentActionPanelTab.pendingDropdownItems.length > 0) {
    // Pending items from Object Dropdown setup
    tabData.hasDropdown = true;
    tabData.dropdownItems = currentActionPanelTab.pendingDropdownItems;
  } else if (tab.dropdownItems) {
    // No changes, preserve existing dropdown items
    tabData.dropdownItems = tab.dropdownItems;
    tabData.hasDropdown = tab.dropdownItems.length > 0;
  }

  // Apply staged promotions (create new main tabs from promoted items)
  if (currentActionPanelTab && currentActionPanelTab.stagedPromotions && currentActionPanelTab.stagedPromotions.length > 0) {

    // Create new main tabs for each promoted item
    currentActionPanelTab.stagedPromotions.forEach(promotedItem => {
      const newTab = {
        id: generateId(),
        label: promotedItem.label,
        path: promotedItem.path || '',
        openInNewTab: false,
        isObject: promotedItem.isObject || false,
        isCustomUrl: promotedItem.isCustomUrl || false,
        isSetupObject: false,
        hasDropdown: (promotedItem.dropdownItems && promotedItem.dropdownItems.length > 0),
        dropdownItems: promotedItem.dropdownItems || [],
        position: tabs.length
      };
      tabs.push(newTab);
    });
  }

  // Update existing tab and save all tabs (in case we added promoted tabs)
  SFTabs.tabs.updateTab(editingTabId, tabData).then(() => {
    // If we have promotions, we need to save the entire tabs array
    if (currentActionPanelTab && currentActionPanelTab.stagedPromotions && currentActionPanelTab.stagedPromotions.length > 0) {
      return SFTabs.storage.saveTabs(tabs);
    }
  }).then(() => {

    // Clear all staged data after successful save
    if (currentActionPanelTab) {
      delete currentActionPanelTab.stagedDropdownItems;
      delete currentActionPanelTab.stagedPromotions;
      delete currentActionPanelTab.pendingDropdownItems;
    }

    hideTabForm();
  }).catch(error => {
    SFTabs.main.showStatus('Error updating tab: ' + error.message, true);
  });
}

/**
 * Edit a tab
 */
function editTab(tabId) {
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

  // Add event listeners to drag handles
  dragHandles.forEach((handle, index) => {
    const item = tabItems[index];
    handle.addEventListener('mousedown', (e) => handleDragStart(e, item));
  });
}

/**
 * Handle drag start (properly implemented)
 */
function handleDragStart(e, item) {
  e.preventDefault();

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

  // Set up move and drop handlers
  setupDragHandlers(item, clone, shiftX, shiftY, tabItemWidth);
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
function setupDragHandlers(item, clone, shiftX, shiftY, tabItemWidth) {
  const domElements = SFTabs.main.getDOMElements();
  let dropTarget = null; // Track the target tab for dropdown creation
  let hoverTimer = null; // Timer for hover delay
  let currentHoverTarget = null; // Track which tab we're hovering over
  const HOVER_DELAY = 500; // Milliseconds to hover before switching to dropdown mode

  // Define mousemove handler
  function onMouseMove(event) {
    moveElement(clone, event.pageX - shiftX, event.pageY - shiftY);

    // Hide clone temporarily to get element underneath
    clone.style.display = 'none';
    const elemBelow = document.elementFromPoint(event.clientX, event.clientY);
    clone.style.display = '';

    if (!elemBelow) {
      // Not over anything - reset everything
      clearHoverTimer();
      removeDropdownHighlight();
      dropTarget = null;
      return;
    }

    // Check if we're over another tab item
    const droppableItem = elemBelow.closest('.tab-item');

    if (droppableItem && droppableItem !== item) {
      // Check if we moved to a different tab
      if (droppableItem !== currentHoverTarget) {
        // Moved to a new tab - reset timer
        clearHoverTimer();
        removeDropdownHighlight();
        dropTarget = null;
        currentHoverTarget = droppableItem;

        // Start hover timer for dropdown mode
        hoverTimer = setTimeout(() => {
          // Timer completed - switch to dropdown mode
          droppableItem.classList.add('drop-target-dropdown');
          dropTarget = droppableItem;
        }, HOVER_DELAY);
      }

      // Perform dynamic reordering unless we're in dropdown mode
      if (!dropTarget) {
        dynamicallyReorderTabs(elemBelow, item, event);
      }
    } else {
      // Not over a valid drop target - reset
      clearHoverTimer();
      removeDropdownHighlight();
      dropTarget = null;
      currentHoverTarget = null;
    }
  }

  // Helper to dynamically reorder tabs
  function dynamicallyReorderTabs(elemBelow, draggedItem, event) {
    const droppableItem = elemBelow.closest('.tab-item');
    if (!droppableItem || droppableItem === draggedItem) return;

    // Determine if we should place above or below
    const rect = droppableItem.getBoundingClientRect();
    const middle = rect.top + rect.height / 2;

    if (event.clientY < middle) {
      // Place above the droppable item
      domElements.tabList.insertBefore(draggedItem, droppableItem);
    } else {
      // Place below the droppable item
      domElements.tabList.insertBefore(draggedItem, droppableItem.nextSibling);
    }
  }

  // Helper to clear hover timer
  function clearHoverTimer() {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
  }

  // Helper to remove dropdown highlight
  function removeDropdownHighlight() {
    document.querySelectorAll('.tab-item.drop-target-dropdown').forEach(el => {
      el.classList.remove('drop-target-dropdown');
    });
  }

  // Define mouseup/drop handler
  function onMouseUp(event) {
    // Clean up timer
    clearHoverTimer();

    // Clean up event listeners
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    // Clean up DOM
    document.body.removeChild(clone);
    item.style.opacity = '';
    item.classList.remove('being-dragged');

    // Remove dropdown target highlight
    removeDropdownHighlight();

    // Check if we're dropping onto a tab for dropdown creation
    if (dropTarget) {
      handleDropdownCreation(item, dropTarget);
    } else {
      // Item is already in the correct position from dynamic reordering
      // Just update the tab positions in storage
      updateTabPositions();
    }
  }

  // Add the event listeners
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

/**
 * Calculate the maximum nesting depth (number of levels) of dropdown items
 * @param {Array} items - Array of dropdown items
 * @returns {number} Maximum number of levels (1 for items with no children, 2 for items with one level of children, etc.)
 */
function calculateMaxNestingDepth(items) {
  if (!items || items.length === 0) {
    return 0;
  }

  let maxLevels = 1; // Count this level
  for (const item of items) {
    if (item.dropdownItems && item.dropdownItems.length > 0) {
      const childLevels = calculateMaxNestingDepth(item.dropdownItems);
      maxLevels = Math.max(maxLevels, 1 + childLevels);
    }
  }

  return maxLevels;
}

/**
 * Handle dropdown creation by dropping one tab onto another
 */
function handleDropdownCreation(draggedItem, targetItem) {

  const tabs = SFTabs.main.getTabs();
  const draggedTab = tabs.find(t => t.id === draggedItem.dataset.id);
  const targetTab = tabs.find(t => t.id === targetItem.dataset.id);

  if (!draggedTab || !targetTab) {
    return;
  }

  // Initialize dropdownItems array if it doesn't exist
  if (!targetTab.dropdownItems) {
    targetTab.dropdownItems = [];
  }

  // Check nesting depth before allowing drop
  // Target tab will become level 0, dragged item becomes level 1
  // Calculate total levels in dragged item's structure (including the item itself)
  const draggedItemDepth = draggedTab.dropdownItems
    ? 1 + calculateMaxNestingDepth(draggedTab.dropdownItems)
    : 1;

  // Calculate current levels in target tab's dropdowns
  const targetDepth = targetTab.dropdownItems
    ? 1 + calculateMaxNestingDepth(targetTab.dropdownItems)
    : 1;

  // The new depth would be the max of current target depth and dragged item depth
  const newDepth = Math.max(targetDepth, draggedItemDepth);

  // Maximum supported depth is 3 levels (0, 1, 2)
  // Renderer only displays flyout submenus up to level 2 to prevent UI overlay issues
  const MAX_DEPTH = 3;
  if (newDepth > MAX_DEPTH) {
    const errorMessage = 'Error: Too many dropdown levels';

    if (SFTabs.main && SFTabs.main.showStatus) {
      SFTabs.main.showStatus(errorMessage, true);
    } else {
      alert(errorMessage);
    }
    return;
  }

  // Create a dropdown item from the dragged tab
  // IMPORTANT: Preserve nested dropdownItems if the dragged tab has them
  const dropdownItem = {
    label: draggedTab.label,
    path: draggedTab.path,
    url: draggedTab.isCustomUrl ? draggedTab.path : null,
    isObject: draggedTab.isObject || false,
    isCustomUrl: draggedTab.isCustomUrl || false
  };

  // Preserve nested dropdown items if they exist
  if (draggedTab.dropdownItems && draggedTab.dropdownItems.length > 0) {
    dropdownItem.dropdownItems = JSON.parse(JSON.stringify(draggedTab.dropdownItems));
  }

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
      }
    });
  }

  // Other checkboxes that affect visibility
  [domElements.hasDropdownCheckbox, domElements.isObjectCheckbox, domElements.isCustomUrlCheckbox].forEach(checkbox => {
    if (checkbox) {
      checkbox.addEventListener('change', updateDropdownControlVisibility);
    }
  });

  // Settings button - open standalone settings page
  if (domElements.settingsButton) {
    domElements.settingsButton.addEventListener('click', () => {
      browser.tabs.create({ url: "/popup/settings.html" }).then(() => {
        // Close the popup after opening the settings tab
        window.close();
      });
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
  
}

/**
 * Show manual dropdown items in the manage dropdown panel
 */
function showManageDropdownPanelItems(tab) {
  const domElements = SFTabs.main.getDOMElements();

  if (!domElements.manageDropdownPreview || !domElements.manageDropdownList || !domElements.manageDropdownCount) {
    return;
  }

  // Use staged items if available (during editing), otherwise use actual items
  const items = tab.stagedDropdownItems || tab.dropdownItems || [];

  // Get the label and instructions elements
  const labelElement = document.getElementById('manual-dropdown-label');
  const instructionsDiv = document.getElementById('manual-dropdown-help-text');

  if (items.length === 0) {
    domElements.manageDropdownPreview.style.display = 'none';
    // Show label and instructions when no items exist
    if (labelElement) {
      labelElement.style.display = 'block';
    }
    if (instructionsDiv) {
      instructionsDiv.style.display = 'block';
    }
    return;
  }

  // Hide the label and instructions when items exist
  if (labelElement) {
    labelElement.style.display = 'none';
  }
  if (instructionsDiv) {
    instructionsDiv.style.display = 'none';
  }

  // Count total items (including nested)
  const totalCount = countAllDropdownItems(items);
  domElements.manageDropdownCount.textContent = totalCount;

  // Clear existing items
  domElements.manageDropdownList.innerHTML = '';

  // Render items recursively
  renderDropdownItems(items, domElements.manageDropdownList, tab, 0);

  // Show preview
  domElements.manageDropdownPreview.style.display = 'block';
}

/**
 * Count all dropdown items including nested ones
 */
function countAllDropdownItems(items) {
  let count = 0;
  items.forEach(item => {
    count++; // Count the item itself
    if (item.dropdownItems && item.dropdownItems.length > 0) {
      count += countAllDropdownItems(item.dropdownItems); // Count nested items
    }
  });
  return count;
}

/**
 * Render dropdown items recursively with nesting support
 * @param {Array} items - The dropdown items to render
 * @param {HTMLElement} container - The container to append items to
 * @param {Object} tab - The parent tab
 * @param {number} level - The nesting level (0 = top level, 1 = nested)
 * @param {Array} indexPath - Array of indices representing the path to this item
 */
function renderDropdownItems(items, container, tab, level = 0, indexPath = []) {
  items.forEach((item, index) => {
    const currentPath = [...indexPath, index];
    const itemDiv = createDropdownItemRow(item, index, tab, level, currentPath);
    container.appendChild(itemDiv);

    // If item has nested items and is expanded, render them
    if (item._expanded && item.dropdownItems && item.dropdownItems.length > 0) {
      const subContainer = document.createElement('div');
      subContainer.className = 'sub-items-container';
      subContainer.style.paddingLeft = '24px'; // Indent nested items
      renderDropdownItems(item.dropdownItems, subContainer, tab, level + 1, currentPath);
      container.appendChild(subContainer);
    }
  });
}

/**
 * Create a single dropdown item row
 */
function createDropdownItemRow(item, index, tab, level, indexPath) {
  const itemDiv = document.createElement('div');
  itemDiv.className = 'dropdown-item-draggable';
  itemDiv.dataset.index = index;
  itemDiv.dataset.level = level;
  itemDiv.dataset.indexPath = JSON.stringify(indexPath);
  itemDiv.style.padding = '4px 0';
  itemDiv.style.borderBottom = '1px solid #dddbda';
  itemDiv.style.display = 'flex';
  itemDiv.style.justifyContent = 'space-between';
  itemDiv.style.alignItems = 'center';
  itemDiv.style.cursor = 'grab';

  const leftSection = document.createElement('div');
  leftSection.style.display = 'flex';
  leftSection.style.alignItems = 'center';
  leftSection.style.flex = '1';
  leftSection.style.gap = '4px';

  // Expand/collapse button for items with children
  if (item.dropdownItems && item.dropdownItems.length > 0) {
    const expandButton = document.createElement('button');
    expandButton.type = 'button';
    expandButton.textContent = item._expanded ? '▼' : '▶';
    expandButton.style.fontSize = '10px';
    expandButton.style.padding = '2px 4px';
    expandButton.style.background = 'transparent';
    expandButton.style.border = 'none';
    expandButton.style.cursor = 'pointer';
    expandButton.style.color = '#706e6b';
    expandButton.title = item._expanded ? 'Collapse' : 'Expand';
    expandButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleItemExpansion(item, tab);
    });
    leftSection.appendChild(expandButton);
  } else {
    // Add spacing placeholder for items without children to maintain alignment
    const spacer = document.createElement('span');
    spacer.style.width = '18px';
    spacer.style.display = 'inline-block';
    leftSection.appendChild(spacer);
  }

  // Drag handle
  const dragHandle = document.createElement('span');
  dragHandle.textContent = '⋮⋮';
  dragHandle.style.marginRight = '8px';
  dragHandle.style.color = '#706e6b';
  dragHandle.style.cursor = 'grab';
  dragHandle.style.fontSize = '14px';
  leftSection.appendChild(dragHandle);

  // Label with sub-item count badge
  const labelSpan = document.createElement('span');
  labelSpan.style.flex = '1';

  const number = indexPath.map(i => i + 1).join('.');
  let labelText = `${number}. ${item.label}`;

  // Add sub-item count badge if has children
  if (item.dropdownItems && item.dropdownItems.length > 0) {
    labelText += ` (${item.dropdownItems.length})`;
    labelSpan.style.fontWeight = '600'; // Make parent items bold
  }

  labelSpan.textContent = labelText;
  leftSection.appendChild(labelSpan);

  const buttonsContainer = document.createElement('div');
  buttonsContainer.style.display = 'flex';
  buttonsContainer.style.gap = '4px';

  // Edit button
  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.textContent = 'Edit';
  editButton.style.fontSize = '11px';
  editButton.style.padding = '2px 6px';
  editButton.style.background = '#0176d3';
  editButton.style.color = 'white';
  editButton.style.border = 'none';
  editButton.style.borderRadius = '3px';
  editButton.style.cursor = 'pointer';
  editButton.title = 'Edit this dropdown item';
  editButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    editDropdownItemByPath(tab, indexPath);
  });

  // Promote button
  const promoteButton = document.createElement('button');
  promoteButton.type = 'button';
  promoteButton.textContent = '↑';
  promoteButton.style.fontSize = '14px';
  promoteButton.style.padding = '2px 6px';
  promoteButton.style.background = '#0c9';
  promoteButton.style.color = 'white';
  promoteButton.style.border = 'none';
  promoteButton.style.borderRadius = '3px';
  promoteButton.style.cursor = 'pointer';
  promoteButton.title = 'Promote to main tab list';
  promoteButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    promoteDropdownItemByPath(tab, indexPath);
  });

  // Delete button
  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.textContent = '×';
  deleteButton.style.fontSize = '16px';
  deleteButton.style.padding = '2px 6px';
  deleteButton.style.background = '#c23934';
  deleteButton.style.color = 'white';
  deleteButton.style.border = 'none';
  deleteButton.style.borderRadius = '3px';
  deleteButton.style.cursor = 'pointer';
  deleteButton.style.lineHeight = '1';
  deleteButton.title = 'Delete this item';
  deleteButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    deleteDropdownItemByPath(tab, indexPath);
  });

  buttonsContainer.appendChild(editButton);
  buttonsContainer.appendChild(promoteButton);
  buttonsContainer.appendChild(deleteButton);

  itemDiv.appendChild(leftSection);
  itemDiv.appendChild(buttonsContainer);

  // Add drag-and-drop support
  setupDropdownItemDragHandlers(itemDiv, tab);

  return itemDiv;
}

/**
 * Toggle expansion state of a dropdown item
 */
function toggleItemExpansion(item, tab) {
  item._expanded = !item._expanded;
  showManageDropdownPanelItems(tab); // Re-render to show/hide children
}

/**
 * Get an item by its index path
 * @param {Array} items - The array of items to search
 * @param {Array} indexPath - Array of indices [0, 2, 1] means items[0].dropdownItems[2].dropdownItems[1]
 * @returns {Object} The item at the path, or null if not found
 */
function getItemByPath(items, indexPath) {
  if (!items || indexPath.length === 0) return null;

  let current = items[indexPath[0]];
  for (let i = 1; i < indexPath.length; i++) {
    if (!current || !current.dropdownItems) return null;
    current = current.dropdownItems[indexPath[i]];
  }
  return current;
}

/**
 * Remove an item by its index path
 * @param {Array} items - The root array of items
 * @param {Array} indexPath - Array of indices
 */
function removeItemByPath(items, indexPath) {
  if (indexPath.length === 1) {
    // Top level item
    items.splice(indexPath[0], 1);
  } else {
    // Nested item - navigate to parent and remove from its children
    const parentPath = indexPath.slice(0, -1);
    const parent = getItemByPath(items, parentPath);
    if (parent && parent.dropdownItems) {
      parent.dropdownItems.splice(indexPath[indexPath.length - 1], 1);

      // If parent has no more children, remove the dropdownItems array
      if (parent.dropdownItems.length === 0) {
        delete parent.dropdownItems;
      }
    }
  }
}

/**
 * Edit dropdown item by path
 */
function editDropdownItemByPath(parentTab, indexPath) {

  const dropdownItem = getItemByPath(parentTab.dropdownItems, indexPath);
  if (!dropdownItem) {
    SFTabs.main.showStatus('Dropdown item not found', true);
    return;
  }

  // Create a temporary tab object for editing
  const tempTab = {
    id: `dropdown-${parentTab.id}-${indexPath.join('-')}`, // Special ID to identify this as a dropdown item edit
    label: dropdownItem.label,
    path: dropdownItem.path || '',
    openInNewTab: false,
    isObject: dropdownItem.isObject || false,
    isCustomUrl: dropdownItem.isCustomUrl || false,
    isSetupObject: false,
    _isDropdownItemEdit: true, // Flag to indicate this is editing a dropdown item
    _parentTabId: parentTab.id,
    _dropdownItemPath: indexPath // Store the full path instead of just index
  };

  // Open the action panel with this temp tab
  if (SFTabs.main && SFTabs.main.showActionPanel) {
    SFTabs.main.showActionPanel(tempTab);
  }
}

/**
 * Promote dropdown item to main tab list by path
 */
function promoteDropdownItemByPath(parentTab, indexPath) {

  // Work with staged items only - don't save yet
  const stagedItems = parentTab.stagedDropdownItems || [];
  const dropdownItem = getItemByPath(stagedItems, indexPath);

  if (!dropdownItem) {
    SFTabs.main.showStatus('Dropdown item not found', true);
    return;
  }

  // Preserve nested items if they exist
  const preservedDropdownItems = dropdownItem.dropdownItems || [];
  if (preservedDropdownItems.length > 0) {
  }

  // Remove the item from the staged dropdown items
  removeItemByPath(stagedItems, indexPath);

  // Update the staged items array
  parentTab.stagedDropdownItems = stagedItems;

  // Show status - but don't save yet
  if (preservedDropdownItems.length > 0) {
    SFTabs.main.showStatus(`"${dropdownItem.label}" with ${preservedDropdownItems.length} nested items will be promoted when you click Save`);
  } else {
    SFTabs.main.showStatus(`"${dropdownItem.label}" will be promoted when you click Save`);
  }

  // Store the promoted item temporarily so we can apply it on Save
  if (!parentTab.stagedPromotions) {
    parentTab.stagedPromotions = [];
  }
  parentTab.stagedPromotions.push({
    label: dropdownItem.label,
    path: dropdownItem.path || '',
    isObject: dropdownItem.isObject || false,
    isCustomUrl: dropdownItem.isCustomUrl || false,
    dropdownItems: preservedDropdownItems
  });


  // Refresh the dropdown preview with staged items (no storage save)
  showManageDropdownPanelItems(parentTab);
}

/**
 * Delete dropdown item by path
 */
function deleteDropdownItemByPath(parentTab, indexPath) {

  // Work with staged items only - don't save yet
  const stagedItems = parentTab.stagedDropdownItems || [];
  const item = getItemByPath(stagedItems, indexPath);

  if (!item) {
    SFTabs.main.showStatus('Dropdown item not found', true);
    return;
  }

  // Check if user wants to skip confirmation
  const userSettings = SFTabs.main.getUserSettings ? SFTabs.main.getUserSettings() : {};
  const skipConfirmation = userSettings.skipDeleteConfirmation;

  const performDelete = () => {
    // Remove the item from staged items
    removeItemByPath(stagedItems, indexPath);

    // Update the staged items array
    parentTab.stagedDropdownItems = stagedItems;

    SFTabs.main.showStatus(`"${item.label}" will be deleted when you click Save`);

    // Refresh the dropdown preview with staged items (no storage save)
    showManageDropdownPanelItems(parentTab);
  };

  if (skipConfirmation) {
    performDelete();
  } else {
    // Show confirmation dialog
    if (confirm(`Delete "${item.label}"?`)) {
      performDelete();
    }
  }
}

/**
 * Setup drag-and-drop handlers for dropdown items with nesting support
 */
function setupDropdownItemDragHandlers(itemDiv, parentTab) {
  let draggedPath = null;
  let dropIndicator = null;

  itemDiv.addEventListener('mousedown', (e) => {
    // Don't start drag if clicking on buttons
    if (e.target.closest('button')) {
      return;
    }

    // Prevent text selection during drag
    e.preventDefault();

    draggedPath = JSON.parse(itemDiv.dataset.indexPath);
    const draggedLevel = parseInt(itemDiv.dataset.level);

    itemDiv.style.cursor = 'grabbing';
    itemDiv.style.opacity = '0.5';
    itemDiv.style.userSelect = 'none';

    // Create drop indicator if it doesn't exist
    if (!dropIndicator) {
      dropIndicator = document.createElement('div');
      dropIndicator.style.position = 'absolute';
      dropIndicator.style.left = '0';
      dropIndicator.style.right = '0';
      dropIndicator.style.height = '2px';
      dropIndicator.style.pointerEvents = 'none';
      dropIndicator.style.display = 'none';
      dropIndicator.style.zIndex = '1000';
      document.body.appendChild(dropIndicator);
    }

    // Disable text selection on the document during drag
    document.body.style.userSelect = 'none';

    let currentDropZone = null;
    let currentTargetPath = null;

    function onMouseMove(event) {
      event.preventDefault();

      // Find all dropdown item divs
      const allItems = Array.from(document.querySelectorAll('.dropdown-item-draggable'));

      // Find which item we're hovering over
      let targetItem = null;
      for (const item of allItems) {
        if (item === itemDiv) continue; // Skip the dragged item

        const rect = item.getBoundingClientRect();
        if (event.clientY >= rect.top && event.clientY <= rect.bottom &&
            event.clientX >= rect.left && event.clientX <= rect.right) {
          targetItem = item;
          break;
        }
      }

      if (!targetItem) {
        dropIndicator.style.display = 'none';
        return;
      }

      const targetRect = targetItem.getBoundingClientRect();
      const targetLevel = parseInt(targetItem.dataset.level);
      const targetPath = JSON.parse(targetItem.dataset.indexPath);
      const y = event.clientY - targetRect.top;
      const height = targetRect.height;

      // Determine drop zone based on vertical position
      let dropZone;
      if (y < height * 0.25) {
        dropZone = 'before';
      } else if (y > height * 0.75) {
        dropZone = 'after';
      } else {
        // Center zone - check if nesting is allowed
        const canNest = targetLevel === 0 && !isDescendantOf(targetPath, draggedPath);
        dropZone = canNest ? 'nest' : 'after';
      }

      currentDropZone = dropZone;
      currentTargetPath = targetPath;

      // Show visual feedback
      dropIndicator.style.display = 'block';

      if (dropZone === 'nest') {
        // Green highlight for nesting
        dropIndicator.style.backgroundColor = '#2e844a';
        dropIndicator.style.height = '100%';
        dropIndicator.style.top = `${targetRect.top}px`;
        dropIndicator.style.left = `${targetRect.left}px`;
        dropIndicator.style.width = `${targetRect.width}px`;
        dropIndicator.style.opacity = '0.2';
      } else if (dropZone === 'before') {
        // Blue line for insert before
        dropIndicator.style.backgroundColor = '#0176d3';
        dropIndicator.style.height = '2px';
        dropIndicator.style.top = `${targetRect.top - 1}px`;
        dropIndicator.style.left = `${targetRect.left}px`;
        dropIndicator.style.width = `${targetRect.width}px`;
        dropIndicator.style.opacity = '1';
      } else {
        // Blue line for insert after
        dropIndicator.style.backgroundColor = '#0176d3';
        dropIndicator.style.height = '2px';
        dropIndicator.style.top = `${targetRect.bottom - 1}px`;
        dropIndicator.style.left = `${targetRect.left}px`;
        dropIndicator.style.width = `${targetRect.width}px`;
        dropIndicator.style.opacity = '1';
      }
    }

    function onMouseUp() {
      itemDiv.style.cursor = 'grab';
      itemDiv.style.opacity = '1';
      itemDiv.style.userSelect = '';

      // Hide drop indicator
      if (dropIndicator) {
        dropIndicator.style.display = 'none';
      }

      // Re-enable text selection
      document.body.style.userSelect = '';

      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      // Perform the drop operation
      if (currentDropZone && currentTargetPath) {
        performDropOperation(parentTab, draggedPath, currentTargetPath, currentDropZone);
      }

      currentDropZone = null;
      currentTargetPath = null;
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
}

/**
 * Check if targetPath is a descendant of sourcePath
 */
function isDescendantOf(targetPath, sourcePath) {
  if (sourcePath.length >= targetPath.length) return false;
  for (let i = 0; i < sourcePath.length; i++) {
    if (targetPath[i] !== sourcePath[i]) return false;
  }
  return true;
}

/**
 * Perform the drop operation
 */
function performDropOperation(parentTab, sourcePath, targetPath, dropZone) {

  // Get the dragged item
  const draggedItem = getItemByPath(parentTab.dropdownItems, sourcePath);
  if (!draggedItem) {
    return;
  }


  // Make a copy of the dragged item (this preserves nested dropdownItems)
  const itemCopy = JSON.parse(JSON.stringify(draggedItem));

  // Remove from source location
  removeItemByPath(parentTab.dropdownItems, sourcePath);

  // Adjust target path if necessary (if source was before target in same parent)
  let adjustedTargetPath = [...targetPath];
  if (sourcePath.length === targetPath.length) {
    const sameParent = sourcePath.slice(0, -1).every((val, idx) => val === targetPath[idx]);
    if (sameParent && sourcePath[sourcePath.length - 1] < targetPath[targetPath.length - 1]) {
      adjustedTargetPath[adjustedTargetPath.length - 1]--;
    }
  }

  // Insert at new location
  if (dropZone === 'nest') {
    // Add as child of target
    const targetItem = getItemByPath(parentTab.dropdownItems, adjustedTargetPath);
    if (!targetItem.dropdownItems) {
      targetItem.dropdownItems = [];
    }
    targetItem.dropdownItems.push(itemCopy);
    targetItem._expanded = true; // Auto-expand to show the new item
  } else if (dropZone === 'before') {
    // Insert before target
    insertItemAt(parentTab.dropdownItems, adjustedTargetPath, itemCopy, true);
  } else {
    // Insert after target
    insertItemAt(parentTab.dropdownItems, adjustedTargetPath, itemCopy, false);
  }


  // Save the changes to storage
  const tabs = SFTabs.main.getTabs();
  SFTabs.storage.saveTabs(tabs).then(() => {
    // Refresh the display
    showManageDropdownPanelItems(parentTab);
  }).catch(error => {
    SFTabs.main.showStatus('Error saving changes: ' + error.message, true);
  });
}

/**
 * Insert item at a specific path
 * @param {Array} items - Root items array
 * @param {Array} targetPath - Path to target item
 * @param {Object} newItem - Item to insert
 * @param {boolean} before - Insert before (true) or after (false) the target
 */
function insertItemAt(items, targetPath, newItem, before) {
  if (targetPath.length === 1) {
    // Top level insertion
    const index = before ? targetPath[0] : targetPath[0] + 1;
    items.splice(index, 0, newItem);
  } else {
    // Nested insertion - navigate to parent
    const parentPath = targetPath.slice(0, -1);
    const parent = getItemByPath(items, parentPath);
    if (parent && parent.dropdownItems) {
      const index = before ? targetPath[targetPath.length - 1] : targetPath[targetPath.length - 1] + 1;
      parent.dropdownItems.splice(index, 0, newItem);
    }
  }
}

/**
 * Promote a dropdown item to main tab list
 */
function promoteDropdownItem(parentTab, itemIndex) {

  const tabs = SFTabs.main.getTabs();
  const parentTabIndex = tabs.findIndex(t => t.id === parentTab.id);

  if (parentTabIndex === -1) {
    SFTabs.main.showStatus('Parent tab not found', true);
    return;
  }

  const dropdownItem = parentTab.dropdownItems[itemIndex];
  if (!dropdownItem) {
    SFTabs.main.showStatus('Dropdown item not found', true);
    return;
  }

  // Create a new main tab from the dropdown item (preserve nested items if any)
  const preservedDropdownItems = dropdownItem.dropdownItems || [];
  const newTab = {
    id: generateId(),
    label: dropdownItem.label,
    path: dropdownItem.path || '',
    openInNewTab: false,
    isObject: dropdownItem.isObject || false,
    isCustomUrl: dropdownItem.isCustomUrl || false,
    isSetupObject: false,
    hasDropdown: preservedDropdownItems.length > 0,
    dropdownItems: preservedDropdownItems,
    position: tabs.length
  };

  // Remove the item from the parent's dropdown
  parentTab.dropdownItems.splice(itemIndex, 1);

  // If no more dropdown items, remove hasDropdown flag
  if (parentTab.dropdownItems.length === 0) {
    parentTab.hasDropdown = false;
  }

  // Add the new tab to the main list
  tabs.push(newTab);

  // Save and refresh
  SFTabs.storage.saveTabs(tabs).then(() => {
    if (preservedDropdownItems.length > 0) {
      SFTabs.main.showStatus(`Promoted "${dropdownItem.label}" with ${preservedDropdownItems.length} nested items to main tab list`);
    } else {
      SFTabs.main.showStatus(`Promoted "${dropdownItem.label}" to main tab list`);
    }

    // Refresh the dropdown preview (but keep action panel open for multiple edits)
    if (parentTab.dropdownItems.length > 0) {
      showManageDropdownPanelItems(parentTab);
    } else {
      // If no more items, hide the manage panel but keep action panel open
      const domElements = SFTabs.main.getDOMElements();
      if (domElements.manageDropdownPreview) {
        domElements.manageDropdownPreview.style.display = 'none';
      }
    }

    // Don't call renderTabList() or hideTabForm() - keep action panel open for multiple edits
  }).catch(error => {
    SFTabs.main.showStatus('Error promoting item: ' + error.message, true);
  });
}

/**
 * Edit a dropdown item - opens action panel with the item's data
 */
function editDropdownItem(parentTab, itemIndex) {

  const dropdownItem = parentTab.dropdownItems[itemIndex];
  if (!dropdownItem) {
    SFTabs.main.showStatus('Dropdown item not found', true);
    return;
  }

  // Create a temporary tab object for editing
  const tempTab = {
    id: `dropdown-${parentTab.id}-${itemIndex}`, // Special ID to identify this as a dropdown item edit
    label: dropdownItem.label,
    path: dropdownItem.path || '',
    openInNewTab: false,
    isObject: dropdownItem.isObject || false,
    isCustomUrl: dropdownItem.isCustomUrl || false,
    isSetupObject: false,
    _isDropdownItemEdit: true, // Flag to indicate this is editing a dropdown item
    _parentTabId: parentTab.id,
    _dropdownItemIndex: itemIndex
  };

  // Open the action panel with this temp tab
  if (SFTabs.main && SFTabs.main.showActionPanel) {
    SFTabs.main.showActionPanel(tempTab);
  }
}

/**
 * Generate a unique ID for tabs
 */
function generateId() {
  return 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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
  promoteDropdownItem,
  editDropdownItem,
  setupEventListeners,
  getItemByPath,
  removeItemByPath
};