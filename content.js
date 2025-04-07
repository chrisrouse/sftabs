// Function to extract the base URL for the current Salesforce org
function getBaseUrl() {
  const currentUrl = window.location.href;
  
  // Check if the URL contains "/lightning/setup/"
  if (currentUrl.includes('/lightning/setup/')) {
    // Extract everything before "/lightning/setup/" plus "/lightning/setup/"
    const baseUrl = currentUrl.split('/lightning/setup/')[0] + '/lightning/setup/';
    console.log('Extracted base URL:', baseUrl);
    return baseUrl;
  }
  
  console.log('Could not extract base URL from:', currentUrl);
  return null;
}

// Load custom tabs from storage
function loadCustomTabs() {
  return browser.storage.sync.get('customTabs')
    .then((result) => {
      if (result.customTabs && Array.isArray(result.customTabs)) {
        return result.customTabs;
      } else {
        // Default tab if no settings
        const defaultTab = {
          id: 'default_tab',
          label: 'User Management',
          path: 'ManageUsers',
          openInNewTab: false,
          position: 0
        };
        
        // Save it to storage for future use
        browser.storage.sync.set({ 
          customTabs: [defaultTab] 
        });
        
        return [defaultTab];
      }
    })
    .catch((error) => {
      console.error('Error loading custom tabs:', error);
      return [];
    });
}

// Function to add custom tabs to the setup menu
function addCustomTabs(tabs) {
  console.log("Attempting to add custom tabs...");
  
  // Log all navigation links for debugging
  const allLinks = document.querySelectorAll('a[href*="/lightning/setup/"]');
  console.log("Found setup links:", allLinks.length);
  allLinks.forEach(link => {
    console.log("Link:", link.href, link.textContent);
  });
  
  // Look for the Object Manager tab which we want to insert our tabs after
  const objectManagerTab = document.querySelector('a[href*="/lightning/setup/ObjectManager/home"]');
  
  if (!objectManagerTab) {
    console.log("Object Manager tab not found yet, looking for alternative reference points");
    
    // Try alternative reference points if Object Manager tab isn't found
    const homeTab = document.querySelector('a[href*="/lightning/setup/Home/home"]');
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
    
    console.log("No suitable reference points found");
    return;
  }
  
  // Find the parent <li> element of the Object Manager tab
  const tabItem = objectManagerTab.closest('li');
  
  if (!tabItem || !tabItem.parentNode) {
    console.log("Parent li element not found or has no parent");
    return;
  }
  
  console.log("Parent tab container found");
  
  processTabAddition(tabItem, tabs);
}

// Helper function to process tab addition
function processTabAddition(referenceTabItem, tabs) {
  // Get the base URL for the current org using the current page URL
  const currentUrl = window.location.href;
  const baseUrl = currentUrl.split('/lightning/setup/')[0] + '/lightning/setup/';
  
  console.log("Using base URL:", baseUrl);
  
  // Sort tabs by position
  const sortedTabs = [...tabs].sort((a, b) => a.position - b.position);
  
  // Remove existing custom tabs first to avoid duplicates
  removeCustomTabs();
  
  // Find the reference element classes for styling our new tabs
  let referenceClassName = referenceTabItem.className;
  let referenceLinkClassName = '';
  let referenceContentClassName = '';
  
  // Get a reference link to copy styles from
  const referenceLink = referenceTabItem.querySelector('a');
  if (referenceLink) {
    referenceLinkClassName = referenceLink.className;
    
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
  // This way, each tab is inserted at the same position after the reference tab,
  // which will reverse the visual order in the menu
  for (let i = sortedTabs.length - 1; i >= 0; i--) {
    const tab = sortedTabs[i];
    
    // Create our new tab
    const newTabLi = document.createElement('li');
    newTabLi.className = referenceClassName;
    newTabLi.dataset.customTabId = tab.id;
    
    // Create the link for the new tab
    const newTabLink = document.createElement('a');
    newTabLink.href = `${baseUrl}${tab.path}/home`;
    
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
    
    console.log(`Custom tab "${tab.label}" successfully added at ${baseUrl}${tab.path}/home`);
  }
}

// Function to check and add tabs when storage changes
function onStorageChange(changes, area) {
  if (area === 'sync' && changes.customTabs) {
    console.log('Storage changed, updating tabs');
    // Remove existing custom tabs
    removeCustomTabs();
    // Add the updated tabs
    addCustomTabs(changes.customTabs.newValue);
  }
}

// Function to remove all custom tabs
function removeCustomTabs() {
  const customTabs = document.querySelectorAll('li[data-custom-tab-id]');
  customTabs.forEach(tab => tab.remove());
}

// Setup an interval to try adding the tabs
let setupMenuCheckAttempts = 0;
const maxSetupMenuCheckAttempts = 3; // Increased max attempts
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
}, 1500); // Increased interval to give more time for the page to load

// Also try when navigation happens
window.addEventListener('popstate', function() {
  console.log("Navigation detected (popstate)");
  // Reset and try again
  setupMenuCheckAttempts = 0;
  loadCustomTabs().then(tabs => {
    addCustomTabs(tabs);
  });
});

// Listen for storage changes to update tabs in real-time
browser.storage.onChanged.addListener(onStorageChange);