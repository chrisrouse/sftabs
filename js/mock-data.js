/**
 * mock-data.js
 * Static data for Phase 1 UI mockup. Mirrors the real storage schema so
 * Phase 2 wiring only swaps the data source, not the component structure.
 */

const MOCK_DATA = {
  tabs: [
    { id: 'tab_001', label: 'Accounts',       path: 'Account',                    isObject: true,  isCustomUrl: false, isSetupObject: false, openInNewTab: false, position: 0, hasDropdown: false, dropdownItems: [] },
    { id: 'tab_002', label: 'Contacts',        path: 'Contact',                    isObject: true,  isCustomUrl: false, isSetupObject: false, openInNewTab: false, position: 1, hasDropdown: false, dropdownItems: [] },
    { id: 'tab_003', label: 'Leads',           path: 'Lead',                       isObject: true,  isCustomUrl: false, isSetupObject: false, openInNewTab: false, position: 2, hasDropdown: false, dropdownItems: [] },
    { id: 'tab_004', label: 'Opportunities',   path: 'Opportunity',                isObject: true,  isCustomUrl: false, isSetupObject: false, openInNewTab: true,  position: 3, hasDropdown: false, dropdownItems: [] },
    { id: 'tab_005', label: 'Users',           path: 'ManageUsers/home',           isObject: false, isCustomUrl: false, isSetupObject: true,  openInNewTab: false, position: 4, hasDropdown: false, dropdownItems: [] },
    { id: 'tab_006', label: 'Object Manager',  path: 'ObjectManager',              isObject: false, isCustomUrl: false, isSetupObject: true,  openInNewTab: false, position: 5, hasDropdown: true,
      dropdownItems: [
        { label: 'Account',     path: 'Account/view',     isObject: false, isCustomUrl: false },
        { label: 'Contact',     path: 'Contact/view',     isObject: false, isCustomUrl: false },
        { label: 'Opportunity', path: 'Opportunity/view', isObject: false, isCustomUrl: false }
      ]
    },
    { id: 'tab_007', label: 'Help Portal',     path: 'https://help.salesforce.com', isObject: false, isCustomUrl: true, isSetupObject: false, openInNewTab: true,  position: 6, hasDropdown: false, dropdownItems: [] }
  ],

  profiles: [
    { id: 'profile_001', name: 'Production', isDefault: true,  color: '#10b981', urlPatterns: ['production.my.salesforce.com'], autoSwitchEnabled: true },
    { id: 'profile_002', name: 'Sandbox',    isDefault: false, color: '#f59e0b', urlPatterns: ['*.sandbox.my.salesforce.com'],  autoSwitchEnabled: true }
  ],

  settings: {
    activeProfileId: 'profile_001',
    defaultProfileId: 'profile_001',
    theme: 'light',
    compactMode: false,
    skipDeleteConfirmation: false,
    profilesEnabled: true,
    useSyncStorage: true
  }
};
