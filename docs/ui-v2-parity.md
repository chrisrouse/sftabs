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
| Tab type badge | n/a | Not a parity item: the shipped popup has no type badge (`popup-ui.js:210` renders the path "without badge"). It was introduced by this rebuild and has now been removed — it read `TAB` on every row once most tabs were setup pages. The left accent bar still colours by type. The `isObject`/`isCustomUrl`/`isSetupObject` flags are untouched: they pick the URL shape, so they are functional, not decorative |

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
| Refresh from page | Done | Same button, relabeled |
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
| `useSyncStorage` | Done | Confirmed before switching, then `migrateBetweenStorageTypes` runs *before* the preference is persisted — the reverse order silently strands the tabs. Covered by `npm test`. Enabling sync over another device's data refuses and points at the settings page, which has the conflict resolver |
| `autoSwitchProfiles` | Done | Toggle in the Profiles sheet, beside the linked orgs it acts on. Warns when it is on but no profile has a linked org |
| `activeProfileId` / `defaultProfileId` | Done | Switching reloads that profile's tabs |
| `floatingButton.*` (6 sub-keys) | **Delegated** | Settings page. Preserved on write by `patchSettings` |
| Advanced settings link | Done | Opens `popup/settings.html` |

## 4. Profiles

| Capability | Status | Notes |
|---|---|---|
| Active profile chip + switcher | Done | Color derived from id hash; production has no color field |
| Switch profile, broadcast to open SF tabs | Done | `broadcastTabRefresh()` sends `refresh_tabs` to the same setup-page URL set production uses |
| Create / rename / delete profile | Done | Profiles list in the tray, reachable from the switcher or Settings > Manage profiles. Delete removes the profile's tabs and refuses on the last one |
| URL patterns, capture current domain | Done | "Linked orgs" field on the profile form, with a capture action. Patterns are matched by exact equality against the org identifier, so capturing is the only reliable way to fill it |
| Auto-switch by URL | Done | Handled by `background.js`, unchanged |
| Disable profiles, keep one | **Delegated** | Settings page |

## 5. Onboarding, migration, notices

| Capability | Status | Notes |
|---|---|---|
| v1 → v2 data migration | Done | Headless `ensureUsableState()`; production's modal is unreachable now. Leaves legacy `customTabs` as a backup |
| Recover from interrupted migration | Done | Adopts existing profile |
| Recover stale `activeProfileId` | Done | Falls back to the default profile |
| Seed defaults on fresh install | Done | |
| First-launch wizard (setup choice) | Done | Shown only when production's `checkFirstLaunch()` returns `first-install`. Offers common tabs / empty / import, plus enable-profiles. Storage choice deliberately left out for now — `DEFAULT_SETTINGS` sync preference stands |
| Preview the wizard on a populated install | Done | Settings > Debug > Preview. Same code path, but the choice is described rather than applied |
| Sync-data-detected screen | **Dropped** | v2 just reads the synced data |
| Release notes panel | Done | Content renders |
| Release notes gating (`seenReleaseNotesVersion`) | Done | Gate version is read from the panel's topmost `.rn-version-label`, so updating the notes updates the check. Same storage key as the old popup, so a dismissal there carries over. Bell stays visible; only the dot clears |
| Version label | Done | Footer reads `browser.runtime.getManifest().version`. Required adding `getManifest` to the browser-compat shim, which the v1-migration path was already calling |

## 6. Cross-cutting

| Capability | Status | Notes |
|---|---|---|
| Localization | Done | 163 keys used, all translated. Static copy via `__MSG_` tokens and `i18n-helper.js`, runtime strings via a local `t()` helper. `en`/`de`/`es` are at 554 keys with no gaps — see `docs/localization.md` |
| React to external storage changes | Done | `installStorageListener()`. Acts only when the incoming value differs from state, so our own writes don't loop, and defers tab reloads while an edit is open |
| Keyboard shortcuts (`open-tab-01..10`) | Done | `background.js`, unchanged |
| Import / export | **Delegated** | Settings page |
| Floating button on page | Done | Content script, unchanged |
| Injected page nav + sub-item flyouts | Done | Content script; active-tab matching fixed for duplicate URLs |
| Status messages | Done | Footer status line, wraps to two lines |

---

## Gaps

None. Every capability the shipped popup has is either implemented here or
reachable through the advanced settings page.

Deliberately deferred: migration wizard, sync-data-detected screen, staged
sub-item edits, duplicate tab (dead code in the shipped UI). Everything marked
**Delegated** needs no work — it is reachable through the advanced settings
page.

## Release process

`/release` (`.claude/commands/release.md`) targets this popup: it bumps
`manifest.base.json`, regenerates `manifest.json`, and inserts a new
`.rn-version` block at the top of `#view-release-notes`. There is no release-notes
version constant — the unread badge is derived from that newest block, so adding
it is what arms the notification.

`popup/popup.html` and `popup/js/popup-release-notes.js` are frozen. They exist
only as a revert path via `action.default_popup`, and `/release` deliberately
leaves them alone.
