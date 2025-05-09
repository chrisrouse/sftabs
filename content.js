// Default tabs configuration
const defaultTabs = [
  {
    id: 'default_tab_flows',
    label: 'Flows',
    path: 'Flows',
    openInNewTab: false,
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

// Initial attempt counter
let loadAttempts = 0;
const maxLoadAttempts = 5;

// Initialize tabs - similar approach to the reference plugin
function initTabs(tabContainer) {
  if (!tabContainer) {
    console.log("No tab container found");
    return;
  }

  // Load tabs from storage
  browser.storage.sync.get('customTabs').then(result => {
    let tabsToUse = [];
    
    if (result.customTabs && Array.isArray(result.customTabs) && result.customTabs.length > 0) {
      tabsToUse = result.customTabs;
    } else {
      // Use default tabs if none found in storage
      tabsToUse = defaultTabs;
      // Save defaults to storage for future use
      browser.storage.sync.set({ customTabs: defaultTabs });
    }
    
    // Sort tabs by position
    tabsToUse.sort((a, b) => a.position - b.position);
    
    // Remove any existing custom tabs
    const existingTabs = tabContainer.querySelectorAll('.sf-tabs-custom-tab');
    existingTabs.forEach(tab => tab.remove());
    
    // Add tabs to the container
    for (const tab of tabsToUse) {
      const tabElement = createTabElement(tab);
      tabContainer.appendChild(tabElement);
    }
    
    // Add click event listeners after all tabs are inserted
    addTabClickListeners(tabsToUse);
    highlightActiveCustomTab(tabsToUse);
    
    console.log("Tabs successfully added to container");
  }).catch(error => {
    console.error("Error loading tabs:", error);
  });
}

// Create tab element with appropriate structure and classes
function createTabElement(tab) {
  // Get the base URL for the current org
  const currentUrl = window.location.href;
  const baseUrlSetup = currentUrl.split('/lightning/setup/')[0] + '/lightning/setup/';
  const baseUrlObject = currentUrl.split('/lightning/setup/')[0] + '/lightning/o/';
  const baseUrlRoot = currentUrl.split('/lightning/setup/')[0];
  
  // Determine the full URL based on tab type
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
  
  // Create the tab element
  const li = document.createElement('li');
  li.setAttribute('role', 'presentation');
  li.className = 'oneConsoleTabItem tabItem slds-context-bar__item borderRight navexConsoleTabItem sf-tabs-custom-tab';
  li.setAttribute('data-aura-class', 'navexConsoleTabItem');
  li.setAttribute('data-tab-id', tab.id);
  li.setAttribute('data-url', fullUrl);
  
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
  
  // Assemble the elements
  a.appendChild(span);
  li.appendChild(a);
  
  return li;
}

function highlightActiveCustomTab(tabs) {
  const currentUrl = window.location.href;
  let matchedTab = null;

  for (const tab of tabs) {
    const baseUrl = window.location.origin;
    const tabUrl = document.querySelector(`li[data-tab-id="${tab.id}"]`)?.getAttribute('data-url');
    if (tabUrl && currentUrl.startsWith(tabUrl)) {
      matchedTab = tab;
      break;
    }
  }

  if (matchedTab) {
    // Only if a custom tab matches the current page
    console.log(`Highlighting active custom tab: ${matchedTab.label}`);

    const allTabs = document.querySelectorAll('.tabBarItems .tabItem');
    allTabs.forEach(tabEl => {
      tabEl.classList.remove('slds-is-active');
      const anchor = tabEl.querySelector('a');
      if (anchor) anchor.setAttribute('aria-selected', 'false');
    });

    const activeEl = document.querySelector(`li[data-tab-id="${matchedTab.id}"]`);
    if (activeEl) {
      activeEl.classList.add('slds-is-active');
      const anchor = activeEl.querySelector('a');
      if (anchor) anchor.setAttribute('aria-selected', 'true');
    }
  } else {
    console.log("No custom tab matched. Leaving default active tab styling.");
  }
}

// Add click event listeners for tabs
function addTabClickListeners(tabs) {
  // We only need to add listeners for tabs that open in new tabs
  // For other tabs, let the browser handle navigation normally
  tabs.forEach(tab => {
    if (!tab.openInNewTab) return;
    
    const links = document.querySelectorAll(`li[data-tab-id="${tab.id}"] a`);
    links.forEach(link => {
      link.addEventListener('click', event => {
        event.preventDefault();
        window.open(link.href, '_blank');
      });
    });
  });
}

// Function to try loading tabs with delay and retries
function delayLoadTabs(attemptCount) {
  const tabContainer = document.querySelector('.tabBarItems.slds-grid');
  attemptCount++;
  
  console.log(`Tab loading attempt ${attemptCount}/${maxLoadAttempts}`);
  
  if (attemptCount > maxLoadAttempts) {
    console.error("SF Tabs - failed to find tab container after max attempts");
    return;
  }
  
  if (!tabContainer) {
    // Schedule next attempt
    setTimeout(() => {
      delayLoadTabs(attemptCount);
    }, 2000);
  } else {
    // Found container, initialize tabs
    console.log("Tab container found - initializing tabs");
    initTabs(tabContainer);
  }
}

// Start loading tabs after a short delay
setTimeout(() => {
  delayLoadTabs(0);
}, 2000);

// Observe DOM mutations to apply active styling sooner
const observer = new MutationObserver(() => {
  const tabContainer = document.querySelector('.tabBarItems.slds-grid');
  if (tabContainer && tabContainer.querySelectorAll('.sf-tabs-custom-tab').length > 0) {
    // Stop observing once tabs are loaded
    observer.disconnect();

    // Re-highlight the active tab now that DOM is ready
    browser.storage.sync.get('customTabs').then(result => {
      const tabsToUse = result.customTabs || defaultTabs;
      highlightActiveCustomTab(tabsToUse);
    });
  }
});

// Start observing early DOM changes
observer.observe(document.body, { childList: true, subtree: true });

// Listen for storage changes to refresh tabs
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.customTabs) {
    console.log("Tabs changed in storage - refreshing");
    const tabContainer = document.querySelector('.tabBarItems.slds-grid');
    if (tabContainer) {
      initTabs(tabContainer);
    }
  }
});

// Handle tab refresh requests from the popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'refresh_tabs') {
    console.log("Received request to refresh tabs");
    const tabContainer = document.querySelector('.tabBarItems.slds-grid');
    if (tabContainer) {
      initTabs(tabContainer);
      sendResponse({ success: true });
    } else {
      console.warn("Could not find tab container for refresh");
      sendResponse({ success: false, error: "Tab container not found" });
    }
  }
  return true;
});

// Also check for URL changes and refresh tabs if needed
let lastUrl = location.href;
setInterval(() => {
  if (location.href !== lastUrl) {
    console.log("URL changed - checking for tab container");
    lastUrl = location.href;
    
    // Slight delay to let the page structure load
    setTimeout(() => {
      const tabContainer = document.querySelector('.tabBarItems.slds-grid');
      if (tabContainer) {
        initTabs(tabContainer);
      }
    }, 1000);
  }
}, 1000);

