---
layout: default
title: User Guide
nav_order: 3
description: "Complete guide to using SF Tabs"
permalink: /user-guide
---

# User Guide
{: .no_toc }

Learn how to use SF Tabs to customize your Salesforce Setup experience.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Opening the Extension

There are two ways to access SF Tabs:

1. **Click the extension icon** in your browser toolbar
2. **Look for your tabs** in the Salesforce Setup menu (they appear automatically when you're on a Setup page)

---

## Adding a New Tab

### Method 1: Quick Add from Current Page

1. **Navigate to a Salesforce Setup page**
   Go to the page you want to create a tab for (e.g., Flows, Users, Profiles)

2. **Click the SF Tabs extension icon**
   The extension will detect the current page

3. **Click "Add Current Page"**
   A new tab will be created with the page name and URL automatically filled in

### Method 2: Manual Tab Creation

1. **Open the extension popup**
   Click the SF Tabs icon in your browser toolbar

2. **Click the "+" button**
   A new tab form will appear

3. **Fill in the tab details**
   Enter a label and path for your tab (see Tab Types below)

4. **Save your tab**
   Click Save and your tab will appear in the Setup menu

---

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
- `Account/object` - Account Object Manager
- `Contact/object` - Contact Object Manager
- `Custom_Object__c/object` - Custom Object Manager

### Custom URLs

Links to any Lightning URL path within Salesforce.

**Examples:**
- `lightning/cms/home` - CMS/Digital Experience home
- `lightning/o/Account/list` - Account list view
- `copado__User_Story__c/list` - Custom object list view

---

## Editing Tabs

1. **Open the extension popup**
   Click the SF Tabs icon

2. **Click the edit icon (✏️) next to a tab**
   The tab details will appear in an editable form

3. **Make your changes**
   Update the label, path, or other settings

4. **Save your changes**
   Click Save to apply the updates

---

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

---

## Deleting Tabs

1. **Open the extension popup**
   Click the SF Tabs icon

2. **Click the delete icon (🗑️) next to a tab**
   A confirmation dialog will appear (unless you've disabled confirmations in settings)

3. **Confirm deletion**
   Click OK to permanently remove the tab

---

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

See the [Shortcuts](/sftabs/shortcuts) page for more details.

---

## Settings

Access settings by clicking the gear icon (⚙️) in the extension popup.

### Theme Mode

- **Light:** Light color scheme
- **Dark:** Dark color scheme
- **System:** Automatically match your system theme

### Compact Mode

Enable compact mode to display more tabs in less space. This reduces padding and font sizes.

### Skip Delete Confirmation

When enabled, tabs will be deleted immediately without a confirmation dialog.

### Lightning Navigation

Controls whether tabs use Lightning navigation. This is typically enabled by default.

---

## Import/Export Configuration

You can backup your configuration or share it with team members.

### Export Configuration

1. **Open settings**
   Click the gear icon in the extension popup

2. **Click "Export Settings"**
   A JSON file will be downloaded to your computer

3. **Save the file**
   Store it in a safe location for backup or sharing

### Import Configuration

1. **Open settings**
   Click the gear icon in the extension popup

2. **Click "Import Settings"**
   A file picker will appear

3. **Select your JSON file**
   Choose the configuration file you want to import

4. **Confirm import**
   Your current settings will be replaced with the imported configuration

---

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
