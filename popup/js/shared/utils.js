// popup/js/shared/utils.js
// Shared utility functions

/**
 * Generate a unique ID for tabs
 */
function generateId() {
  return 'tab_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
}

/**
 * Format a Salesforce object name from URL format
 * Examples: 
 * - "Study_Group__c" becomes "Study Group"
 * - "Campaign" stays "Campaign"
 * - "ProductTransfer" becomes "Product Transfer"
 */
function formatObjectNameFromURL(objectNameFromURL) {
  if (!objectNameFromURL) {
    return 'Object';
  }
  
  // Remove any __c or similar custom object suffix
  let cleanName = objectNameFromURL.replace(/__c$/g, '');
  
  // Replace underscores with spaces
  cleanName = cleanName.replace(/_/g, ' ');
  
  // Insert spaces between camelCase words
  cleanName = cleanName.replace(/([a-z])([A-Z])/g, '$1 $2');
  
  // Ensure proper capitalization
  cleanName = cleanName.replace(/\b\w/g, letter => letter.toUpperCase());
  
  return cleanName;
}

/**
 * Extract name from page title
 */
function extractNameFromTitle(pageTitle) {
  if (!pageTitle) return '';
  
  // Remove " | Salesforce" suffix and other common suffixes
  let cleanTitle = pageTitle.split(' | ')[0];
  
  // Remove "Setup: " prefix
  if (cleanTitle.startsWith('Setup: ')) {
    cleanTitle = cleanTitle.substring(7);
  }
  
  return cleanTitle.trim();
}

/**
 * Format path segment to readable name
 */
function formatPathToName(pathSegment) {
  return pathSegment
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

/**
 * Get current page information
 */
function getCurrentPageInfo() {
  const currentUrl = window.location.href;
  
  // Check if on ObjectManager page
  const objectManagerMatch = currentUrl.match(/\/lightning\/setup\/ObjectManager\/([^\/]+)/);
  if (objectManagerMatch) {
    return {
      type: 'objectManager',
      objectName: objectManagerMatch[1],
      fullPath: currentUrl.split('/lightning/setup/')[1]?.split('?')[0]
    };
  }
  
  // Check if on general setup page
  const setupMatch = currentUrl.match(/\/lightning\/setup\/([^\/]+)/);
  if (setupMatch) {
    return {
      type: 'setup',
      setupPage: setupMatch[1],
      fullPath: currentUrl.split('/lightning/setup/')[1]?.split('?')[0]
    };
  }
  
  return null;
}

/**
 * Build full URL from tab path and optional sub-path
 */
function buildFullUrl(tab, subPath = '') {
  const baseUrl = window.location.origin;
  
  if (tab.isCustomUrl) {
    let formattedPath = tab.path;
    if (!formattedPath.startsWith('/')) {
      formattedPath = '/' + formattedPath;
    }
    return `${baseUrl}${formattedPath}`;
  } else if (tab.isObject) {
    return `${baseUrl}/lightning/o/${tab.path}`;
  } else {
    // Setup pages
    let fullPath;
    if (subPath) {
      // For dropdown navigation items, use the subPath as-is
      if (subPath.startsWith('/lightning/setup/')) {
        return `${baseUrl}${subPath}`;
      } else {
        fullPath = `${tab.path}/${subPath}`;
      }
    } else {
      // For main tab navigation
      if (tab.path.includes('ObjectManager/')) {
        // ObjectManager URLs don't need /home
        fullPath = tab.path;
      } else {
        // Other setup URLs need /home
        fullPath = `${tab.path}/home`;
      }
    }
    
    return `${baseUrl}/lightning/setup/${fullPath}`;
  }
}

/**
 * Check if tab can have dropdown
 */
function canHaveDropdown(tab) {
  // Any tab can have manual dropdowns
  return true;
}

/**
 * Check if current page matches a tab's path
 */
function isCurrentPageMatchingTab(tab) {
  const currentPageInfo = getCurrentPageInfo();
  if (!currentPageInfo) return false;
  
  if (tab.isSetupObject && currentPageInfo.type === 'objectManager') {
    // Check if the tab's path starts with ObjectManager/ and matches current object
    if (tab.path.startsWith('ObjectManager/')) {
      const tabObjectName = tab.path.split('/')[1];
      return tabObjectName === currentPageInfo.objectName;
    }
  }
  
  return false;
}

/**
 * Check if Lightning Navigation is enabled
 * Always returns true as Lightning Navigation is now standard
 */
function isLightningNavigationEnabled() {
  return true;
}

/**
 * Debounce function to limit rapid function calls
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Deep clone an object
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Export for use in other modules
/**
 * Extract the Salesforce org identifier from a URL — the subdomain label that
 * identifies the org, e.g. "amplify--dev1" from
 * amplify--dev1.sandbox.my.salesforce-setup.com.
 *
 * This is what profile URL patterns are compared against, by exact
 * case-insensitive equality (checkAndSwitchProfile in background.js). A pattern
 * holding a full hostname therefore never matches, which is why the profile
 * form captures this rather than letting it be typed.
 *
 * NOTE: background.js carries its own copy, because a service worker cannot
 * load these popup scripts. Keep the two in step.
 *
 * @param {string} url
 * @returns {string|null} the identifier, or null for a non-Salesforce host
 */
function extractOrgIdentifier(url) {
  try {
    const hostname = new URL(url).hostname;
    const patterns = [
      /^([^.]+)\.sandbox\.my\.salesforce-setup\.com$/i,
      /^([^.]+)\.sandbox\.my\.salesforce\.com$/i,
      /^([^.]+)\.sandbox\.lightning\.force\.com$/i,
      /^([^.]+)\.develop\.my\.salesforce-setup\.com$/i,
      /^([^.]+)\.develop\.lightning\.force\.com$/i,
      /^([^.]+)\.lightning\.force\.com$/i,
      /^([^.]+)\.my\.salesforce\.com$/i,
      /^([^.]+)\.my\.salesforce-setup\.com$/i,
      /^([^.]+)\.salesforce\.com$/i
    ];
    for (const re of patterns) {
      const m = hostname.match(re);
      if (m) return m[1];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Which profile applies to a given Salesforce URL.
 *
 * The point of resolving per URL rather than reading settings.activeProfileId is
 * that activeProfileId is one global value: with two orgs open, whichever was
 * activated last governed every page, so two windows — or two tabs — could not
 * show their own tabs at the same time.
 *
 * Matching deliberately mirrors checkAndSwitchProfile in background.js: exact,
 * case-insensitive equality against the org identifier. If the two ever
 * disagree, a page renders one profile while the popup claims another.
 *
 * When auto-switch is off this returns activeProfileId unchanged, so behaviour
 * for anyone not using linked orgs is exactly as before.
 *
 * @param {string} url        the page being rendered
 * @param {Array}  profiles
 * @param {Object} settings   userSettings
 * @returns {string|null} profile id, or null when there is nothing to use
 */
function resolveProfileForUrl(url, profiles, settings) {
  const list = Array.isArray(profiles) ? profiles : [];
  const active = settings && settings.activeProfileId ? settings.activeProfileId : null;

  if (!settings || !settings.profilesEnabled || !settings.autoSwitchProfiles) {
    return active;
  }

  const org = extractOrgIdentifier(url);
  if (org) {
    const match = list.find(p => (p.urlPatterns || []).some(
      pattern => String(pattern).toLowerCase() === org.toLowerCase()));
    if (match) return match.id;
  }

  // No linked org matches, so fall back the same way background.js does
  const fallback = list.find(p => p.isDefault) ||
                   list.find(p => p.id === (settings.defaultProfileId || null));
  return fallback ? fallback.id : active;
}

/**
 * Optional per-tab colours.
 *
 * Keyed by SLDS expressive-palette hue name, not by hex. Storing the name is
 * what lets a colour follow the theme: each value is a light-dark() pair, so
 * "teal" is #056764 on a light surface and #06a59a on a dark one. A stored hex
 * would strand every coloured tab in whichever theme it was picked under.
 *
 * accent = palette 40, dark enough for text and indicators.
 * wash    = palette 90, light enough to sit behind that accent.
 *
 * Values are verbatim from @salesforce-ux/design-system-2. Neutral is omitted —
 * that is the no-colour case — and electric blue, which is the brand accent and
 * would read as "selected" rather than as a chosen colour.
 */
const TAB_COLORS = {
  'red': { accent: 'light-dark(#ba0517, #fe5c4c)', wash: 'light-dark(#feded8, #300c01)' },
  'hot-orange': { accent: 'light-dark(#aa3001, #ff5d2d)', wash: 'light-dark(#ffded5, #281202)' },
  'orange': { accent: 'light-dark(#825101, #dd7a01)', wash: 'light-dark(#fedfd0, #201600)' },
  'yellow': { accent: 'light-dark(#8c4b02, #ca8501)', wash: 'light-dark(#f9e3b6, #281202)' },
  'green': { accent: 'light-dark(#396547, #3ba755)', wash: 'light-dark(#cdefc4, #071b12)' },
  'teal': { accent: 'light-dark(#056764, #06a59a)', wash: 'light-dark(#acf3e4, #071b12)' },
  'cloud-blue': { accent: 'light-dark(#05628a, #0d9dda)', wash: 'light-dark(#cfe9fe, #001a28)' },
  'blue': { accent: 'light-dark(#0b5cab, #1b96ff)', wash: 'light-dark(#d8e6fe, #001639)' },
  'indigo': { accent: 'light-dark(#3a49da, #7f8ced)', wash: 'light-dark(#e0e5f8, #17094e)' },
  'violet': { accent: 'light-dark(#9602c7, #cb65ff)', wash: 'light-dark(#f2defe, #2e0039)' },
  'purple': { accent: 'light-dark(#7526e3, #ad7bee)', wash: 'light-dark(#ece1f9, #240643)' },
  'pink': { accent: 'light-dark(#b60554, #ff538a)', wash: 'light-dark(#fddde3, #370114)' },
};

/**
 * Inline custom properties for a tab's colour, or null when it has none.
 *
 * Returned as properties rather than baked-into-CSS classes so the palette lives
 * in exactly one place — here — instead of being restated in every stylesheet
 * that needs it.
 *
 * @param {string|null} name  a TAB_COLORS key
 * @returns {{accent: string, wash: string}|null}
 */
function tabColorVars(name) {
  return (name && TAB_COLORS[name]) ? TAB_COLORS[name] : null;
}

/**
 * Put a tab's colour on an element, or take it off.
 *
 * Clearing is as important as setting: turning the feature off must leave the
 * stored colour alone but stop rendering it, and rows get reused.
 *
 * @param {Element} el
 * @param {string|null} name   colour name, or null/unknown for none
 * @param {string} style       'dot' | 'underline' | 'tint'
 * @param {boolean} enabled    the tabColors.enabled setting
 */
function applyTabColor(el, name, style, enabled) {
  el.classList.remove('sftabs-tc', 'sftabs-tc--dot', 'sftabs-tc--tint');
  el.style.removeProperty('--sftabs-tc');
  el.style.removeProperty('--sftabs-tc-wash');
  if (!enabled) return;

  const colour = tabColorVars(name);
  if (!colour) return;

  // 'underline' was offered briefly and removed for being too faint against
  // Salesforce's chrome; anything unrecognised, including that, falls back.
  const mode = ['dot', 'tint'].includes(style) ? style : 'dot';
  el.style.setProperty('--sftabs-tc', colour.accent);
  el.style.setProperty('--sftabs-tc-wash', colour.wash);
  el.classList.add('sftabs-tc', `sftabs-tc--${mode}`);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateId,
    extractOrgIdentifier,
    TAB_COLORS,
    tabColorVars,
    applyTabColor,
    resolveProfileForUrl,
    formatObjectNameFromURL,
    extractNameFromTitle,
    formatPathToName,
    getCurrentPageInfo,
    buildFullUrl,
    canHaveDropdown,
    isCurrentPageMatchingTab,
    isLightningNavigationEnabled,
    debounce,
    deepClone
  };
} else {
  // Browser environment
  window.SFTabs = window.SFTabs || {};
  window.SFTabs.utils = {
    generateId,
    extractOrgIdentifier,
    TAB_COLORS,
    tabColorVars,
    applyTabColor,
    resolveProfileForUrl,
    formatObjectNameFromURL,
    extractNameFromTitle,
    formatPathToName,
    getCurrentPageInfo,
    buildFullUrl,
    canHaveDropdown,
    isCurrentPageMatchingTab,
    isLightningNavigationEnabled,
    debounce,
    deepClone
  };
}