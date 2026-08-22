---
layout: default
title: Profiles
---

# Profiles

Profiles allow you to create multiple sets of tabs for different Salesforce orgs, projects, or work contexts. Each profile can have its own unique collection of tabs.

<img width="389" height="307" alt="Screenshot 2025-12-25 at 1 25 39 PM" src="https://github.com/user-attachments/assets/307c2914-306a-413d-a5bb-6f464ff9930f" />

### Enabling Profiles

1. **Open Settings**
   Click the gear icon <img src="{{ '/assets/images/icons/settings.svg' | relative_url }}" alt="Settings" style="display: inline; height: 1.2em; vertical-align: middle;"> in the extension popup

2. **Enable the Profiles feature**
   In the Profiles section, check "Enable Profiles"

3. **Access the Profiles manager**
   Click the users icon <img src="{{ '/assets/images/icons/profiles.svg' | relative_url }}" alt="Profiles" style="display: inline; height: 1.2em; vertical-align: middle;"> in the extension popup header to manage profiles

## Creating a New Profile

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
   Navigate to a Salesforce org that matches one of your patterns. The extension automatically switches to the matching profile.

## Managing Profiles

### Default Profile

Click on the "D" icon to set the default profile. This profile is used when URL matching is enabled for sites not specified.

### Editing a Profile

1. **Open the Profiles manager**
   Click the users icon <img src="{{ '/assets/images/icons/profiles.svg' | relative_url }}" alt="Profiles" style="display: inline; height: 1.2em; vertical-align: middle;">

2. **Click the edit icon**
   Click the edit icon <img src="{{ '/assets/images/icons/edit.svg' | relative_url }}" alt="Edit" style="display: inline; height: 1.2em; vertical-align: middle;"> next to the profile

3. **Update the profile**
   Update the profile name or URL patterns

4. **Save your changes**
   Click "Save Profile"

### Deleting a Profile

1. **Open the Profiles manager**
   Click the users icon in the extension popup

2. **Click the delete icon**
   Click the delete icon <img src="{{ '/assets/images/icons/delete.svg' | relative_url }}" alt="Delete" style="display: inline; height: 1.2em; vertical-align: middle;"> next to the profile

3. **Confirm deletion**
   Confirm the deletion when prompted

**Note:** You cannot delete the active profile. Switch to another profile first.

### Renaming a Profile

1. **Open the Profiles manager**
   Click the users icon in the extension popup

2. **Click the edit icon**
   Click the edit icon <img src="{{ '/assets/images/icons/edit.svg' | relative_url }}" alt="Edit" style="display: inline; height: 1.2em; vertical-align: middle;"> next to the profile

3. **Change the profile name**
   Update the name (character counter shows remaining characters)

4. **Save your changes**
   Click "Save Profile"

## Profile Best Practices

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

## Disabling Profiles

If you want to return to a single set of tabs:

1. Go to Settings → Profiles
2. Uncheck "Enable Profiles"
3. Choose which profile's tabs to keep
4. All other profiles will be removed

This action cannot be undone, so export a backup first if needed.