---
layout: v3
title: Profiles
description: Use profiles to keep separate sets of tabs for different Salesforce orgs and switch between them automatically.
---

# Profiles

Profiles let you keep separate sets of tabs for different Salesforce orgs, projects, or work contexts. Each profile has its own tabs, and a tab can belong to more than one profile at a time.

<div class="v3-shot">Screenshot: the profile switcher open in the popup header, listing several profiles</div>

## Enabling Profiles

1. **Open Settings**
   Click the gear icon in the popup.

2. **Enable the Profiles feature**
   In the Profiles tile, check "Enable Profiles".

3. **Manage your profiles**
   Still in Settings > Profiles, you'll find the list of profiles. This is where you create, edit, and delete them.

4. **Switch profiles from the popup**
   Once Profiles are enabled, a profile button appears in the popup header. Use it to switch which profile's tabs you're looking at.

## Creating a New Profile

1. **Go to Settings > Profiles**
   Click the gear icon, then open the Profiles section.

2. **Click "Create New Profile"**
   This opens the profile creation wizard.

3. **Choose a starting point:**

<div class="v3-shot">Screenshot: the profile creation wizard's starting point step</div>

   - **Start empty:** Begin with no tabs and add them manually.
   - **Start with the default tabs:** Begin with the standard set of tabs (Flows, Users, Profiles, etc.).
   - **Copy an existing profile:** Duplicate the tabs from a profile you already have.

4. **Name your profile**
   Enter a descriptive name (up to 30 characters).
   Examples: "Work - Production", "Sandbox - Dev", "Client - Acme Corp".

5. **Save the profile**
   Your new profile is created and ready to use.

## Switching Between Profiles

There are two ways to switch profiles: manually, from the popup, or automatically, based on the org you're in.

### Manual Switching

1. **Click the profile button**
   It's in the popup header and shows your current profile's name.

2. **Select a profile from the dropdown**
   All your profiles are listed.

3. **The extension switches immediately**
   Your tabs update to show the selected profile's tabs.

Two orgs open in separate browser windows each keep their own profile — switching in one window doesn't affect the other.

### Automatic Switching (Org Matching)

Set up profiles to automatically switch based on the Salesforce org you're visiting.

1. **Enable Auto-Switch in Settings**
   Go to Settings > Profiles and turn on "Auto-Switch Profiles".

2. **Edit a profile**
   Open the profile you want to link to an org, from the Profiles manager.

3. **Add the org's identifier**
   Enter the org identifier from the URL — for example `acme` or `acme--dev1`.
   There's a button to capture the current org automatically, rather than typing it, if you're already on that org's page.

<div class="v3-shot">Screenshot: a profile's edit screen with the org identifier field and the “Add the org I’m on” button</div>

4. **Test automatic switching**
   Navigate to a Salesforce org that matches one of your linked identifiers. SF Tabs automatically switches to the matching profile.

3.0 recognizes many more org types when matching, including sandboxes, Developer Edition orgs, scratch orgs, demo orgs, patch orgs, and Trailhead Playgrounds. Experience Builder pages resolve to the same org as their Lightning pages, so a single identifier covers both.

**When auto-switch is on and the current org is linked to a profile**, the profile switcher is locked and shows a note naming that profile — auto-switch has already decided, so a manual switch wouldn't hold. On an org that isn't linked to any profile, switching works normally and your choice sticks.

## Managing Profiles

### Default Profile

One profile is always marked as the default, shown with a star. This is the profile used when auto-switch is on but the current org doesn't match any linked profile.

### Editing a Profile

1. **Open Settings > Profiles**
2. **Select the profile you want to edit**
3. **Update its name or linked org identifiers**
4. **Save your changes**

### Deleting a Profile

1. **Open Settings > Profiles**
2. **Select the profile you want to delete**
3. **Confirm deletion when prompted**

**Note:** You cannot delete the active profile. Switch to another profile first.

### Renaming a Profile

1. **Open Settings > Profiles**
2. **Select the profile**
3. **Change its name**
   A character counter shows how much of the 30-character limit remains.
4. **Save your changes**

### Adding a Tab to Multiple Profiles

Edit any tab and tick the profiles it should appear in. A tab isn't limited to a single profile — it shows up in every profile you check.

## Profile Best Practices

**Organize by Org Type**
- Create separate profiles for Production, Sandbox, Developer Edition, and Scratch orgs.
- Example: "Prod", "UAT Sandbox", "Dev Sandbox", "Scratch".

**Organize by Project or Client**
- Useful for consultants managing multiple client orgs.
- Example: "Client - Acme", "Client - Globex", "Internal".

**Organize by Role or Responsibility**
- Different tabs for admin work vs. development vs. configuration.
- Example: "Admin Tasks", "Development", "User Support".

**Link Orgs for Automatic Switching**
- Add org identifiers to your frequently-used profiles.
- Saves time by automatically showing the right tabs when you switch orgs.

**Keep Profile Names Short**
- Use abbreviations or short names for better display in the UI.
- The 30-character limit is enforced.

## Disabling Profiles

If you want to return to a single set of tabs:

1. Go to Settings > Profiles.
2. Uncheck "Enable Profiles".
3. Choose which profile's tabs to keep.
4. All other profiles will be removed.

This action cannot be undone, so [export]({{ '/v3/import-export' | relative_url }}) a backup first if needed.
