// content/inject.js - Enhanced Lightning Navigation Handler for SF Tabs
// This file is injected into the page to access Salesforce's Lightning navigation APIs

/**
 * Main Lightning navigation function
 */
window.sfTabsLightningNav = function(details) {
  try {
    if (details.navigationType === "url" && details.url) {
      if (typeof $A !== 'undefined' && $A.get) {
        const e = $A.get("e.force:navigateToURL");
        if (e) {
          e.setParams({ url: details.url });
          e.fire();
          
          // Signal completion back to content script
          window.postMessage({
            type: 'SF_TABS_NAVIGATION_COMPLETE',
            success: true,
            url: details.url
          }, window.location.origin);
          
          return true;
        }
      }
    } else if (details.navigationType === "recordId" && details.recordId) {
      if (typeof $A !== 'undefined' && $A.get) {
        const e = $A.get("e.force:navigateToSObject");
        if (e) {
          e.setParams({ "recordId": details.recordId });
          e.fire();
          
          // Signal completion
          window.postMessage({
            type: 'SF_TABS_NAVIGATION_COMPLETE',
            success: true,
            recordId: details.recordId
          }, window.location.origin);
          
          return true;
        }
      }
    }
  } catch (error) {
    // Signal error back to content script
    window.postMessage({
      type: 'SF_TABS_NAVIGATION_COMPLETE',
      success: false,
      error: error.message
    }, window.location.origin);
  }
  
  return false;
};


/**
 * Listen for postMessage for Lightning navigation (backup method)
 */
window.addEventListener("message", function(event) {
  // Verify the message is from the same origin and is our Lightning navigation message
  if (event.origin !== window.location.origin) {
    return;
  }

  if (event.data && event.data.type === 'SF_TABS_LIGHTNING_NAVIGATE') {
    const success = window.sfTabsLightningNav(event.data);

    if (!success) {
      
      // Signal failure back to content script
      window.postMessage({
        type: 'SF_TABS_NAVIGATION_COMPLETE',
        success: false,
        fallbackUsed: true
      }, window.location.origin);
    }
  }
});

/**
 * Check Lightning framework availability
 */
function checkLightningAvailability() {
  // The probe that used to live here called $A.get four times and threw the
  // result away — leftover instrumentation from a removed logging pass.
  return typeof $A !== 'undefined' && typeof $A.get === 'function';
}

/**
 * Enhanced Lightning framework detection with retries
 */
function waitForLightning(callback, maxAttempts = 10, interval = 500) {
  let attempts = 0;

  const check = () => {
    attempts++;

    if (checkLightningAvailability()) {
      callback(true);
    } else if (attempts >= maxAttempts) {
      callback(false);
    } else {
      setTimeout(check, interval);
    }
  };

  check();
}

// Wait for Lightning framework and signal when ready
waitForLightning((available) => {
  // Signal that the handler is ready
  window.postMessage({
    type: 'SF_TABS_INJECT_LOADED',
    lightningAvailable: available,
    timestamp: Date.now()
  }, window.location.origin);
});

// Also provide immediate availability check
const immediateCheck = checkLightningAvailability();

// Signal initial load completion
window.postMessage({
  type: 'SF_TABS_INJECT_LOADED',
  lightningAvailable: immediateCheck,
  immediate: true,
  timestamp: Date.now()
}, window.location.origin);