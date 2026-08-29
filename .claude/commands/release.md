You are helping with the SF Tabs release process. Follow these steps precisely.

## Your job

Take the version at the top of `CHANGELOG.md` and make the extension actually
say that version: bump the manifest, then sync the release notes into the popup.
Optionally create the GitHub release if the user asks.

`CHANGELOG.md` is the source of truth. Never invent release-note copy.

---

## Step 1 — Read CHANGELOG.md

Read `CHANGELOG.md` and take the **topmost** `## x.y.z` section (no brackets,
three parts). Extract:

- the version number (e.g. `2.1.2`)
- the entries beneath it — each is a `**Bold title**` line followed by a
  paragraph of description

Compare that version against `manifest.base.json`. If the manifest already
matches, say so and ask whether the user wants to re-sync the notes anyway or
add a new CHANGELOG section first — do not silently do nothing.

---

## Step 2 — Bump the version

Set `version` in **`manifest.base.json`** to the version from Step 1, then
regenerate the generated manifest:

```
npm run manifest:chrome
```

`manifest.json` is generated from `manifest.base.json` and is committed, so it
must be regenerated or the build ships the old version.

This step did not exist in the earlier version of these instructions, so the bump
depended on someone remembering it. That is how the repo came to hold 2.1.2 notes
against a 2.1.1 manifest: harmless while unreleased, but shipping in that state
would have shown the wrong version in the popup footer, which reads
`browser.runtime.getManifest().version`.

---

## Step 3 — Sync the release-notes panel in `popup.html`

The shipping popup is the root `popup.html`. Inside `#view-release-notes` →
`.rn-body` there is one `.rn-version` block per released version, newest first.

Insert a **new** block at the top of `.rn-body` for this version, keeping the
existing blocks below it:

```html
<div class="rn-version">
  <div class="rn-version-label">vVERSION</div>
  <ul class="rn-items">
    <li class="rn-item">
      <span class="rn-item-title">TITLE</span>
      <span class="rn-item-desc">DESCRIPTION</span>
    </li>
  </ul>
</div>
```

One `<li class="rn-item">` per CHANGELOG entry. The `**Bold title**` becomes
`rn-item-title`, its paragraph becomes `rn-item-desc`. Preserve any `<code>`
tags. Escape `&`, `<` and `>` in the copy.

**There is no version constant to update.** The unread-notes gate in
`js/popup.js` reads the topmost `.rn-version-label` and compares it to
`seenReleaseNotesVersion` in local storage, so adding the block above is what
arms the notification dot. Do not add a constant — that would be a second
source of truth that can drift.

Keep the `v` prefix in the label (`v2.1.2`); the gate strips it.

### Do not localize the notes

`.rn-item-title` and `.rn-item-desc` stay English, matching the shipped popup.
They are synced verbatim from `CHANGELOG.md`. Everything else in the panel is
already localized via `__MSG_` tokens — leave those alone. See
`docs/localization.md`.

### The old popup is frozen

`popup/popup.html` and `popup/js/popup-release-notes.js` belong to the previous
UI, which is kept only as a revert path (`manifest.base.json` →
`action.default_popup`). Do **not** update them. Their notes will lag, which is
acceptable for an emergency revert.

---

## Step 3b — Regenerate the docs release-notes page

```
npm run docs:release-notes
```

`docs/release-notes.md` is generated from `CHANGELOG.md` by
`scripts/build-release-notes.js` and is a section of the v3 docs site. Do not
write it by hand — run the command.

It exists as a generated copy because the docs site cannot read the changelog:
Jekyll's source is `docs/`, `CHANGELOG.md` is above it, and GitHub Pages runs
Jekyll in safe mode, so no plugin or symlink reaches outside the source
directory.

The page states the current version from `manifest.base.json`, so this must run
**after** Step 2. `test/release-notes-sync.test.js` re-runs the renderer and
fails if the committed page does not match, so a skipped sync shows up in
Step 4 rather than on the live site.

Also update `v3_version` in `docs/_config.yml` to the new version — it feeds the
docs header badge and footer, and the notice on the retained /v2/ pages.

---

## Step 4 — Verify

Run these and report the results:

```
npm test
node -e "console.log(require('./manifest.json').version)"
```

Then confirm the version in `manifest.json` matches the topmost
`.rn-version-label` in `popup.html` with the `v` stripped. If they differ, the
notification dot will fire for a version the user is not running.

---

## Step 5 — Report

Tell the user:

1. the version synced, and that both `manifest.base.json` and `manifest.json`
   were bumped
2. how many release-note items were written into `popup.html`
3. that `docs/release-notes.md` and `docs/_config.yml` were regenerated/updated
4. the `npm test` result
5. that a GitHub release is a separate step — `/release github`, or ask

---

## Optional: GitHub release (only when asked)

Only if the user runs `/release github` or explicitly asks:

- Confirm the tag name with the user before running anything. Existing tags use
  the `vX.Y.Z` form (`v2.1.1`).
- `gh release create vVERSION --title "vVERSION" --notes "CHANGELOG_SECTION"`
- Use the full entry list from that CHANGELOG section as the body.
