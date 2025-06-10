// browser-compat.js - Enhanced universal browser API compatibility layer
(function() {
  'use strict';
  
  console.log('SF Tabs: Loading browser compatibility layer...');
  
  // Detect browser environment
  const isChrome = typeof chrome !== 'undefined' && !!chrome.runtime;
  const isFirefox = typeof browser !== 'undefined' && !!browser.runtime;
  
  console.log('SF Tabs: Browser detection:', { isChrome, isFirefox });
  
  // Create a universal browser API object
  if (!isFirefox && isChrome) {
    console.log('SF Tabs: Setting up Chrome compatibility layer...');
    
    // Chrome doesn't have 'browser' namespace, so create it from 'chrome'
    window.browser = {};
    
    // Copy over the basic runtime properties
    window.browser.runtime = {
      getURL: chrome.runtime.getURL.bind(chrome.runtime),
      onMessage: chrome.runtime.onMessage,
      lastError: chrome.runtime.lastError
    };
    
    // Storage API with promise support
    window.browser.storage = {
      onChanged: chrome.storage.onChanged
    };
    
    // Promisify storage.sync methods
    if (chrome.storage && chrome.storage.sync) {
      window.browser.storage.sync = {
        get: function(keys) {
          return new Promise((resolve, reject) => {
            try {
              chrome.storage.sync.get(keys, (result) => {
                if (chrome.runtime.lastError) {
                  console.error('SF Tabs: Storage get error:', chrome.runtime.lastError);
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  console.log('SF Tabs: Storage get success:', result);
                  resolve(result);
                }
              });
            } catch (error) {
              console.error('SF Tabs: Storage get exception:', error);
              reject(error);
            }
          });
        },
        
        set: function(items) {
          return new Promise((resolve, reject) => {
            try {
              chrome.storage.sync.set(items, () => {
                if (chrome.runtime.lastError) {
                  console.error('SF Tabs: Storage set error:', chrome.runtime.lastError);
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  console.log('SF Tabs: Storage set success:', items);
                  resolve();
                }
              });
            } catch (error) {
              console.error('SF Tabs: Storage set exception:', error);
              reject(error);
            }
          });
        },
        
        clear: function() {
          return new Promise((resolve, reject) => {
            try {
              chrome.storage.sync.clear(() => {
                if (chrome.runtime.lastError) {
                  console.error('SF Tabs: Storage clear error:', chrome.runtime.lastError);
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  console.log('SF Tabs: Storage cleared successfully');
                  resolve();
                }
              });
            } catch (error) {
              console.error('SF Tabs: Storage clear exception:', error);
              reject(error);
            }
          });
        }
      };
    }
    
    // Tabs API with promise support
    window.browser.tabs = {};
    
    if (chrome.tabs && chrome.tabs.query) {
      window.browser.tabs.query = function(queryInfo) {
        return new Promise((resolve, reject) => {
          try {
            chrome.tabs.query(queryInfo, (tabs) => {
              if (chrome.runtime.lastError) {
                console.error('SF Tabs: Tabs query error:', chrome.runtime.lastError);
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                console.log('SF Tabs: Tabs query success:', tabs);
                resolve(tabs);
              }
            });
          } catch (error) {
            console.error('SF Tabs: Tabs query exception:', error);
            reject(error);
          }
        });
      };
    }
    
    if (chrome.tabs && chrome.tabs.create) {
      window.browser.tabs.create = function(createProperties) {
        return new Promise((resolve, reject) => {
          try {
            chrome.tabs.create(createProperties, (tab) => {
              if (chrome.runtime.lastError) {
                console.error('SF Tabs: Tabs create error:', chrome.runtime.lastError);
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                console.log('SF Tabs: Tab created successfully:', tab);
                resolve(tab);
              }
            });
          } catch (error) {
            console.error('SF Tabs: Tabs create exception:', error);
            reject(error);
          }
        });
      };
    }
    
    if (chrome.tabs && chrome.tabs.sendMessage) {
      window.browser.tabs.sendMessage = function(tabId, message, options) {
        return new Promise((resolve, reject) => {
          try {
            const callback = (response) => {
              if (chrome.runtime.lastError) {
                // In Chrome, this is often expected (tab not ready, etc.)
                console.log('SF Tabs: Tab message expected error (tab not ready):', chrome.runtime.lastError.message);
                resolve(null);
              } else {
                console.log('SF Tabs: Tab message sent successfully:', response);
                resolve(response);
              }
            };
            
            if (options) {
              chrome.tabs.sendMessage(tabId, message, options, callback);
            } else {
              chrome.tabs.sendMessage(tabId, message, callback);
            }
          } catch (error) {
            console.error('SF Tabs: Tab message exception:', error);
            reject(error);
          }
        });
      };
    }
    
    console.log('SF Tabs: Chrome compatibility layer setup complete');
    
  } else if (isFirefox) {
    console.log('SF Tabs: Using native Firefox browser API');
  } else {
    console.error('SF Tabs: No compatible browser API found');
  }
  
  // Test the browser API after setup
  setTimeout(() => {
    console.log('SF Tabs: Testing browser API...');
    if (window.browser && window.browser.storage && window.browser.storage.sync) {
      console.log('SF Tabs: ✓ Storage API available');
    } else {
      console.error('SF Tabs: ✗ Storage API not available');
    }
    
    if (window.browser && window.browser.tabs && window.browser.tabs.query) {
      console.log('SF Tabs: ✓ Tabs API available');
    } else {
      console.error('SF Tabs: ✗ Tabs API not available');
    }
  }, 100);
  
})();