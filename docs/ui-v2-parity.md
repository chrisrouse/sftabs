# UI v2 Feature Parity Checklist

Tracks every user-facing capability of the shipped popup (`popup/popup.html`)
against the v2 popup (root `popup.html`) on branch `SLDS-V2-Base`.

Derived from the code, not from memory: 125 element ids in the old popup vs 51
in the new one, plus the module inventory and `DEFAULT_SETTINGS` keys.

**Status key**
- **Done** — implemented and exercised in the v2 popup
- **Delegated** — deliberately left to the advanced settings page
  (`popup/settings.html`), reachable from v2 Settings
- **Gap** — must be closed before release
- **Dropped** — intentionally not carried over

Reverting is always one line: `manifest.base.json` → `action.default_popup`.

---

## 1. Tab list and CRUD

| Capability | Status | Notes |
|---|---|---|
| Render tab list, sorted by position | Done | |
| Empty state | Done | |
| Click tab to navigate | Done | Builds URL from the active tab's origin; also tolerates a fully-qualified `/lightning/...` path |
| Open in new tab, per tab | Done | Toggle persists |
| Add tab | Done | |
| Edit tab (name, path, options) | Done | |
| Delete tab, honouring skip-confirmation | Done | |
| Duplicate tab | **Dropped** | `SFTabs.tabs.duplicateTab` exists but is unreachable in the shipped UI — no control, no caller, no i18n key. Not a parity gap; adding it would be new scope |
| Reorder via keyboard buttons | Done | Move up/down, visible on hover and focus |
| Reorder via drag | Done | Positional drop zones instead of production's 500ms hover delay |
| Reset to defaults | **Delegated** | Settings page, Data section |
| Compact mode affects list | Done | Density hooks; also hides badges/paths and shows a count chip |
| Tab type badge | Done | Shows `TAB` for Setup pages because `DEFAULT_TABS` carry `isSetupObject: false` — consider inferring from path |

## 2. Sub-items (dropdowns)

| Capability | Status | Notes |
|---|---|---|
| Nested rendering with expand/collapse | Done | Path-indexed, dotted numbering, child counts |
| Add item (root or nested) | Done | Inline form |
| Edit item | Done | Inline |
| Delete item, with nested count in prompt | Done | |
| Promote one level (grandchild → child, child → tab) | Done | Carries its subtree; translates path conventions |
| Reorder / re-nest via drag | Done | before / after / nest zones |
| Depth limit | Done | Parent → child → grandchild (`MAX_ITEM_DEPTH = 2`) |
| Populate from ObjectManager page | Done | Ports production's validation; stores only canonical fields |
| Refresh from page | Done | Same button, relabelled |
| Drag a tab onto a tab to group it | Done | Depth-checked |
| Staged edits with cancel | **Dropped** | v2 saves immediately, by decision |

## 3. Settings

All `DEFAULT_SETTINGS` keys are accounted for.

| Setting | Status | Notes |
|---|---|---|
| `themeMode` (light/dark/system) | Done | |
| `compactMode` | Done | |
| `skipDeleteConfirmation` | Done | |
| `profilesEnabled` | Done | Toggle persists |
| `useSyncStorage` | **Gap** | Radios render the current value but changing them does nothing. Shim now restores `saveUserSettings`'s sync↔local migration, so wiring is safe |
| `autoSwitchProfiles` | **Delegated** | Settings page, Profiles section |
| `activeProfileId` / `defaultProfileId` | Done | Switching reloads that profile's tabs |
| `floatingButton.*` (6 sub-keys) | **Delegated** | Settings page. Preserved on write by `patchSettings` |
| Advanced settings link | Done | Opens `popup/settings.html` |

## 4. Profiles

| Capability | Status | Notes |
|---|---|---|
| Active profile chip + switcher | Done | Colour derived from id hash; production has no colour field |
| Switch profile, broadcast to open SF tabs | **Gap** | Switches and reloads tabs, but does not message content scripts (`refresh_tabs`), so an open page keeps the old nav |
| Create / rename / delete profile | **Delegated** | Settings page |
| URL patterns, capture current domain | **Delegated** | Settings page |
| Auto-switch by URL | Done | Handled by `background.js`, unchanged |
| Disable profiles, keep one | **Delegated** | Settings page |

## 5. Onboarding, migration, notices

| Capability | Status | Notes |
|---|---|---|
| v1 → v2 data migration | Done | Headless `ensureUsableState()`; production's modal is unreachable now. Leaves legacy `customTabs` as a backup |
| Recover from interrupted migration | Done | Adopts existing profile |
| Recover stale `activeProfileId` | Done | Falls back to the default profile |
| Seed defaults on fresh install | Done | |
| First-launch wizard (setup choice) | Done | Settings > Debug has a Preview button that opens it read-only on a populated install |
| First-launch wizard — real run | Done | Shown only when production's `checkFirstLaunch()` returns `first-install`. Offers common tabs / empty / import, plus enable-profiles. Storage choice deliberately left out for now — `DEFAULT_SETTINGS` sync preference stands |
| Sync-data-detected screen | **Dropped** | v2 just reads the synced data |
| Release notes panel | Done | Content renders |
| Release notes gating (`seenReleaseNotesVersion`) | Done | Gate version is read from the panel's topmost `.rn-version-label`, so updating the notes updates the check. Same storage key as the old popup, so a dismissal there carries over. Bell stays visible; only the dot clears |
| Version label | Done | Footer reads `browser.runtime.getManifest().version`. Required adding `getManifest` to the browser-compat shim, which the v1-migration path was already calling |

## 6. Cross-cutting

| Capability | Status | Notes |
|---|---|---|
| Localization | **Gap** | Old popup has 113 `__MSG_` tokens; v2 has 0. `de` and `es` would regress to English |
| React to external storage changes | **Gap** | No `storage.onChanged` listener, so background auto-switch leaves a stale popup |
| Keyboard shortcuts (`open-tab-01..10`) | Done | `background.js`, unchanged |
| Import / export | **Delegated** | Settings page |
| Floating button on page | Done | Content script, unchanged |
| Injected page nav + sub-item flyouts | Done | Content script; active-tab matching fixed for duplicate URLs |
| Status messages | Done | Footer status line, wraps to two lines |

---

## Gaps, in release order

1. **Localization** — the only outright regression from what ships today.
2. **`storage.onChanged`** — stale popup after background profile switch.
3. **Profile switch broadcast** — open SF pages keep the previous nav until reload.
4. **Storage sync/local radios** — a visibly broken setting; risks users
   believing data stopped syncing. *On hold by decision until the rest is done.*

Deliberately deferred: migration wizard, sync-data-detected screen, staged
sub-item edits, duplicate tab (dead code in the shipped UI). Everything marked
**Delegated** needs no work — it is reachable through the advanced settings
page.

## Release-process note

`/release` (`.claude/commands/release.md`) still edits
`popup/js/popup-release-notes.js` and `popup/popup.html` — the *old* popup. Once
the manifest points at the v2 popup, it must instead rewrite the `.rn-version`
blocks in root `popup.html`; there is no `RELEASE_NOTES_VERSION` constant to
bump, because v2 derives the gate from the topmost `.rn-version-label`.

Separately, `manifest.base.json` is at 2.1.1 while CHANGELOG and the notes are
at 2.1.2, so the footer will read v2.1.1 until the manifest is bumped.
