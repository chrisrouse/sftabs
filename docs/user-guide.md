---
layout: default
title: User Guide
---

# User Guide

## Opening the Extension

 Click the extension icon in your browser toolbar to open SF Tabs
 
<img src="{{ '/assets/images/icons/sftabs_blue.svg' | relative_url }}" alt="SF Tabs Icon" style="display: inline; height: 1.2em; vertical-align: middle;"> 


## Adding a New Tab

### Method 1: Quick Add from Current Page

<img width="402" height="52" alt="Screenshot 2025-12-26 at 7 30 40 AM" src="https://github.com/user-attachments/assets/c3075e90-23b8-4e4b-b6a3-0d13664d7d76" />


1. **Navigate to a Salesforce Setup page**
   Go to the page you want to create a tab for (e.g., Flows, Users, Profiles)

2. **Click the SF Tabs extension icon**
   The extension will detect the current page

3. **Click Quick Create button <img src="{{ '/assets/images/icons/quick-add.svg' | relative_url }}" alt="Quick Add" style="display: inline; height: 1.2em; vertical-align: middle;">**
   A new tab will be created with the page name and URL automatically filled in. If you are creating a tab outside of Setup, "Object" will be automatically seelcted for the new tab.

### Method 2: Manual Tab Creation

<img width="412" height="539" alt="2026-01-01_09-55-57" src="https://github.com/user-attachments/assets/8dc84577-7d12-4c1e-93f6-b11b4afed5a1" />

1. **Open the extension popup**
   Click the SF Tabs icon in your browser toolbar

2. **Click the <img src="{{ '/assets/images/icons/manual-add.svg' | relative_url }}" alt="Quick Add" style="display: inline; height: 1.2em; vertical-align: middle;"> button**
   A new tab form will appear

3. **Fill in the tab details**
   Enter a label and path for your tab. See Tab Types below.

4. **Save your tab**
   Click **Save Changes** and your tab will appear in the Setup menu


## Tab Types

SF Tabs supports three types of tabs:

### Setup Pages

Links to standard Salesforce Setup pages. Use the Setup page name as the path.

**Examples:**
- `Flows` - Links to Flow Builder
- `ManageUsersLightning` - Links to Users page

### Object Pages

Links to Object Manager pages for standard or custom objects.

**Examples:**
- `Account` - Account Object
- `Custom_Object__c` - Custom Object
- `My Opportunities` - List View

### Custom URLs

Links to any Lightning URL path within Salesforce.

**Examples:**
- `interaction_explorer/flowExplorer.app` - Flow Trigger Explorer
- `Opportunity/list?filterName=ClosingNextMonth` - Opportunity "Closing Next Month" list view

## Creating Dropdown Menus

SF Tabs supports dropdown menus, allowing you to organize related tabs under a parent tab. There are two types of dropdowns:

### Object Manager Dropdowns

When you create a tab that links to an Object Manager page, you can create a dropdown menu with all the object's sub-pages.


#### Creating an Object Manager Dropdown

1. **Navigate to an Object Manager page**
   Go to any object in Salesforce (e.g., Setup → Object Manager → Account)

2. **Add the current page as a tab**
   Click "Add Current Page" in the SF Tabs popup

3. **Open the tab settings**
   Click the edit icon <img src="{{ '/assets/images/icons/edit.svg' | relative_url }}" alt="Edit" style="display: inline; height: 1.2em; vertical-align: middle;"> next to your new tab

4. **Set up the dropdown**
   Click "Setup as Object Dropdown" button
   
   <img width="412" height="212" alt="2026-01-01_09-54-08" src="https://github.com/user-attachments/assets/55e265ff-c839-4029-a704-a64b8ff907bb" />


6. **Review the dropdown items**
   The extension automatically detects available sub-pages:
   - Details
   - Fields & Relationships
   - Page Layouts
   - Buttons, Links, and Actions
   - Validation Rules
   - Triggers
   - And more...
     
<img width="394" height="357" alt="2026-01-01_09-49-13" src="https://github.com/user-attachments/assets/24216384-3b8c-4371-b28b-5be2d583ee4a" />

   
6. **Save your changes**
   Click "Save Changes"

Now when you click this tab in Salesforce Setup, you'll see a dropdown menu with all the object's sub-pages.

**Tip:** Click "Refresh List" to restore the default Object menu items after making manual changes.

### Manual Dropdowns (Drag and Drop)

Create custom dropdown menus by dragging existing tabs onto a parent tab.

<img width="412" height="295" alt="2025-12-31_15-01-04" src="https://github.com/user-attachments/assets/8ca86ec4-c601-4e02-873c-511c3f4fb41d" />

#### Creating a Manual Dropdown

1. **Create a parent tab**
   This can be any tab, or create a "folder" tab by leaving the URL blank

2. **Drag a tab onto the parent**
   Click and hold a tab, then drag it over another tab
   Release when you see the drop indicator

   <img width="412" height="295" alt="2025-12-31_15-01-04" src="https://github.com/user-attachments/assets/e2677c43-70ce-4dc3-9459-d03287f9ebd6" />


4. **The dragged tab becomes a dropdown item**
   It's now nested under the parent tab

5. **Add more items**
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

1. Click on the tab name to see the items included in the dropdown

<img width="412" height="258" alt="2026-01-01_10-21-09" src="https://github.com/user-attachments/assets/55670dd4-5c79-4865-98db-bcbc97618e86" />


#### Reordering Items in a Dropdown

1. Click on the parent tab's name to open the dropdown items
2. In the dropdown items preview, drag items to reorder them
3. Save your changes

#### Editing Items in Dropdown

1. Click on Edit <img src="https://chrisrouse.github.io/sftabs/assets/images/icons/edit-button.svg" alt="Promote" style="display: inline; vertical-align: middle;"> next to an item in the dropdown preview to make changes to that menu item

#### Promoting Dropdown Items to Regular Tabs

1. Click on the up arrow <img src="https://chrisrouse.github.io/sftabs/assets/images/icons/promote-button.svg" alt="Promote" style="display: inline; vertical-align: middle;"> to promote a dropdown item to a top-level tab
2. The item becomes a regular top-level tab again


#### Removing Items from a Dropdown

1. Open the parent tab's settings
2. Click the remove icon <img src="https://chrisrouse.github.io/sftabs/assets/images/icons/remove-button.svg" alt="Remove" style="display: inline; vertical-align: middle;"> next to the item
3. The item is removed from the dropdown

#### Converting a Dropdown Back to a Regular Tab

1. Remove all items from the dropdown
2. The tab automatically becomes a regular tab


### Multi-level Dropdown Menus

1. **Up to three levels are supported** Parent > Child > Tab
2. An example for using nested dropdowns would be having a folder that organizes your object tabs. The first level shows the object names and the second level shows the object menus.
3. Create your object tabs first and then drag them into the parent folder.
4. If your attempt to add a folder or tab that already has three levels into another folder or tab, an error will be shown. You can only have up to three levels of hierarchy.
   
<img width="412" height="490" alt="2026-01-02_07-36-47" src="https://github.com/user-attachments/assets/2c48383e-b43e-4c20-b10e-02c705576112" />

<img width="527" height="482" alt="Screenshot 2025-12-26 at 9 42 59 AM" src="https://github.com/user-attachments/assets/11bd77b9-2c61-4ba2-9d06-a1d468a9eba6" />


## Editing Tabs

1. **Open SF Tabs**
   Click the SF Tabs icon

2. **Click the edit icon <img src="{{ '/assets/images/icons/edit.svg' | relative_url }}" alt="Edit" style="display: inline; height: 1.2em; vertical-align: middle;"> next to a tab**
   The tab details will appear in an editable form

3. **Make your changes**
   Update the label, path, or other settings

4. **Save your changes**
   Click Save to apply the updates

<img width="412" height="539" alt="2026-01-02_07-38-57" src="https://github.com/user-attachments/assets/c9d533a2-3ee3-49ce-a6fb-ac8dbdca0202" />

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

   <img width="412" height="295" alt="2025-12-31_15-01-04" src="https://github.com/user-attachments/assets/9d53fb55-e981-4e0f-b39f-9bed2e1d6f92" />

## Open in New Tab

Click on the new tab icon <img src="{{ '/assets/images/icons/new-tab.svg' | relative_url }}" alt="New Tab" style="display: inline; height: 1.2em; vertical-align: middle;"> to have your tab open in a new tab. The icon will turn blue to indicate it is enabled.

## Deleting Tabs

1. **Open the extension popup**
   Click the SF Tabs icon

2. **Click the delete icon <img src="{{ '/assets/images/icons/delete.svg' | relative_url }}" alt="Delete" style="display: inline; height: 1.2em; vertical-align: middle;"> next to a tab**
   A confirmation dialog will appear (unless you've disabled confirmations in settings)

3. **Confirm deletion**
   Click OK to permanently remove the tab


## Keyboard Shortcuts

SF Tabs supports keyboard shortcuts for quick access to your first 10 custom tabs. This section explains how to set up and use these shortcuts.

By default, no keyboard shortcuts are assigned. You must configure them manually in your browser settings.

### Setting Up Shortcuts in Firefox

<img width="686" height="614" alt="Screenshot 2025-12-24 at 3 14 10 PM" src="https://github.com/user-attachments/assets/e9370e17-2c71-4641-8c07-7e429cb611b0" />

1. **Open Add-ons Manager**
   Click on the extensions menu and select Manage extensions, or click on the menu button (three lines), click Extensions and themes and select Extensions. 

2. **Access Keyboard Shortcuts**
   Click the cog icon in the top right and select "Manage Extension Shortcuts"

3. **Find SF Tabs**
   Scroll down to find SF Tabs in the list of extensions

4. **Configure Shortcuts**
   Click in the input field next to each command (e.g., "Tab 1") and press your desired key combination


### Setting Up Shortcuts in Chrome

1. **Open Extensions Shortcuts**
   Click on the extensions menu and select Manage Extensions, or click on the menu button (three dots), click Extensions, click Manage Extensions. 

2. **Access Keyboard Shortcuts**
   CLick on Keyboard shortcuts on the left

3. **Find SF Tabs**
   Scroll down to find SF Tabs in the list of extensions

4. **Configure Shortcuts**
   Click in the pencil icon next to each command (e.g., "Tab 1") and press your desired key combination


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

**Note:** Regardless of which storage option you choose, all data remains in your browser or managed by your browser's sync system. SF Tabs doesn't not send your data anywhere else.

### Profiles

Enable the Profiles feature to create multiple tab configurations for different Salesforce orgs or work contexts. See the [Profiles](#profiles) section for complete documentation.

#### Enable Profiles

Turn on the Profiles feature to create and manage multiple sets of tabs.

#### Auto-Switch Profiles (Only shown when Profiles are enabled)

Automatically switch to the appropriate profile based on the current Salesforce org's MyDomain URL. You can configure URL patterns for each profile to enable automatic switching.

### Keyboard Shortcuts

Configure keyboard shortcuts to quickly access your first 10 tabs by position. Click "Configure Keyboard Shortcuts" to open your browser's keyboard shortcut configuration page.

See the [Keyboard Shortcuts](#keyboard-shortcuts) section for detailed setup instructions.


## Profiles

Profiles allow you to create multiple sets of tabs for different Salesforce orgs, projects, or work contexts. Each profile can have its own unique collection of tabs.

<img width="389" height="307" alt="Screenshot 2025-12-25 at 1 25 39 PM" src="https://github.com/user-attachments/assets/307c2914-306a-413d-a5bb-6f464ff9930f" />

### Enabling Profiles

1. **Open Settings**
   Click the gear icon <img src="{{ '/assets/images/icons/settings.svg' | relative_url }}" alt="Settings" style="display: inline; height: 1.2em; vertical-align: middle;"> in the extension popup

2. **Enable the Profiles feature**
   In the Profiles section, check "Enable Profiles"

4. **Access the Profiles manager**
   Click the users icon <img src="{{ '/assets/images/icons/profiles.svg' | relative_url }}" alt="Profiles" style="display: inline; height: 1.2em; vertical-align: middle;"> in the extension popup header to manage profiles

### Creating a New Profile

<img width="411" height="375" alt="Screenshot 2025-12-25 at 1 26 59 PM" src="https://github.com/user-attachments/assets/f8eb9e66-0ad6-4264-ab6c-64d2676e49b5" />

1. **Click the Profiles button**
   Click the users icon <img src="{{ '/assets/images/icons/profiles.svg' | relative_url }}" alt="Profiles" style="display: inline; height: 1.2em; vertical-align: middle;"> in the extension popup

2. **Click "Create New Profile"**
   This opens the profile creation wizard

3. **Choose initialization method:**
  
<img width="405" height="399" alt="Screenshot 2025-12-25 at 1 27 32 PM" src="https://github.com/user-attachments/assets/932c6ce4-541d-42bf-a016-58438499451c" />

   - **Add default tabs:** Start with the standard set of tabs (Flows, Users, Profiles, etc.)
   - **Start with no tabs:** Begin with an empty profile and add tabs manually
   - **Clone another profile:** Copy tabs from an existing profile

6. **Name your profile**
   Enter a descriptive name (up to 30 characters)
   Examples: "Work - Production", "Sandbox - Dev", "Client - Acme Corp"

7. **Save the profile**
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
     
<img width="414" height="517" alt="Screenshot 2025-12-25 at 1 33 37 PM" src="https://github.com/user-attachments/assets/2b86ed47-3baf-44ae-8089-4167ac57f724" />

4. **Capture current domain**
   Click "Capture Current Domain" to automatically add the domain from your current Salesforce tab

5. **Test automatic switching**
   Navigate to a Salesforce org that matches one of your patterns
   The extension automatically switches to the matching profile

### Managing Profiles

#### Default Profile

1. Click on the "D" icon to set the default profile. This profile is used when URL matching is enabled for sites not specified.

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
