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
## 3.0.0
A new look, a pile of color, and a few things that quietly never worked before.

**Settings finally live where you'd look for them**
No more hunting for a separate settings page in another browser tab. Everything's in the extension now, sorted into tiles — General, Tabs, Profiles, Org Colors, Button and Data — so you can find a switch without remembering where you left it. The standalone page still exists, but it's earned its retirement: Import & Export only.

**Tell your orgs apart at a glance**
Production and a sandbox look identical in a row of browser tabs, right up until the moment they really don't. Now every Salesforce tab's icon can carry a color, picked automatically from the kind of org you're in. Red for production, green for sandboxes, and you can change any of that. Got three sandboxes in the same org? Give each its own color — the web address can't tell them apart, so this is the only thing that can.

**Color-code your tabs, too**
Individual tabs in the Salesforce menu bar can each take a color, as a small dot or a full tint. Off unless you want it, and if you turn it off later your colors are still there waiting.

**SF Tabs, right in the Salesforce header**
There's now an optional bookmark menu sitting next to Salesforce's own Favorites, styled to look like it belongs there. Use it instead of the floating panel, or run both.

**Grab the page you're on, without stopping**
Turn on the "+" at the end of your tabs and capture whatever page you're looking at without opening the extension at all. There's also a setting to drop captured pages into every profile at once, if you keep your profiles in sync.

**One tab, many profiles**
Editing a tab now lets you tick the profiles it should appear in. No more building the same tab four times and getting the URL slightly wrong on the third one.

**Pick a shape for the floating panel**
Edge drawer, round button, or a labeled pill. Dock it left or right, and set how far down it sits in actual pixels — so it stops wandering when you resize the window or open devtools.

**New profiles don't have to start from nothing**
Start empty, start with the default tabs, or copy a profile you already have and prune from there.

**Profiles now work in orgs where they never did**
Scratch orgs, Developer Edition, demo orgs, patch orgs and Trailhead Playgrounds were invisible to profile matching, so auto-switching just sat there doing nothing. All recognized now.

**Two orgs, two windows, two sets of tabs**
Open different orgs in separate windows and each keeps its own tabs. Previously whichever profile you touched last hijacked every window.

## 2.1.2
**Fixes an issue with data storage**
When switching between Sync and Local Storage options. Stale data could get left behind which have caused data loss if you switched back and forth between storage options.

**Release Notes**
You found them! New releases will now have release notes published on [github](https://github.com/chrisrouse/sftabs/releases) and available in the extension. After you've had a chance to read the release notes, check the box to hide them. The next time there is an update, you'll be shown the new notes.