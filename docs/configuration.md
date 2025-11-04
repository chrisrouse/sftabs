---
layout: default
title: Configuration Reference
nav_order: 5
description: "SF Tabs configuration file format reference"
permalink: /configuration
---

# Configuration Reference
{: .no_toc }

This page documents the SF Tabs configuration file format, which is used when importing and exporting settings.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Configuration File Structure

The configuration file is a JSON file with two main sections:

- `customTabs` - Array of tab definitions
- `userSettings` - Global user preferences

---

## Custom Tabs

Each tab in the `customTabs` array has the following properties:

| Property | Type | Required | Description |
|:---------|:-----|:---------|:------------|
| `id` | string | Yes | Unique identifier for the tab. Format: `default_tab_*` or `tab_[timestamp]_[random]` |
| `label` | string | Yes | Display name of the tab |
| `path` | string | Yes | URL path or Setup page name |
| `openInNewTab` | boolean | Yes | Whether to open the tab in a new browser tab |
| `isObject` | boolean | No | Whether this is an Object Manager tab |
| `isCustomUrl` | boolean | No | Whether this uses a custom Lightning URL path |
| `position` | number | Yes | Display order of the tab (0-indexed) |

### Example Tab Definitions

#### Setup Page Tab

```json
{
  "id": "default_tab_flows",
  "label": "Flows",
  "path": "Flows",
  "openInNewTab": true,
  "isObject": false,
  "position": 0
}
```

#### Object Manager Tab

```json
{
  "id": "tab_1755611450913_671",
  "label": "Copado User Story List",
  "path": "copado__User_Story__c/list",
  "openInNewTab": true,
  "isObject": true,
  "isCustomUrl": false,
  "position": 9
}
```

#### Custom URL Tab

```json
{
  "id": "tab_1752504693080_749",
  "label": "DigExp",
  "path": "lightning/cms/home",
  "openInNewTab": true,
  "isObject": false,
  "isCustomUrl": true,
  "position": 8
}
```

---

## User Settings

The `userSettings` object contains global preferences:

| Property | Type | Options | Description |
|:---------|:-----|:--------|:------------|
| `themeMode` | string | "light", "dark", "system" | Visual theme for the extension popup |
| `compactMode` | boolean | true, false | Whether to use compact display mode |
| `skipDeleteConfirmation` | boolean | true, false | Whether to skip confirmation when deleting tabs |

### Example User Settings

```json
{
  "themeMode": "light",
  "compactMode": true,
  "skipDeleteConfirmation": true
}
```

---

## Complete Configuration Example

Here's a complete configuration file example:

```json
{
  "customTabs": [
    {
      "id": "default_tab_flows",
      "label": "Flows",
      "path": "Flows",
      "openInNewTab": true,
      "isObject": false,
      "position": 0
    },
    {
      "id": "default_tab_users",
      "label": "Users",
      "path": "ManageUsers",
      "openInNewTab": true,
      "position": 1,
      "isObject": false,
      "isCustomUrl": false
    },
    {
      "id": "tab_1752504693080_749",
      "label": "Digital Experience",
      "path": "lightning/cms/home",
      "openInNewTab": true,
      "isObject": false,
      "isCustomUrl": true,
      "position": 2
    }
  ],
  "userSettings": {
    "themeMode": "light",
    "compactMode": true,
    "skipDeleteConfirmation": true
  }
}
```

---

## Common Setup Page Paths

Here are some commonly used Setup page paths:

| Setup Page | Path Value |
|:-----------|:-----------|
| Flows | `Flows` |
| Users | `ManageUsers` |
| Profiles | `EnhancedProfiles` |
| Permission Sets | `PermSets` |
| Installed Packages | `ImportedPackage` |
| Custom Metadata Types | `CustomMetadata` |
| Sites | `SetupNetworks` |
| Paused Flows | `Pausedflows` |
| Process Builder | `ProcessAutomation` |
| Apex Classes | `ApexClasses` |
| Apex Triggers | `ApexTriggers` |
| Lightning Components | `LightningComponentBundles` |

---

## Sharing Configurations

Configuration files can be shared with team members to standardize Setup tabs across your organization.

### Best Practices

- Use descriptive labels that are clear to all team members
- Order tabs by frequency of use
- Include only tabs that are relevant to your team
- Document any custom URLs or paths that might not be obvious
- Test the configuration in a sandbox before sharing

### Version Control

Consider storing your team's configuration file in version control (e.g., Git) to track changes over time.
