// utils.js - Central location for shared utility functions
const SFTabsUtils = {
    // Storage Operations
    storageHelpers: {
      /**
       * Default tabs configuration
       */
      getDefaultTabs: function() {
        return [
          {
            id: 'default_tab_flows',
            label: 'Flows',
            path: 'Flows',
            openInNewTab: false,
            isObject: false,
            position: 0
          },
          {
            id: 'default_tab_packages',
            label: 'Installed Packages',
            path: 'ImportedPackage',
            openInNewTab: false,
            isObject: false,
            position: 1
          },
          {
            id: 'default_tab_users',
            label: 'Users',
            path: 'ManageUsers',
            openInNewTab: false,
            isObject: false,
            position: 2
          },
          {
            id: 'default_tab_profiles',
            label: 'Profiles',
            path: 'EnhancedProfiles',
            openInNewTab: false,
            isObject: false,
            position: 3
          },
          {
            id: 'default_tab_permsets',
            label: 'Permission Sets',
            path: 'PermSets',
            openInNewTab: false,
            isObject: false,
            position: 4
          }
        ];
      },
      
      /**
       * Default user settings
       */
      getDefaultSettings: function() {
        return {
          themeMode: 'light',
          compactMode: false
        };
      },
      
      /**
       * Load tabs from storage
       * @returns {Promise} - Promise resolving to array of tabs
       */
      loadTabs: function() {
        console.log('Utils: Loading tabs from storage');
        return browser.storage.sync.get('customTabs')
          .then((result) => {
            if (result.customTabs && Array.isArray(result.customTabs) && result.customTabs.length > 0) {
              console.log('Utils: Found', result.customTabs.length, 'tabs in storage');
              return result.customTabs;
            } else {
              console.log('Utils: No tabs in storage, using defaults');
              // Return default tabs if none found
              return JSON.parse(JSON.stringify(this.getDefaultTabs()));
            }
          })
          .catch((error) => {
            console.error('Error loading tabs from storage:', error);
            // Return default tabs on error
            return this.getDefaultTabs();
          });
      },
      
      /**
       * Save tabs to storage
       * @param {Array} tabs - The tabs to save
       * @returns {Promise} - Promise resolving when save is complete
       */
      saveTabs: function(tabs) {
        console.log('Utils: Saving tabs to storage');
        // Sort tabs by position before saving
        const sortedTabs = [...tabs].sort((a, b) => a.position - b.position);
        
        return browser.storage.sync.set({ customTabs: sortedTabs })
          .then(() => {
            console.log('Tabs saved successfully');
            return true;
          })
          .catch((error) => {
            console.error('Error saving tabs to storage:', error);
            return false;
          });
      },
      
      /**
       * Load user settings from storage
       * @returns {Promise} - Promise resolving to user settings object
       */
      loadSettings: function() {
        console.log('Utils: Loading user settings from storage');
        const defaultSettings = this.getDefaultSettings();
        
        return browser.storage.sync.get('userSettings')
          .then((result) => {
            if (result.userSettings) {
              return { ...defaultSettings, ...result.userSettings };
            } else {
              return defaultSettings;
            }
          })
          .catch((error) => {
            console.error('Error loading settings from storage:', error);
            return defaultSettings;
          });
      },
      
      /**
       * Save user settings to storage
       * @param {Object} settings - The settings to save
       * @returns {Promise} - Promise resolving when save is complete
       */
      saveSettings: function(settings) {
        console.log('Utils: Saving user settings to storage:', settings);
        return browser.storage.sync.set({ userSettings: settings })
          .then(() => {
            console.log('Settings saved successfully');
            return true;
          })
          .catch((error) => {
            console.error('Error saving settings to storage:', error);
            return false;
          });
      },
      
      /**
       * Export all settings and tabs to a JSON string
       * @returns {Promise<string>} - Promise resolving to a JSON string
       */
      exportAll: function() {
        return Promise.all([
          browser.storage.sync.get('customTabs'),
          browser.storage.sync.get('userSettings')
        ]).then(([tabsResult, settingsResult]) => {
          const config = {
            customTabs: tabsResult.customTabs || [],
            userSettings: settingsResult.userSettings || {}
          };
          return JSON.stringify(config, null, 2);
        });
      },
      
      /**
       * Import settings and tabs from a JSON string
       * @param {string} jsonString - The JSON string to import
       * @returns {Promise} - Promise resolving when import is complete
       */
      importAll: function(jsonString) {
        try {
          const config = JSON.parse(jsonString);
          
          // Validate the configuration
          if (!config.customTabs || !Array.isArray(config.customTabs)) {
            throw new Error('Invalid configuration format: missing customTabs array');
          }
          
          // Clear existing storage and save the imported configuration
          return browser.storage.sync.clear()
            .then(() => {
              return Promise.all([
                browser.storage.sync.set({ customTabs: config.customTabs }),
                browser.storage.sync.set({ userSettings: config.userSettings || {} })
              ]);
            });
        } catch (error) {
          return Promise.reject(error);
        }
      }
    },
  
    // URL/Path Processing
    urlHelpers: {
      /**
       * Formats a Salesforce object name from URL format
       * Examples: 
       * - "Study_Group__c" becomes "Study Group"
       * - "Campaign" stays "Campaign"
       * - "ProductTransfer" becomes "Product Transfer"
       */
      formatObjectNameFromURL: function(objectNameFromURL) {
        if (!objectNameFromURL) {
          return 'Object';
        }
        
        // First, remove any __c or similar custom object suffix
        let cleanName = objectNameFromURL.replace(/__c$/g, '');
        
        // Replace underscores with spaces
        cleanName = cleanName.replace(/_/g, ' ');
        
        // Insert spaces between camelCase words (ProductTransfer -> Product Transfer)
        cleanName = cleanName.replace(/([a-z])([A-Z])/g, '$1 $2');
        
        // Ensure proper capitalization
        cleanName = cleanName.replace(/\b\w/g, letter => letter.toUpperCase());
        
        return cleanName;
      },
      
      /**
       * Determines the full URL based on tab type and path
       */
      buildCompleteURL: function(path, isObject, isCustomUrl) {
        // Get the base URL for the current org - we'll need to adjust this for different contexts
        const currentUrl = window.location.href;
        const baseUrlMatch = currentUrl.match(/^(https?:\/\/[^\/]+)/);
        const baseUrl = baseUrlMatch ? baseUrlMatch[1] : '';
        
        // Create appropriate URL structure based on Salesforce instance
        const baseUrlSetup = baseUrl + '/lightning/setup/';
        const baseUrlObject = baseUrl + '/lightning/o/';
        
        // Determine the full URL based on tab type
        let fullUrl = '';
        
        if (isCustomUrl) {
          // For custom URLs, ensure there's a leading slash
          let formattedPath = path;
          
          if (!formattedPath.startsWith('/')) {
            formattedPath = '/' + formattedPath;
          }
          
          fullUrl = `${baseUrl}${formattedPath}`;
        } else if (isObject) {
          // Object URLs need /home at the end
          fullUrl = `${baseUrlObject}${path}/home`;
        } else if (path.includes('ObjectManager/')) {
          // ObjectManager URLs don't need /home
          fullUrl = `${baseUrlSetup}${path}`;
        } else {
          // Setup URLs need /home at the end
          fullUrl = `${baseUrlSetup}${path}/home`;
        }
        
        return fullUrl;
      },
      
      /**
       * Detect the type of Salesforce page from a URL
       * Returns an object with detection results
       */
      detectPageType: function(url) {
        let result = {
          isObject: false,
          isCustomUrl: false,
          path: '',
          name: ''
        };
        
        // Check if this is a Salesforce setup page
        if (url.includes('/lightning/setup/')) {
          // Extract the full path component (after /setup/)
          const urlParts = url.split('/lightning/setup/');
          if (urlParts.length > 1) {
            // Get everything after /setup/ and before any query parameters
            const fullPath = urlParts[1].split('?')[0]; 
            
            // Special case for ObjectManager: keep the /view suffix
            if (fullPath.startsWith('ObjectManager/')) {
              result.path = fullPath;
              result.isObject = false; // Mark ObjectManager paths as Setup type
            } else {
              // For other setup pages, remove trailing '/home' or '/view' if present
              result.path = fullPath.replace(/\/(home|view)$/, '');
            }
          }
        } 
        // Check if this is a Salesforce object page
        else if (url.includes('/lightning/o/')) {
          result.isObject = true; // Mark as object page
          // Extract the path component (after /o/)
          const urlParts = url.split('/lightning/o/');
          if (urlParts.length > 1) {
            // Get everything after /o/ and before any query parameters
            const fullPath = urlParts[1].split('?')[0];
            
            // Standard object pages (remove trailing suffixes)
            result.path = fullPath.replace(/\/(home|view)$/, '');
          }
        }
        // Handle custom URLs (any other Salesforce URL pattern)
        else if (url.includes('.lightning.force.com/') || url.includes('.salesforce.com/')) {
          result.isCustomUrl = true;
          
          // Get base domain
          const urlParts = url.split('.com/');
          if (urlParts.length > 1) {
            // Extract everything after the domain
            result.path = urlParts[1].split('?')[0]; // Remove query parameters
          }
        }
        
        return result;
      }
    },
  
    // DOM Helpers
    domHelpers: {
      /**
       * Create tab element for the tab list
       * @param {Object} tab - The tab data
       * @param {boolean} compactMode - Whether to use compact display mode
       * @returns {HTMLElement} - The created tab element
       */
      createTabElement: function(tab, compactMode = false) {
        const tabItem = document.createElement('div');
        tabItem.className = 'tab-item';
        tabItem.dataset.id = tab.id;
        
        const dragHandle = document.createElement('div');
        dragHandle.className = 'drag-handle';
        dragHandle.innerHTML = '⋮⋮';
        dragHandle.setAttribute('title', 'Drag to reorder');
        
        const contentContainer = document.createElement('div');
        contentContainer.className = 'tab-info';
        
        // Determine the tab type - force correct type detection
        let isObject = false;
        let isCustomUrl = false;
        
        // Check for explicit properties first
        if (tab.hasOwnProperty('isObject') && tab.isObject === true) {
          isObject = true;
        } else if (tab.hasOwnProperty('isCustomUrl') && tab.isCustomUrl === true) {
          isCustomUrl = true;
        } 
        // Then check the path if properties aren't set
        else if (tab.path) {
          // Check for ObjectManager paths
          if (!tab.path.startsWith('ObjectManager/') && 
              (tab.path.includes('/o/') || tab.path.endsWith('/view'))) {
            isObject = true;
          } 
          // Check for custom URL patterns
          else if (tab.path.includes('interaction_explorer') || 
                  tab.path.endsWith('.app') ||
                  tab.path.includes('apex/')) {
            isCustomUrl = true;
          }
        }
        
        // Set badge type based on detected tab type
        let badgeText = 'Setup';
        let badgeClass = 'setup';
        
        if (isCustomUrl) {
          badgeText = 'Custom';
          badgeClass = 'custom';
        } else if (isObject) {
          badgeText = 'Object';
          badgeClass = 'object';
        }
        
        // Create tab name
        const tabName = document.createElement('div');
        tabName.className = 'tab-name';
        tabName.textContent = tab.label;
        
        // Setup different layout based on compact mode
        if (compactMode) {
          // Compact mode specific setup
          tabItem.classList.add('compact-mode');
          
          // In compact mode, badge is a single letter
          const badgeShort = badgeText.charAt(0);
          
          // Create the badge element for compact mode
          const pathType = document.createElement('span');
          pathType.className = 'path-type-compact ' + badgeClass;
          pathType.textContent = badgeShort;
          
          // Create a wrapper div for proper alignment
          const badgeWrapper = document.createElement('div'); 
          badgeWrapper.style.display = 'flex';
          badgeWrapper.style.alignItems = 'flex-start';
          badgeWrapper.style.paddingTop = '3px'; // Align with drag handle
          badgeWrapper.appendChild(pathType);
          
          // Configure content container for compact mode
          contentContainer.style.display = 'flex';
          contentContainer.style.flexDirection = 'row';
          contentContainer.style.flex = '1';
          contentContainer.style.minWidth = '0';
          contentContainer.style.alignItems = 'flex-start'; // Align items to the top
          
          // Add badge directly to content container
          contentContainer.appendChild(badgeWrapper);
          
          // Create text container for name that allows wrapping
          const textContainer = document.createElement('div');
          textContainer.style.marginLeft = '8px';
          textContainer.style.flex = '1';
          textContainer.style.minWidth = '0';
          textContainer.appendChild(tabName);
          
          // Add text to content container
          contentContainer.appendChild(textContainer);
          
          // Style the tab name for wrapping
          tabName.style.wordBreak = 'break-word';
          tabName.style.overflow = 'hidden';
          tabName.style.paddingTop = '3px'; // Align with badge and drag handle
        } else {
          // Regular mode - keep original structure
          contentContainer.style.display = 'flex';
          contentContainer.style.flexDirection = 'column';
          contentContainer.style.flex = '1';
          contentContainer.style.minWidth = '0';
          
          // Add tab name first
          contentContainer.appendChild(tabName);
          
          // Create tab path container
          const tabPath = document.createElement('div');
          tabPath.className = 'tab-path';
          
          // Create the badge element for regular mode
          const pathType = document.createElement('span');
          pathType.className = 'path-type ' + badgeClass;
          pathType.textContent = badgeText;
          
          // Create path text element
          const pathTextElement = document.createElement('span');
          pathTextElement.className = 'path-text';
          pathTextElement.textContent = tab.path;
          
          // Add badge and path to tab path container
          tabPath.appendChild(pathType);
          tabPath.appendChild(pathTextElement);
          
          // Add tab path to content container
          contentContainer.appendChild(tabPath);
        }
        
        // Create actions container
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'tab-actions';
        
        // Create toggle for "open in new tab"
        const newTabToggle = document.createElement('label');
        newTabToggle.className = 'new-tab-toggle';
        newTabToggle.setAttribute('title', 'Open in new tab');
        
        const toggleInput = document.createElement('input');
        toggleInput.type = 'checkbox';
        toggleInput.checked = tab.openInNewTab;
        toggleInput.style.display = 'none';
        
        // We need to handle events in the calling code
        // Just add a data attribute to identify this element
        toggleInput.dataset.inputType = 'openInNewTab';
        toggleInput.dataset.tabId = tab.id;
        
        const toggleSwitch = document.createElement('span');
        toggleSwitch.className = 'toggle-switch';
        
        newTabToggle.appendChild(toggleInput);
        newTabToggle.appendChild(toggleSwitch);
        
        // Create delete button
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path fill-rule="evenodd" d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.405 15h5.19c.9 0 1.652-.681 1.741-1.576l.66-6.6a.75.75 0 00-1.492-.149l-.66 6.6a.25.25 0 01-.249.225h-5.19a.25.25 0 01-.249-.225l-.66-6.6z"></path></svg>';
        deleteButton.setAttribute('title', 'Remove tab');
        deleteButton.dataset.action = 'delete';
        deleteButton.dataset.tabId = tab.id;
        
        // Add buttons to actions container
        actionsContainer.appendChild(newTabToggle);
        actionsContainer.appendChild(deleteButton);
        
        // Add data attribute for edit action
        contentContainer.dataset.action = 'edit';
        contentContainer.dataset.tabId = tab.id;
        
        // Assemble final tab layout
        tabItem.appendChild(dragHandle);
        tabItem.appendChild(contentContainer);
        tabItem.appendChild(actionsContainer);
        
        return tabItem;
      },
      
      /**
       * Create a drop indicator element for drag and drop
       * @returns {HTMLElement} - The drop indicator element
       */
      createDropIndicator: function() {
        const dropIndicator = document.createElement('div');
        dropIndicator.className = 'drop-indicator';
        return dropIndicator;
      },
      
      /**
       * Create a clone for drag and drop
       * @param {HTMLElement} item - The item to clone
       * @param {number} width - The width of the item
       * @returns {HTMLElement} - The cloned element
       */
      createDragClone: function(item, width) {
        const clone = item.cloneNode(true);
        clone.classList.add('tab-item-clone');
        clone.style.width = width + 'px';
        
        // Add clone to the DOM
        document.body.appendChild(clone);
        
        return clone;
      },
      
      /**
       * Move an element to specified coordinates
       * @param {HTMLElement} element - The element to move
       * @param {number} x - The x coordinate
       * @param {number} y - The y coordinate
       */
      moveElement: function(element, x, y) {
        element.style.top = y + 'px';
        element.style.left = x + 'px';
      }
    },
  
    // UI Helpers
    uiHelpers: {
      /**
       * Apply theme based on settings
       * @param {string} themeMode - The theme mode (light, dark, system)
       */
      applyTheme: function(themeMode) {
        if (themeMode === 'system') {
          // Check system preference
          if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.setAttribute('data-theme', 'dark');
          } else {
            document.documentElement.setAttribute('data-theme', 'light');
          }
    
          // Listen for changes in system theme
          const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
          mediaQuery.addEventListener('change', e => {
            const newTheme = e.matches ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
          });
        } else {
          // Apply user selected theme
          document.documentElement.setAttribute('data-theme', themeMode);
        }
      },
      
      /**
       * Show status message
       * @param {string} message - The message to display
       * @param {boolean} isError - Whether this is an error message
       * @param {string} elementId - ID of the status message element
       */
      showStatus: function(message, isError = false, elementId = 'status-message') {
        console.log('Utils: Showing status message', { message, isError });
        const statusMessage = document.getElementById(elementId);
        
        if (!statusMessage) {
          console.error('Status message element not found:', elementId);
          return;
        }
        
        statusMessage.textContent = message;
    
        // Apply appropriate class
        statusMessage.classList.remove('success', 'error');
        if (isError) {
          statusMessage.classList.add('error');
        } else if (message) {
          statusMessage.classList.add('success');
        }
    
        // Clear message after a delay
        setTimeout(() => {
          statusMessage.textContent = '';
          statusMessage.classList.remove('success', 'error');
        }, 3000);
      },
      
      /**
       * Show a modal dialog
       * @param {HTMLElement} modalElement - The modal DOM element
       * @param {HTMLElement} cancelButton - The cancel button in the modal
       * @param {HTMLElement} confirmButton - The confirm button in the modal
       * @param {Function} onConfirm - Callback to execute on confirmation
       */
      showModal: function(modalElement, cancelButton, confirmButton, onConfirm) {
        console.log(`Utils: Showing modal: ${modalElement.id}`);
    
        if (!modalElement) {
          console.error('Modal element not found!');
          return;
        }
    
        // Show the modal
        modalElement.classList.add('show');
    
        // Handle Cancel button
        cancelButton.onclick = function() {
          console.log('Cancel button clicked');
          modalElement.classList.remove('show');
        };
    
        // Handle Confirm button
        confirmButton.onclick = function() {
          console.log('Confirm button clicked');
          modalElement.classList.remove('show');
          if (typeof onConfirm === 'function') {
            onConfirm();
          }
        };
    
        // Close modal when clicking outside
        modalElement.onclick = function(event) {
          if (event.target === modalElement) {
            console.log('Clicked outside modal');
            modalElement.classList.remove('show');
          }
        };
      },
      
      /**
       * Toggle between panels (e.g., main content and settings)
       * @param {HTMLElement} panelToShow - The panel to show
       * @param {HTMLElement} panelToHide - The panel to hide
       */
      togglePanelVisibility: function(panelToShow, panelToHide) {
        if (!panelToShow || !panelToHide) {
          console.error('Toggle panel: Missing elements!', { show: panelToShow, hide: panelToHide });
          return;
        }
        
        panelToShow.classList.add('active');
        panelToShow.style.display = 'block';
        
        panelToHide.classList.remove('active');
        panelToHide.style.display = 'none';
      }
    },
  
    // General Helpers
    generateId: function() {
      return 'tab_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    }
  };
  
  // Make the utils accessible in different contexts
  if (typeof module !== 'undefined') {
    module.exports = SFTabsUtils;
  } else {
    window.SFTabsUtils = SFTabsUtils;
  }