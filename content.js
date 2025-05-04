// Reference to utils
let SFTabsUtils;

// Initialize utils with better error handling and logging
function initUtils() {
  console.log("Initializing SF Tabs utils...");
  
  // Ensure the global object exists
  if (!window.SFTabsUtils) {
    console.warn("SFTabsUtils not found in window object, will retry soon");
    setTimeout(initUtils, 500);
    return;
  }
  
  // Verify essential properties exist
  if (!window.SFTabsUtils.urlHelpers || !window.SFTabsUtils.domHelpers) {
    console.warn("SFTabsUtils partially loaded, waiting for full initialization");
    setTimeout(initUtils, 500);
    return;
  }
  
  // Set local reference
  SFTabsUtils = window.SFTabsUtils;
  console.log("Utils initialized successfully");
  
  // Start loading tabs after utils are available
  setTimeout(() => {
    delayLoadTabs(0);
  }, 2000);
}

// Initialize utils after a short delay to ensure DOM is ready
setTimeout(initUtils, 500);

// Default tabs configuration
const defaultTabs = [
  {
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
    isObject: false,
    position: 1
  },
  {
    id: 'default_tab_users',
    label: 'Users',
    path: 'ManageUsers',
    openInNewTab: false,
    isObject: false,
    position: 2
  },
  {
    id: 'default_tab_profiles',
    label: 'Profiles',
    path: 'EnhancedProfiles',
    openInNewTab: false,
    isObject: false,
    position: 3
  },
  {
    id: 'default_tab_permsets',
    label: 'Permission Sets',
    path: 'PermSets',
    openInNewTab: false,
    isObject: false,
    position: 4
  }
];

// Initial attempt counter
let loadAttempts = 0;
const maxLoadAttempts = 8; // Increased max attempts

// Initialize tabs with improved error handling
function initTabs(tabContainer) {
  if (!tabContainer) {
    console.error("SF Tabs: No tab container found");
    return;
  }

  console.log("SF Tabs: Found tab container, loading tabs from storage");

  // Direct access to storage for more reliability
  browser.storage.sync.get('customTabs')
    .then(result => {
      let tabsToUse = [];
      
      // Log the raw result for debugging
      console.log("SF Tabs: Raw storage data:", JSON.stringify(result).substring(0, 200) + "...");
      
      if (result.customTabs && Array.isArray(result.customTabs) && result.customTabs.length > 0) {
        console.log("SF Tabs: Found", result.customTabs.length, "custom tabs in storage");
        tabsToUse = result.customTabs;
      } else {
        console.log("SF Tabs: No custom tabs found in storage, using defaults");
        // Use default tabs if none found in storage
        tabsToUse = JSON.parse(JSON.stringify(defaultTabs)); // Deep clone
        
        // Save defaults to storage for future use
        browser.storage.sync.set({ customTabs: tabsToUse })
          .then(() => console.log("Default tabs saved to storage"))
          .catch(err => console.error("Error saving default tabs:", err));
      }
      
      // Sort tabs by position
      tabsToUse.sort((a, b) => a.position - b.position);
      
      // Remove any existing custom tabs
      const existingTabs = tabContainer.querySelectorAll('.sf-tabs-custom-tab');
      existingTabs.forEach(tab => tab.remove());
      
      // Add tabs to the container
      for (const tab of tabsToUse) {
        try {
          // Log each tab for debugging
          console.log("SF Tabs: Creating tab element for:", tab.label);
          
          const tabElement = createTabElement(tab);
          tabContainer.appendChild(tabElement);
        } catch (err) {
          console.error("SF Tabs: Error creating tab element:", err, tab);
        }
      }
      
      // Add click event listeners after all tabs are inserted
      addTabClickListeners(tabsToUse);
      highlightActiveCustomTab(tabsToUse);
      
      console.log("SF Tabs: Tabs successfully added to container");
    })
    .catch(error => {
      console.error("SF Tabs: Error loading tabs from storage:", error);
    });
}

// Create tab element with appropriate structure and classes
function createTabElement(tab) {
  // Fail fast if SFTabsUtils is not available
  if (!SFTabsUtils || !SFTabsUtils.urlHelpers) {
    console.error("SFTabsUtils not available for createTabElement");
    throw new Error("SFTabsUtils not initialized");
  }

  // Get the base URL for the current org
  const currentUrl = window.location.href;
  
  // Determine the full URL based on tab type
  let fullUrl = SFTabsUtils.urlHelpers.buildCompleteURL(
    tab.path, 
    tab.hasOwnProperty('isObject') ? tab.isObject : false,
    tab.hasOwnProperty('isCustomUrl') ? tab.isCustomUrl : false
  );
  
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
    const tabElement = document.querySelector(`li[data-tab-id="${tab.id}"]`);
    if (!tabElement) continue;
    
    const tabUrl = tabElement.getAttribute('data-url');
    if (tabUrl && currentUrl.startsWith(tabUrl)) {
      matchedTab = tab;
      break;
    }
  }

  if (matchedTab) {
    // Only if a custom tab matches the current page
    console.log(`SF Tabs: Highlighting active custom tab: ${matchedTab.label}`);

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
    console.log("SF Tabs: No custom tab matched. Leaving default active tab styling.");
  }
}

// Add click event listeners for tabs
function addTabClickListeners(tabs) {
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

// Improved function to find tab container with multiple selectors
function findTabContainer() {
  // Try multiple selectors to find the tab container
  const selectors = [
    '.tabBarItems.slds-grid',
    '.slds-context-bar__secondary .slds-grid',
    '.oneConsoleTabContainer',
    '.slds-context-bar__primary',
    '.navexWorkspaceManager',
    '.slds-tabs_default ul',
    'ul.tabBarItems'
  ];
  
  // Try each selector
  for (const selector of selectors) {
    const container = document.querySelector(selector);
    if (container) {
      console.log("SF Tabs: Found tab container with selector:", selector);
      return container;
    }
  }
  
  console.log("SF Tabs: No tab container found with any selector");
  return null;
}

// Function to try loading tabs with delay and retries
function delayLoadTabs(attemptCount) {
  // Find the tab container using our improved function
  const tabContainer = findTabContainer();
  attemptCount++;
  
  console.log(`SF Tabs: Tab loading attempt ${attemptCount}/${maxLoadAttempts}`);
  
  if (attemptCount > maxLoadAttempts) {
    console.error("SF Tabs: Failed to find tab container after max attempts");
    return;
  }
  
  if (!tabContainer) {
    // Schedule next attempt with progressive delay
    const delay = Math.min(2000 + (attemptCount * 500), 5000);
    console.log(`SF Tabs: No tab container found, retrying in ${delay}ms`);
    setTimeout(() => {
      delayLoadTabs(attemptCount);
    }, delay);
  } else {
    // Found container, initialize tabs with our improved function
    console.log("SF Tabs: Tab container found - initializing tabs");
    initTabs(tabContainer);
    
    // Add a class to the body to indicate that SF Tabs is loaded
    document.body.classList.add('sf-tabs-loaded');
  }
}
  
  // Increment attempt counter
  attemptCount++;
  
  console.log(`SF Tabs: Tab loading attempt ${attemptCount}/${maxLoadAttempts}`);
  
  if (attemptCount > maxLoadAttempts) {
    console.error("SF Tabs: Failed to find tab container after max attempts");
    return;
  }
  
  if (!tabContainer) {
    // Schedule next attempt with increasing delay
    const delay = Math.min(2000 + (attemptCount * 500), 5000);
    console.log(`SF Tabs: No tab container found, retrying in ${delay}ms`);
    setTimeout(() => {
      delayLoadTabs(attemptCount);
    }, delay);
  } else {
    // Found container, initialize tabs
    console.log("SF Tabs: Tab container found - initializing tabs");
    initTabs(tabContainer);
    
    // Add a class to the body to indicate that SF Tabs is loaded
    document.body.classList.add('sf-tabs-loaded');
  }
}

// Start loading tabs after a short delay
setTimeout(() => {
  delayLoadTabs(0);
}, 2000);

// Observe DOM mutations to apply active styling sooner
const observer = new MutationObserver(mutations => {
  // Check if we find tabs container in these mutations
  const tabContainer = document.querySelector('.tabBarItems.slds-grid');
  if (tabContainer && tabContainer.querySelectorAll('.sf-tabs-custom-tab').length > 0) {
    // Refresh tab highlighting
    browser.storage.sync.get('customTabs').then(result => {
      const tabsToUse = result.customTabs || defaultTabs;
      highlightActiveCustomTab(tabsToUse);
    }).catch(err => {
      console.error("Error fetching tabs for highlighting:", err);
    });
  }
  
  // Check each mutation for newly added tab container
  for (const mutation of mutations) {
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      // Check if any added node is our target or contains our target
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // If the node itself is a tab container
          if (node.classList && 
             (node.classList.contains('tabBarItems') || 
              node.classList.contains('oneConsoleTabContainer'))) {
            delayLoadTabs(0);
            return;
          }
          
          // If the node contains a tab container
          const container = node.querySelector('.tabBarItems.slds-grid, .oneConsoleTabContainer');
          if (container) {
            delayLoadTabs(0);
            return;
          }
        }
      }
    }
  }
});

// Special debugging function to test storage access
function debugStorage() {
  console.log("SF Tabs: Testing storage access...");
  browser.storage.sync.get(null)
    .then(result => {
      console.log("SF Tabs: All storage data:", result);
      if (result.customTabs) {
        console.log("SF Tabs: Found customTabs with", result.customTabs.length, "items");
      } else {
        console.log("SF Tabs: No customTabs found in storage");
      }
      
      // Try setting a test value
      return browser.storage.sync.set({ 'sfTabsTest': Date.now() });
    })
    .then(() => {
      console.log("SF Tabs: Test value successfully saved to storage");
    })
    .catch(error => {
      console.error("SF Tabs: Storage access error:", error);
    });
}

// Call our debug function early
setTimeout(debugStorage, 1000);

// Add a message listener for debugging from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'debug_storage') {
    debugStorage();
    sendResponse({ success: true });
  }
  return true;
});

// Start observing early DOM changes
observer.observe(document.body, { childList: true, subtree: true });

// Listen for storage changes to refresh tabs
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.customTabs) {
    console.log("SF Tabs: Tabs changed in storage - refreshing");
    console.log("SF Tabs: New value has", 
      changes.customTabs.newValue ? changes.customTabs.newValue.length : 0, 
      "tabs");
    
    // Find the tab container using our improved function
    const tabContainer = findTabContainer();
    
    if (tabContainer) {
      initTabs(tabContainer);
    } else {
      console.warn("SF Tabs: Could not find tab container for refresh");
      // If no container found, initiate a new load attempt
      delayLoadTabs(0);
    }
  }
});

// Handle tab refresh requests from the popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'refresh_tabs') {
    console.log("SF Tabs: Received request to refresh tabs");
    
    // Try multiple selectors to find the tab container
    const selectors = [
      '.tabBarItems.slds-grid',
      '.slds-context-bar__secondary .slds-grid',
      '.oneConsoleTabContainer'
    ];
    
    let tabContainer = null;
    
    // Try each selector
    for (const selector of selectors) {
      const container = document.querySelector(selector);
      if (container) {
        tabContainer = container;
        break;
      }
    }
    
    if (tabContainer) {
      initTabs(tabContainer);
      sendResponse({ success: true });
    } else {
      console.warn("SF Tabs: Could not find tab container for refresh");
      sendResponse({ success: false, error: "Tab container not found" });
      // If no container found, initiate a new load attempt
      delayLoadTabs(0);
    }
  }
  return true;
});

// Check for URL changes and refresh tabs if needed
let lastUrl = location.href;
setInterval(() => {
  if (location.href !== lastUrl) {
    console.log("SF Tabs: URL changed - checking for tab container");
    lastUrl = location.href;
    
    // Slight delay to let the page structure load
    setTimeout(() => {
      // Try multiple selectors to find the tab container
      const selectors = [
        '.tabBarItems.slds-grid',
        '.slds-context-bar__secondary .slds-grid',
        '.oneConsoleTabContainer'
      ];
      
      let tabContainer = null;
      
      // Try each selector
      for (const selector of selectors) {
        const container = document.querySelector(selector);
        if (container) {
          tabContainer = container;
          break;
        }
      }
      
      if (tabContainer) {
        initTabs(tabContainer);
      } else {
        // If no container found, try again with delayLoadTabs
        delayLoadTabs(0);
      }
    }, 1000);
  }
}, 1000);