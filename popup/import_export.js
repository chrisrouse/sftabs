// Browser compatibility layer - add this at the very top of import_export.js
(function() {
  'use strict';
  
  if (typeof browser === 'undefined' && typeof chrome !== 'undefined' && chrome.runtime) {
    window.browser = {
      runtime: {
        getURL: chrome.runtime.getURL.bind(chrome.runtime)
      },
      storage: {
        local: {
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
          }
        }
      },
      tabs: {
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
        }
      }
    };
  }
})();

// DOM elements
const exportButton = document.getElementById('export-button');
const importButton = document.getElementById('import-button');
const fileInput = document.getElementById('import-file-input');
const statusMessage = document.getElementById('status-message');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
	console.log('Import/Export page loaded');

	// Set up event listeners
	exportButton.addEventListener('click', exportSettings);
	importButton.addEventListener('click', importSettings);
	fileInput.addEventListener('change', handleFileSelect);

	// Styling functions
	applyThemeFromStorage();
});

// Apply theme based on saved user settings
function applyThemeFromStorage() {
	browser.storage.local.get('userSettings')
		.then((result) => {
			if (result.userSettings && result.userSettings.themeMode) {
				const themeMode = result.userSettings.themeMode;

				if (themeMode === 'system') {
					// Check system preference
					if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
						document.documentElement.setAttribute('data-theme', 'dark');
					} else {
						document.documentElement.setAttribute('data-theme', 'light');
					}
				} else {
					// Apply user selected theme
					document.documentElement.setAttribute('data-theme', themeMode);
				}
			}
		})
		.catch(error => {
			console.error('Error loading theme settings:', error);
		});
}

// Export settings function
function exportSettings() {
	console.log('Exporting settings');

	browser.storage.local.get(['customTabs', 'userSettings'])
		.then((result) => {
			// Create a configuration object containing all settings
			const config = {
				customTabs: result.customTabs || [],
				userSettings: result.userSettings || {}
			};

			// Convert to JSON string
			const jsonString = JSON.stringify(config, null, 2);

			// Create a Blob containing the data
			const blob = new Blob([jsonString], { type: 'application/json' });

			// Create an object URL for the blob
			const url = URL.createObjectURL(blob);

			// Generate timestamp for the filename
			const now = new Date();
			const timestamp = now.getFullYear() + '-' +
				('0' + (now.getMonth() + 1)).slice(-2) + '-' +
				('0' + now.getDate()).slice(-2) + '_' +
				('0' + now.getHours()).slice(-2) + '-' +
				('0' + now.getMinutes()).slice(-2);

			// Create the filename with timestamp
			const filename = `sftabs_config_${timestamp}.json`;

			// Create a temporary anchor element
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;

			// Append to the DOM
			document.body.appendChild(a);

			// Trigger the download
			a.click();

			// Clean up
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			showStatus('Configuration exported successfully', false);
		})
		.catch(error => {
			console.error('Error exporting configuration:', error);
			showStatus('Error exporting configuration: ' + error.message, true);
		});
}

// Import settings function - simplified direct approach
function importSettings() {
	console.log('Import function started');
	fileInput.click();
}

// File selection handler
function handleFileSelect(event) {
	console.log('File selection handler triggered');
	const file = event.target.files[0];

	if (!file) {
		console.log('No file selected');
		return;
	}

	console.log('File selected:', file.name);

	const reader = new FileReader();

	reader.onload = function(e) {
		try {
			console.log('File read successfully');
			const fileContent = e.target.result;
			const config = JSON.parse(fileContent);

			// Validate the configuration
			if (!config.customTabs || !Array.isArray(config.customTabs)) {
				throw new Error('Invalid configuration format: missing customTabs array');
			}

			// First clear existing storage
			browser.storage.local.clear()
				.then(() => {
					// Then save the imported configuration
					return Promise.all([
						browser.storage.local.set({ customTabs: config.customTabs }),
						browser.storage.local.set({ userSettings: config.userSettings || {} })
					]);
				})
				.then(() => {
					console.log('Configuration imported successfully');
					showStatus('Configuration imported successfully. Changes will take effect when you reopen the extension.', false);
				})
				.catch(error => {
					console.error('Error saving configuration:', error);
					showStatus('Error saving configuration: ' + error.message, true);
				});
		} catch (error) {
			console.error('Error parsing file:', error);
			showStatus('Invalid configuration file: ' + error.message, true);
		}
	};

	reader.onerror = function() {
		console.error('Error reading file');
		showStatus('Error reading file', true);
	};

	reader.readAsText(file);

	// Reset the file input to allow selecting the same file again
	fileInput.value = '';
}

// Show status message
function showStatus(message, isError = false) {
	console.log('Showing status message:', message, isError);
	statusMessage.textContent = message;

	// Apply appropriate class
	statusMessage.classList.remove('success', 'error');
	if (isError) {
		statusMessage.classList.add('error');
	} else {
		statusMessage.classList.add('success');
	}
}