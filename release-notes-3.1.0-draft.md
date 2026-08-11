## 3.1.0
Know which org you're in before you click, and a long list of things that were quietly losing your data.

**A banner across the top, naming the org you're in**
The colored favicon tells you which org a tab is at a glance in the tab strip. This tells you while you're actually looking at the page — which is where an action taken in the wrong org actually happens. It reads "ACME--DEV1 · SANDBOX", or just the environment if you'd rather, and it takes its color from the same place the favicon does, so the two can never disagree. Like the floating button, you choose where it shows up: everywhere, only in Setup, or everywhere but Setup.

**Dragging tabs in the Salesforce bar now sticks**
You could always drag them. They just went back where they were on the next refresh, which is why the bar and the popup never agreed on the order. The new order is saved now, and everything else follows it.

**Experience Builder pages know which org they belong to**
Builder pages weren't recognized as Salesforce orgs at all. The favicon stayed grey, and — less obviously — the floating panel and header menu showed whatever profile happened to be active instead of the one you set up for that org. Both fixed by the same change.

**The floating handle looks like itself again**
Open and closed, it's now the same blue-and-white control rather than two different-looking ones, and it's a little shorter. It also closes properly when you click away inside the Experience Builder canvas, which it never did.

**Import & Export is just Import & Export**
The page has been stripped back to the one job it has. The GitHub and Sponsor links moved into the popup's settings hub, and the version number down there is the real one now instead of a hardcoded 2.1.2.

**Your data stops leaking between storage areas**
Several things went wrong when switching between Sync and Local, or when a profile was large enough to be split across multiple storage entries. Exports missed tabs. Imports could silently drop settings. A large profile could be destroyed partway through a write. Switching storage left orphaned entries behind, and imported profiles could get a doubled prefix that hid them entirely. Exports now also record which version wrote them.

**Profiles stop stepping on each other**
Clicking New Profile no longer wipes the profile you were on. The popup no longer writes to the wrong profile or talks over itself. Auto-switching no longer clobbers settings you just changed.

**Settings reach the page without a reload**
Tab colors, and settings changes generally, now show up on open Salesforce pages immediately. Toggling one no longer makes the header, tab bar and panel flicker.

**Fixes**
- The floating button could vanish entirely, or ignore where you told it to appear
- The "+" in the menu bar and dragging in the tab bar were both dead on Chrome
- A keyboard shortcut pointed at a folder tab would hang
- Moving a tab into a folder dropped part of its Setup address
- Running out of storage threw an error instead of explaining what happened
- Tinted rows went black in dark mode instead of tinted
- The "+" and the overflow chevron could be dragged out of the bar
- On Firefox, the popup could get stuck open after the tray animation

**Accessibility**
The reorder arrows couldn't be reached by tabbing forward, and the Import & Export page announced nothing at all to a screen reader. Both fixed, along with a sweep of smaller defects.

**Under the hood**
The content scripts no longer leak observers and listeners as you navigate, and a pile of per-row and per-profile work that only needed doing once now only happens once.

---

## Editor's notes — delete before publishing

**Version number is a guess.** Six features since 3.0.0, so I drafted this as a minor bump. Change the heading if you'd rather ship it as something else.

**Deliberately left out:**

- *"Firefox content scripts could not see the shared modules"* (833bafa) — the one we just fixed. The regression was introduced on Aug 5, two days **after** 3.0.0 shipped, so no user ever received the broken build. Putting it in the notes would advertise a bug they never had. Add it back only if a build went out between Aug 5 and today.
- *"Format byte counts as people read them"* (d5025b8) — the only thing that used it was the file-picker proof of concept, which was reverted in c055aad. No user-visible effect.
- *The review prompt* (79ba43b) — a "Leave a review / No thanks" strip that appears once, two weeks after first use. Worth a line if you want to set expectations; left out on the grounds that announcing a prompt is odd. Your call.
- Twelve `chore`, seven `refactor` and four `docs` commits with no user-facing effect.

**Worth verifying before you publish.** Roughly half the fixes above were written during the Aug 3–5 refactor, and I could not always tell from the commit alone whether the bug existed in shipped 3.0.0 or was introduced and fixed within that same window. If it never reached a user, it doesn't belong in release notes. The ones I'm confident shipped broken in 3.0.0 are the Experience Builder org matching, the storage and import/export defects, and the floating button placement. The rest are worth a skim.
