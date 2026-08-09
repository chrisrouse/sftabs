---
layout: v3
title: Getting Started
description: Open SF Tabs for the first time, choose your storage, and add your first tab.
---

# Getting Started

## Opening the Extension

Click the extension icon in your browser toolbar to open SF Tabs.

<div class="v3-shot">Screenshot: the browser toolbar with the SF Tabs icon highlighted</div>

## First Launch Wizard

The first time you open SF Tabs you will see the First Launch Wizard. This allows you to quickly configure a few key settings.

<div class="v3-shot">Screenshot: the First Launch Wizard's welcome step</div>

### Tab Options

**1. Start with default tabs** to use the pre-defined defaults, just so that you have something to start with.
**2. Start with no tabs** if you have used SF Tabs before and want a clean start.
**3. Import existing configuration** if you have used SF Tabs on another computer and you want to import your settings.

### Profiles

If you are working in a single org, you probably don't need profiles, but if you work in different orgs or need different sets of tabs depending on your work, you may want to use profiles. You can read more about this in [Profiles]({{ '/v3/profiles' | relative_url }}).

## Storage Options

**1. Local Storage** keeps all SF Tabs data in the browser on your computer. If you install on another computer, none of your tabs or settings will be synced.
**2. Sync Storage** uses your browser's sync storage (if enabled) to keep your data in sync across multiple computers, where you are signed into the same browser profile.

You can change this later from Settings > Data.

## Adding a New Tab

SF Tabs gives you a few ways to add a tab, whether you're on a Salesforce Setup page or a regular record page.

### Method 1: Quick Add from the Popup

1. **Navigate to a Salesforce page**
   Go to the page you want to create a tab for — a Setup page, an object page, or a record page all work.

2. **Click the SF Tabs extension icon**
   The extension will detect the current page.

3. **Click the Quick Add button**
   A new tab will be created with the page name and URL automatically filled in.

<div class="v3-shot">Screenshot: the popup with the Quick Add button highlighted next to a detected page</div>

### Method 2: Manual Tab Creation

1. **Open the extension popup**
   Click the SF Tabs icon in your browser toolbar.

2. **Click the add button**
   A new tab form will appear.

3. **Fill in the tab details**
   Enter a label and path for your tab. See Tab Types below.

4. **Save your tab**
   Click **Save Changes** and your tab will appear in the Setup menu.

<div class="v3-shot">Screenshot: the manual add tab form with label and path fields</div>

### Method 3: The "+" in the Setup Tab Bar

A "+" appears at the end of your Setup tab bar in Salesforce. Click it to capture the current page as a new tab without opening the popup. Turn this on from Settings > Tabs > "Quick Add in the Salesforce menu bar".

<div class="v3-shot">Screenshot: the "+" button at the end of the Salesforce Setup tab bar</div>

### Method 4: The Header Bookmark Button

SF Tabs also adds a bookmark button to the Salesforce header that lets you capture the current page in one click. See [Quick Access]({{ '/v3/quick-access' | relative_url }}) for details.

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
