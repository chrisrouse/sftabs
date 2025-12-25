---
layout: default
title: User Guide
---

# User Guide

Learn how to use SF Tabs to customize your Salesforce Setup experience.

## Table of contents

- [Opening the Extension](#opening-the-extension)
- [Adding a New Tab](#adding-a-new-tab)
- [Tab Types](#tab-types)
- [Creating Dropdown Menus](#creating-dropdown-menus)
  - [Object Manager Dropdowns](#object-manager-dropdowns-automatic)
  - [Manual Dropdowns](#manual-dropdowns-drag-and-drop)
  - [Folder-Style Tabs](#folder-style-tabs-menu-containers)
- [Editing Tabs](#editing-tabs)
- [Reordering Tabs](#reordering-tabs)
- [Deleting Tabs](#deleting-tabs)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Settings](#settings)
- [Profiles](#profiles)
- [Import/Export Configuration](#importexport-configuration)
- [Upgrading to v2.0.0](#upgrading-to-v200-migration-wizard)
- [Troubleshooting](#troubleshooting)


## Opening the Extension

 **Click the extension icon** in your browser toolbar
 

## Adding a New Tab

### Method 1: Quick Add from Current Page

1. **Navigate to a Salesforce Setup page**
   Go to the page you want to create a tab for (e.g., Flows, Users, Profiles)

2. **Click the SF Tabs extension icon**
   The extension will detect the current page

3. **Click Quick Create button <img src="{{ '/assets/images/icons/quick-add.svg' | relative_url }}" alt="Quick Add" style="display: inline; height: 1.2em; vertical-align: middle;">**
   A new tab will be created with the page name and URL automatically filled in

### Method 2: Manual Tab Creation

1. **Open the extension popup**
   Click the SF Tabs icon in your browser toolbar

2. **Click the <img src="{{ '/assets/images/icons/manual-add.svg' | relative_url }}" alt="Quick Add" style="display: inline; height: 1.2em; vertical-align: middle;"> button**
   A new tab form will appear

3. **Fill in the tab details**
   Enter a label and path for your tab (see Tab Types below)

4. **Save your tab**
   Click **Save Changes** and your tab will appear in the Setup menu


## Tab Types

SF Tabs supports three types of tabs:

### Setup Pages

Links to standard Salesforce Setup pages. Use the Setup page name as the path.

**Examples:**
- `Flows` - Links to Flow Builder
- `ManageUsers` - Links to Users page
- `EnhancedProfiles` - Links to Profiles page
- `PermSets` - Links to Permission Sets

### Object Pages

Links to Object Manager pages for standard or custom objects.

**Examples:**
- `Account` - Account Object Manager
- `Contact` - Contact Object Manager
- `Custom_Object__c` - Custom Object Manager

### Custom URLs

Links to any Lightning URL path within Salesforce.

**Examples:**
- `lightning/cms/home` - CMS/Digital Experience home
- `lightning/o/Account/list` - Account list view
- `copado__User_Story__c/list` - Custom object list view


## Creating Dropdown Menus

SF Tabs supports dropdown menus, allowing you to organize related tabs under a parent tab. There are two types of dropdowns:

### Object Manager Dropdowns (Automatic)

When you create a tab that links to an Object Manager page, you can automatically create a dropdown menu with all the object's sub-pages.

#### Creating an Object Manager Dropdown

1. **Navigate to an Object Manager page**
   Go to any object in Salesforce (e.g., Setup → Object Manager → Account)

2. **Add the current page as a tab**
   Click "Add Current Page" in the SF Tabs popup

3. **Open the tab settings**
   Click the edit icon <img src="{{ '/assets/images/icons/edit.svg' | relative_url }}" alt="Edit" style="display: inline; height: 1.2em; vertical-align: middle;"> next to your new tab

4. **Set up the dropdown**
   Click "Setup as Object Dropdown" button

5. **Review the dropdown items**
   The extension automatically detects available sub-pages:
   - Details
   - Fields & Relationships
   - Page Layouts
   - Buttons, Links, and Actions
   - Validation Rules
   - Triggers
   - And more...

6. **Save your changes**
   Click "Save Changes"

Now when you click this tab in Salesforce Setup, you'll see a dropdown menu with all the object's sub-pages.

**Tip:** Click "Refresh List" if you want to update the dropdown items after Salesforce changes.

### Manual Dropdowns (Drag and Drop)

Create custom dropdown menus by dragging existing tabs onto a parent tab.

#### Creating a Manual Dropdown

1. **Create a parent tab**
   This can be any tab, or create a "folder" tab by leaving the URL blank

2. **Drag a tab onto the parent**
   Click and hold a tab, then drag it over another tab
   Release when you see the drop indicator

3. **The dragged tab becomes a dropdown item**
   It's now nested under the parent tab

4. **Add more items**
   Drag additional tabs onto the parent to build your menu

### Folder-Style Tabs (Menu Containers)

Create tabs that only act as dropdown menus without their own destination URL:

1. **Create a new tab**
   Click the "+" button

2. **Enter a name only**
   Give it a descriptive name like "User Management" or "Dev Tools"

3. **Leave the URL blank**
   Don't enter any path

4. **Add dropdown items**
   Drag other tabs onto this tab to create a menu

This creates a folder-style tab that opens a dropdown menu when clicked, without navigating anywhere.

### Managing Dropdown Items

#### Reordering Items in a Dropdown

1. Open the parent tab's settings (edit icon <img src="{{ '/assets/images/icons/edit.svg' | relative_url }}" alt="Edit" style="display: inline; height: 1.2em; vertical-align: middle;">)
2. In the dropdown items preview, drag items to reorder them
3. Save your changes

#### Removing Items from a Dropdown

1. Open the parent tab's settings
2. Click the remove icon (×) next to the item
3. The item becomes a regular top-level tab again

#### Converting a Dropdown Back to a Regular Tab

1. Remove all items from the dropdown
2. The tab automatically becomes a regular tab

### Dropdown Best Practices

**Group Related Functionality**
- Group related Setup pages together (e.g., all user management pages)
- Organize object-related tasks under the object dropdown

**Use Descriptive Parent Names**
- Parent tab names should clearly indicate what's in the dropdown
- Examples: "User Admin", "Account Config", "Dev Tools"

**Limit Dropdown Depth**
- Keep menus shallow (one level) for best usability
- Nested dropdowns are not supported

**Combine with Profiles**
- Create different dropdown structures for different profiles
- Example: Admin profile might have more granular dropdowns than a basic user profile


## Editing Tabs

1. **Open the extension popup**
   Click the SF Tabs icon

2. **Click the edit icon <img src="{{ '/assets/images/icons/edit.svg' | relative_url }}" alt="Edit" style="display: inline; height: 1.2em; vertical-align: middle;"> next to a tab**
   The tab details will appear in an editable form

3. **Make your changes**
   Update the label, path, or other settings

4. **Save your changes**
   Click Save to apply the updates


## Reordering Tabs

You can easily reorder your tabs using drag and drop:

1. **Open the extension popup**
   Click the SF Tabs icon

2. **Click and hold on a tab**
   The cursor will change to indicate you can drag

3. **Drag the tab to its new position**
   Other tabs will move to make room

4. **Release to drop**
   The new order is saved automatically


## Deleting Tabs

1. **Open the extension popup**
   Click the SF Tabs icon

2. **Click the delete icon <img src="{{ '/assets/images/icons/delete.svg' | relative_url }}" alt="Delete" style="display: inline; height: 1.2em; vertical-align: middle;"> next to a tab**
   A confirmation dialog will appear (unless you've disabled confirmations in settings)

3. **Confirm deletion**
   Click OK to permanently remove the tab


## Keyboard Shortcuts

SF Tabs supports keyboard shortcuts for quick access to your first 10 tabs.

### Default Shortcuts

The extension provides keyboard shortcut commands for tabs 1-10, but you need to configure the key combinations in your browser:

#### Firefox

1. Navigate to `about:addons`
2. Click the gear icon and select "Manage Extension Shortcuts"
3. Find SF Tabs and set shortcuts for "Tab 1" through "Tab 10"

#### Chrome

1. Navigate to `chrome://extensions/shortcuts`
2. Find SF Tabs in the list
3. Click the pencil icon to set shortcuts for "Tab 1" through "Tab 10"

See the [Shortcuts](shortcuts) page for more details.


## Settings

Access the Settings page by clicking the gear icon <img src="{{ '/assets/images/icons/settings.svg' | relative_url }}" alt="Settings" style="display: inline; height: 1.2em; vertical-align: middle;"> in the extension popup. This opens a dedicated settings page with organized sections for all configuration options.

### Appearance

#### Theme Mode

Choose how the extension looks:
- **Light:** Light color scheme optimized for daytime use
- **Dark:** Dark color scheme for low-light environments
- **System:** Automatically matches your operating system's theme preference

#### Compact Mode

Enable compact mode to display more tabs in less space by:
- Hiding tab URLs in the popup
- Reducing padding and spacing between items
- Using smaller font sizes

This is useful when you have many tabs and want to see them all at once.

### Behavior

#### Skip Delete Confirmation

When enabled, tabs will be deleted immediately without showing a confirmation dialog. Use this if you're confident in your deletions and want a faster workflow.

### Sync & Storage

Control how your tabs are stored and whether they sync across devices.

#### Enable Cross-Device Sync (Recommended)

When enabled, your tabs sync across all devices where you use the same browser account:
- **Sync Storage (Cloud):** Tabs stored in browser's sync storage, automatically syncs across devices
  - Limited to approximately 50 tabs due to browser sync storage limits (8KB total storage)
  - Data is automatically split into smaller chunks to work within browser limitations
  - Recommended for most users

When disabled, tabs are stored locally:
- **Local Storage:** Tabs stored only on this device
  - No practical limit on number of tabs (several MB available)
  - Does not sync to other devices
  - Useful if you have many tabs or device-specific configurations

**Note:** Regardless of which storage option you choose, all data remains in your browser - nothing is ever sent to external servers.

### Profiles

Enable the Profiles feature to create multiple tab configurations for different Salesforce orgs or work contexts. See the [Profiles Guide](#profiles) section for complete documentation.

#### Enable Profiles

Turn on the Profiles feature to create and manage multiple sets of tabs.

#### Auto-Switch Profiles (Only shown when Profiles are enabled)

Automatically switch to the appropriate profile based on the current Salesforce org's MyDomain URL. You can configure URL patterns for each profile to enable automatic switching.

### Keyboard Shortcuts

Configure keyboard shortcuts to quickly access your first 10 tabs by position. Click "Configure Keyboard Shortcuts" to open your browser's keyboard shortcut configuration page.

See the [Keyboard Shortcuts](shortcuts) page for detailed setup instructions.


## Profiles

Profiles allow you to create multiple sets of tabs for different Salesforce orgs, projects, or work contexts. Each profile can have its own unique collection of tabs.

### Enabling Profiles

1. **Open Settings**
   Click the gear icon <img src="{{ '/assets/images/icons/settings.svg' | relative_url }}" alt="Settings" style="display: inline; height: 1.2em; vertical-align: middle;"> in the extension popup

2. **Enable the Profiles feature**
   In the Profiles section, check "Enable Profiles"

3. **Access the Profiles manager**
   Click the users icon <img src="{{ '/assets/images/icons/profiles.svg' | relative_url }}" alt="Profiles" style="display: inline; height: 1.2em; vertical-align: middle;"> in the extension popup header to manage profiles

### Creating a New Profile

1. **Click the Profiles button**
   Click the users icon <img src="{{ '/assets/images/icons/profiles.svg' | relative_url }}" alt="Profiles" style="display: inline; height: 1.2em; vertical-align: middle;"> in the extension popup

2. **Click "Create New Profile"**
   This opens the profile creation wizard

3. **Choose initialization method:**
   - **Add default tabs:** Start with the standard set of tabs (Flows, Users, Profiles, etc.)
   - **Start with no tabs:** Begin with an empty profile and add tabs manually
   - **Clone another profile:** Copy tabs from an existing profile

4. **Name your profile**
   Enter a descriptive name (up to 30 characters)
   Examples: "Work - Production", "Sandbox - Dev", "Client - Acme Corp"

5. **Save the profile**
   Your new profile is created and ready to use

### Switching Between Profiles

There are two ways to switch profiles:

#### Manual Switching

1. **Click the active profile banner**
   The banner shows your current profile name at the top of the popup

2. **Select a profile from the dropdown**
   All your profiles are listed

3. **The extension switches immediately**
   Your tabs update to show the selected profile's tabs

#### Automatic Switching (URL Pattern Matching)

Set up profiles to automatically switch based on the Salesforce org you're visiting:

1. **Enable Auto-Switch in Settings**
   Go to Settings → Profiles → Enable "Auto-Switch Profiles"

2. **Edit a profile**
   Click the edit icon <img src="{{ '/assets/images/icons/edit.svg' | relative_url }}" alt="Edit" style="display: inline; height: 1.2em; vertical-align: middle;"> next to a profile in the Profiles manager

3. **Add URL patterns**
   Enter MyDomain patterns that match your Salesforce orgs
   - Example: `mycompany-dev-ed` matches `https://mycompany-dev-ed.develop.my.salesforce.com`
   - Example: `acmecorp` matches `https://acmecorp.lightning.force.com`

4. **Capture current domain**
   Click "Capture Current Domain" to automatically add the domain from your current Salesforce tab

5. **Test automatic switching**
   Navigate to a Salesforce org that matches one of your patterns
   The extension automatically switches to the matching profile

### Managing Profiles

#### Editing a Profile

1. Open the Profiles manager (users icon <img src="{{ '/assets/images/icons/profiles.svg' | relative_url }}" alt="Profiles" style="display: inline; height: 1.2em; vertical-align: middle;">)
2. Click the edit icon <img src="{{ '/assets/images/icons/edit.svg' | relative_url }}" alt="Edit" style="display: inline; height: 1.2em; vertical-align: middle;"> next to the profile
3. Update the profile name or URL patterns
4. Click "Save Profile"

#### Deleting a Profile

1. Open the Profiles manager
2. Click the delete icon <img src="{{ '/assets/images/icons/delete.svg' | relative_url }}" alt="Delete" style="display: inline; height: 1.2em; vertical-align: middle;"> next to the profile
3. Confirm deletion

**Note:** You cannot delete the active profile. Switch to another profile first.

#### Renaming a Profile

1. Open the Profiles manager
2. Click the edit icon <img src="{{ '/assets/images/icons/edit.svg' | relative_url }}" alt="Edit" style="display: inline; height: 1.2em; vertical-align: middle;"> next to the profile
3. Change the profile name (character counter shows remaining characters)
4. Click "Save Profile"

### Profile Best Practices

**Organize by Org Type**
- Create separate profiles for Production, Sandbox, Developer Edition, and Scratch orgs
- Example: "Prod", "UAT Sandbox", "Dev Sandbox", "Scratch"

**Organize by Project or Client**
- Useful for consultants managing multiple client orgs
- Example: "Client - Acme", "Client - Globex", "Internal"

**Organize by Role or Responsibility**
- Different tabs for admin work vs. development vs. configuration
- Example: "Admin Tasks", "Development", "User Support"

**Use URL Patterns for Automatic Switching**
- Set up MyDomain patterns for frequently-used orgs
- Saves time by automatically showing the right tabs when you switch orgs

**Keep Profile Names Short**
- Use abbreviations or short names for better display in the UI
- The 30-character limit is enforced

### Disabling Profiles

If you want to return to a single set of tabs:

1. Go to Settings → Profiles
2. Uncheck "Enable Profiles"
3. Choose which profile's tabs to keep
4. All other profiles will be removed

This action cannot be undone, so export a backup first if needed.


## Import/Export Configuration

You can backup your configuration or share it with team members.

### Export Configuration

1. **Open settings**
   Click the gear icon <img src="{{ '/assets/images/icons/settings.svg' | relative_url }}" alt="Settings" style="display: inline; height: 1.2em; vertical-align: middle;"> in the extension popup

2. **Click "Export Settings"**
   A JSON file will be downloaded to your computer

3. **Save the file**
   Store it in a safe location for backup or sharing

### Import Configuration

1. **Open settings**
   Click the gear icon <img src="{{ '/assets/images/icons/settings.svg' | relative_url }}" alt="Settings" style="display: inline; height: 1.2em; vertical-align: middle;"> in the extension popup

2. **Click "Import Settings"**
   A file picker will appear

3. **Select your JSON file**
   Choose the configuration file you want to import

4. **Confirm import**
   Your current settings will be replaced with the imported configuration


## Upgrading to v2.0.0 (Migration Wizard)

When you upgrade to SF Tabs v2.0.0, you'll see a migration wizard that helps you transition to the new profile-based system.

### What's Being Migrated?

Version 2.0.0 introduces a new data structure to support:
- Multiple profiles with different tab sets
- Choice between Sync and Local storage
- Enhanced dropdown functionality

Your existing tabs and settings are migrated to this new format automatically.

### Migration Wizard Screens

#### Welcome Screen

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

#### Migration in Progress

The wizard shows progress as it:
1. Reads your existing data
2. Creates the Default profile
3. Saves the new format

This typically takes only a few seconds.

#### Migration Complete

Once complete, you'll see a success message confirming:
- Your tabs are now in the "Default" profile
- Whether Profiles feature is enabled
- Next steps for using the new features

Click "Get Started" to begin using SF Tabs with the new features.

### What If Migration Fails?

If migration encounters an error:
- Your original data remains intact
- An error message explains what went wrong
- You can retry the migration or continue without migrating

**Troubleshooting migration issues:**
1. Export a backup of your current settings
2. Try closing and reopening the browser
3. Check that you have sufficient storage space
4. Report the issue on [GitHub Issues](https://github.com/chrisrouse/sftabs/issues) with the error message

### After Migration

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

### Can I Revert After Migration?

Migration is one-way and cannot be undone. However:
- If you exported a backup before migrating, you can import it to restore your old configuration
- The new format is more flexible and supports all your existing tabs
- You can disable Profiles in Settings if you don't want to use them


## Troubleshooting

### Tabs not appearing in Salesforce

- Make sure you're on a Salesforce Setup page (URL should contain `/lightning/setup/`)
- Try refreshing the page
- Check that the extension is enabled in your browser

### Tab links not working

- Verify the path is correct for your org
- Make sure you have permission to access that Setup page
- Try using a different path format (Setup page name vs. Lightning URL)

### Settings not saving

- Check that the extension has storage permissions
- Try disabling and re-enabling the extension
- Clear browser cache and restart

### Still having issues?

Visit the [GitHub Issues](https://github.com/chrisrouse/sftabs/issues) page to report bugs or ask for help.
