# Changelog

All notable changes to SF Tabs are documented here. This file is the canonical source of truth for release notes — keep it updated first, then sync the popup HTML.

**Releasing a new version:**
1. Add a new `## [x.x.x.x]` section below with your changes
2. Update `RELEASE_NOTES_VERSION` in `popup/js/popup-release-notes.js`
3. Update the `#release-notes-panel` content in `popup/popup.html` to match
4. Paste this version's section into the GitHub Release body

---
## 2.1.2
**Fixes an issue with data storage**
When switching between Sync and Local Storage options. Stale data could get left behind which have caused data loss if you switched back and forth between storage options.

**Release Notes**
You found them! New releases will now have release notes published on [github](https://github.com/chrisrouse/sftabs/releases) and available in the extension. After you've had a chance to read the release notes, check the box to hide them. The next time there is an update, you'll be shown the new notes.