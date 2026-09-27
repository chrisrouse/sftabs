# Open question: smarter profile import

**Status:** parked idea, no design or code yet. Raised during 3.0.2.

## Where import stands

As of 3.0.2, `importSelectedProfiles` in `popup/settings.js` matches profiles
by id only:

- A profile whose id is already installed is **replaced**, tabs included. This
  is restoring your own backup.
- Any other profile is **added** under its own id.
- Installed profiles the file doesn't mention are left alone.

Before 3.0.2 every imported profile got a new id, so restoring a backup added a
second copy of every profile. `test/profile-import.test.js` covers the current
behavior.

## What that still gets wrong

- **Same names, different ids.** A file from another install, such as a
  teammate's or a browser without sync, never matches by id. Its Dev1 lands
  beside your Dev1 as a duplicate, even when both clearly mean the same org.
- **Replace is the only option for a match.** You can't keep your tabs and add
  the file's.
- **No say in the outcome.** Replace-or-add is decided silently, and the options
  screen gives no preview of which profiles will be overwritten.

## Ideas

**Map imported profiles to installed ones.** List each profile from the file
with a target beside it: *New profile*, or one of your installed profiles.
Suggested defaults:

1. an installed profile with the same id
2. an installed profile with the same name, or linked to the same org
   (`urlPatterns`)
3. otherwise, *New profile*

**Choose replace or merge per mapped profile.**

- *Replace*: today's behavior.
- *Merge*: add the file's tabs to the installed profile's, skipping ones already
  there.

**Show the outcome before confirming**, e.g. "Dev1: 9 tabs replace 4" or "QA:
new profile, 10 tabs".

## Open questions

- **What makes two tabs "the same" when merging?** Tab id, destination (`path`
  plus `isCustomUrl`, `isObject`), or label? Ids drift between installs, and
  labels get renamed. Destination is probably the right key, but then which
  label and color win?
- **Dropdown items and nested tabs.** Merge them recursively, or treat each
  parent as a unit?
- **Imported settings that name profiles.** `activeProfileId` and
  `defaultProfileId` in the file refer to the file's ids. Once profiles can be
  remapped, these need translating through the mapping, or they'll point at
  profiles that don't exist.
- **Files that disagree with themselves.** The export that prompted this had two
  profiles with `isDefault: true`, and a `defaultProfileId` matching none of its
  profiles. Should import repair that, or pass it through?
- **Where does the extra UI go?** The import card on the settings page already
  has several conditional sections. A mapping table may need its own step.
