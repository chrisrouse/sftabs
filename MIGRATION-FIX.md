# Tab Migration Fix - Version 1.4.0

## Problem
Users were losing their custom tabs when upgrading to newer versions of the SF Tabs extension. The issue occurred because:

1. When no tabs were found in storage, the extension would automatically reset to default tabs
2. The migration function only added new fields but didn't properly detect upgrade scenarios
3. There was no version tracking to distinguish between first-time installs and upgrades

## Solution

### 1. Version Tracking
- Added `extensionVersion` field to browser storage
- Extension now marks itself as installed when saving tabs
- Can distinguish between first-time installs and upgrades

### 2. Improved Migration Function
**File:** `popup/js/popup-main.js`

The `migrateTabsToNewStructure()` function now:
- Preserves ALL existing tab properties
- Only adds missing fields with proper defaults
- Handles both old and new dropdown formats
- Never overwrites existing user data

**Key improvements:**
- Explicitly checks each field before adding defaults
- Preserves `openInNewTab`, `isObject`, `isCustomUrl` settings
- Maintains custom tab IDs, labels, and paths
- Supports both legacy (`cachedNavigation`, `children`) and new (`dropdownItems`) dropdown formats

### 3. Safer Loading Logic
**File:** `popup/js/popup-main.js`

The `loadTabsFromStorage()` function now:
- Checks for `extensionVersion` to detect first-time vs upgrade
- Only uses default tabs for truly first-time installations
- Shows warning message if tabs are missing during upgrade
- Never automatically overwrites with defaults on errors

### 4. Enhanced Storage Functions
**File:** `popup/js/popup-storage.js`

Updated functions to:
- Save `extensionVersion` alongside tabs
- Log detailed information about storage state
- Preserve version info during import/export

## Testing

A test file has been created at `test-migration.html` that includes:

### Test 1: Old Format Migration
Verifies that tabs from pre-1.4.0 format are properly migrated with all custom properties preserved.

### Test 2: New Format Preservation
Ensures tabs already in the new format aren't unnecessarily modified.

### Test 3: Custom Tabs Preservation During Upgrade
Critical test that simulates a real upgrade scenario with custom user tabs like:
- Custom Metadata Types
- Sites
- Failed Flows
- DigExp
- Copado User Story List

## User Impact

### Before Fix
- Users upgrading to new version would lose all custom tabs
- Only default tabs (Flows, Packages, Users, Profiles, Permission Sets) would remain
- No way to recover lost tabs except from manual backup

### After Fix
- All custom tabs preserved during upgrades
- User settings (openInNewTab, compact mode, etc.) maintained
- Smooth migration from old to new format
- Clear warning if tabs are genuinely missing

## Rollout Instructions

1. **Before Upgrading Users:**
   - Remind users to export their configuration as backup
   - Document can be imported via Settings > Import/Export

2. **After Upgrade:**
   - Custom tabs should appear exactly as before
   - New dropdown features will be available
   - Settings preserved

3. **If Tabs Are Missing:**
   - Check browser console for migration logs
   - Use Import feature to restore from backup
   - Extension will not auto-reset to defaults

## Technical Details

### Migration Flow

```
User Upgrades Extension
        ↓
loadTabsFromStorage() called
        ↓
Check storage for customTabs
        ↓
   ┌────────────┴────────────┐
   │                         │
Has Tabs               No Tabs
   │                         │
   ↓                         ↓
migrateTabsToNewStructure() Check extensionVersion
   │                         │
   ↓                    ┌────┴────┐
Preserve all       Version     No Version
custom properties   Exists      (First Time)
   │                  │            │
   ↓                  ↓            ↓
Add missing      Show Warning  Use Defaults
new fields       Don't Reset   & Mark Installed
   │                  │            │
   └──────────────────┴────────────┘
                      ↓
              Save to Storage
           (with extensionVersion)
```

### Storage Schema

**Before:**
```json
{
  "customTabs": [...],
  "userSettings": {...}
}
```

**After:**
```json
{
  "customTabs": [...],
  "userSettings": {...},
  "extensionVersion": "1.4.0"
}
```

### Backward Compatibility

The fix is fully backward compatible:
- Old format tabs automatically upgraded
- New fields added only if missing
- Existing properties never overwritten
- Legacy dropdown fields supported

## Files Modified

1. **popup/js/popup-main.js**
   - Enhanced `loadTabsFromStorage()` with version checking
   - Improved `migrateTabsToNewStructure()` to preserve all properties
   - Added `hasStructuralChanges()` helper function

2. **popup/js/popup-storage.js**
   - Updated `getTabs()` to log storage state
   - Modified `saveTabs()` to save extension version
   - Enhanced `importConfiguration()` to handle version tracking

3. **test-migration.html** (NEW)
   - Comprehensive test suite for migration scenarios
   - Verifies old format → new format migration
   - Tests custom tab preservation

## Verification

To verify the fix works:

1. Open `test-migration.html` in a browser
2. Run all three tests
3. All tests should pass with green checkmarks
4. Verify that custom tabs like "Copado User Story List" and "Sites" are preserved

## Future Enhancements

Consider adding:
- Automatic backup before upgrades
- Migration status notifications
- Rollback capability
- More detailed version migration paths
