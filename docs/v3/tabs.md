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
   Click on the pencil icon on the tab you want to edit.

3. **Make your changes**
   Tab Name is required. If you create a tab with a blank Tab Path it will act as a folder without a link. The tab options control the behavior of how the tab opens. Most tabs in Setup do not need one of these options selected. Using Quick Add will automatically select the correct option. Tab colors are pre-set based on SLDS 2.0 colors to ensure the text remains readable on tabs. The tab color is applied based on the setting you enabled in Settings > Tabs.

4. **Save your changes**
   Click Save Tab to apply the updates.

### Profile Membership

If you have [profiles]({{ '/v3/profiles' | relative_url }}) enabled, the edit form includes a checkbox for each profile. Tick the profiles a tab should belong to — a tab can belong to more than one profile at the same time.

<img width="770" height="857" alt="sftabs-edit-tab" src="https://github.com/user-attachments/assets/34c78b4d-44cf-4eac-b217-51d1e552419d" />

## Reordering Tabs

You can reorder your tabs from the popup, or by dragging them directly in the Salesforce Setup tab bar.

### Reordering in the Popup

1. **Open the extension popup**
   Click the SF Tabs icon.

2. **Click and hold on a tab**
   The cursor will change to indicate you can drag.

   <img width="415" height="249" alt="sftabs-drag-handle" src="https://github.com/user-attachments/assets/ac23bd99-9464-4892-9bc0-84b26f7d530a" />


4. **Drag the tab to its new position**
   You will see a line indicating where the tab will be inserted. If you are adding a tab to a folder or nesting it with other tabs, hover over the destination. The entire parent tab will change colors indicating you can drop the tab.

   <div class="v3-pair">
     <figure>
       <img width="385" height="242" alt="sftabs-drag-drop-position" src="https://github.com/user-attachments/assets/212529fd-2695-4b55-960c-2ec5a5bf3635" />
       <figcaption>A line shows where the tab will be inserted</figcaption>
     </figure>
     <figure>
       <img width="382" height="320" alt="sftabs-drag-folder" src="https://github.com/user-attachments/assets/341b0cae-7381-494d-9d13-6546d5624628" />
       <figcaption>Hovering over a parent tab highlights it as a drop target</figcaption>
     </figure>
   </div>

6. **Release to drop**
   The new order is saved automatically.

### Reordering in the Salesforce Setup Bar

You can also drag tabs directly in the Setup tab bar in Salesforce. Salesforce's own drag-and-drop moves the tab, SF Tabs saves the new order, and the popup updates to match.

## Open in New Tab

Click on the new tab icon to have your tab open in a new browser tab. The icon will turn blue to indicate it is enabled.

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

3. **Open the tab hierarchy settings**
   The hierarchy icon is the one to the left of the pencil.
   
5. **Set up the dropdown**
   Click "Load items from this page" to automatically generate an object menu.

   <img width="771" height="539" alt="sftabs-object-menu" src="https://github.com/user-attachments/assets/9016730b-eb9e-436d-a228-3cdac0760115" />

5. **Review the dropdown items**
   The extension automatically detects available sub-pages and adds them as sub-tabs.
   
   <img width="767" height="540" alt="sftabs-object-menu-example" src="https://github.com/user-attachments/assets/641a6839-3fc7-4720-82c7-bbbf90df0ad7" />

6. **Save your changes**
   Click the X to close Manage Items. These changes are saved automatically.

Now when you click this tab in Salesforce Setup, you'll see a dropdown menu with all the object's sub-pages.

<img width="417" height="508" alt="sftbabs-dropdown" src="https://github.com/user-attachments/assets/4ec5b761-b2e4-4867-a52b-5b503fd2494a" />

**Tip:** Click "Refresh List" to restore the default Object menu items after making manual changes.

### Manual Dropdowns (Drag and Drop)

Create custom dropdown menus by dragging existing tabs onto a parent tab.

#### Creating a Manual Dropdown

1. **Create a parent tab**
   This can be any tab, or create a "folder" tab by leaving the URL blank (see Folder-Style Tabs below).

2. **Drag a tab onto the parent**
   Click and hold a tab, then drag it over another tab. Release when you see the drop indicator.


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
