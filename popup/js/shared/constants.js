// popup/js/shared/constants.js
// Shared constants and data structures

// Enhanced tab data structure
const TAB_STRUCTURE = {
  id: '',
  label: '',
  path: '',
  openInNewTab: false,
  isObject: false,
  isCustomUrl: false,
  isSetupObject: false,
  hasDropdown: false,
  autoSetupDropdown: false,
  children: [],
  parentId: null,
  position: 0,
  isExpanded: false,
  cachedNavigation: [],
  navigationLastUpdated: null,
  needsNavigationRefresh: false
};

// Default tabs configuration
const DEFAULT_TABS = [
  {
    id: 'default_tab_flows',
    label: 'Flows',
    path: 'Flows',
    openInNewTab: false,
    isObject: false,
    isCustomUrl: false,
    isSetupObject: false,
    hasDropdown: false,
    autoSetupDropdown: false,
    children: [],
    parentId: null,
    position: 0,
    isExpanded: false,
    cachedNavigation: [],
    navigationLastUpdated: null,
    needsNavigationRefresh: false
  },
  {
    id: 'default_tab_packages',
    label: 'Installed Packages',
    path: 'ImportedPackage',
    openInNewTab: false,
    isObject: false,
    isCustomUrl: false,
    isSetupObject: false,
    hasDropdown: false,
    autoSetupDropdown: false,
    children: [],
    parentId: null,
    position: 1,
    isExpanded: false,
    cachedNavigation: [],
    navigationLastUpdated: null,
    needsNavigationRefresh: false
  },
  {
    id: 'default_tab_users',
    label: 'Users',
    path: 'ManageUsers',
    openInNewTab: false,
    isObject: false,
    isCustomUrl: false,
    isSetupObject: false,
    hasDropdown: false,
    autoSetupDropdown: false,
    children: [],
    parentId: null,
    position: 2,
    isExpanded: false,
    cachedNavigation: [],
    navigationLastUpdated: null,
    needsNavigationRefresh: false
  },
  {
    id: 'default_tab_profiles',
    label: 'Profiles',
    path: 'EnhancedProfiles',
    openInNewTab: false,
    isObject: false,
    isCustomUrl: false,
    isSetupObject: false,
    hasDropdown: false,
    autoSetupDropdown: false,
    children: [],
    parentId: null,
    position: 3,
    isExpanded: false,
    cachedNavigation: [],
    navigationLastUpdated: null,
    needsNavigationRefresh: false
  },
  {
    id: 'default_tab_permsets',
    label: 'Permission Sets',
    path: 'PermSets',
    openInNewTab: false,
    isObject: false,
    isCustomUrl: false,
    isSetupObject: false,
    hasDropdown: false,
    autoSetupDropdown: false,
    children: [],
    parentId: null,
    position: 4,
    isExpanded: false,
    cachedNavigation: [],
    navigationLastUpdated: null,
    needsNavigationRefresh: false
  }
];

// Default user settings
const DEFAULT_SETTINGS = {
  themeMode: 'light',
  compactMode: false,
  skipDeleteConfirmation: false
};

// UI selectors
const SELECTORS = {
  // Main containers
  tabList: '#tab-list',
  emptyState: '#empty-state',
  tabForm: '#tab-form',
  mainContent: '#main-content',
  settingsPanel: '#settings-panel',
  
  // Form elements
  formTitle: '#form-title',
  tabNameInput: '#tab-name',
  tabPathInput: '#tab-path',
  openInNewTabCheckbox: '#open-in-new-tab',
  isObjectCheckbox: '#is-object',
  isCustomUrlCheckbox: '#is-custom-url',
  isSetupObjectCheckbox: '#is-setup-object',
  hasDropdownCheckbox: '#has-dropdown',
  autoSetupDropdownCheckbox: '#auto-setup-dropdown',
  
  // Buttons
  addTabButton: '#add-tab-button',
  quickAddButton: '#quick-add-button',
  saveButton: '#save-button',
  cancelButton: '#cancel-button',
  settingsButton: '#settings-button',
  refreshNavButton: '#refresh-nav-button',
  
  // Status and modals
  statusMessage: '#status-message',
  confirmModal: '#confirm-modal',
  deleteConfirmModal: '#delete-confirm-modal',
  
  // Settings
  compactModeCheckbox: '#compact-mode',
  skipDeleteConfirmationCheckbox: '#skip-delete-confirmation',
  settingsResetButton: '#settings-reset-button',
  
  // Form groups
  hasDropdownGroup: '.has-dropdown-group',
  autoSetupDropdownGroup: '.auto-setup-dropdown-group',
  refreshNavGroup: '.refresh-nav-group'
};

// ObjectManager navigation selectors
const NAVIGATION_SELECTORS = [
  '.objectManagerLeftNav',
  '.slds-navigation-list--vertical',
  '[role="tabpanel"] ul[role="tablist"]'
];

// Tab item selectors for content script
const TAB_CONTAINER_SELECTOR = '.tabBarItems.slds-grid';
const CUSTOM_TAB_CLASS = 'sf-tabs-custom-tab';

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TAB_STRUCTURE,
    DEFAULT_TABS,
    DEFAULT_SETTINGS,
    SELECTORS,
    NAVIGATION_SELECTORS,
    TAB_CONTAINER_SELECTOR,
    CUSTOM_TAB_CLASS
  };
} else {
  // Browser environment
  window.SFTabs = window.SFTabs || {};
  window.SFTabs.constants = {
    TAB_STRUCTURE,
    DEFAULT_TABS,
    DEFAULT_SETTINGS,
    SELECTORS,
    NAVIGATION_SELECTORS,
    TAB_CONTAINER_SELECTOR,
    CUSTOM_TAB_CLASS
  };
}