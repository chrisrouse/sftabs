---
layout: v3
title: Settings
description: Every SF Tabs setting explained, from theme and compact mode to profiles, org colors, and the floating button.
---

# Settings

Settings now live inside the popup itself. Click the gear icon in the bottom-right corner of the popup to open the Settings hub — a set of tiles, one per section. Click a tile to open that section in place; click back to return to the hub.

<div class="v3-shot">Screenshot: the Settings hub inside the popup, showing the row of section tiles</div>

## General

| Setting | What it does |
| --- | --- |
| Theme Mode | Light, Dark or System |
| Compact Mode | Reduces tab item height |
| Skip Delete Confirmation | Delete tabs without a prompt |

## Tabs

| Setting | What it does |
| --- | --- |
| Color-code tabs | Give individual tabs a color. Tabs without one keep the standard look. |
| Color style | How the color appears on a tab — dot or tint |
| Quick Add in the Salesforce menu bar | Adds a + at the end of your tabs that captures the current page without opening this popup |

## Profiles

| Setting | What it does |
| --- | --- |
| Enable Profiles | Separate tab sets for different orgs |
| Auto-Switch Profiles | Automatically switch to the appropriate profile based on the current Salesforce org's URL |
| Quick Add adds to all profiles | A page captured with Quick Add lands in every profile, not just the active one |

Auto-Switch Profiles and Quick Add adds to all profiles only appear once Enable Profiles is turned on.

This is the short version — see the full [Profiles]({{ '/v3/profiles' | relative_url }}) page for how to create, switch, and match profiles to orgs.

## Button

SF Tabs can put your tabs one click away on every Salesforce page, either as a floating button, a menu in Salesforce's own header, or both.

| Setting | What it does |
| --- | --- |
| Enable floating button | Show a floating button on Salesforce pages for quick tab access |
| Show a menu in the Salesforce header | Adds a bookmark button to Salesforce's own header, beside Favorites, that opens your tabs. Works alongside the floating button or on its own. |
| Edge | Which side it docks to, left or right |
| Offset from top | In pixels, so it stays put when the window resizes |

The floating button also has a layout choice — edge drawer (handle), round button, or labeled pill — and a location choice — everywhere, only in Setup, or outside Setup.

<div class="v3-shot">Screenshot: the Button settings section showing edge, offset, layout and location controls</div>

See [Quick Access]({{ '/v3/quick-access' | relative_url }}) for more on how these show up on the page.

## Org Colors

| Setting | What it does |
| --- | --- |
| Color the browser tab icon | Tints the Salesforce icon in your browser tab so you can tell orgs apart at a glance |
| Show a banner on the page | A colored bar across the top of every Salesforce page, in the same color as the tab icon |
| Include the org name | Shows "ACME--DEV1 · SANDBOX" rather than just "SANDBOX" — useful across several sandboxes of one org |

See [Org Colors]({{ '/v3/org-colors' | relative_url }}) for how colors are chosen and applied.

## Data

| Setting | What it does |
| --- | --- |
| Storage location | Sync or Local — where your tabs and settings are stored |
| Reset to Defaults | Reset all tabs and settings to their default values |

<div class="v3-shot">Screenshot: the Data settings section with the Sync/Local radio buttons and Reset to Defaults button</div>

## Links

Two tiles in the Settings hub open a page instead of a section:

- **Import & Export** — see [Import & Export]({{ '/v3/import-export' | relative_url }})
- **User Guide** — opens this documentation site

## Keyboard Shortcuts

There is no keyboard shortcuts section in Settings anymore. Shortcuts are configured in your browser, not in SF Tabs. See [Keyboard Shortcuts]({{ '/v3/keyboard-shortcuts' | relative_url }}) for setup instructions.
