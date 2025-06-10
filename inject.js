// inject.js - Lightning Navigation Handler for SF Tabs
// This file is injected into the page to access Salesforce's Lightning navigation APIs

console.log("SF Tabs inject.js loaded");

// Create the main Lightning navigation function
window.sfTabsLightningNav = function(details) {
  console.log("Window Lightning navigation called with:", details);
  
  try {
    if (details.navigationType === "url" && details.url) {
      if (typeof $A !== 'undefined' && $A.get) {
        const e = $A.get("e.force:navigateToURL");
        if (e) {
          console.log("Firing Lightning navigation event for URL:", details.url);
          e.setParams({ url: details.url });
          e.fire();
          console.log("Lightning navigation event fired successfully");
          return true;
        } else {
          console.log("Lightning navigateToURL event not available");
        }
      } else {
        console.log("Lightning framework ($A) not available");
      }
    } else if (details.navigationType === "recordId" && details.recordId) {
      if (typeof $A !== 'undefined' && $A.get) {
        const e = $A.get("e.force:navigateToSObject");
        if (e) {
          console.log("Firing Lightning navigation event for recordId:", details.recordId);
          e.setParams({ "recordId": details.recordId });
          e.fire();
          console.log("Lightning SObject navigation event fired successfully");
          return true;
        } else {
          console.log("Lightning navigateToSObject event not available");
        }
      } else {
        console.log("Lightning framework ($A) not available");
      }
    } else {
      console.log("Invalid navigation details:", details);
    }
  } catch (error) {
    console.error("Lightning navigation error:", error);
  }
  
  return false;
};

// Listen for postMessage for Lightning navigation (backup method)
window.addEventListener("message", function(event) {
  // Verify the message is from the same origin and is our Lightning navigation message
  if (event.origin !== window.location.origin) {
    return;
  }
  
  if (event.data && event.data.type === 'SF_TABS_LIGHTNING_NAVIGATE') {
    console.log("Received Lightning navigation message:", event.data);
    
    const success = window.sfTabsLightningNav(event.data);
    
    // Don't fallback automatically - let Lightning handle the navigation
    if (success) {
      console.log("Lightning navigation initiated via postMessage");
    } else {
      console.log("Lightning navigation failed via postMessage, but not falling back automatically");
    }
  }
});

// Signal that the handler is ready
console.log("SF Tabs Lightning navigation handler ready");
window.postMessage({type: 'SF_TABS_INJECT_LOADED'}, window.location.origin);