# Build: Chrome Beta

Build a clean Chrome-ready zip for the beta release and optionally upload it to the current GitHub release.

---

## Chrome vs Firefox: What's Different

| Concern | Chrome | Firefox |
|---|---|---|
| Background script | `"background": { "service_worker": "background.js" }` | `"background": { "scripts": ["background.js"] }` |
| `browser_specific_settings` | Not needed (Chrome ignores it) | Required for gecko ID |
| Manifest version | MV3 (`service_worker`) | MV3 (`scripts` array) |
| Version format | `"x.x.x.x"` (4-part OK) | `"x.x.x"` preferred, but 4-part works |

`build-manifest.js chrome` handles the `service_worker` swap automatically from `manifest.base.json`.

---

## Step 1 — Verify and enforce required Chrome beta fields

Read `manifest.base.json` and verify:

1. **Version** matches the top entry in `CHANGELOG.md`. If they differ, **stop and tell the user** — do not build.

2. **Name** must be exactly: `"SF Tabs (Beta)"`

3. **Description** must be exactly:
   `"THIS EXTENSION IS FOR BETA TESTING. Add custom tabs to the Salesforce setup menu."`

If the name or description don't match, update `manifest.base.json` to the correct values before proceeding. Tell the user what was changed.

---

## Step 2 — Generate Chrome manifest

Run:
```
npm run manifest:chrome
```

This writes `manifest.json` with `background.service_worker: "background.js"` (true MV3 for Chrome/Edge).

Verify that `manifest.json` now contains `"service_worker"` and does **not** contain `"scripts"` in the background block.

---

## Step 3 — Build the zip

Run:
```
npm run build -- --overwrite-dest --filename=sftabs-chrome-{version}.zip
```

The output file will be:
```
web-ext-artifacts/sftabs-chrome-{VERSION}.zip
```

`web-ext-config.cjs` already excludes: `node_modules`, `.git`, `.claude`, `scripts/`, `manifest.base.json`, `build-manifest.js`, `*.md`, `.DS_Store`, `__MACOSX`, standard (non-beta) icons, and other dev artifacts.

---

## Step 4 — Report

Tell the user:
1. The zip filename and path
2. The version that was packaged
3. Whether the manifest correctly uses `service_worker`
4. What name and description are in the build

Then ask: **"Upload this zip to the current GitHub release?"**

---

## Step 5 — Upload to GitHub release (only if user confirms)

Find the matching GitHub release tag (e.g. `v2.0.1.0-beta`) and upload the zip as a release asset:

```
gh release upload TAG web-ext-artifacts/FILENAME.zip
```

After uploading, provide the release URL so the user can verify.
