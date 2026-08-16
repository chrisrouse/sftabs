---
layout: v3
title: Settings
description: Every SF Tabs setting explained, from theme and compact mode to profiles, org colors, and the floating button.
---

# Settings

Settings now live inside the popup itself. Click the gear icon in the bottom-right corner of the popup to open the Settings hub — a set of tiles, one per section. Click a tile to open that section in place; click back to return to the hub.

<img width="781" height="550" alt="sftabs-settings" src="https://github.com/user-attachments/assets/e3fa6ce0-bd04-425f-b328-a9ce066eb101" />

## General

<div class="v3-setting" markdown="1">

<img width="377" height="443" alt="sftabs-settings-general" src="https://github.com/user-attachments/assets/39b2e3d3-5ee9-4e2a-8f7f-fd25aa0bebec" />

<div markdown="1">

| Setting | What it does |
| --- | --- |
| Theme Mode | Light, Dark or System |
| Compact Mode | Reduces tab item height |
| Skip Delete Confirmation | Delete tabs without a prompt |

</div>

</div>

## Tabs

<div class="v3-setting" markdown="1">

<img width="376" height="443" alt="sftabs-settings-tabs" src="https://github.com/user-attachments/assets/22e3066c-aa4f-459a-9daa-7d8484e9106f" />

<div markdown="1">

| Setting | What it does |
| --- | --- |
| Color-code tabs | Give individual tabs a color. Tabs without one keep the standard look. |
| Color style | How the color appears on a tab — dot or tint |
| Quick Add in the Salesforce menu bar | Adds a + at the end of your tabs that captures the current page without opening this popup |

</div>

</div>

## Profiles

<div class="v3-setting" markdown="1">

<img width="375" height="502" alt="sftabs-settings-profiles" src="https://github.com/user-attachments/assets/56eefd48-337e-481b-acae-c421bf442a51" />

<div markdown="1">

| Setting | What it does |
| --- | --- |
| Enable Profiles | Separate tab sets for different orgs |
| Auto-Switch Profiles | Automatically switch to the appropriate profile based on the current Salesforce org's URL |
| Quick Add adds to all profiles | A page captured with Quick Add lands in every profile, not just the active one |

Auto-Switch Profiles and Quick Add adds to all profiles only appear once Enable Profiles is turned on.

</div>

</div>

This is the short version — see the full [Profiles]({{ '/v3/profiles' | relative_url }}) page for how to create, switch, and match profiles to orgs.

## Button

SF Tabs can put your tabs one click away on every Salesforce page, either as a floating button, a menu in Salesforce's own header, or both.

<div class="v3-setting" markdown="1">

<img width="369" height="826" alt="sftabs-settings-button" src="https://github.com/user-attachments/assets/7415e38e-7065-4595-adaa-41a10aaadca4" />

<div markdown="1">

| Setting | What it does |
| --- | --- |
| Enable floating button | Show a floating button on Salesforce pages for quick tab access |
| Show a menu in the Salesforce header | Adds a bookmark button to Salesforce's own header, beside Favorites, that opens your tabs. Works alongside the floating button or on its own. |
| Edge | Which side it docks to, left or right |
| Offset from top | In pixels, so it stays put when the window resizes |

The floating button also has a layout choice — edge drawer (handle), round button, or labeled pill — and a location choice — everywhere, only in Setup, or outside Setup.

</div>

</div>

See [Quick Access]({{ '/v3/quick-access' | relative_url }}) for more on how these show up on the page.

## Org Colors

<div class="v3-setting" markdown="1">

<img width="368" height="819" alt="sftabs-settings-org-colors" src="https://github.com/user-attachments/assets/d3b26a6e-a099-4002-a548-7e0200a0b65b" />

<div markdown="1">

| Setting | What it does |
| --- | --- |
| Color the browser tab icon | Tints the Salesforce icon in your browser tab so you can tell orgs apart at a glance |
| Show a banner on the page | A colored bar across the top of every Salesforce page, in the same color as the tab icon |
| Include the org name | Shows "ACME--DEV1 · SANDBOX" rather than just "SANDBOX" — useful across several sandboxes of one org |
| Where the banner appears | Everywhere, only in Setup, or outside Setup — the same three choices the floating button offers |

Environments start at Production and Sandbox. Add the rest — Developer Edition, Trailhead Playground, scratch, demo and patch orgs — from the picklist under the table.

</div>

</div>

See [Org Colors]({{ '/v3/org-colors' | relative_url }}) for how colors are chosen and applied.

## Data

<div class="v3-setting" markdown="1">

<img width="376" height="501" alt="sftabs-settings-data" src="https://github.com/user-attachments/assets/827fa502-eeba-47b0-946e-a6dbba024735" />

<div markdown="1">

| Setting | What it does |
| --- | --- |
| Storage location | Sync or Local — where your tabs and settings are stored |
| Reset to Defaults | Reset all tabs and settings to their default values |

</div>

</div>

## Links

Two tiles in the Settings hub open a page instead of a section:

- **Import & Export** — see [Import & Export]({{ '/v3/import-export' | relative_url }})
- **User Guide** — opens this documentation site
