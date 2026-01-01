---
layout: default
title: User Guide
---

# User Guide

## Opening the Extension

 Click the extension icon in your browser toolbar
 
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

<img width="412" height="539" alt="2026-01-01_09-55-57" src="https://github.com/user-attachments/assets/7301b3b9-17ce-47cb-81e1-73b5109f923f" />

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

## Managing Tabs

1. **Rearranging Tabs**
   Tabs can be rearranged by using click-and-drag. Click on the drag handle on the left and move the tab to a new position.

   <img width="412" height="325" alt="2025-12-31_14-51-35" src="https://github.com/user-attachments/assets/c2c15bef-c978-44c4-bcc0-b194f43e9cf0" />

3. **Editing Tabs**
   Click the edit icon <img src="{{ '/assets/images/icons/edit.svg' | relative_url }}" alt="Edit" style="display: inline; height: 1.2em; vertical-align: middle;"> on a tab to edit the name or URL.

4. **Open in New Tab**
   Click on the new tab icon <img src="{{ '/assets/images/icons/new-tab.svg' | relative_url }}" alt="New Tab" style="display: inline; height: 1.2em; vertical-align: middle;"> to have your tab open in a new tab. The icon will turn blue to indicate it is enabled.

5. **Delete tabs**
   Click on the trash can icon <img src="{{ '/assets/images/icons/delete.svg' | relative_url }}" alt="Delete" style="display: inline; height: 1.2em; vertical-align: middle;"> to delete a tab.


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
   
   <img width="412" height="221" alt="2025-12-31_15-01-54" src="https://github.com/user-attachments/assets/b378f2e7-9f8e-43a2-9ad0-4653fecf9110" />

6. **Review the dropdown items**
   The extension automatically detects available sub-pages:
   - Details
   - Fields & Relationships
   - Page Layouts
   - Buttons, Links, and Actions
   - Validation Rules
   - Triggers
   - And more...
     
   <img width="412" height="357" alt="2026-01-01_09-49-13" src="https://github.com/user-attachments/assets/b72d850d-8c8d-4f57-a525-ace596f83190" />
   
6. **Save your changes**
   Click "Save Changes"

Now when you click this tab in Salesforce Setup, you'll see a dropdown menu with all the object's sub-pages.

**Tip:** Click "Refresh List" to restore the default Object menu items after making manual changes.

### Manual Dropdowns (Drag and Drop)

Create custom dropdown menus by dragging existing tabs onto a parent tab.

   <img width="412" height="211" alt="2026-01-01_09-54-08" src="https://github.com/user-attachments/assets/9ae33968-6e18-4967-bec3-efd4415e052f" />

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

<img width="405" height="58" alt="Screenshot 2025-12-26 at 7 58 33 AM" src="https://github.com/user-attachments/assets/db754a22-d09a-4641-aee7-3ecb425161cc" />

<img width="356" height="108" alt="Screenshot 2025-12-25 at 1 14 49 PM" src="https://github.com/user-attachments/assets/6c565416-8075-4109-a7bf-d6cf3b7f9cc2" />


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
4. If you attempt to add a nested group of tabs to another group and it would results in having too many levels, an error is shown.
   
<img width="407" height="347" alt="Screenshot 2025-12-26 at 9 42 51 AM" src="https://github.com/user-attachments/assets/cba6c9e8-e94f-480a-ab05-899ef7b59b4e" />

<img width="527" height="482" alt="Screenshot 2025-12-26 at 9 42 59 AM" src="https://github.com/user-attachments/assets/11bd77b9-2c61-4ba2-9d06-a1d468a9eba6" />

<img width="407" height="607" alt="Screenshot 2025-12-26 at 9 40 36 AM" src="https://github.com/user-attachments/assets/451752e7-5150-4943-b9e5-b57524825eae" />


## Editing Tabs

<img width="412" height="482" alt="Screenshot 2025-12-26 at 9 45 01 AM" src="https://github.com/user-attachments/assets/abfcd541-0378-47cf-a08a-26b9658a7194" />

1. **Open SF Tabs**
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

SF Tabs supports keyboard shortcuts for quick access to your first 10 custom tabs. This section explains how to set up and use these shortcuts.

### Available Shortcuts

SF Tabs provides 10 keyboard shortcut commands that correspond to your first 10 tabs:

| Command | Default Key | Opens |
|:--------|:------------|:------|
| Tab 1   | Not set     | Your first tab (position 0) |
| Tab 2   | Not set     | Your second tab (position 1) |
| Tab 3   | Not set     | Your third tab (position 2) |
| Tab 4   | Not set     | Your fourth tab (position 3) |
| Tab 5   | Not set     | Your fifth tab (position 4) |
| Tab 6   | Not set     | Your sixth tab (position 5) |
| Tab 7   | Not set     | Your seventh tab (position 6) |
| Tab 8   | Not set     | Your eighth tab (position 7) |
| Tab 9   | Not set     | Your ninth tab (position 8) |
| Tab 10  | Not set     | Your tenth tab (position 9) |

By default, no keyboard shortcuts are assigned. You must configure them manually in your browser settings.

You can quickly access the Keyboard Shortcuts page by opening SF Tabs' Settings page and clicking
on **Configure Keyboard Shortcuts**.

<img width="782" height="188" alt="Screenshot 2025-12-24 at 3 21 08 PM" src="https://github.com/user-attachments/assets/3428e215-c181-423e-afa1-57bfba348e6c" />


### Setting Up Shortcuts in Firefox

<img width="686" height="614" alt="Screenshot 2025-12-24 at 3 14 10 PM" src="https://github.com/user-attachments/assets/e9370e17-2c71-4641-8c07-7e429cb611b0" />


1. **Open Add-ons Manager**
   Type `about:addons` in the address bar and press Enter

2. **Access Keyboard Shortcuts**
   Click the gear icon <img src="{{ '/assets/images/icons/settings.svg' | relative_url }}" alt="Settings" style="display: inline; height: 1.2em; vertical-align: middle;"> in the top right and select "Manage Extension Shortcuts"

3. **Find SF Tabs**
   Scroll down to find SF Tabs in the list of extensions

4. **Configure Shortcuts**
   Click in the input field next to each command (e.g., "Tab 1") and press your desired key combination

5. **Save Automatically**
   Your shortcuts are saved automatically as you configure them

#### Recommended Firefox Shortcuts

| Tab | Suggested Shortcut | Notes |
|:----|:-------------------|:------|
| Tab 1 | `Ctrl+Shift+1` (or `Cmd+Shift+1` on Mac) | Easy to remember and type |
| Tab 2 | `Ctrl+Shift+2` (or `Cmd+Shift+2` on Mac) | Follows natural numbering |
| Tab 3-10 | `Ctrl+Shift+3` through `Ctrl+Shift+0` | Continue the pattern |


### Setting Up Shortcuts in Chrome
<img width="701" height="752" alt="Screenshot 2025-12-24 at 3 18 25 PM" src="https://github.com/user-attachments/assets/90d7953a-5d61-4e98-a1bf-8a4e941ea459" />

1. **Open Extensions Shortcuts**
   Type `chrome://extensions/shortcuts` in the address bar and press Enter

2. **Find SF Tabs**
   Scroll down to find SF Tabs in the list of extensions

3. **Click the Pencil Icon**
   Click the pencil/edit icon next to each command you want to configure

4. **Enter Your Shortcut**
   Press your desired key combination in the input field

5. **Save**
   Click outside the field or press Enter to save

#### Recommended Chrome Shortcuts

| Tab | Suggested Shortcut | Notes |
|:----|:-------------------|:------|
| Tab 1 | `Ctrl+Shift+1` (or `Cmd+Shift+1` on Mac) | Easy to remember and type |
| Tab 2 | `Ctrl+Shift+2` (or `Cmd+Shift+2` on Mac) | Follows natural numbering |
| Tab 3-10 | `Ctrl+Shift+3` through `Ctrl+Shift+0` | Continue the pattern |


### Best Practices

#### Choosing Key Combinations

- **Use modifier keys:** Always include Ctrl/Cmd and/or Shift to avoid conflicts with existing shortcuts
- **Be consistent:** Use a pattern like `Ctrl+Shift+[Number]` for all your tabs
- **Avoid conflicts:** Check that your chosen shortcuts don't conflict with browser or Salesforce shortcuts
- **Consider frequency:** Assign shortcuts to your most frequently used tabs first

#### Common Key Combination Conflicts to Avoid

| Shortcut | Existing Function | Browser |
|:---------|:------------------|:--------|
| `Ctrl+1` through `Ctrl+9` | Switch to browser tab 1-9 | Both |
| `Ctrl+T` | New tab | Both |
| `Ctrl+W` | Close tab | Both |
| `Ctrl+N` | New window | Both |


### Organizing Your Tabs for Shortcuts

Since shortcuts correspond to tab positions, organize your tabs strategically:

1. **Identify your most-used pages**
   Determine which Setup pages you visit most frequently

2. **Reorder tabs in the extension**
   Drag and drop your most important tabs to positions 1-10

3. **Assign shortcuts**
   Configure keyboard shortcuts for these priority tabs

4. **Test and adjust**
   Use your shortcuts for a few days and reorder as needed

#### Example Organization

Here's an example of how you might organize tabs for optimal shortcut usage:

| Position | Tab Name | Shortcut | Why |
|:---------|:---------|:---------|:----|
| 1 | Flows | `Ctrl+Shift+1` | Most frequently accessed |
| 2 | Users | `Ctrl+Shift+2` | Second most common |
| 3 | Profiles | `Ctrl+Shift+3` | Regular maintenance |
| 4 | Permission Sets | `Ctrl+Shift+4` | Security configuration |
| 5 | Custom Metadata | `Ctrl+Shift+5` | Development work |


### Shortcuts Troubleshooting

#### Shortcut doesn't work

- Make sure you're on a Salesforce page when pressing the shortcut
- Verify the shortcut is configured correctly in browser settings
- Check that you have a tab at that position (e.g., Tab 5 won't work if you only have 4 tabs)
- Ensure the shortcut doesn't conflict with another extension or browser function

#### Can't set a shortcut

- The key combination may be reserved by the browser
- Try a different combination with more modifier keys (e.g., `Ctrl+Alt+Shift+1`)
- Some keys may be restricted by your operating system

#### Shortcut opens wrong tab

- Remember that shortcuts correspond to tab positions (0-9), not tab IDs
- If you reorder tabs, the shortcuts will open different pages
- Check the extension popup to see which tab is in which position


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
