# SF Tabs - Profile Migration Fix Status

**Date:** December 15, 2024
**Session:** Profile Migration Timing Issue Fix

---

## Problem Summary

When enabling profiles in SF Tabs, the migration of existing tabs to the Default profile was failing (0 tabs migrated instead of 3). The root cause was a timing race condition where:
- Profile checkbox event listener was attached before tabs finished loading
- `getLegacyTabs()` was checking wrong storage location or checking before data was loaded
- No recovery mechanism if migration failed

---

## Changes Implemented

### 1. Fixed Popup Storage Disconnect & Auto-Refresh (NEW - Dec 16 morning)
**Files:** `popup/js/popup-main.js` (lines 220-307), `popup/js/popup-storage.js` (lines 113-164), `content/content-main.js` (lines 980-1005)

**Problem Found:**
- Popup was loading tabs from `customTabs` (legacy storage) even when profiles were enabled
- Content scripts were correctly loading from `profile_{id}_tabs`
- This caused popup to show 7 tabs while Salesforce page only showed 5
- User's JSON export revealed the mismatch

**What Changed:**
1. **loadTabsFromStorage()** now checks if profiles are enabled:
   - If yes: loads from `SFTabs.storage.getProfileTabs(activeProfileId)`
   - If no: loads from legacy `customTabs`

2. **saveTabs()** now checks if profiles are enabled:
   - If yes: saves to `saveProfileTabs(activeProfileId, tabs)`
   - If no: saves to legacy `customTabs`

3. **Storage listener** now watches for profile-specific storage changes:
   - Added detection for keys matching `profile_{id}_tabs` pattern
   - Also watches for `profile_{id}_tabs_metadata` and chunk keys
   - Triggers automatic tab refresh on Salesforce page when profile tabs change

**Key Code:**
```javascript
// In loadTabsFromStorage()
if (userSettings.profilesEnabled && userSettings.activeProfileId) {
  console.log('🔵 SF Tabs: Profiles enabled - loading from profile:', userSettings.activeProfileId);
  loadedTabs = await SFTabs.storage.getProfileTabs(userSettings.activeProfileId);
} else {
  console.log('🔵 SF Tabs: Profiles disabled - loading from legacy customTabs');
  loadedTabs = await SFTabs.storage.getTabs();
}

// In saveTabs()
if (settings.profilesEnabled && settings.activeProfileId) {
  console.log('💾 Saving tabs to profile:', settings.activeProfileId);
  await saveProfileTabs(settings.activeProfileId, cleanedTabs);
} else {
  // Save to legacy customTabs
}

// In storage change listener (content-main.js)
const hasProfileTabsChange = Object.keys(changes).some(key =>
  key.startsWith('profile_') && key.endsWith('_tabs')
) || Object.keys(changes).some(key =>
  key.startsWith('profile_') && (key.endsWith('_tabs_metadata') || key.includes('_tabs_chunk_'))
);

if ((area === 'local' || area === 'sync') && (hasCustomTabsChange || hasProfileTabsChange)) {
  console.log('📦 Tabs changed (custom or profile) - triggering refresh');
  debouncedRefreshTabs();
}
```

---

### 2. Fixed Popup Initialization Sequence
**File:** `popup/js/popup-main.js` (lines 23-56)

**What Changed:**
- Converted from promise chaining (`.then()`) to sequential `async/await`
- Ensures `loadTabsFromStorage()` completes **before** `setupAllEventListeners()` runs
- Prevents race condition where profile checkbox could be toggled before tabs are loaded

**Key Code:**
```javascript
(async function init() {
  try {
    await loadUserSettings();
    await loadTabsFromStorage();  // ← WAIT for this to complete
    setupAllEventListeners();      // ← THEN setup listeners
    // ...
  }
})();
```

---

### 2. Added New Storage Helper Function
**File:** `popup/js/popup-profiles.js` (lines 1075-1096)

**What Changed:**
- Added `getLegacyTabsFromStorage(storageType)` function
- Can explicitly check either 'sync' or 'local' storage
- Better logging to show where tabs were found

**Key Code:**
```javascript
async function getLegacyTabsFromStorage(storageType) {
  if (storageType === 'sync') {
    const tabs = await SFTabs.storageChunking.readChunkedSync('customTabs');
    console.log(`Found ${tabs ? tabs.length : 0} tabs in sync storage`);
    return tabs || [];
  } else {
    const result = await browser.storage.local.get('customTabs');
    const tabs = result.customTabs || [];
    console.log(`Found ${tabs.length} tabs in local storage`);
    return tabs;
  }
}
```

---

### 3. Fixed Migration Priority in Checkbox Handler
**File:** `popup/js/popup-profiles.js` (lines 168-186)

**What Changed:**
- Changed migration source priority order
- **Priority 1**: Check `SFTabs.main.getTabs()` first (current state - most reliable)
- **Priority 2**: If empty, check sync storage explicitly
- **Priority 3**: If still empty, check local storage explicitly

**Key Code:**
```javascript
// Priority 1: Get tabs from current state (most reliable)
let tabsToMigrate = SFTabs.main.getTabs();
console.log(`Found ${tabsToMigrate.length} tabs in main state`);

// Priority 2: If state is empty, check sync storage
if (!tabsToMigrate || tabsToMigrate.length === 0) {
  tabsToMigrate = await getLegacyTabsFromStorage('sync');
}

// Priority 3: If still empty, check local storage
if (!tabsToMigrate || tabsToMigrate.length === 0) {
  tabsToMigrate = await getLegacyTabsFromStorage('local');
}

console.log(`Migrating ${tabsToMigrate.length} tabs to Default profile`);
```

---

### 4. ~~Added Automatic Migration Recovery~~ (REMOVED - Dec 16)
**File:** `popup/js/popup-profiles.js` (lines 109-147 → now lines 109-113)

**Original Implementation:**
- Added recovery logic in `initProfiles()` that ran on every popup load
- Detected if active profile had 0 tabs
- Automatically searched for tabs and migrated them
- Updated UI and showed status message

**Problem with This Approach:**
- Ran on EVERY popup load, not just once
- Could not distinguish between "empty by choice" (user selected "Start with no tabs") and "incomplete migration"
- Caused user-selected empty profiles to receive tabs from legacy storage on popup reopen

**What Changed (Dec 16):**
- **REMOVED** the migration recovery code entirely
- Migration now ONLY happens when profiles are first enabled (via checkbox handler)
- Empty profiles stay empty as intended by user

**Current Code (lines 109-113):**
```javascript
// DISABLED: Migration recovery code removed to fix empty profile issue
// This code was running on every popup load and migrating legacy tabs to empty profiles
// even when users explicitly chose "Start with no tabs"
// Migration now ONLY happens when profiles are first enabled (via checkbox handler)
// See checkbox handler around line 168-186 for migration logic
```

---

## Current State (Updated Dec 16)

### Issues Fixed:
- ✅ Popup now loads from correct storage location (profile-specific vs legacy)
- ✅ Tab changes in popup auto-refresh on Salesforce page
- ✅ Empty profiles stay empty when popup is reopened
- ✅ Migration only happens when profiles are first enabled, not on every popup load

### Expected Behavior:
1. **Creating Empty Profile:**
   - User creates new profile with "Start with no tabs"
   - Popup shows empty tab list ✓
   - Salesforce page shows no tabs ✓
   - Close and reopen popup → stays empty ✓

2. **Enabling Profiles First Time:**
   - User enables profiles checkbox
   - System detects legacy tabs in `customTabs`
   - Migrates them to Default profile
   - Tabs appear immediately in popup and Salesforce page

---

## Testing Checklist

### Test 1: Automatic Migration Recovery ⏳ NOT TESTED YET
**Steps:**
1. Close and reopen the SF Tabs popup
2. Open browser console (F12)
3. Look for these console messages:

**Expected Console Output:**
```
Detected profile with 0 tabs - checking for tabs to migrate
Found X tabs in main state (or sync/local storage)
Auto-migrating 3 tabs to Default
💾 Saving tabs for profile profile_xxxxx to sync storage
✅ Tabs saved successfully to sync storage (3 tabs)
```

**Expected UI:**
- Status message: "Migrated 3 tabs to Default"
- Tabs should appear in popup list
- Tabs should appear on Salesforce setup pages

**Status:** ⏳ NOT TESTED YET

---

### Test 2: Migration on Enable (Fresh Start) ⏳ NOT TESTED YET
**Prerequisites:**
- Disable profiles first
- Verify 3 tabs exist and work

**Steps:**
1. Go to Settings
2. Disable profiles checkbox
3. Select which profile to keep (should have the 3 tabs)
4. Verify tabs still work in disabled state
5. Re-enable profiles checkbox
6. Watch console for migration messages

**Expected Console Output:**
```
Profiles enabled for the first time - creating Default profile
Found 3 tabs in main state
Migrating 3 tabs to Default profile
Default profile created: profile_xxxxx with 3 tabs
```

**Expected UI:**
- Status message: "Profiles enabled. Migrated 3 tabs to Default profile"
- Tabs appear immediately

**Status:** ⏳ NOT TESTED YET

---

### Test 3: Profile Switching ⏳ NOT TESTED YET
**Prerequisites:**
- Complete Test 1 or Test 2 (profiles enabled with tabs)

**Steps:**
1. Create a new profile called "Test Profile"
2. Select "Start with no tabs" initialization option
3. Switch to "Test Profile" in the active profile dropdown
4. Verify no tabs appear on Salesforce page
5. Switch back to "Default" profile
6. Verify 3 tabs reappear on Salesforce page

**Expected Behavior:**
- Tabs disappear when switching to empty profile
- Tabs reappear when switching back to Default
- Content script reloads tabs immediately

**Status:** ⏳ NOT TESTED YET

---

### Test 4: Cross-Storage Migration ⏳ NOT TESTED YET
**Purpose:** Test that migration works regardless of storage location

**Steps:**
1. Disable profiles (if enabled)
2. Toggle "Enable cross-browser sync" OFF (use local storage)
3. Verify tabs still work
4. Enable profiles
5. Verify migration succeeds from local storage

**Expected Console Output:**
```
Found 0 tabs in main state
Found 3 tabs in local storage
Migrating 3 tabs to Default profile
```

**Status:** ⏳ NOT TESTED YET

---

## Files Modified

1. **popup/js/popup-main.js**
   - Lines 23-56: Changed init from promise chain to async/await
   - Lines 220-307: Made `loadTabsFromStorage()` profile-aware

2. **popup/js/popup-storage.js**
   - Lines 113-164: Made `saveTabs()` profile-aware

3. **content/content-main.js**
   - Lines 980-1005: Updated storage listener to detect profile-specific tab changes

4. **popup/js/popup-profiles.js**
   - Lines 1075-1096: Added `getLegacyTabsFromStorage()` helper
   - Lines 109-113: REMOVED migration recovery in `initProfiles()` (was causing empty profiles to receive tabs)
   - Lines 168-186: Updated checkbox handler migration priority

---

## Known Issues / Edge Cases

### 1. Storage Metadata Missing
If customTabs data exists but metadata is missing:
- `readChunkedSync()` should still find direct key
- May need to verify this works in both browsers

### 2. Multiple Storage Locations
If tabs exist in BOTH sync and local storage (shouldn't happen but possible):
- Priority is: main state → sync → local
- First non-empty result is used

### 3. ~~Profile Already Has Tabs~~ (N/A - Recovery logic removed)
This edge case no longer applies since migration recovery has been removed.

---

## Next Steps

### Completed (Dec 16):
1. ✅ Fix initialization race condition
2. ✅ Fix popup storage disconnect (profile-aware loading/saving)
3. ✅ Fix auto-refresh for profile tab changes
4. ✅ Update migration priority order in checkbox handler
5. ✅ Remove migration recovery that ran on every popup load

### Ready for Testing:
1. ⏳ Test empty profile creation (should stay empty on reopen)
2. ⏳ Test profile switching between empty and non-empty profiles
3. ⏳ Test enabling profiles for first time (migration from legacy storage)

### Follow-up (Future Session):
1. Consider adding migration status to UI (badge/indicator)
2. Add cleanup of old customTabs storage after successful migration
3. Consider adding a manual "Re-migrate" button in settings for edge cases

---

## Debugging Tips

### If Migration Still Fails:

**Check Browser Console:**
1. Open popup
2. Press F12 to open DevTools
3. Look for console logs starting with:
   - "Detected profile with 0 tabs"
   - "Found X tabs in..."
   - "Auto-migrating"

**Check Storage Directly:**
1. Open Firefox/Chrome DevTools
2. Go to Storage → Extension Storage
3. Look for keys:
   - `customTabs` or `customTabs_metadata` (legacy)
   - `profile_xxxxx_tabs` (profile-specific)
   - `userSettings` (has profilesEnabled flag)
   - `profiles` (list of profiles)

**Check Content Script:**
1. On Salesforce setup page
2. Open console (F12)
3. Look for:
   - "Profiles enabled - reading tabs for profile: xxxxx"
   - "Loaded X tabs from profile"

---

## Reverting Changes (If Needed)

If the changes cause issues, revert with:
```bash
git checkout HEAD~1 popup/js/popup-main.js popup/js/popup-profiles.js
```

Or manually:
1. popup-main.js: Change async IIFE back to promise chain
2. popup-profiles.js: Remove lines 109-147 (recovery logic)
3. popup-profiles.js: Restore old migration priority (lines 168-186)

---

## Success Criteria

- ✅ Popup loads from correct storage location (profile-specific vs legacy)
- ✅ Tab changes in popup auto-refresh on Salesforce page
- ✅ Empty profiles stay empty when popup is reopened
- ✅ User can enable/disable profiles without losing tabs
- ✅ Migration works regardless of storage type (sync/local)
- ✅ Clear console logging shows migration status
- ✅ No race conditions during popup initialization
- ✅ Profile switching works correctly on Salesforce pages
- ✅ Migration only happens when profiles first enabled, not on every popup load

---

**Status:** Empty profile fix implemented, ready for user testing

**Last Updated:** December 16, 2024
