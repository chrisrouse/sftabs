// Function to extract the base URL for the current Salesforce org
function getBaseUrl() {
    const currentUrl = window.location.href;
    const setupPattern = /https:\/\/([^\/]+)\/lightning\/setup\//;
    const match = currentUrl.match(setupPattern);
    
    if (match && match[1]) {
      return `https://${match[1]}/lightning/setup/`;
    }
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
    // Look for the Object Manager tab which we want to insert our tabs after
    const objectManagerTab = document.querySelector('a[href*="/lightning/setup/ObjectManager/home"]');
    
    if (!objectManagerTab) {
      console.log("Object Manager tab not found yet");
      return;
    }
    
    // Find the parent <li> element of the Object Manager tab
    const tabItem = objectManagerTab.closest('li');
    
    if (!tabItem || !tabItem.parentNode) {
      console.log("Parent li element not found or has no parent");
      return;
    }
    
    console.log("Parent tab container found");
    
    // Get the base URL for the current org
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      console.log("Couldn't determine base URL");
      return;
    }
    
    // Sort tabs by position
    const sortedTabs = [...tabs].sort((a, b) => a.position - b.position);
    
    // Remove existing custom tabs first to avoid duplicates
    removeCustomTabs();
    
    // Add each custom tab in REVERSE order to maintain the same order as in the popup
    // This way, each tab is inserted at the same position after the reference tab,
    // which will reverse the visual order in the menu
    for (let i = sortedTabs.length - 1; i >= 0; i--) {
      const tab = sortedTabs[i];
      
      // Create our new tab
      const newTabLi = document.createElement('li');
      newTabLi.className = tabItem.className;
      newTabLi.dataset.customTabId = tab.id;
      
      // Create the link for the new tab
      const newTabLink = document.createElement('a');
      newTabLink.href = `${baseUrl}${tab.path}/home`;
      
      // Handle "open in new tab" setting
      if (tab.openInNewTab) {
        newTabLink.target = '_blank';
        newTabLink.rel = 'noopener noreferrer';
      }
      
      newTabLink.className = objectManagerTab.className;
      
      // Create the tab content
      const tabContent = document.createElement('div');
      if (objectManagerTab.firstElementChild) {
        tabContent.className = objectManagerTab.firstElementChild.className;
      }
      
      // Set the tab label
      const tabLabel = document.createElement('span');
      tabLabel.textContent = tab.label;
      
      // Assemble the tab
      tabContent.appendChild(tabLabel);
      newTabLink.appendChild(tabContent);
      newTabLi.appendChild(newTabLink);
      
      // Insert our new tab after the reference tab
      tabItem.parentNode.insertBefore(newTabLi, tabItem.nextSibling);
      
      console.log(`Custom tab "${tab.label}" successfully added`);
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
  const maxSetupMenuCheckAttempts = 20;
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
  }, 1000);
  
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