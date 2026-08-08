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
  dropdownItems: [],
  position: 0,
  color: null        // SLDS palette hue name, or null for the theme default
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
    position: 4
  }
];

const CHUNK_SIZE = 7000; // bytes - leave 1KB buffer under 8KB limit
// Default user settings
const DEFAULT_SETTINGS = {
  themeMode: 'light',
  compactMode: false,
  skipDeleteConfirmation: false,
  useSyncStorage: true, // Sync storage by default (acts as local if browser sync disabled)
  profilesEnabled: false, // Enable profiles feature
  autoSwitchProfiles: false, // Enable auto-switching based on URL patterns
  activeProfileId: null, // Currently active profile ID (null = no profiles mode)
  defaultProfileId: null, // Default profile to use when auto-switch doesn't match
  // Quick Add writes to the active profile only unless this is on, in which
  // case a captured page lands in every profile at once.
  quickAddAllProfiles: false,
  // A "+" at the end of the injected Setup tab bar that captures the current
  // page without opening the popup.
  menuBarQuickAdd: false,
  // Tints the browser tab's favicon so orgs are told apart in the tab strip.
  // Two layers: every org gets its environment's colour, and an entry in `orgs`
  // overrides that for one org — which is the only way to separate sandboxes,
  // since the hostname never says which tier a sandbox is.
  orgColors: {
    enabled: false,     // tint the browser tab's favicon
    banner: false,      // and/or show a bar across the top of the page
    bannerShowOrgName: true,   // "ACME--DEV1 · SANDBOX" rather than "SANDBOX"
    environments: {},   // environment -> hex; empty means use DEFAULT_ENV_COLORS
    orgs: []            // { identifier, environment, color }
  },
  // Optional per-tab colors. Off by default, and switching it off only stops
  // the colors rendering — the stored tab.color values are left alone.
  tabColors: {
    enabled: false,
    style: 'dot'     // 'dot' | 'tint'
  },
  // Injected into Salesforce's own global header. Independent of floatingButton
  // on purpose: either surface can be used alone or both together.
  headerMenu: {
    enabled: false
  },
  floatingButton: {
    enabled: false, // Disabled by default (opt-in feature)
    layout: 'handle', // 'handle' (edge drawer) | 'fab' (round) | 'pill' (labeled)
    side: 'right', // 'left' | 'right' — which edge it docks to
    offset: 0, // Pixels down from the top. 0 = derive from legacy `position`
    position: 25, // LEGACY percentage down the edge; still read when offset is 0
    location: 'everywhere', // 'everywhere' | 'setup-only' | 'outside-setup'
    defaultVisibility: true, // Show on all pages by default
    visibilityRules: [], // URL pattern rules (advanced)
    buttonSize: 'medium', // 'small' | 'medium' | 'large'
    showLabel: false // Show "SF Tabs" text next to icon
  }
};

// ObjectManager navigation selectors
const NAVIGATION_SELECTORS = [
  '.objectManagerLeftNav',
  '.slds-navigation-list--vertical',
  '[role="tabpanel"] ul[role="tablist"]'
];

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TAB_STRUCTURE,
    DEFAULT_TABS,
    DEFAULT_SETTINGS,
    NAVIGATION_SELECTORS,
    CHUNK_SIZE
  };
} else {
  // Browser environment. globalThis, not window: the background worker loads
  // this file and a service worker has no window — `window.SFTabs` there is a
  // ReferenceError that kills the whole worker. utils.js has always used
  // globalThis for that reason; this file did not, and only got away with it
  // because the worker did not load it until now.
  globalThis.SFTabs = globalThis.SFTabs || {};
  globalThis.SFTabs.constants = {
    TAB_STRUCTURE,
    DEFAULT_TABS,
    DEFAULT_SETTINGS,
    NAVIGATION_SELECTORS,
    CHUNK_SIZE
  };
}