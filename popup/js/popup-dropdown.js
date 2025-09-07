// popup/js/popup-dropdowns.js
// Enhanced dropdown functionality with navigation caching

/**
 * Create dropdown arrow element
 */
function createDropdownArrow() {
  const dropdownArrow = document.createElement('button');
  dropdownArrow.className = 'dropdown-arrow';
  dropdownArrow.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  `;
  dropdownArrow.setAttribute('title', 'Show navigation menu');
  
  return dropdownArrow;
}

/**
 * Create enhanced dropdown menu with cached navigation
 */
function createEnhancedDropdownMenu(tab) {
  const dropdownMenu = document.createElement('div');
  dropdownMenu.className = 'dropdown-menu';
  
  // Get cached navigation or show loading state
  if (tab.cachedNavigation && tab.cachedNavigation.length > 0) {
    populateDropdownWithNavigation(dropdownMenu, tab);
  } else if (tab.isSetupObject && tab.autoSetupDropdown) {
    // Show loading state and attempt to fetch navigation
    showLoadingState(dropdownMenu, tab);
    attemptNavigationFetch(tab).then(() => {
      if (tab.cachedNavigation && tab.cachedNavigation.length > 0) {
        populateDropdownWithNavigation(dropdownMenu, tab);
      } else {
        showEmptyState(dropdownMenu, tab);
      }
    });
  } else {
    // Show placeholder for manual dropdown
    showManualDropdownState(dropdownMenu, tab);
  }
  
  return dropdownMenu;
}

/**
 * Populate dropdown with cached navigation items
 */
function populateDropdownWithNavigation(dropdownMenu, tab) {
  // Clear existing content
  dropdownMenu.innerHTML = '';
  
  // Add main tab link first
  const mainItem = document.createElement('a');
  mainItem.className = 'dropdown-item main-item';
  mainItem.textContent = tab.label;
  mainItem.href = '#';
  mainItem.addEventListener('click', (e) => {
    e.preventDefault();
    navigateToMainTab(tab);
    closeAllDropdowns();
  });
  dropdownMenu.appendChild(mainItem);
  
  // Add separator
  const separator = document.createElement('div');
  separator.className = 'dropdown-separator';
  dropdownMenu.appendChild(separator);
  
  // Add navigation items
  tab.cachedNavigation.forEach((navItem, index) => {
    const item = document.createElement('a');
    item.className = 'dropdown-item nav-item';
    item.textContent = navItem.label;
    item.href = '#';
    item.setAttribute('data-nav-path', navItem.path);
    item.setAttribute('data-nav-id', navItem.id);
    
    if (navItem.isActive) {
      item.classList.add('active');
    }
    
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigateToNavigationItem(navItem, tab);
      closeAllDropdowns();
    });
    
    dropdownMenu.appendChild(item);
  });
  
  // Add refresh option at the bottom
  if (tab.isSetupObject && tab.autoSetupDropdown) {
    const refreshSeparator = document.createElement('div');
    refreshSeparator.className = 'dropdown-separator';
    dropdownMenu.appendChild(refreshSeparator);
    
    const refreshItem = document.createElement('a');
    refreshItem.className = 'dropdown-item refresh-item';
    refreshItem.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="23 4 23 10 17 10"></polyline>
        <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10"></path>
        <polyline points="1 20 1 14 7 14"></polyline>
        <path d="M3.51 15a9 9 0 0 0 14.85 4.36L23 14"></path>
      </svg>
      Refresh Navigation
    `;
    refreshItem.href = '#';
    refreshItem.addEventListener('click', (e) => {
      e.preventDefault();
      refreshTabNavigation(tab);
      closeAllDropdowns();
    });
    
    dropdownMenu.appendChild(refreshItem);
  }
}

/**
 * Show loading state in dropdown
 */
function showLoadingState(dropdownMenu, tab) {
  dropdownMenu.innerHTML = `
    <div class="dropdown-item placeholder">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12a9 9 0 11-6.219-8.56"/>
      </svg>
      Loading navigation...
    </div>
  `;
}

/**
 * Show empty state when no navigation found
 */
function showEmptyState(dropdownMenu, tab) {
  dropdownMenu.innerHTML = `
    <div class="dropdown-item placeholder">No navigation items found</div>
    <div class="dropdown-separator"></div>
    <a href="#" class="dropdown-item refresh-item">Try Refresh</a>
  `;
  
  const refreshItem = dropdownMenu.querySelector('.refresh-item');
  refreshItem.addEventListener('click', (e) => {
    e.preventDefault();
    refreshTabNavigation(tab);
    closeAllDropdowns();
  });
}

/**
 * Show manual dropdown state for non-auto dropdowns
 */
function showManualDropdownState(dropdownMenu, tab) {
  dropdownMenu.innerHTML = `
    <div class="dropdown-item placeholder">Manual dropdown - add child tabs</div>
  `;
}

/**
 * Navigate to main tab
 */
function navigateToMainTab(tab) {
  if (SFTabs.ui && SFTabs.ui.navigateToTab) {
    SFTabs.ui.navigateToTab(tab);
  }
}

/**
 * Navigate to a navigation item
 */
function navigateToNavigationItem(navItem, parentTab) {
  console.log('Navigating to navigation item:', navItem.label, navItem.path);
  
  // Build full URL
  const baseUrl = window.location.origin;
  const fullUrl = `${baseUrl}${navItem.path}`;
  
  if (parentTab.openInNewTab) {
    window.open(fullUrl, '_blank');
  } else {
    // Check Lightning Navigation setting
    const lightningEnabled = SFTabs.main.getUserSettings().lightningNavigation;
    
    if (lightningEnabled) {
      // Send message to content script for Lightning navigation
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
 * Attempt to fetch navigation from current tab
 */
function attemptNavigationFetch(tab) {
  return new Promise((resolve) => {
    // Only attempt if browser API is available
    if (typeof browser === 'undefined') {
      resolve();
      return;
    }
    
    browser.tabs.query({ active: true, currentWindow: true })
      .then(tabs => {
        if (tabs[0]) {
          return browser.tabs.sendMessage(tabs[0].id, { action: 'parse_navigation' });
        }
        throw new Error('No active tab');
      })
      .then(response => {
        if (response && response.success && response.navigation) {
          // Update tab with navigation data
          tab.cachedNavigation = response.navigation;
          tab.navigationLastUpdated = Date.now();
          tab.needsNavigationRefresh = false;
          
          console.log('Successfully cached navigation for tab:', tab.label);
          
          // Save updated tab
          const tabs = SFTabs.main.getTabs();
          const tabIndex = tabs.findIndex(t => t.id === tab.id);
          if (tabIndex >= 0) {
            tabs[tabIndex] = tab;
            SFTabs.storage.saveTabs(tabs);
          }
        }
        resolve();
      })
      .catch(error => {
        console.log('Could not fetch navigation:', error);
        resolve();
      });
  });
}

/**
 * Get navigation data for a tab - used by quick add
 */
function getNavigationForTab(tab) {
  return new Promise((resolve) => {
    if (tab.cachedNavigation && tab.cachedNavigation.length > 0) {
      resolve(tab.cachedNavigation);
      return;
    }
    
    attemptNavigationFetch(tab).then(() => {
      resolve(tab.cachedNavigation || []);
    });
  });
}

/**
 * Refresh navigation for a specific tab
 */
function refreshTabNavigation(tab) {
  console.log('Refreshing navigation for tab:', tab.label);
  
  // Show loading in status
  SFTabs.main.showStatus('Refreshing navigation...', false);
  
  // Clear existing cache
  tab.cachedNavigation = [];
  tab.navigationLastUpdated = null;
  tab.needsNavigationRefresh = true;
  
  // Attempt to fetch fresh navigation
  attemptNavigationFetch(tab).then(() => {
    if (tab.cachedNavigation && tab.cachedNavigation.length > 0) {
      SFTabs.main.showStatus(`Updated navigation for "${tab.label}" (${tab.cachedNavigation.length} items)`, false);
    } else {
      SFTabs.main.showStatus('No navigation items found. Make sure you\'re on the object page.', true);
    }
    
    // Re-render the tab list to update dropdowns
    if (SFTabs.ui && SFTabs.ui.renderTabList) {
      SFTabs.ui.renderTabList();
    }
  });
}

/**
 * Manual refresh for editing tabs
 */
function manualRefreshTabNavigation(tabId) {
  const tab = SFTabs.tabs.getTabById(tabId);
  if (!tab) {
    SFTabs.main.showStatus('Tab not found', true);
    return false;
  }
  
  if (!tab.isSetupObject || !tab.autoSetupDropdown) {
    SFTabs.main.showStatus('Tab must be a Setup Object with Auto Setup Dropdown enabled', true);
    return false;
  }
  
  refreshTabNavigation(tab);
  return true;
}

/**
 * Toggle dropdown visibility
 */
function toggleDropdown(tabItem, arrow, menu) {
  const isOpen = menu.classList.contains('show');
  
  // Close all other dropdowns first
  closeAllDropdowns();
  
  if (!isOpen) {
    // Open this dropdown
    menu.classList.add('show');
    arrow.classList.add('open');
    
    // Position dropdown correctly
    positionDropdown(tabItem, menu);
  }
}

/**
 * Position dropdown menu properly
 */
function positionDropdown(tabItem, menu) {
  // Reset positioning
  menu.style.top = '';
  menu.style.bottom = '';
  
  // Check if there's enough space below
  const tabRect = tabItem.getBoundingClientRect();
  const menuHeight = menu.scrollHeight;
  const viewportHeight = window.innerHeight;
  const spaceBelow = viewportHeight - tabRect.bottom;
  
  if (spaceBelow < menuHeight + 20 && tabRect.top > menuHeight + 20) {
    // Not enough space below, show above
    menu.style.bottom = '100%';
    menu.style.marginBottom = '4px';
  } else {
    // Show below (default)
    menu.style.top = '100%';
    menu.style.marginTop = '4px';
  }
}

/**
 * Close all open dropdowns
 */
function closeAllDropdowns() {
  document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
    menu.classList.remove('show');
    const arrow = menu.parentElement.querySelector('.dropdown-arrow');
    if (arrow) {
      arrow.classList.remove('open');
    }
  });
}

/**
 * Setup dropdown-related event listeners
 */
function setupEventListeners() {
  // Global click listener to close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.has-dropdown')) {
      closeAllDropdowns();
    }
  });
  
  console.log('Enhanced dropdown event listeners setup complete');
}

// Export enhanced dropdown functions
window.SFTabs = window.SFTabs || {};
window.SFTabs.dropdowns = {
  createDropdownArrow,
  createEnhancedDropdownMenu,
  toggleDropdown,
  closeAllDropdowns,
  navigateToNavigationItem,
  manualRefreshTabNavigation,
  refreshTabNavigation,
  getNavigationForTab,
  setupEventListeners
};