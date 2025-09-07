// content/tab-renderer.js
// Tab rendering in Salesforce pages

/**
 * Initialize tabs in the given container
 */
function initTabs(tabContainer) {
  if (!tabContainer) {
    console.log("No tab container found");
    return;
  }

  browser.storage.sync.get(['customTabs', 'userSettings']).then(result => {
    let tabsToUse = [];
    
    if (result.customTabs && Array.isArray(result.customTabs) && result.customTabs.length > 0) {
      tabsToUse = result.customTabs;
    } else {
      // Get default tabs from constants if available, otherwise use fallback
      if (window.SFTabs && window.SFTabs.constants && window.SFTabs.constants.DEFAULT_TABS) {
        tabsToUse = window.SFTabs.constants.DEFAULT_TABS;
      } else {
        // Fallback default tabs
        tabsToUse = [
          {
            id: 'default_tab_flows',
            label: 'Flows',
            path: 'Flows',
            openInNewTab: false,
            isObject: false,
            isCustomUrl: false,
            isSetupObject: false,
            position: 0
          },
          {
            id: 'default_tab_packages',
            label: 'Installed Packages',
            path: 'ImportedPackage',
            openInNewTab: false,
            isObject: false,
            isCustomUrl: false,
            isSetupObject: false,
            position: 1
          },
          {
            id: 'default_tab_users',
            label: 'Users',
            path: 'ManageUsers',
            openInNewTab: false,
            isObject: false,
            isCustomUrl: false,
            isSetupObject: false,
            position: 2
          },
          {
            id: 'default_tab_profiles',
            label: 'Profiles',
            path: 'EnhancedProfiles',
            openInNewTab: false,
            isObject: false,
            isCustomUrl: false,
            isSetupObject: false,
            position: 3
          },
          {
            id: 'default_tab_permsets',
            label: 'Permission Sets',
            path: 'PermSets',
            openInNewTab: false,
            isObject: false,
            isCustomUrl: false,
            isSetupObject: false,
            position: 4
          }
        ];
      }
      browser.storage.sync.set({ customTabs: tabsToUse });
    }
    
    // Sort tabs by position (only top-level tabs)
    const topLevelTabs = getTopLevelTabs(tabsToUse);
    
    // Remove any existing custom tabs
    const existingTabs = tabContainer.querySelectorAll('.sf-tabs-custom-tab');
    existingTabs.forEach(tab => tab.remove());
    
    // Add tabs to the container
    for (const tab of topLevelTabs) {
      const tabElement = createTabElementWithDropdown(tab);
      tabContainer.appendChild(tabElement);
    }
    
    // Add click event listeners
    addTabClickListeners(topLevelTabs);
    highlightActiveTab();
    
    // Try to refresh navigation for setup object tabs on current page
    refreshNavigationForCurrentPage();
    
    console.log("Enhanced tabs successfully added to container");
  }).catch(error => {
    console.error("Error loading tabs:", error);
  });
}

/**
 * Get top-level tabs only (no parents)
 */
function getTopLevelTabs(allTabs) {
  return allTabs.filter(tab => !tab.parentId).sort((a, b) => a.position - b.position);
}

/**
 * Create tab element with dropdown functionality
 */
function createTabElementWithDropdown(tab) {
  // Get the base URL for the current org
  const currentUrl = window.location.href;
  const baseUrlSetup = currentUrl.split('/lightning/setup/')[0] + '/lightning/setup/';
  const baseUrlObject = currentUrl.split('/lightning/setup/')[0] + '/lightning/o/';
  const baseUrlRoot = currentUrl.split('/lightning/setup/')[0];
  
  // Determine the full URL based on tab type
  const fullUrl = buildFullUrl(tab, baseUrlRoot, baseUrlSetup, baseUrlObject);
  
  // Create the tab element
  const li = document.createElement('li');
  li.setAttribute('role', 'presentation');
  li.className = 'oneConsoleTabItem tabItem slds-context-bar__item borderRight navexConsoleTabItem sf-tabs-custom-tab';
  li.setAttribute('data-aura-class', 'navexConsoleTabItem');
  li.setAttribute('data-tab-id', tab.id);
  li.setAttribute('data-url', fullUrl);
  
  // Add dropdown indicator classes if tab has dropdown functionality
  if (tab.hasDropdown || tab.autoSetupDropdown || (tab.cachedNavigation && tab.cachedNavigation.length > 0)) {
    li.classList.add('has-dropdown');
    
    // Add navigation count if available
    if (tab.cachedNavigation && tab.cachedNavigation.length > 0) {
      li.setAttribute('data-nav-count', tab.cachedNavigation.length);
    }
  }
  
  // Create the anchor element
  const a = document.createElement('a');
  a.setAttribute('role', 'tab');
  a.setAttribute('tabindex', '-1');
  a.setAttribute('title', tab.label);
  a.setAttribute('aria-selected', 'false');
  a.setAttribute('href', fullUrl);
  
  // Set target based on openInNewTab property
  if (tab.openInNewTab) {
    a.setAttribute('target', '_blank');
  } else {
    a.setAttribute('target', '_self');
  }
  
  // Add appropriate classes
  a.classList.add('tabHeader', 'slds-context-bar__label-action');
  
  // Create span for tab title
  const span = document.createElement('span');
  span.classList.add('title', 'slds-truncate');
  span.textContent = tab.label;
  
  // Add dropdown arrow if tab has dropdown functionality
  if (tab.hasDropdown || tab.autoSetupDropdown || (tab.cachedNavigation && tab.cachedNavigation.length > 0)) {
    const dropdownArrow = document.createElement('span');
    dropdownArrow.className = 'dropdown-arrow-inline';
    dropdownArrow.innerHTML = `
    <svg focusable="false" aria-hidden="true" viewBox="0 0 520 520" class="slds-icon slds-icon_xx-small" style="width: 12px; height: 12px; fill: currentColor;">
      <path d="M476 178L271 385c-6 6-16 6-22 0L44 178c-6-6-6-16 0-22l22-22c6-6 16-6 22 0l161 163c6 6 16 6 22 0l161-162c6-6 16-6 22 0l22 22c5 6 5 15 0 21z"></path>
    </svg>
    `;
    dropdownArrow.style.cssText = `
      opacity: 0.7;
      margin-left: 4px;
      cursor: pointer;
      user-select: none;
      display: inline-flex;
      align-items: center;
    `;
    
    span.appendChild(dropdownArrow);
    
    // Create dropdown menu if navigation data exists
    if (tab.cachedNavigation && tab.cachedNavigation.length > 0) {
      const dropdown = createInlineDropdownMenu(tab);
      li.appendChild(dropdown);
      
      // Add dropdown toggle handler
      dropdownArrow.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        toggleInlineDropdown(dropdown);
      });
    }
  }
  
  // Assemble the elements
  a.appendChild(span);
  li.appendChild(a);
  
  return li;
}

/**
 * Create inline dropdown menu with pure Salesforce styling
 */
function createInlineDropdownMenu(tab) {
  const dropdown = document.createElement('div');
  dropdown.className = 'sf-tabs-inline-dropdown slds-dropdown slds-dropdown_left';
  dropdown.style.cssText = `
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 1000;
    min-width: 200px;
    max-width: 350px;
    display: none;
    max-height: 300px;
    overflow-y: auto;
  `;

    dropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  // Create dropdown list using Salesforce classes
  const dropdownList = document.createElement('ul');
  dropdownList.className = 'slds-dropdown__list';
  dropdownList.setAttribute('role', 'menu');
  
  // Add main tab link first - using Salesforce dropdown item classes
  const mainItemLi = document.createElement('li');
  mainItemLi.className = 'slds-dropdown__item';
  mainItemLi.setAttribute('role', 'presentation');
  
  const mainItem = document.createElement('a');
  mainItem.href = '#';
  mainItem.className = 'slds-dropdown__link';
  mainItem.setAttribute('role', 'menuitem');
  mainItem.textContent = tab.label;
  mainItem.style.fontWeight = '600';
  
  mainItem.addEventListener('click', (e) => {
    e.preventDefault();
    navigateToMainTab(tab);
    dropdown.style.display = 'none';
  });
  
  mainItemLi.appendChild(mainItem);
  dropdownList.appendChild(mainItemLi);
  
  // Add separator
  const separator = document.createElement('li');
  separator.className = 'slds-has-divider_top-space';
  separator.setAttribute('role', 'separator');
  dropdownList.appendChild(separator);
  
  // Add navigation items using Salesforce dropdown classes
  tab.cachedNavigation.forEach(navItem => {
    const itemLi = document.createElement('li');
    itemLi.className = 'slds-dropdown__item';
    itemLi.setAttribute('role', 'presentation');
    
    const item = document.createElement('a');
    item.href = '#';
    item.className = 'slds-dropdown__link';
    item.setAttribute('role', 'menuitem');
    item.textContent = navItem.label;
    
    if (navItem.isActive) {
      item.classList.add('slds-is-selected');
    }
    
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigateToNavigationItem(navItem, tab);
      dropdown.style.display = 'none';
    });
    
    itemLi.appendChild(item);
    dropdownList.appendChild(itemLi);
  });
  
  dropdown.appendChild(dropdownList);
  return dropdown;
}

/**
 * Toggle inline dropdown visibility
 */
function toggleInlineDropdown(dropdown) {
  // Close all other dropdowns first
  document.querySelectorAll('.sf-tabs-inline-dropdown').forEach(d => {
    if (d !== dropdown) {
      d.style.display = 'none';
    }
  });
  
  // Toggle this dropdown
  dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

/**
 * Navigate to main tab
 */
function navigateToMainTab(tab) {
  console.log('SF Tabs: Navigating to main tab:', tab.label);
  
  const currentUrl = window.location.href;
  const baseUrlSetup = currentUrl.split('/lightning/setup/')[0] + '/lightning/setup/';
  const baseUrlObject = currentUrl.split('/lightning/setup/')[0] + '/lightning/o/';
  const baseUrlRoot = currentUrl.split('/lightning/setup/')[0];
  
  const fullUrl = buildFullUrl(tab, baseUrlRoot, baseUrlSetup, baseUrlObject);
  
  if (tab.openInNewTab) {
    window.open(fullUrl, '_blank');
  } else {
    const lightningEnabled = isLightningNavigationEnabled();
    if (lightningEnabled) {
      lightningNavigate({
        navigationType: "url",
        url: fullUrl
      }, fullUrl);
    } else {
      window.location.href = fullUrl;
    }
  }
}

/**
 * Navigate to a navigation item from dropdown
 */
function navigateToNavigationItem(navItem, parentTab) {
  console.log('SF Tabs: Navigating to navigation item:', navItem.label);
  
  const baseUrl = window.location.origin;
  const fullUrl = `${baseUrl}${navItem.path || navItem.url}`;
  
  if (parentTab.openInNewTab) {
    window.open(fullUrl, '_blank');
  } else {
    const lightningEnabled = isLightningNavigationEnabled();
    if (lightningEnabled) {
      lightningNavigate({
        navigationType: "url",
        url: fullUrl
      }, fullUrl);
    } else {
      window.location.href = fullUrl;
    }
  }
}

/**
 * Build full URL from tab configuration
 */
function buildFullUrl(tab, baseUrlRoot, baseUrlSetup, baseUrlObject) {
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
  
  return fullUrl;
}

/**
 * Add click event listeners for tabs with Lightning navigation support
 */
function addTabClickListeners(tabs) {
  tabs.forEach(tab => {
    const links = document.querySelectorAll(`li[data-tab-id="${tab.id}"] a`);
    links.forEach(link => {
      link.addEventListener('click', event => {
        // If clicking on dropdown arrow, don't navigate
        if (event.target.closest('.dropdown-arrow-inline')) {
          return;
        }
        
        // If clicking within the dropdown menu, don't navigate
        if (event.target.closest('.sf-tabs-inline-dropdown')) {
          return;
        }
        
        const lightningEnabled = isLightningNavigationEnabled();
        console.log('Tab clicked:', tab.label, 'Lightning Navigation enabled:', lightningEnabled, 'Open in new tab:', tab.openInNewTab);
        
        if (tab.openInNewTab) {
          // For new tab, always use window.open
          event.preventDefault();
          window.open(link.href, '_blank');
        } else {
          // For same tab, check if Lightning navigation is enabled
          if (lightningEnabled) {
            // Use Lightning navigation
            console.log('Using Lightning navigation for:', link.href);
            event.preventDefault();
            lightningNavigate({
              navigationType: "url",
              url: link.href
            }, link.href);
          } else {
            // Lightning navigation is disabled, use regular navigation
            console.log('Using regular navigation for:', link.href);
            event.preventDefault();
            window.location.href = link.href;
          }
        }
      });
    });
  });
}

/**
 * Check if Lightning Navigation is enabled
 */
function isLightningNavigationEnabled() {
  const localStorageValue = localStorage.getItem("lightningNavigation");
  if (localStorageValue !== null) {
    return JSON.parse(localStorageValue);
  }
  return true; // Default to true
}

/**
 * Lightning navigation function
 */
function lightningNavigate(details, fallbackURL) {
  if (!isLightningNavigationEnabled()) {
    console.log("Lightning Navigation disabled - using regular navigation");
    window.location.href = fallbackURL;
    return;
  }

  console.log("Attempting Lightning navigation...");
  
  // Try inject.js window function approach first
  if (window.sfTabsLightningNav) {
    console.log("Using inject.js window function approach");
    const success = window.sfTabsLightningNav({
      navigationType: details.navigationType || "url",
      url: details.url || fallbackURL,
      recordId: details.recordId || null
    });
    
    if (success) {
      console.log("Lightning navigation initiated successfully");
      return;
    }
  }
  
  // Final fallback
  console.log("No Lightning navigation available - using regular navigation");
  window.location.href = fallbackURL;
}

/**
 * Highlight active custom tab and show current section
 */
function highlightActiveTab() {
  const currentUrl = window.location.href;
  
  browser.storage.sync.get('customTabs').then(result => {
    const tabs = result.customTabs || [];
    const topLevelTabs = getTopLevelTabs(tabs);
    let matchedTab = null;

    for (const tab of topLevelTabs) {
      const tabElement = document.querySelector(`li[data-tab-id="${tab.id}"]`);
      if (tabElement) {
        const tabUrl = tabElement.getAttribute('data-url');
        if (tabUrl && currentUrl.startsWith(tabUrl.split('/Details')[0])) { // Match base ObjectManager URL
          matchedTab = tab;
          break;
        }
      }
    }

    if (matchedTab) {
      console.log(`Highlighting active custom tab: ${matchedTab.label}`);

      // Remove active state from all tabs
      const allTabs = document.querySelectorAll('.tabBarItems .tabItem');
      allTabs.forEach(tabEl => {
        tabEl.classList.remove('slds-is-active');
        const anchor = tabEl.querySelector('a');
        if (anchor) anchor.setAttribute('aria-selected', 'false');
      });

      // Add active state to matched tab
      const activeEl = document.querySelector(`li[data-tab-id="${matchedTab.id}"]`);
      if (activeEl) {
        activeEl.classList.add('slds-is-active');
        const anchor = activeEl.querySelector('a');
        if (anchor) anchor.setAttribute('aria-selected', 'true');
      }
      
    }
  }).catch(error => {
    console.error("Error highlighting active tab:", error);
  });
}

/**
 * Add visual indicator showing current section
 */
function addActiveIndicatorToTab(tab, currentNavItem) {
  const tabElement = document.querySelector(`li[data-tab-id="${tab.id}"]`);
  if (!tabElement) return;
  
  // Remove existing indicator
  const existingIndicator = tabElement.querySelector('.active-section-indicator');
  if (existingIndicator) {
    existingIndicator.remove();
  }
  
  // Add new indicator
  const indicator = document.createElement('div');
  indicator.className = 'active-section-indicator';
  indicator.style.cssText = `
    font-size: 10px;
    color: var(--lwc-brandPrimary);
    margin-top: 2px;
    text-align: center;
    font-weight: 500;
    line-height: 1;
  `;
  indicator.textContent = currentNavItem.label;
  
  const span = tabElement.querySelector('.title').parentNode;
  span.appendChild(indicator);
}

/**
 * Refresh navigation for tabs matching the current page
 */
function refreshNavigationForCurrentPage() {
  if (!window.SFTabsContent || !window.SFTabsContent.navigationParser) {
    console.log("Navigation parser not available");
    return;
  }
  
  const currentPageInfo = window.SFTabsContent.navigationParser.getCurrentPageInfo();
  if (!currentPageInfo || currentPageInfo.type !== 'objectManager') {
    return;
  }
  
  browser.storage.sync.get('customTabs').then(result => {
    const tabs = result.customTabs || [];
    
    // Find tabs that match the current page and need navigation refresh
    const matchingTabs = tabs.filter(tab => 
      tab.isSetupObject && 
      isCurrentPageMatchingTab(tab, currentPageInfo) && 
      (tab.needsNavigationRefresh || !tab.cachedNavigation || tab.cachedNavigation.length === 0)
    );
    
    let updatedCount = 0;
    matchingTabs.forEach(tab => {
      const navigation = window.SFTabsContent.navigationParser.parseCurrentObjectManagerNavigation();
      if (navigation.length > 0) {
        tab.cachedNavigation = navigation;
        tab.navigationLastUpdated = Date.now();
        tab.needsNavigationRefresh = false;
        updatedCount++;
      }
    });
    
    if (updatedCount > 0) {
      browser.storage.sync.set({ customTabs: tabs });
      console.log(`Refreshed navigation for ${updatedCount} tabs`);
    }
  }).catch(error => {
    console.error("Error refreshing navigation:", error);
  });
}

/**
 * Check if current page matches a tab's path
 */
function isCurrentPageMatchingTab(tab, currentPageInfo) {
  if (tab.isSetupObject && currentPageInfo.type === 'objectManager') {
    if (tab.path.startsWith('ObjectManager/')) {
      const tabObjectName = tab.path.split('/')[1];
      return tabObjectName === currentPageInfo.objectName;
    }
  }
  
  return false;
}

/**
 * Remove all custom tabs from the container
 */
function removeCustomTabs(tabContainer) {
  const existingTabs = tabContainer.querySelectorAll('.sf-tabs-custom-tab');
  existingTabs.forEach(tab => tab.remove());
}

/**
 * Get tab by ID from storage
 */
async function getTabById(tabId) {
  try {
    const result = await browser.storage.sync.get('customTabs');
    const tabs = result.customTabs || [];
    return tabs.find(tab => tab.id === tabId);
  } catch (error) {
    console.error("Error getting tab by ID:", error);
    return null;
  }
}

/**
 * Check if tabs are currently visible/loaded
 */
function areTabsLoaded() {
  const customTabs = document.querySelectorAll('.sf-tabs-custom-tab');
  return customTabs.length > 0;
}

/**
 * Force refresh all tabs (useful for debugging)
 */
function forceRefreshTabs() {
  const tabContainer = document.querySelector('.tabBarItems.slds-grid');
  if (tabContainer) {
    console.log("Force refreshing all tabs");
    initTabs(tabContainer);
  } else {
    console.warn("No tab container found for force refresh");
  }
}

// Setup global dropdown event handlers
document.addEventListener('click', (e) => {
  if (!e.target.closest('.sf-tabs-custom-tab')) {
    document.querySelectorAll('.sf-tabs-inline-dropdown').forEach(dropdown => {
      dropdown.style.display = 'none';
    });
  }
});

// Export tab renderer functions
window.SFTabsContent = window.SFTabsContent || {};
window.SFTabsContent.tabRenderer = {
  initTabs,
  getTopLevelTabs,
  createTabElement: createTabElementWithDropdown,
  buildFullUrl,
  addTabClickListeners,
  isLightningNavigationEnabled,
  lightningNavigate,
  highlightActiveTab,
  addActiveIndicatorToTab,
  refreshNavigationForCurrentPage,
  isCurrentPageMatchingTab,
  removeCustomTabs,
  getTabById,
  areTabsLoaded,
  forceRefreshTabs,
  navigateToMainTab,
  navigateToNavigationItem,
  toggleInlineDropdown
};