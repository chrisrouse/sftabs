You are helping with the SF Tabs release process. Follow these steps precisely.

## Your job

Sync the release notes from `CHANGELOG.md` into the extension popup, then update the version constant. Optionally create a GitHub release if the user asks.

---

## Step 1 — Read CHANGELOG.md

Read `CHANGELOG.md` and identify the **topmost** `## [x.x.x.x]` version section. Extract:
- The version number (e.g. `2.0.1.0`)
- All bullet points under `### What's New` for that version

---

## Step 2 — Update RELEASE_NOTES_VERSION

In `popup/js/popup-release-notes.js`, update the `RELEASE_NOTES_VERSION` constant to match the version from Step 1.

Also restore the version check in `init()` if it was commented out for testing — it should look like this:

```js
async init() {
  const result = await chrome.storage.local.get('seenReleaseNotesVersion');
  if (result.seenReleaseNotesVersion !== RELEASE_NOTES_VERSION) {
    document.getElementById('release-notes-button').style.display = '';
  }

  document.getElementById('release-notes-button').addEventListener('click', () => this.show());
  document.getElementById('release-notes-close-button').addEventListener('click', () => this.hide());
},
```

---

## Step 3 — Sync popup.html release notes panel

In `popup/popup.html`, replace the contents of the `<div class="release-notes-items">` block inside `#release-notes-panel` with new items generated from the CHANGELOG bullet points.

Each bullet point `- EMOJI **Title** — Description` becomes:

```html
<div class="release-notes-item">
    <div class="release-notes-item-icon">EMOJI</div>
    <div>
        <div class="release-notes-item-title">Title</div>
        <div class="release-notes-item-desc">Description</div>
    </div>
</div>
```

Preserve any `<code>` tags for inline code in descriptions. Keep the existing close button below the items block — do not modify it.

---

## Step 4 — Report

After making the changes, tell the user:
1. What version was synced
2. How many release note items were written to the popup
3. Whether the version check was restored in JS
4. Remind them: if they want a GitHub release, run `/release github` or ask you to create one using the CHANGELOG section as the body

---

## Optional: GitHub Release (only if user passes "github" as argument or asks for it)

If the user runs `/release github` or explicitly asks to create the GitHub release:
- Use `gh release create vVERSION --title "v VERSION" --notes "CHANGELOG_SECTION_CONTENT"`
- Use the full `### What's New` bullet list from the CHANGELOG section as the release notes body
- Ask the user to confirm the tag name before running the gh command
