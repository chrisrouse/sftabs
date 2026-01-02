---
layout: default
title: Managing Tabs
---

# Managing Tabs

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

5. **Review the dropdown items**
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
   Click and hold a tab, then drag it over another tab. Release when you see the drop indicator.

   <img width="412" height="295" alt="2025-12-31_15-01-04" src="https://github.com/user-attachments/assets/e2677c43-70ce-4dc3-9459-d03287f9ebd6" />

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

Click on the tab name to see the items included in the dropdown.

<img width="412" height="258" alt="2026-01-01_10-21-09" src="https://github.com/user-attachments/assets/55670dd4-5c79-4865-98db-bcbc97618e86" />

#### Reordering Items in a Dropdown

1. **Click on the parent tab's name**
   Open the dropdown items

2. **Drag items to reorder**
   In the dropdown items preview, drag items to reorder them

3. **Save your changes**
   Click Save to apply the new order

#### Editing Items in Dropdown

1. **Click the Edit icon**
   Click on Edit <img src="https://chrisrouse.github.io/sftabs/assets/images/icons/edit-button.svg" alt="Promote" style="display: inline; vertical-align: middle;"> next to an item in the dropdown preview to make changes to that menu item

#### Promoting Dropdown Items to Regular Tabs

1. **Click the promote icon**
   Click on the up arrow <img src="https://chrisrouse.github.io/sftabs/assets/images/icons/promote-button.svg" alt="Promote" style="display: inline; vertical-align: middle;"> to promote a dropdown item to a top-level tab

2. **Item becomes a top-level tab**
   The item becomes a regular top-level tab again

#### Removing Items from a Dropdown

1. **Open the parent tab's settings**
   Click the edit icon next to the parent tab

2. **Click the remove icon**
   Click the remove icon <img src="https://chrisrouse.github.io/sftabs/assets/images/icons/remove-button.svg" alt="Remove" style="display: inline; vertical-align: middle;"> next to the item

3. **Item is removed**
   The item is removed from the dropdown

#### Converting a Dropdown Back to a Regular Tab

1. **Remove all items from the dropdown**
   Delete or promote all dropdown items

2. **Tab automatically converts**
   The tab automatically becomes a regular tab


### Multi-level Dropdown Menus

SF Tabs supports up to three levels of nested dropdowns: Parent > Child > Tab

**Use Case Example:**
Create a folder that organizes your object tabs. The first level shows the object names and the second level shows the object menus.

**How to Create:**
1. Create your object tabs first
2. Drag them into the parent folder
3. You can nest folders up to three levels deep

**Note:** If you attempt to add a folder or tab that already has three levels into another folder or tab, an error will be shown. You can only have up to three levels of hierarchy.

<img width="412" height="490" alt="2026-01-02_07-36-47" src="https://github.com/user-attachments/assets/2c48383e-b43e-4c20-b10e-02c705576112" />

<img width="527" height="482" alt="Screenshot 2025-12-26 at 9 42 59 AM" src="https://github.com/user-attachments/assets/11bd77b9-2c61-4ba2-9d06-a1d468a9eba6" />

## Floating Button

This is a new feature added in v2.0. This new floating button allows you to have quick access to your custom tabs whether you are in Setup or elsewhere in Salesforce. It can be configured in [Settings](#settings).

<img width="166" height="270" alt="Screenshot 2026-01-02 at 8 16 42 AM" src="https://github.com/user-attachments/assets/4f3f57fe-8baa-403f-b066-905e59a17b17" />

<img width="339" height="287" alt="Screenshot 2026-01-02 at 8 21 47 AM" src="https://github.com/user-attachments/assets/67e985d8-dff2-486f-8dbd-012d18f66abe" />