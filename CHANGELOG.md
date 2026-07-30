# Changelog

All notable changes to SF Tabs are documented here. This file is the canonical source of truth for release notes — keep it updated first, then sync the popup HTML.

**Releasing a new version:**
1. Add a new `## x.y.z` section below, newest first, with your changes
2. Run `/release` — it bumps `manifest.base.json`, regenerates `manifest.json`,
   and syncs this section into the popup's release-notes panel
3. Run `/release github` (or ask) to create the GitHub release from this section

The popup derives its "new notes" badge from the newest version block in
`popup.html`, so there is no version constant to bump by hand.

---
## 2.1.2
**Fixes an issue with data storage**
When switching between Sync and Local Storage options. Stale data could get left behind which have caused data loss if you switched back and forth between storage options.

**Release Notes**
You found them! New releases will now have release notes published on [github](https://github.com/chrisrouse/sftabs/releases) and available in the extension. After you've had a chance to read the release notes, check the box to hide them. The next time there is an update, you'll be shown the new notes.