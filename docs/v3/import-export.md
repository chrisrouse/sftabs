---
layout: v3
title: Import & Export
description: Back up, share, or migrate your SF Tabs configuration, and choose where your data is stored.
---

# Import & Export

Import & Export is reached from the Settings hub in the popup — click the "Import & Export" tile. It's the only part of Settings that isn't in the popup: it opens as its own page in a browser tab, because extension popups handle file pickers badly.

<img width="767" height="503" alt="import-export-page" src="https://github.com/user-attachments/assets/ad44e22b-a397-4805-a3a4-d237886f9f8d" />

## Export Configuration

You can back up your configuration or share it with team members.

- **Everything (Recommended)** — Exports all tabs, settings, and profiles to a single JSON file.
- **Custom Selection** — Choose to export Settings (preferences, theme, and options) and/or specific profiles. Use this if you already use SF Tabs on another device and only need to export certain profiles, or if you're sharing a configuration with a co-worker.

Exported files record which version of SF Tabs wrote them.

<img width="774" height="803" alt="export-options" src="https://github.com/user-attachments/assets/c5d6cfe8-f0cf-4a92-bf4b-4db030886131" />

## Import Configuration

Import a JSON file that was exported from SF Tabs, whether it's an older file or a newer one — the import tool identifies the file and offers the right options for it:

- Add the imported tabs to your existing tabs
- Overwrite your existing tabs
- Create a new profile

If the imported file contains several profiles, Profiles are enabled and you choose which ones to import.

<img width="777" height="961" alt="import-options" src="https://github.com/user-attachments/assets/8e2cdb02-2a77-4e9c-9688-665cb3126275" />

## Migrate from the Why Salesforce Extension

You can also import a file exported from the Why Salesforce extension. Select that file using the normal import steps above, and SF Tabs will bring in your tabs.

## Storage

Set in Settings > Data — choose where your tabs and settings live:

- **Sync** — Keeps data in your browser's sync storage, so it follows you between computers signed into the same browser profile. Sync storage is small, so large tab sets are split into chunks to fit.
- **Local** — Keeps data on this device only, with far more room to work with.

Either way, your data stays in your browser — SF Tabs does not send it anywhere.

"Reset to Defaults" in Settings > Data resets all tabs and settings.

We recommend exporting a backup before switching storage or disabling profiles.
