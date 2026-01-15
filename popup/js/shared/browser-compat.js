// popup/js/shared/browser-compat.js
// Browser compatibility layer for Chrome/Firefox

(function() {
  'use strict';
  
  if (typeof browser === 'undefined' && typeof chrome !== 'undefined' && chrome.runtime) {
    
    window.browser = {
      runtime: {
        getURL: chrome.runtime.getURL.bind(chrome.runtime),
        onMessage: chrome.runtime.onMessage,
        lastError: chrome.runtime.lastError,
        openOptionsPage: function() {
          return new Promise((resolve, reject) => {
            chrome.runtime.openOptionsPage(() => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve();
              }
            });
          });
        }
      },
      storage: (function() {
        // Create local storage methods
        const localStorageMethods = {
          get: function(keys) {
            return new Promise((resolve, reject) => {
              chrome.storage.local.get(keys, (result) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve(result);
                }
              });
            });
          },
          set: function(items) {
            return new Promise((resolve, reject) => {
              chrome.storage.local.set(items, () => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve();
                }
              });
            });
          },
          clear: function() {
            return new Promise((resolve, reject) => {
              chrome.storage.local.clear(() => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve();
                }
              });
            });
          },
          remove: function(keys) {
            return new Promise((resolve, reject) => {
              chrome.storage.local.remove(keys, () => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve();
                }
              });
            });
          }
        };

        // Create sync storage methods (separate from local)
        const syncStorageMethods = {
          get: function(keys) {
            return new Promise((resolve, reject) => {
              chrome.storage.sync.get(keys, (result) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve(result);
                }
              });
            });
          },
          set: function(items) {
            return new Promise((resolve, reject) => {
              chrome.storage.sync.set(items, () => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve();
                }
              });
            });
          },
          clear: function() {
            return new Promise((resolve, reject) => {
              chrome.storage.sync.clear(() => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve();
                }
              });
            });
          },
          remove: function(keys) {
            return new Promise((resolve, reject) => {
              chrome.storage.sync.remove(keys, () => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
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
          return new Promise((resolve, reject) => {
            chrome.tabs.query(queryInfo, (tabs) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(tabs);
              }
            });
          });
        },
        create: function(createProperties) {
          return new Promise((resolve, reject) => {
            chrome.tabs.create(createProperties, (tab) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(tab);
              }
            });
          });
        },
        sendMessage: function(tabId, message, options) {
          return new Promise((resolve) => {
            const callback = (response) => {
              if (chrome.runtime.lastError) {
                resolve(null);
              } else {
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
  } else if (typeof browser === 'undefined') {
  }
})();