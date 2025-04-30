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

// State tracking
let lastActiveTab = '';
let lastUrl = location.href;
let setupMenuCheckAttempts = 0;
const maxSetupMenuCheckAttempts = 5;

// Load custom tabs from storage
function loadCustomTabs() {
  return browser.storage.sync.get('customTabs')
    .then((result) => {
      if (result.customTabs && Array.isArray(result.customTabs) && result.customTabs.length > 0) {
        return result.customTabs;
      } else {
        // Use default tabs instead of just one
        
        // Save them to storage for future use
        browser.storage.sync.set({ 
          customTabs: defaultTabs 
        });
        
        return defaultTabs;
      }
    })
    .catch((error) => {
      console.error('Error loading custom tabs:', error);
      return defaultTabs; // Return defaults on error too
    });
}

// Function to add custom tabs to the setup menu
function addCustomTabs(tabs) {
  console.log("Attempting to add custom tabs...");
  
  // Log all navigation links for debugging
  const allLinks = document.querySelectorAll('a[href*="/lightning/setup/"]');
  console.log("Found setup links:", allLinks.length);
  
  // Look for the Object Manager tab which we want to insert our tabs after
  const objectManagerTab = document.querySelector('a[href*="/lightning/setup/ObjectManager/home"]');
  const homeTab = document.querySelector('a[href*="/lightning/setup/Home/home"]');
  
  // Check if we're on an Object Manager page
  const isObjectManagerPage = window.location.href.includes('/lightning/setup/ObjectManager/');
  console.log("Is Object Manager page:", isObjectManagerPage);
  
  // If we're on an Object Manager page, we need to be more aggressive in finding a reference point
  if (isObjectManagerPage) {
    console.log("On Object Manager page - using special handling");
    
    // Look for ANY navigation list item
    const anyNavItem = document.querySelector('.oneSetupNavContainer ul.slds-tree li');
    
    if (anyNavItem) {
      console.log("Found a navigation list item to use as reference");
      processTabAddition(anyNavItem, tabs);
      
      // After adding tabs, make sure they're visible
      setTimeout(() => {
        const customTabs = document.querySelectorAll('li[data-custom-tab-id]');
        console.log(`Visibility check: Found ${customTabs.length} custom tabs`);
        
        customTabs.forEach(tab => {
          // Make sure the tab is visible
          tab.style.display = 'block';
          console.log(`Ensuring tab ${tab.dataset.customTabId} is visible`);
        });
      }, 500);
      
      return;
    }
  }
  
  // Standard approach for non-Object Manager pages
  if (objectManagerTab) {
    // Find the parent <li> element of the Object Manager tab
    const tabItem = objectManagerTab.closest('li');
    
    if (tabItem && tabItem.parentNode) {
      console.log("Found Object Manager tab as reference point");
      processTabAddition(tabItem, tabs);
      return;
    }
  }
  
  // Try alternative reference points if Object Manager tab isn't found
  if (homeTab) {
    console.log("Found Home tab as alternative reference point");
    const tabItem = homeTab.closest('li');
    if (tabItem && tabItem.parentNode) {
      console.log("Using Home tab as reference point");
      processTabAddition(tabItem, tabs);
      return;
    }
  }
  
  // If we still can't find a reference point, try using any setup tab
  const anySetupTab = document.querySelector('a[href*="/lightning/setup/"]');
  if (anySetupTab) {
    console.log("Found a setup tab as a last resort reference point");
    const tabItem = anySetupTab.closest('li');
    if (tabItem && tabItem.parentNode) {
      console.log("Using a generic setup tab as reference point");
      processTabAddition(tabItem, tabs);
      return;
    }
  }
  
  console.log("No suitable reference points found, will try again later");
}

// Helper function to process tab addition
function processTabAddition(referenceTabItem, tabs) {
  // Get the base URL for the current org using the current page URL
  const currentUrl = window.location.href;
  const baseUrlSetup = currentUrl.split('/lightning/setup/')[0] + '/lightning/setup/';
  const baseUrlObject = currentUrl.split('/lightning/setup/')[0] + '/lightning/o/';
  
  console.log("Using base URL for setup:", baseUrlSetup);
  console.log("Using base URL for objects:", baseUrlObject);
  
  // Sort tabs by position
  const sortedTabs = [...tabs].sort((a, b) => a.position - b.position);
  
  // Remove existing custom tabs first to avoid duplicates
  removeCustomTabs();
  
  // Find the reference element classes for styling our new tabs
  let referenceClassName = referenceTabItem.className;
  // Remove any active classes from the reference class names
  referenceClassName = referenceClassName.replace(/\bactive\b|\bslds-is-active\b|\bselected\b/g, '').trim();

  let referenceLinkClassName = '';
  let referenceContentClassName = '';
  
  // Get a reference link to copy styles from
  const referenceLink = referenceTabItem.querySelector('a');
  if (referenceLink) {
    referenceLinkClassName = referenceLink.className;
    // Remove any active classes from the link class names
    referenceLinkClassName = referenceLinkClassName.replace(/\bactive\b|\bslds-is-active\b|\bselected\b/g, '').trim();
    
    // Get reference content div if available
    const referenceContent = referenceLink.firstElementChild;
    if (referenceContent) {
      referenceContentClassName = referenceContent.className;
    }
  }
  
  console.log("Reference classes:", {
    li: referenceClassName,
    a: referenceLinkClassName,
    content: referenceContentClassName
  });
  
  // Add each custom tab in REVERSE order to maintain the same order as in the popup
  for (let i = sortedTabs.length - 1; i >= 0; i--) {
    const tab = sortedTabs[i];
    
    // Create our new tab
    const newTabLi = document.createElement('li');
    newTabLi.className = referenceClassName;
    newTabLi.dataset.customTabId = tab.id;
    
    // Create the link for the new tab
    const newTabLink = document.createElement('a');
    
    // Check if tab has isObject property, default to false if not defined
    const isObject = tab.hasOwnProperty('isObject') ? tab.isObject : false;
    
    // Determine correct URL based on tab type
    if (isObject) {
      // Object page format: /lightning/o/ObjectName/home
      newTabLink.href = `${baseUrlObject}${tab.path}/home`;
    } else if (tab.path.startsWith('ObjectManager/') && tab.path.endsWith('/view')) {
      // Special case for ObjectManager paths that already have a /view suffix
      newTabLink.href = `${baseUrlSetup}${tab.path}`;
      console.log(`Using exact path for ObjectManager tab: ${newTabLink.href}`);
    } else if (tab.path.startsWith('ObjectManager/')) {
      // Special case for ObjectManager paths without a suffix - add /view
      newTabLink.href = `${baseUrlSetup}${tab.path}/view`;
      console.log(`Adding /view suffix for ObjectManager tab: ${newTabLink.href}`);
    } else {
      // Standard setup page format: /lightning/setup/PageName/home
      newTabLink.href = `${baseUrlSetup}${tab.path}/home`;
    }

    // Important: Set ARIA attributes to prevent active state
    newTabLink.setAttribute('aria-selected', 'false');
    newTabLink.setAttribute('role', 'tab');
    
    // Handle "open in new tab" setting
    if (tab.openInNewTab) {
      newTabLink.target = '_blank';
      newTabLink.rel = 'noopener noreferrer';
    }
    
    newTabLink.className = referenceLinkClassName;
    
    // Create the tab content
    const tabContent = document.createElement('div');
    tabContent.className = referenceContentClassName;
    
    // Set the tab label
    const tabLabel = document.createElement('span');
    tabLabel.textContent = tab.label;
    
    // Assemble the tab
    tabContent.appendChild(tabLabel);
    newTabLink.appendChild(tabContent);
    newTabLi.appendChild(newTabLink);
    
    // Insert our new tab after the reference tab
    referenceTabItem.parentNode.insertBefore(newTabLi, referenceTabItem.nextSibling);
    
    // Log with appropriate URL based on tab type
    const baseUrl = isObject ? baseUrlObject : baseUrlSetup;
    let logPath = tab.path;
    if (tab.path.startsWith('ObjectManager/') && !tab.path.endsWith('/view')) {
      logPath += '/view';
    } else if (!tab.path.startsWith('ObjectManager/') && !isObject) {
      logPath += '/home';
    }
    console.log(`Custom tab "${tab.label}" successfully added at ${baseUrl}${logPath}`);
  }
}

// Function to remove all custom tabs
function removeCustomTabs() {
  const customTabs = document.querySelectorAll('li[data-custom-tab-id]');
  customTabs.forEach(tab => tab.remove());
}

// Function to check and add tabs when storage changes
function onStorageChange(changes, area) {
  if (area === 'sync' && changes.customTabs) {
    console.log('Storage changed, updating tabs');
    removeCustomTabs();
    loadCustomTabs().then(tabs => {
      addCustomTabs(tabs);
    });
  }
}

// Function to check for navigation changes
function checkNavigation() {
  const currentUrl = location.href;
  
  // Look for active tab header
  const activeTab = document.querySelector('a.tabHeader[aria-selected="true"]');
  const activeTabId = activeTab ? activeTab.getAttribute('data-tabid') : '';
  
  // Check if we've switched tabs
  if (activeTabId && activeTabId !== lastActiveTab) {
    console.log("Tab switch detected:", lastActiveTab, "->", activeTabId);
    console.log("Active tab:", activeTab ? activeTab.getAttribute('title') : 'None');
    
    // Store new active tab
    lastActiveTab = activeTabId;
    
    // Force refresh tabs with staggered timing to catch DOM changes
    setTimeout(() => refreshTabs(), 100);
    setTimeout(() => refreshTabs(), 500);
    setTimeout(() => refreshTabs(), 1000);
    setTimeout(() => refreshTabs(), 2000);
  }
  
  // Also check URL changes as a backup method
  if (currentUrl !== lastUrl) {
    console.log("URL changed:", lastUrl, "->", currentUrl);
    lastUrl = currentUrl;
    
    // If we're on an Object Manager page, we need special handling
    if (currentUrl.includes('/lightning/setup/ObjectManager/')) {
      console.log("Object Manager page detected through URL change");
      setTimeout(() => refreshTabs(), 100);
      setTimeout(() => refreshTabs(), 500);
      setTimeout(() => refreshTabs(), 1000);
      setTimeout(() => refreshTabs(), 2000);
    }
  }
  
  // Periodic check for missing tabs on setup pages
  if ((currentUrl.includes('/lightning/setup/') || 
       currentUrl.includes('/lightning/o/')) && 
      !document.querySelector('li[data-custom-tab-id]')) {
    
    // But only refresh if we can see a navigation container
    if (document.querySelector('.oneSetupNavContainer') || 
        document.querySelector('.oneConsoleNav') ||
        document.querySelector('.tabHeader')) {
      
      console.log("Setup page detected with missing custom tabs - refreshing");
      refreshTabs();
    }
  }
}

// Helper function to refresh tabs
function refreshTabs() {
  // Look for tab containers that already exist
  const tabContainer = document.querySelector('.oneSetupNavContainer ul') || 
                      document.querySelector('.oneConsoleNav') ||
                      document.querySelector('ul.slds-context-bar__vertical-menu');
  
  if (!tabContainer) {
    console.log("No tab container found for adding tabs");
    return;
  }
  
  // Remove existing custom tabs to avoid duplicates
  removeCustomTabs();
  
  // Load and add custom tabs
  loadCustomTabs().then(tabs => {
    addCustomTabs(tabs);
  });
}

// Initial setup and tab addition
const setupMenuCheckInterval = setInterval(function() {
  setupMenuCheckAttempts++;
  console.log(`Setup menu check attempt ${setupMenuCheckAttempts}/${maxSetupMenuCheckAttempts}`);
  
  // Try to add the tabs
  loadCustomTabs().then(tabs => {
    addCustomTabs(tabs);
  });
  
  // Stop checking after max attempts
  if (setupMenuCheckAttempts >= maxSetupMenuCheckAttempts) {
    console.log("Max check attempts reached, stopping automatic checks");
    clearInterval(setupMenuCheckInterval);
  }
}, 2000);

// Run navigation check frequently
setInterval(checkNavigation, 200);

// Create a unified MutationObserver that handles all DOM changes
const unifiedObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    // Handle childList changes
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      // Check if we should refresh tabs based on DOM changes
      let refreshNeeded = false;
      
      // Check for navigation container
      const hasNavContainer = document.querySelector('.oneSetupNavContainer');
      const hasCustomTabs = document.querySelector('li[data-custom-tab-id]');
      
      if (hasNavContainer && !hasCustomTabs) {
        refreshNeeded = true;
      }
      
      // Check for new navigation elements being added
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE && node.querySelector) {
          if (node.querySelector('.oneSetupNavContainer') || 
              node.querySelector('.oneConsoleNav') || 
              node.querySelector('.tabHeader') ||
              node.classList?.contains('oneSetupNavContainer') ||
              node.classList?.contains('oneConsoleNav')) {
            
            refreshNeeded = true;
            break;
          }
        }
      }
      
      if (refreshNeeded) {
        console.log("Navigation structure changed - refreshing tabs");
        setTimeout(() => refreshTabs(), 200);
      }
    }
    
    // Handle attribute changes that indicate tab switching
    if (mutation.type === 'attributes' && 
        mutation.attributeName === 'aria-selected' &&
        mutation.target.classList?.contains('tabHeader')) {
      
      console.log("Tab selection attribute changed");
      setTimeout(() => refreshTabs(), 200);
    }
  }
});

// Start observing with a targeted approach
if (document.readyState === "complete" || document.readyState === "interactive") {
  unifiedObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-selected', 'class']
  });
} else {
  document.addEventListener('DOMContentLoaded', () => {
    unifiedObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-selected', 'class']
    });
  });
}

// Listen for storage changes to update tabs in real-time
browser.storage.onChanged.addListener(onStorageChange);

// Also watch for page navigation events
window.addEventListener('popstate', function() {
  console.log("Navigation detected (popstate)");
  // Reset attempt counter
  setupMenuCheckAttempts = 0;
  refreshTabs();
});