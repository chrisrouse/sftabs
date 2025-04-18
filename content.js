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

// Add this function to your content.js file
function detectBrandingColors() {
  console.log("Detecting branding colors from active tab...");
  
  // Selectors for active tab elements in Salesforce
  const activeTabSelectors = [
    '.slds-context-bar__item.slds-is-active', // Standard active tab
    '.tabHeader.slds-context-bar__label-action.slds-is-active', // Active tab header
    '.slds-context-bar__item.slds-is-active a', // Active tab link
    '.slds-context-bar__item:not(.slds-no-hover).slds-is-active', // Another active tab pattern
    '.slds-is-active .slds-context-bar__label-action' // Active tab child element
  ];
  
  let hoverColor = null;
  
  // Try each selector until we find an active tab element
  for (const selector of activeTabSelectors) {
    const activeElement = document.querySelector(selector);
    if (activeElement) {
      // Get computed styles
      const styles = window.getComputedStyle(activeElement);
      
      // Check for background color
      if (styles.backgroundColor && styles.backgroundColor !== 'rgba(0, 0, 0, 0)' && 
          styles.backgroundColor !== 'transparent') {
        hoverColor = styles.backgroundColor;
        console.log("Found active tab color:", hoverColor, "from selector:", selector);
        break;
      }
    }
  }
  
  // If we couldn't find an active tab color, try a different approach
  if (!hoverColor) {
    // Look for any elements that might have the selection color
    const selectionElements = document.querySelectorAll('.slds-is-selected, .slds-is-active');
    for (const element of selectionElements) {
      const styles = window.getComputedStyle(element);
      if (styles.backgroundColor && styles.backgroundColor !== 'rgba(0, 0, 0, 0)' && 
          styles.backgroundColor !== 'transparent') {
        hoverColor = styles.backgroundColor;
        console.log("Found selection color from other element:", hoverColor);
        break;
      }
    }
  }
  
  // If we still don't have a color, use the default Salesforce hover blue
  if (!hoverColor) {
    hoverColor = 'rgb(216, 230, 254)';
    console.log("Using default Salesforce hover color");
  }
  
  // Apply the detected colors by injecting a style element
  applyBrandingColors(hoverColor);
}

// Function to apply the detected colors
function applyBrandingColors(hoverColor) {
  console.log("Applying hover color:", hoverColor);

    // Parse the RGB values from the color string
    let r = 216, g = 230, b = 254; // Default values
  
    // Try to extract RGB values from the color string
    if (hoverColor) {
      const rgbMatch = hoverColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (rgbMatch) {
        r = parseInt(rgbMatch[1], 10);
        g = parseInt(rgbMatch[2], 10);
        b = parseInt(rgbMatch[3], 10);
      }
    }
  
// Get all custom tabs
const customTabs = document.querySelectorAll('li[data-custom-tab-id]');
  
// Apply the color directly to each tab
customTabs.forEach(tab => {
  // Remove any existing theme classes
  tab.classList.remove('sf-tabs-theme-blue', 'sf-tabs-theme-custom');
  
  if (hoverColor === 'rgb(216, 230, 254)') {
    // If it's the default blue, just add the blue theme class
    tab.classList.add('sf-tabs-theme-blue');
  } else {
    // For custom colors, add class and set RGB component variables
    tab.classList.add('sf-tabs-theme-custom');
    tab.style.setProperty('--sf-tabs-hover-r', r);
    tab.style.setProperty('--sf-tabs-hover-g', g);
    tab.style.setProperty('--sf-tabs-hover-b', b);
  }
});
}

// When to call the color detection
function detectAndApplyColors() {
  // Add a short delay to ensure the UI is fully rendered
  setTimeout(detectBrandingColors, 1000);
}

// Call this after adding tabs
// Add this line at the end of your processTabAddition function:
detectAndApplyColors();

// Also call it on navigation/DOM changes
window.addEventListener('popstate', detectAndApplyColors);

// Add this to improve color detection on page load
window.addEventListener('load', function() {
  console.log("Window fully loaded, detecting colors");
  detectAndApplyColors();
});

// Make the detection function retry a few times with increasing delays
function detectAndApplyColors() {
  // Try immediately
  detectBrandingColors();
  
  // Then retry with increasing delays
  setTimeout(detectBrandingColors, 1000);
  setTimeout(detectBrandingColors, 3000);
  setTimeout(detectBrandingColors, 5000);
}