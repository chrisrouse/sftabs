---
layout: default
title: Settings
---

# Settings

Access the Settings page by clicking the gear icon <img src="{{ '/assets/images/icons/settings.svg' | relative_url }}" alt="Settings" style="display: inline; height: 1.2em; vertical-align: middle;"> in the extension popup. This opens a dedicated settings page with organized sections for all configuration options.

## General

### Appearance

Choose how the extension looks:
- **Light:** Light color scheme optimized for daytime use
- **Dark:** Dark color scheme for low-light environments
- **System:** Automatically matches your operating system's theme preference

<img width="759" height="297" alt="Screenshot 2026-01-02 at 8 11 49 AM" src="https://github.com/user-attachments/assets/aff3aebc-8955-4065-9641-c9366f16f667" />
<img width="412" height="302" alt="2026-01-02_08-13-29" src="https://github.com/user-attachments/assets/d9623eca-44ad-477b-b8d8-68b956e4eb2e" />

### Compact Mode

Enable compact mode to display more tabs in less space by:
- Hiding tab URLs in the popup
- Reducing padding and spacing between items

This is useful when you have many tabs and want to see more of them all at once in the extension popup.

<img width="453" height="140" alt="Screenshot 2026-01-02 at 8 12 43 AM" src="https://github.com/user-attachments/assets/241e9f11-28bd-4b14-95bf-515679d0113f" />
<img width="410" height="214" alt="Screenshot 2026-01-02 at 8 13 04 AM" src="https://github.com/user-attachments/assets/7fbdc6cc-ae1f-49d9-9f5b-50f37f47f8a8" />
<img width="411" height="158" alt="Screenshot 2026-01-02 at 8 13 14 AM" src="https://github.com/user-attachments/assets/ee356562-7c86-490f-a83d-664447fd125b" />

### Delete Confirmation

When enabled, tabs will be deleted immediately without showing a confirmation dialog. Use this if you're confident in your deletions and want a faster workflow.

<img width="371" height="118" alt="Screenshot 2026-01-02 at 8 52 54 AM" src="https://github.com/user-attachments/assets/8506c268-1a51-47f9-963f-acce3782b8c7" />
<img width="412" height="302" alt="2026-01-02_08-14-25" src="https://github.com/user-attachments/assets/514c80b1-622d-4231-b5fd-c235d3ae3eb3" />

## Floating Button

- **Enable floating button** This enables the button
- **Location** Choose where you want the button to be visibile. It can show on all pages, only in Setup, or only outside of Setup.
- **Position** Adjust the slider to set the vertical position of the floating button on the right side of the window. Setting it to close to 0% or 100% can have unexpected issues depending on the size of the window, so if you see any issues, adjust the position.

<img width="784" height="584" alt="Screenshot 2026-01-02 at 8 35 59 AM" src="https://github.com/user-attachments/assets/28ff4a47-7502-4263-9686-a18c752187a7" />

## Profiles

- **Enable Profiles** Enable this feature to create multiple tab configurations for different Salesforce orgs or work contexts. See the [Profiles](/profiles) page for complete documentation.
- **Auto-Switch Profiles** When enabled, Profiles can use URL matching to automatically switch the active profile for the current tab.
- **Disable Profiles** When you disable profiles, you will need to select one profile to keep as th new default set of tabs. All other profiles will be deleted from storage and cannot be retrieved, so you may want to export your data first.

<img width="811" height="615" alt="Screenshot 2026-01-02 at 8 38 35 AM" src="https://github.com/user-attachments/assets/4efac4d6-69d3-4e35-a7ba-13d7c36f46b4" />

## Keyboard Shortcuts

Configure keyboard shortcuts to quickly access your first 10 tabs by position. See the [Keyboard Shortcuts](/keyboard-shortcuts) page for detailed setup instructions.

<img width="780" height="341" alt="Screenshot 2026-01-02 at 8 41 36 AM" src="https://github.com/user-attachments/assets/58fde083-9861-4daa-b11d-2f91ae0f3512" />

## Data

Control how your tabs are stored and whether they sync across devices.

- **Enable cross-device sync** When this is enabled, SF Tabs will store information in your browser's sync storage system, allowing it to be shared across all of your computers where SF Tabs is installed. This is the recommended configuration for most users, however, it is opt-in, so you will need to enable it. Once enabled, your data will be migrated from local storage to sync storage. We recommend making a backup of your data first or changing before you start adding tabs in order to avoid data loss if there are any issues. If Profiles are enabled, those will also be synced.
- **Reset** Use this to reset SF Tabs to the original settings.
  
<img width="782" height="504" alt="Screenshot 2026-01-02 at 8 48 13 AM" src="https://github.com/user-attachments/assets/0a01bc91-149b-4303-a259-4848c1eb47ee" />

**Sync Storage (Cloud):** Tabs stored in browser's sync storage, automatically syncs across devices
  - Limited to approximately 50 tabs due to browser sync storage limits (8KB total storage)
  - Data is automatically split into smaller chunks to work within browser limitations
  - Recommended for most users

**Local Storage:** Tabs stored only on this device
  - No practical limit on number of tabs (several MB available)
  - Does not sync to other devices
  - Useful if you have many tabs or device-specific configurations

**Note:** Regardless of which storage option you choose, all data remains in your browser or managed by your browser's sync system. SF Tabs doesn't not send your data anywhere else.


## Import/Export Configuration

You can backup your configuration or share it with team members.

### Export Configuration

- **Everything (Recommended)** Choose this option to exprot all tabs, settings, and profiles to a JSON file.
- **Custom Selection** When you choose this option, you'll be able choose if you want to export Settings (Preferences, theme, and options) and/or specific profiles. Use this option if you alreday use SF Tabs on another device and only need to export certain profiles or if you are sharing a configuration with a co-worker.

### Import Configuration
Import a JSON file that was exported from SF Tabs on a different computer or to restore a backup. Whether you are importing an older JSON file (pre-v2.0) or a newer file, the import tool will properly identify the file and show the correct import options.

- **Importing v1 configuration, profiles not enabled** If you import a file that was exported from an older version of SF Tabs and you have not enabled Profiles yet, the import tool will ask if you want to add your tabs to your existing configuration or replace your current tabs.

<img width="751" height="498" alt="Screenshot 2026-01-02 at 10 55 59 AM" src="https://github.com/user-attachments/assets/fe36b992-3bf2-476f-96e3-cd5359807d23" />

- **Importing v1 configuration, profiles are enabled** If you import a file that was exported from an older version of SF Tabs and you have enabled Profiles, you will be able to choose if you want to add your tabs to an existng Profile, overwrite an existing profile, or create a new Profile.
  
<img width="756" height="575" alt="Screenshot 2026-01-02 at 11 03 29 AM" src="https://github.com/user-attachments/assets/63ca2bd2-7ec3-4333-b33d-e4b0e3fa3ea9" />


- **Importing v2 configuration, profiles not enabled** When importing a v2 configuration file, there are a couple of possible outcomes. If you are importing a configuration where Profiles were not enabled, then you will have the option to create a new Profile and Enable Profiles, add to the existing configuration of tabs, or overwrite the existing configuration of tabs. Even if Profiles are not enabled, you always have one called "Default". If you are importing a file from a configuration that contains multiple Profiles, then Profiles will be enabled automatically and you can choose which Profiles to import.

<img width="755" height="545" alt="Screenshot 2026-01-02 at 11 24 59 AM" src="https://github.com/user-attachments/assets/eeb491d1-c190-4361-91b9-96be3d7f2c27" />  
<img width="753" height="578" alt="Screenshot 2026-01-02 at 10 59 33 AM" src="https://github.com/user-attachments/assets/b49b6d1b-8f8a-4ee0-be46-5332a60ee10c" />

- **Importing v2 configuration, profiles are enabled** If Profiles have been enabled, but your file only contains the one Default Profile, you will have options for adding to or overwriting an existing Profile or creating a new Profile. If you are importing a configuration that has multiple Profiles, then your imported Profiles will be imported but they do not replace any existing profiles.
  <img width="749" height="573" alt="Screenshot 2026-01-02 at 11 37 47 AM" src="https://github.com/user-attachments/assets/befd6f89-28ba-4f42-8436-89fd2ec2ec77" />
  <img width="747" height="445" alt="Screenshot 2026-01-02 at 11 32 07 AM" src="https://github.com/user-attachments/assets/dd83f904-0e6e-4f66-93f8-ccec0c14b803" />

