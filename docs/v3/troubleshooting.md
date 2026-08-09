---
layout: v3
title: Troubleshooting
description: Fixes for the most common SF Tabs issues, from missing tabs to storage and profile switching problems.
---

# Troubleshooting

## Tabs not appearing in Salesforce

- Make sure you're on a Salesforce Setup page (URL should contain `/lightning/setup/`)
- Try refreshing the page
- Check that the extension is enabled in your browser
- Check to see if the extension is requesting permissions to access your current domain

## Tab links not working

- Verify the path is correct for your org
- Make sure you have permission to access that Setup page
- Try using a different path format (Setup page name vs. Lightning URL)

## Settings not saving

- Check that the extension has storage permissions
- Try disabling and re-enabling the extension
- Clear browser cache and restart

## The org banner or tab icon color isn't showing

Check that the feature is switched on in Settings > Org Colors, and that the banner's location setting covers the page you are on.

## Switching profiles doesn't stick

If Auto-Switch Profiles is on and the current org is linked to a profile, auto-switch decides which profile is used there and the switcher is locked, showing a note naming that profile. See [Profiles]({{ '/v3/profiles' | relative_url }}).

## The header menu or floating button isn't there

Both are off by default and are enabled in Settings > Button. See [Quick Access]({{ '/v3/quick-access' | relative_url }}).

## Running out of storage

Sync storage is small; switch to Local in Settings > Data if you have a lot of tabs. See [Import & Export]({{ '/v3/import-export' | relative_url }}) to back up your data first.

## Still having issues?

Visit the [GitHub Issues](https://github.com/chrisrouse/sftabs/issues) page to report bugs or ask for help.
