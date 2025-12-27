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
  dropdownItems: [],
  position: 0
};

// Profile data structure
const PROFILE_STRUCTURE = {
  id: '',
  name: '',
  isDefault: false,
  urlPatterns: [],
  createdAt: '',
  lastActive: ''
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
    position: 0
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
    position: 1
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
    position: 2
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
    position: 3
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
    position: 4
  }
];

// Storage configuration
const STORAGE_VERSION = '2.0.0';
const CHUNK_SIZE = 7000; // bytes - leave 1KB buffer under 8KB limit
const CHUNK_KEY_PREFIX = 'customTabs_chunk_';
const SETTINGS_CHUNK_KEY_PREFIX = 'userSettings_chunk_';
const STORAGE_METADATA_KEY = 'storageMetadata';

// Default user settings
const DEFAULT_SETTINGS = {
  themeMode: 'light',
  compactMode: false,
  skipDeleteConfirmation: false,
  useSyncStorage: true, // Enable cross-device sync by default
  profilesEnabled: false, // Enable profiles feature
  autoSwitchProfiles: false, // Enable auto-switching based on URL patterns
  activeProfileId: null, // Currently active profile ID (null = no profiles mode)
  defaultProfileId: null, // Default profile to use when auto-switch doesn't match
  floatingButton: {
    enabled: false, // Disabled by default (opt-in feature)
    position: 25, // Vertical position along right edge (0 = top, 100 = bottom)
    displayMode: 'both', // 'setup-only' | 'floating-only' | 'both'
    defaultVisibility: true, // Show on all pages by default
    visibilityRules: [], // URL pattern rules (advanced)
    buttonSize: 'medium', // 'small' | 'medium' | 'large'
    showLabel: false // Show "SF Tabs" text next to icon
  }
};

// UI selectors
const SELECTORS = {
  // Main containers
  tabList: '#tab-list',
  emptyState: '#empty-state',
  tabForm: '#tab-form',
  mainContent: '#main-content',

  // Form elements
  formTitle: '#form-title',
  tabNameInput: '#tab-name',
  tabPathInput: '#tab-path',
  openInNewTabCheckbox: '#open-in-new-tab',
  isObjectCheckbox: '#is-object',
  isCustomUrlCheckbox: '#is-custom-url',
  isSetupObjectCheckbox: '#is-setup-object',
  hasDropdownCheckbox: '#has-dropdown',
  
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
  useSyncStorageCheckbox: '#use-sync-storage',
  settingsResetButton: '#settings-reset-button',

  // Form groups
  hasDropdownGroup: '.has-dropdown-group',
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
    PROFILE_STRUCTURE,
    DEFAULT_TABS,
    DEFAULT_SETTINGS,
    SELECTORS,
    NAVIGATION_SELECTORS,
    TAB_CONTAINER_SELECTOR,
    CUSTOM_TAB_CLASS,
    STORAGE_VERSION,
    CHUNK_SIZE,
    CHUNK_KEY_PREFIX,
    SETTINGS_CHUNK_KEY_PREFIX,
    STORAGE_METADATA_KEY
  };
} else {
  // Browser environment
  window.SFTabs = window.SFTabs || {};
  window.SFTabs.constants = {
    TAB_STRUCTURE,
    PROFILE_STRUCTURE,
    DEFAULT_TABS,
    DEFAULT_SETTINGS,
    SELECTORS,
    NAVIGATION_SELECTORS,
    TAB_CONTAINER_SELECTOR,
    CUSTOM_TAB_CLASS,
    STORAGE_VERSION,
    CHUNK_SIZE,
    CHUNK_KEY_PREFIX,
    SETTINGS_CHUNK_KEY_PREFIX,
    STORAGE_METADATA_KEY
  };
}