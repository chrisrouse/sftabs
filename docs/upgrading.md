---
layout: default
title: Upgrading to v2.0
---

# Upgrading to v2.0.0 (Migration Wizard)

When you upgrade to SF Tabs v2.0.0, you'll see a migration wizard that helps you transition to the new profile-based system.

## What's Being Migrated?

Version 2.0.0 introduces a new data structure to support:
- Multiple profiles with different tab sets
- Choice between Sync and Local storage
- Enhanced dropdown functionality

Your existing tabs and settings are migrated to this new format automatically.

## Migration Wizard Screens

### Welcome Screen

The wizard explains what will happen during migration:
- Your existing tabs will be moved to a "Default" profile
- No data will be lost
- You can choose to enable Profiles now or later

**Options on this screen:**

1. **Enable Profiles after migration**
   - Check this box to turn on the Profiles feature immediately
   - Uncheck to migrate data but keep Profiles disabled (you can enable later in Settings)

2. **Storage Location**
   - **Sync Storage (Recommended):** Syncs across devices, ~50 tab limit
   - **Local Storage:** Stored on this device only, unlimited tabs

3. **Export Backup**
   - Click "Export Backup" to save your current configuration before migrating
   - This is optional but recommended for safety

### Migration in Progress

The wizard shows progress as it:
1. Reads your existing data
2. Creates the Default profile
3. Saves the new format

This typically takes only a few seconds.

### Migration Complete

Once complete, you'll see a success message confirming:
- Your tabs are now in the "Default" profile
- Whether Profiles feature is enabled
- Next steps for using the new features

Click "Get Started" to begin using SF Tabs with the new features.

## What If Migration Fails?

If migration encounters an error:
- Your original data remains intact
- An error message explains what went wrong
- You can retry the migration or continue without migrating

**Troubleshooting migration issues:**
1. Export a backup of your current settings
2. Try closing and reopening the browser
3. Check that you have sufficient storage space
4. Report the issue on [GitHub Issues](https://github.com/chrisrouse/sftabs/issues) with the error message

## After Migration

Once migration completes:

1. **Your tabs are unchanged**
   - All your tabs are exactly as they were before
   - They're now in a profile called "Default"

2. **Explore new features**
   - Try creating additional profiles for different orgs
   - Set up dropdown menus
   - Configure auto-switching based on URL patterns

3. **Adjust storage if needed**
   - Go to Settings → Sync & Storage to change storage options
   - Data automatically transfers when switching storage types

## Can I Revert After Migration?

Migration is one-way and cannot be undone. However:
- If you exported a backup before migrating, you can import it to restore your old configuration
- The new format is more flexible and supports all your existing tabs
- You can disable Profiles in Settings if you don't want to use them