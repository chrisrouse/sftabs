# Changelog

All notable changes to SF Tabs are documented here. This file is the canonical source of truth for release notes — keep it updated first, then sync the popup HTML.

**Releasing a new version:**
1. Add a new `## [x.x.x.x]` section below with your changes
2. Update `RELEASE_NOTES_VERSION` in `popup/js/popup-release-notes.js`
3. Update the `#release-notes-panel` content in `popup/popup.html` to match
4. Paste this version's section into the GitHub Release body

---
## 2.1.1
**Import didn't work**
Fixed a bug where importing data wasn't working as expected in v2.x.x.

**Importing didn't create unique IDs**
If a duplicate tab existed in an import file, it wasn't guaranteed to import with a unique ID, which meant deleting one instance of the tab would delete all instances of that same tab.

## 2.1.0

### What's New

**German Translation**
SF Tabs has been translated to German! Thanks to Andreas Bruchwitz for reviewing the AI translations and making human corrections.

**Spanish Translation**
SF Tabs has been translated to Spanish! Thanks to Lucas Lorenzi for reviewing the AI translations and making human corrections. 

**Chrome, Firefox, and Edge extensions updated**
The latest version of SF Tabs is available for Chrome, Firefox, and Edge.

**Release Notes**
You found them! New releases will now have release notes published on [github](https://github.com/chrisrouse/sftabs/releases) and available in the extension. After you've had a chance to read the release notes, check the box to hide them. The next time there is an update, you'll be shown the new notes.