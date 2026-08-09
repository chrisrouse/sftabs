---
layout: v3
title: Tabs
description: Edit, reorder, color, delete and organize your SF Tabs into dropdown menus.
---

# Tabs

## Editing Tabs

1. **Open SF Tabs**
   Click the SF Tabs icon.

2. **Click the edit icon next to a tab**
   The tab details will appear in an editable form.

3. **Make your changes**
   Update the label, path, color, or other settings.

4. **Save your changes**
   Click Save to apply the updates.

<div class="v3-shot">Screenshot: the tab edit form with label, path and color fields</div>

### Profile Membership

If you have [profiles]({{ '/v3/profiles' | relative_url }}) enabled, the edit form includes a checkbox for each profile. Tick the profiles a tab should belong to — a tab can belong to more than one profile at the same time.

<div class="v3-shot">Screenshot: the profile checkboxes in the tab edit form</div>

## Reordering Tabs

You can reorder your tabs from the popup, or by dragging them directly in the Salesforce Setup tab bar.

### Reordering in the Popup

1. **Open the extension popup**
   Click the SF Tabs icon.

2. **Click and hold on a tab**
   The cursor will change to indicate you can drag.

3. **Drag the tab to its new position**
   Other tabs will move to make room.

4. **Release to drop**
   The new order is saved automatically.

<div class="v3-shot">Screenshot: a tab mid-drag in the popup list, with other rows shifting to make room</div>

### Reordering in the Salesforce Setup Bar

You can also drag tabs directly in the Setup tab bar in Salesforce. Salesforce's own drag-and-drop moves the tab, SF Tabs saves the new order, and the popup updates to match.

<div class="v3-shot">Screenshot: a tab being dragged within the Salesforce Setup tab bar</div>

## Open in New Tab

Click on the new tab icon to have your tab open in a new browser tab. The icon will turn blue to indicate it is enabled.

## Tab Colors

Individual tabs can take their own color, separate from [Org Colors]({{ '/v3/org-colors' | relative_url }}). Turn this on from Settings > Tabs > "Color-code tabs", then choose a "Color style" of dot or tint. Set a color for a tab from its edit form.

This is off by default. If you turn it off later, any colors you've already set are kept and will reappear if you turn it back on.

<div class="v3-shot">Screenshot: a tab row showing a color dot next to its label</div>

## Deleting Tabs

1. **Open the extension popup**
   Click the SF Tabs icon.

2. **Click the delete icon next to a tab**
   A confirmation dialog will appear (unless you've turned on "Skip Delete Confirmation" in Settings > General).

3. **Confirm deletion**
   Click OK to permanently remove the tab.

## Creating Dropdown Menus

SF Tabs supports dropdown menus, allowing you to organize related tabs under a parent tab. There are two types of dropdowns:

### Object Manager Dropdowns

When you create a tab that links to an Object Manager page, you can create a dropdown menu with all the object's sub-pages.

#### Creating an Object Manager Dropdown

1. **Navigate to an Object Manager page**
   Go to any object in Salesforce (e.g., Setup → Object Manager → Account).

2. **Add the current page as a tab**
   Use one of the ways to add a tab described in [Getting Started]({{ '/v3/getting-started' | relative_url }}).

3. **Open the tab settings**
   Click the edit icon next to your new tab.

4. **Set up the dropdown**
   Click "Setup as Object Dropdown".

<div class="v3-shot">Screenshot: the tab edit form with the "Setup as Object Dropdown" button</div>

5. **Review the dropdown items**
   The extension automatically detects available sub-pages:
   - Details
   - Fields & Relationships
   - Page Layouts
   - Buttons, Links, and Actions
   - Validation Rules
   - Triggers
   - And more...

<div class="v3-shot">Screenshot: the detected list of Object Manager sub-pages in the dropdown editor</div>

6. **Save your changes**
   Click "Save Changes".

Now when you click this tab in Salesforce Setup, you'll see a dropdown menu with all the object's sub-pages.

**Tip:** Click "Refresh List" to restore the default Object menu items after making manual changes.

### Manual Dropdowns (Drag and Drop)

Create custom dropdown menus by dragging existing tabs onto a parent tab.

#### Creating a Manual Dropdown

1. **Create a parent tab**
   This can be any tab, or create a "folder" tab by leaving the URL blank (see Folder-Style Tabs below).

2. **Drag a tab onto the parent**
   Click and hold a tab, then drag it over another tab. Release when you see the drop indicator.

<div class="v3-shot">Screenshot: a tab being dragged over another tab in the popup, showing the drop indicator</div>

3. **The dragged tab becomes a dropdown item**
   It's now nested under the parent tab.

4. **Add more items**
   Drag additional tabs onto the parent to build your menu.

### Folder-Style Tabs (Menu Containers)

Create tabs that only act as dropdown menus without their own destination URL:

1. **Create a new tab**
   Click the add button.

2. **Enter a name only**
   Give it a descriptive name like "User Management" or "Dev Tools".

3. **Leave the URL blank**
   Don't enter any path.

4. **Add dropdown items**
   Drag other tabs onto this tab to create a menu.

This creates a folder-style tab that opens a dropdown menu when clicked, without navigating anywhere.

### Managing Dropdown Items

Click on the tab name to see the items included in the dropdown.

<div class="v3-shot">Screenshot: an expanded dropdown showing its nested items in the popup</div>

#### Reordering Items in a Dropdown

1. **Click on the parent tab's name**
   Open the dropdown items.

2. **Drag items to reorder**
   In the dropdown items preview, drag items to reorder them.

3. **Save your changes**
   Click Save to apply the new order.

#### Editing Items in a Dropdown

1. **Click the edit icon**
   Click the edit icon next to an item in the dropdown preview to make changes to that menu item.

#### Promoting Dropdown Items to Regular Tabs

1. **Click the promote icon**
   Click the up arrow to promote a dropdown item to a top-level tab.

2. **Item becomes a top-level tab**
   The item becomes a regular top-level tab again.

#### Removing Items from a Dropdown

1. **Open the parent tab's settings**
   Click the edit icon next to the parent tab.

2. **Click the remove icon**
   Click the remove icon next to the item.

3. **Item is removed**
   The item is removed from the dropdown.

#### Converting a Dropdown Back to a Regular Tab

1. **Remove all items from the dropdown**
   Delete or promote all dropdown items.

2. **Tab automatically converts**
   The tab automatically becomes a regular tab.

### Multi-level Dropdown Menus

SF Tabs supports up to three levels of nested dropdowns: Parent > Child > Tab.

**Use Case Example:**
Create a folder that organizes your object tabs. The first level shows the object names and the second level shows the object menus.

**How to Create:**
1. Create your object tabs first.
2. Drag them into the parent folder.
3. You can nest folders up to three levels deep.

**Note:** If you attempt to add a folder or tab that already has three levels into another folder or tab, an error will be shown. You can only have up to three levels of hierarchy.

<div class="v3-shot">Screenshot: a three-level nested dropdown menu open in the Salesforce Setup bar</div>
