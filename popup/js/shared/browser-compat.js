// popup/js/shared/browser-compat.js
// Browser compatibility layer for Chrome/Firefox

(function() {
  'use strict';
  
  console.log('SF Tabs: Initializing browser compatibility...');
  
  if (typeof browser === 'undefined' && typeof chrome !== 'undefined' && chrome.runtime) {
    console.log('SF Tabs: Setting up Chrome compatibility layer...');
    
    window.browser = {
      runtime: {
        getURL: chrome.runtime.getURL.bind(chrome.runtime),
        onMessage: chrome.runtime.onMessage,
        lastError: chrome.runtime.lastError
      },
      storage: (function() {
        // Create local storage methods
        const localStorageMethods = {
          get: function(keys) {
            console.log('SF Tabs: Chrome storage.local.get called with:', keys);
            return new Promise((resolve, reject) => {
              chrome.storage.local.get(keys, (result) => {
                if (chrome.runtime.lastError) {
                  console.error('SF Tabs: Storage local get error:', chrome.runtime.lastError);
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  console.log('SF Tabs: Storage local get result:', result);
                  resolve(result);
                }
              });
            });
          },
          set: function(items) {
            console.log('SF Tabs: Chrome storage.local.set called with:', items);
            return new Promise((resolve, reject) => {
              chrome.storage.local.set(items, () => {
                if (chrome.runtime.lastError) {
                  console.error('SF Tabs: Storage local set error:', chrome.runtime.lastError);
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  console.log('SF Tabs: Storage local set success');
                  resolve();
                }
              });
            });
          },
          clear: function() {
            console.log('SF Tabs: Chrome storage.local.clear called');
            return new Promise((resolve, reject) => {
              chrome.storage.local.clear(() => {
                if (chrome.runtime.lastError) {
                  console.error('SF Tabs: Storage local clear error:', chrome.runtime.lastError);
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  console.log('SF Tabs: Storage local clear success');
                  resolve();
                }
              });
            });
          }
        };

        // Create sync storage methods (separate from local)
        const syncStorageMethods = {
          get: function(keys) {
            console.log('SF Tabs: Chrome storage.sync.get called with:', keys);
            return new Promise((resolve, reject) => {
              chrome.storage.sync.get(keys, (result) => {
                if (chrome.runtime.lastError) {
                  console.error('SF Tabs: Storage sync get error:', chrome.runtime.lastError);
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  console.log('SF Tabs: Storage sync get result:', result);
                  resolve(result);
                }
              });
            });
          },
          set: function(items) {
            console.log('SF Tabs: Chrome storage.sync.set called with:', items);
            return new Promise((resolve, reject) => {
              chrome.storage.sync.set(items, () => {
                if (chrome.runtime.lastError) {
                  console.error('SF Tabs: Storage sync set error:', chrome.runtime.lastError);
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  console.log('SF Tabs: Storage sync set success');
                  resolve();
                }
              });
            });
          },
          clear: function() {
            console.log('SF Tabs: Chrome storage.sync.clear called');
            return new Promise((resolve, reject) => {
              chrome.storage.sync.clear(() => {
                if (chrome.runtime.lastError) {
                  console.error('SF Tabs: Storage sync clear error:', chrome.runtime.lastError);
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  console.log('SF Tabs: Storage sync clear success');
                  resolve();
                }
              });
            });
          }
        };

        return {
          onChanged: chrome.storage.onChanged,
          local: localStorageMethods,
          sync: syncStorageMethods  // Now properly separate
        };
      })(),
      tabs: {
        query: function(queryInfo) {
          console.log('SF Tabs: Chrome tabs.query called with:', queryInfo);
          return new Promise((resolve, reject) => {
            chrome.tabs.query(queryInfo, (tabs) => {
              if (chrome.runtime.lastError) {
                console.error('SF Tabs: Tabs query error:', chrome.runtime.lastError);
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                console.log('SF Tabs: Tabs query result:', tabs);
                resolve(tabs);
              }
            });
          });
        },
        create: function(createProperties) {
          console.log('SF Tabs: Chrome tabs.create called with:', createProperties);
          return new Promise((resolve, reject) => {
            chrome.tabs.create(createProperties, (tab) => {
              if (chrome.runtime.lastError) {
                console.error('SF Tabs: Tabs create error:', chrome.runtime.lastError);
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                console.log('SF Tabs: Tab created:', tab);
                resolve(tab);
              }
            });
          });
        },
        sendMessage: function(tabId, message, options) {
          console.log('SF Tabs: Chrome tabs.sendMessage called');
          return new Promise((resolve) => {
            const callback = (response) => {
              if (chrome.runtime.lastError) {
                console.log('SF Tabs: Tab message expected error:', chrome.runtime.lastError.message);
                resolve(null);
              } else {
                console.log('SF Tabs: Tab message success:', response);
                resolve(response);
              }
            };
            
            if (options) {
              chrome.tabs.sendMessage(tabId, message, options, callback);
            } else {
              chrome.tabs.sendMessage(tabId, message, callback);
            }
          });
        }
      }
    };
    
    console.log('SF Tabs: Chrome compatibility layer complete');
  } else if (typeof browser !== 'undefined') {
    console.log('SF Tabs: Using native browser API (Firefox)');
  } else {
    console.error('SF Tabs: No compatible browser API found!');
  }
  
  // Test the setup
  console.log('SF Tabs: Final browser object:', window.browser);
})();