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
  
  // Check if this tab should have a dropdown
  const allTabs = SFTabs.main.getTabs();
  const childTabs = allTabs.filter(t => t.parentId === tab.id);
  const hasAnyDropdown = tab.hasDropdown || tab.autoSetupDropdown || childTabs.length > 0;
  
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
  
  // Add dropdown menu if needed
  if (hasAnyDropdown && SFTabs.dropdowns) {
    const dropdownMenu = SFTabs.dropdowns.createEnhancedDropdownMenu(tab);
    tabItem.appendChild(dropdownMenu);
  }
  
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
  
  if (hasDropdown && SFTabs.dropdowns) {
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'tab-content-wrapper';
    contentWrapper.appendChild(tabName);
    
    const dropdownArrow = SFTabs.dropdowns.createDropdownArrow();
    contentWrapper.appendChild(dropdownArrow);
    textContainer.appendChild(contentWrapper);
  } else {
    textContainer.appendChild(tabName);
  }
  
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
  
  if (hasDropdown && SFTabs.dropdowns) {
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'tab-content-wrapper';
    contentWrapper.appendChild(tabName);
    
    const dropdownArrow = SFTabs.dropdowns.createDropdownArrow();
    contentWrapper.appendChild(dropdownArrow);
    container.appendChild(contentWrapper);
  } else {
    container.appendChild(tabName);
  }
  
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
  if (hasDropdown) {
    // For dropdown tabs, only the tab name should be clickable for editing
    tabName.addEventListener('click', (e) => {
      e.stopPropagation();
      editTab(tab.id);
    });
    
    // Add dropdown toggle handler to the dropdown arrow
    const dropdownArrow = contentContainer.querySelector('.dropdown-arrow');
    if (dropdownArrow && SFTabs.dropdowns) {
      dropdownArrow.addEventListener('click', (e) => {
        e.stopPropagation();
        const tabItem = e.target.closest('.tab-item');
        const dropdownMenu = tabItem.querySelector('.dropdown-menu');
        SFTabs.dropdowns.toggleDropdown(tabItem, dropdownArrow, dropdownMenu);
      });
    }
    
    // Main tab navigation on content wrapper click (avoiding arrow)
    const contentWrapper = contentContainer.querySelector('.tab-content-wrapper');
    if (contentWrapper) {
      contentWrapper.addEventListener('click', (e) => {
        // Only navigate if not clicking on dropdown arrow
        if (!e.target.closest('.dropdown-arrow')) {
          navigateToTab(tab);
        }
      });
    }
  } else {
    // For regular tabs: 
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
 * Create tab actions (new tab toggle and delete button)
 */
function createTabActions(tab) {
  const actionsContainer = document.createElement('div');
  actionsContainer.className = 'tab-actions';
  
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
    domElements.formTitle.textContent = 'Add New Tab';
    
    // Auto-detect current page for setup objects
    autoDetectCurrentPage();
    
    domElements.tabList.after(domElements.tabForm);
  }

  // Update dropdown control visibility and show form
  updateDropdownControlVisibility();
  domElements.tabForm.style.display = 'block';
  domElements.tabNameInput.focus();
}

/**
 * Reset the tab form to initial state
 */
function resetTabForm() {
  const domElements = SFTabs.main.getDOMElements();
  
  domElements.tabNameInput.value = '';
  domElements.tabPathInput.value = '';
  domElements.openInNewTabCheckbox.checked = false;
  domElements.isObjectCheckbox.checked = false;
  domElements.isCustomUrlCheckbox.checked = false;
  domElements.isSetupObjectCheckbox.checked = false;
  
  if (domElements.hasDropdownCheckbox) domElements.hasDropdownCheckbox.checked = false;
  if (domElements.autoSetupDropdownCheckbox) domElements.autoSetupDropdownCheckbox.checked = false;
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
  domElements.formTitle.textContent = 'Edit Tab';
  
  // Populate form fields
  domElements.tabNameInput.value = tab.label;
  domElements.tabPathInput.value = tab.path;
  domElements.openInNewTabCheckbox.checked = tab.openInNewTab;
  domElements.isObjectCheckbox.checked = tab.isObject || false;
  domElements.isCustomUrlCheckbox.checked = tab.isCustomUrl || false;
  domElements.isSetupObjectCheckbox.checked = tab.isSetupObject || false;
  
  if (domElements.hasDropdownCheckbox) domElements.hasDropdownCheckbox.checked = tab.hasDropdown || false;
  if (domElements.autoSetupDropdownCheckbox) domElements.autoSetupDropdownCheckbox.checked = tab.autoSetupDropdown || false;
}

/**
 * Auto-detect current page for setup object detection
 */
function autoDetectCurrentPage() {
  const domElements = SFTabs.main.getDOMElements();
  
  browser.tabs.query({ active: true, currentWindow: true })
    .then(tabs => {
      if (tabs.length > 0) {
        const currentUrl = tabs[0].url;
        const currentPageInfo = SFTabs.utils ? SFTabs.utils.getCurrentPageInfo() : null;
        
        if (currentPageInfo && currentPageInfo.type === 'objectManager') {
          domElements.isSetupObjectCheckbox.checked = true;
          if (domElements.autoSetupDropdownCheckbox) domElements.autoSetupDropdownCheckbox.checked = true;
          if (domElements.hasDropdownCheckbox) domElements.hasDropdownCheckbox.checked = true;
        }
      }
    })
    .catch(error => console.log('Could not check current URL'));
}

/**
 * Update dropdown control visibility based on form state
 */
function updateDropdownControlVisibility() {
  const domElements = SFTabs.main.getDOMElements();
  
  const isSetupObjectChecked = domElements.isSetupObjectCheckbox.checked;
  const editingTabId = SFTabs.main.getEditingTabId();
  
  // Show/hide auto setup dropdown based on setup object status
  if (domElements.autoSetupDropdownGroup) {
    domElements.autoSetupDropdownGroup.style.display = isSetupObjectChecked ? 'block' : 'none';
  }
  
  // Show refresh navigation button if editing a tab with cached navigation
  if (domElements.refreshNavGroup && editingTabId) {
    const tab = SFTabs.tabs.getTabById(editingTabId);
    const showRefresh = tab && tab.isSetupObject && tab.autoSetupDropdown;
    domElements.refreshNavGroup.style.display = showRefresh ? 'block' : 'none';
  } else if (domElements.refreshNavGroup) {
    domElements.refreshNavGroup.style.display = 'none';
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
  
  const name = domElements.tabNameInput.value.trim();
  const path = domElements.tabPathInput.value.trim();

  if (!name || !path) {
    SFTabs.main.showStatus('Tab name and path are required', true);
    return;
  }

  // Get checkbox values
  const isObject = domElements.isObjectCheckbox.checked;
  const isCustomUrl = domElements.isCustomUrlCheckbox.checked;
  const isSetupObject = domElements.isSetupObjectCheckbox.checked;
  const hasDropdown = domElements.hasDropdownCheckbox?.checked || false;
  const autoSetupDropdown = domElements.autoSetupDropdownCheckbox?.checked || false;

  // Validation
  if (isSetupObject && (isObject || isCustomUrl)) {
    SFTabs.main.showStatus('Setup Object cannot be combined with Object or Custom URL', true);
    return;
  }

  if (isObject && isCustomUrl) {
    SFTabs.main.showStatus('Tab cannot be both Object and Custom URL', true);
    return;
  }

  if (autoSetupDropdown && !isSetupObject) {
    SFTabs.main.showStatus('Auto Setup Dropdown requires Setup Object to be enabled', true);
    return;
  }

  const tabData = {
    label: name,
    path: path,
    openInNewTab: domElements.openInNewTabCheckbox.checked,
    isObject: isObject,
    isCustomUrl: isCustomUrl,
    isSetupObject: isSetupObject,
    hasDropdown: hasDropdown,
    autoSetupDropdown: autoSetupDropdown
  };

  const editingTabId = SFTabs.main.getEditingTabId();
  
  if (editingTabId) {
    // Update existing tab
    SFTabs.tabs.updateTab(editingTabId, tabData).then(() => {
      console.log('Tab updated successfully');
      hideTabForm();
    });
  } else {
    // Create new tab
    SFTabs.tabs.createTab(tabData).then(() => {
      console.log('Tab created successfully');
      hideTabForm();
    });
  }
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