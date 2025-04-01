// DOM Elements
const tabList = document.getElementById('tab-list');
const emptyState = document.getElementById('empty-state');
const tabForm = document.getElementById('tab-form');
const formTitle = document.getElementById('form-title');
const tabNameInput = document.getElementById('tab-name');
const tabPathInput = document.getElementById('tab-path');
const openInNewTabCheckbox = document.getElementById('open-in-new-tab');
const addTabButton = document.getElementById('add-tab-button');
const saveButton = document.getElementById('save-button');
const cancelButton = document.getElementById('cancel-button');
const statusMessage = document.getElementById('status-message');

// State
let customTabs = [];
let editingTabId = null;
let draggedItem = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadTabsFromStorage();
  setupEventListeners();
});

// Load tabs from storage
function loadTabsFromStorage() {
  browser.storage.sync.get('customTabs')
    .then((result) => {
      if (result.customTabs && Array.isArray(result.customTabs)) {
        customTabs = result.customTabs;
        renderTabList();
      } else {
        // Initialize with default tab if no saved tabs
        customTabs = [{
          id: generateId(),
          label: 'User Management',
          path: 'ManageUsers',
          openInNewTab: false,
          position: 0
        }];
        saveTabsToStorage();
      }
    })
    .catch((error) => {
      showStatus('Error loading tabs: ' + error.message, true);
    });
}

// Save tabs to storage
function saveTabsToStorage() {
  // Sort tabs by position before saving
  customTabs.sort((a, b) => a.position - b.position);
  
  browser.storage.sync.set({ customTabs })
    .then(() => {
      renderTabList();
      showStatus('Settings saved', false);
    })
    .catch((error) => {
      showStatus('Error saving tabs: ' + error.message, true);
    });
}

// Setup event listeners
function setupEventListeners() {
  // Add tab button
  addTabButton.addEventListener('click', () => {
    showTabForm();
  });
  
  // Save button
  saveButton.addEventListener('click', () => {
    saveTabForm();
  });
  
  // Cancel button
  cancelButton.addEventListener('click', () => {
    hideTabForm();
  });
  
  // Enter key in form fields
  tabNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') saveTabForm();
  });
  
  tabPathInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') saveTabForm();
  });
}

// Render the tab list
function renderTabList() {
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

// Create tab list item element
function createTabElement(tab) {
  const tabItem = document.createElement('div');
  tabItem.className = 'tab-item';
  tabItem.dataset.id = tab.id;
  
  const dragHandle = document.createElement('div');
  dragHandle.className = 'drag-handle';
  dragHandle.innerHTML = '⋮⋮'; // Simple drag handle
  dragHandle.setAttribute('title', 'Drag to reorder');
  
  const tabInfo = document.createElement('div');
  tabInfo.className = 'tab-info';
  
  const tabName = document.createElement('div');
  tabName.className = 'tab-name';
  tabName.textContent = tab.label;
  
  const tabPath = document.createElement('div');
  tabPath.className = 'tab-path';
  tabPath.textContent = tab.path;
  
  const tabActions = document.createElement('div');
  tabActions.className = 'tab-actions';
  
  // New tab toggle
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
  
  // Delete button
  const deleteButton = document.createElement('button');
  deleteButton.className = 'delete-button';
  deleteButton.innerHTML = '×';
  deleteButton.setAttribute('title', 'Remove tab');
  deleteButton.addEventListener('click', () => {
    deleteTab(tab.id);
  });
  
  // Edit functionality
  tabInfo.addEventListener('click', () => {
    editTab(tab.id);
  });
  
  // Assemble the tab item
  tabInfo.appendChild(tabName);
  tabInfo.appendChild(tabPath);
  tabActions.appendChild(newTabToggle);
  tabActions.appendChild(deleteButton);
  
  tabItem.appendChild(dragHandle);
  tabItem.appendChild(tabInfo);
  tabItem.appendChild(tabActions);
  
  return tabItem;
}

// Setup drag and drop functionality
function setupDragAndDrop() {
  const tabItems = document.querySelectorAll('.tab-item');
  const dragHandles = document.querySelectorAll('.drag-handle');
  
  dragHandles.forEach((handle, index) => {
    const item = tabItems[index];
    
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      draggedItem = item;
      item.classList.add('dragging');
      
      // Store original positions
      const rect = item.getBoundingClientRect();
      const shiftX = e.clientX - rect.left;
      const shiftY = e.clientY - rect.top;
      
      // Move the element
      function moveAt(pageX, pageY) {
        item.style.position = 'absolute';
        item.style.zIndex = 1000;
        item.style.top = pageY - shiftY + 'px';
        item.style.left = pageX - shiftX + 'px';
      }
      
      moveAt(e.pageX, e.pageY);
      
      // Find the element under the dragged item
      function onMouseMove(event) {
        moveAt(event.pageX, event.pageY);
        
        // Hide the element so it doesn't interfere with elementFromPoint
        item.style.display = 'none';
        const elemBelow = document.elementFromPoint(event.clientX, event.clientY);
        item.style.display = '';
        
        if (!elemBelow) return;
        
        // Check if we're over another tab item
        const droppableItem = elemBelow.closest('.tab-item');
        if (droppableItem && droppableItem !== item) {
          // Determine if we should place above or below
          const rect = droppableItem.getBoundingClientRect();
          const middle = rect.top + rect.height / 2;
          
          if (event.clientY < middle) {
            tabList.insertBefore(item, droppableItem);
          } else {
            tabList.insertBefore(item, droppableItem.nextSibling);
          }
        }
      }
      
      // Move on mousemove
      document.addEventListener('mousemove', onMouseMove);
      
      // Drop and cleanup
      document.addEventListener('mouseup', function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        
        // Reset styles
        item.style.position = 'static';
        item.style.zIndex = '';
        item.style.top = '';
        item.style.left = '';
        item.classList.remove('dragging');
        
        // Update positions
        updateTabPositions();
      });
    });
  });
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

// Show tab form for adding/editing
function showTabForm(tabId = null) {
  // Clear previous values
  tabNameInput.value = '';
  tabPathInput.value = '';
  openInNewTabCheckbox.checked = false;
  
  if (tabId) {
    // Edit mode
    const tab = customTabs.find(t => t.id === tabId);
    if (tab) {
      editingTabId = tabId;
      formTitle.textContent = 'Edit Tab';
      tabNameInput.value = tab.label;
      tabPathInput.value = tab.path;
      openInNewTabCheckbox.checked = tab.openInNewTab;
    }
  } else {
    // Add mode
    editingTabId = null;
    formTitle.textContent = 'Add New Tab';
  }
  
  // Show the form
  tabForm.style.display = 'block';
  addTabButton.style.display = 'none';
  tabNameInput.focus();
}

// Hide tab form
function hideTabForm() {
  tabForm.style.display = 'none';
  addTabButton.style.display = 'block';
  editingTabId = null;
}

// Save tab form data
function saveTabForm() {
  const name = tabNameInput.value.trim();
  const path = tabPathInput.value.trim();
  
  if (!name || !path) {
    showStatus('Tab name and path are required', true);
    return;
  }
  
  if (editingTabId) {
    // Update existing tab
    const tab = customTabs.find(t => t.id === editingTabId);
    if (tab) {
      tab.label = name;
      tab.path = path;
      tab.openInNewTab = openInNewTabCheckbox.checked;
    }
  } else {
    // Add new tab
    const newTab = {
      id: generateId(),
      label: name,
      path: path,
      openInNewTab: openInNewTabCheckbox.checked,
      position: customTabs.length
    };
    
    customTabs.push(newTab);
  }
  
  saveTabsToStorage();
  hideTabForm();
}

// Delete tab
function deleteTab(tabId) {
  const confirmDelete = confirm('Are you sure you want to remove this tab?');
  
  if (confirmDelete) {
    customTabs = customTabs.filter(tab => tab.id !== tabId);
    saveTabsToStorage();
  }
}

// Edit tab
function editTab(tabId) {
  showTabForm(tabId);
}

// Generate a unique ID
function generateId() {
  return 'tab_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
}

// Show status message
function showStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.style.color = isError ? 'var(--red-50)' : 'var(--green-50)';
  
  // Clear message after a delay
  setTimeout(() => {
    statusMessage.textContent = '';
  }, 3000);
}