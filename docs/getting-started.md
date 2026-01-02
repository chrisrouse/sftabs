---
layout: default
title: Getting Started
---
# Getting Started

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
