# Localization — strings awaiting de/es translation

The v2 popup is fully wired for i18n. Static copy in `popup.html` uses
`__MSG_key__` tokens substituted by `popup/js/shared/i18n-helper.js`; anything
`js/popup.js` builds at runtime goes through its local `t()` helper, because the
helper's DOM pass runs once at load and never sees generated markup.

**Nothing here is broken today.** `default_locale` is `en`, so Chrome falls back to
English for any key missing from `de`/`es`. These are the keys that will read
English until translated.

- Keys used by the v2 popup: **150**
- Already translated, reused from the shipped popup: **36**
- Awaiting de/es: **114**

## How to add a translation

Add the key to `_locales/de/messages.json` and `_locales/es/messages.json` with the
same shape as `en`. Where a row says **has placeholders**, keep every `$NAME$`
token and copy the `placeholders` block from `en` unchanged — its positional
`content` values are what bind the tokens to the call site.

`node scripts/json-to-csv.js` regenerates `_locales/messages.csv` if you would
rather hand translators a spreadsheet.

### Two things to watch

- **Plurals.** Chrome i18n has no plural rules, so counts use paired keys
  (`...One` / `...Many`), following the shipped popup. Languages needing more
  than two forms will need the call sites changed, not just the strings.
- **Sentence fragments.** `previewSummary` and `itemPromoted*` compose from
  fragments (`previewOutcome*`, `withSubItems*`, `stateOn`/`stateOff`). If a
  language cannot take the fragment in that position, say so rather than forcing
  it — the call site can be restructured.

## Not translated on purpose

- **Release-note bodies** in the What's New panel. `/release` syncs them verbatim
  from `CHANGELOG.md`, and the shipped popup leaves them English too.
- **Version labels** (`v2.1.1`) and the character counter (`0/30`) — digits only.
- **`SF Tabs`** itself, via the existing `extensionName` key.

## Header and landmarks (14)

| Key | English | Context |
|---|---|---|
| `skipToMainContent` | Skip to main content | Skip link for keyboard users, first focusable element in the popup |
| `ariaSwitchProfile` | Switch profile | Accessible name for the profile switcher button before a profile is known |
| `ariaQuickAdd` | Quick add a tab from the current Salesforce page | Accessible name for the Quick Add header button |
| `quickAddTitle` | Quick add from this page | Tooltip on the Quick Add header button |
| `ariaAddManually` | Add a tab manually | Accessible name and tooltip for the manual Add button in the header |
| `ariaViewReleaseNotes` | View release notes | Accessible name for the release-notes bell when there is nothing new |
| `ariaTabList` | Tab list | Accessible name for the left panel listing the user’s tabs |
| `ariaCustomTabs` | Custom tabs | Accessible name for the navigation element wrapping the tab list |
| `ariaDetailsPanel` | Details panel | Accessible name for the panel that expands to the right |
| `ariaRequired` | required | Accessible name for the asterisk marking a required field |
| `ariaThemeSelection` | Theme selection | Accessible name for the light/dark/system segmented control |
| `ariaExtensionControls` | Extension controls | Accessible name for the footer navigation |
| `ariaVersion` | Version $VERSION$ | Accessible name for the version label in the footer **has placeholders** |
| `ariaSwitchProfileNamed` | Profile: $NAME$ — switch profile | Accessible name for the profile switcher once the active profile is known **has placeholders** |

## Tab list rows (15)

| Key | English | Context |
|---|---|---|
| `emptyStateTitle` | No tabs yet | Heading shown when the user has no tabs |
| `emptyStateDesc` | Use Quick Add to capture the Salesforce page you’re on, or add one manually. | Description under the empty-tabs heading, naming the two ways to add a tab |
| `ariaOpenInNewTabOn` | Open in new tab: on — click to toggle off | Accessible name for the open-in-new-tab toggle while it is on |
| `ariaOpenInNewTabOff` | Open in new tab: off — click to toggle on | Accessible name for the open-in-new-tab toggle while it is off |
| `ariaTabType` | $TYPE$ tab | Accessible name for the small type badge on a tab row. $TYPE$ is a short abbreviation such as Obj, Setup, URL or Tab **has placeholders** |
| `srSubItems` | sub-items | Screen-reader-only word after a sub-item count badge |
| `ariaTabActions` | Actions for $NAME$ tab | Accessible name for the row action group **has placeholders** |
| `ariaMoveUpNamed` | Move $NAME$ up | Accessible name for the move-up button on a tab row **has placeholders** |
| `ariaMoveDownNamed` | Move $NAME$ down | Accessible name for the move-down button on a tab row **has placeholders** |
| `ariaManageSubItems` | Manage $COUNT$ sub-items in $NAME$ | Accessible name for the sub-items button when the tab already has some **has placeholders** |
| `ariaAddSubItems` | Add sub-items to $NAME$ | Accessible name for the sub-items button when the tab has none **has placeholders** |
| `subItemsTitle` | Sub-items | Tooltip on the button that opens a tab’s sub-item manager |
| `ariaEditNamed` | Edit $NAME$ | Accessible name for an edit button, naming what it edits **has placeholders** |
| `ariaDeleteNamed` | Delete $NAME$ | Accessible name for a delete button, naming what it deletes **has placeholders** |
| `deleteButtonTitle` | Delete | Tooltip on the delete icon button in a tab or sub-item row |

## Edit tab form (12)

| Key | English | Context |
|---|---|---|
| `editTabSubtitle` | Update this tab’s name and destination. | Subtitle under the Edit Tab heading |
| `ariaCloseEditPanel` | Close edit panel | Accessible name for the X that closes the edit panel |
| `tabPathPlaceholderFull` | /lightning/o/Account or full URL | Placeholder for the Tab Path field. Leave the path example as-is; translate only "or full URL" |
| `tabPathHint` | The Salesforce path or URL this tab navigates to. | Helper text under the Tab Path field |
| `tabOptionsLegend` | Tab Options | Legend for the checkbox group of tab flags |
| `tabIsObjectDesc` | Navigates to a Salesforce object list | Description under the Object tab checkbox |
| `tabIsCustomUrlDesc` | Uses a non-standard Salesforce URL | Description under the Custom URL checkbox |
| `tabOpenInNewTabLabel` | Open in new tab | Checkbox label for the per-tab option that opens the tab in a new browser tab |
| `tabOpenNewTabDesc` | Always opens in a new browser tab | Description under the Open in new tab checkbox |
| `saveTabButton` | Save Tab | Submit button in the tab edit form |
| `editingTabSubtitle` | Editing “$NAME$” | Subtitle of the edit panel while editing an existing tab **has placeholders** |
| `addTabSubtitle` | Create a new custom navigation tab. | Subtitle of the edit panel while adding a tab |

## Manage sub-items (21)

| Key | English | Context |
|---|---|---|
| `ariaManageItems` | Manage dropdown items | Accessible name for the Manage Items panel |
| `manageItemsTitle` | Manage Items | Heading of the panel for editing a tab’s sub-items |
| `manageItemsSubtitle` | Organize related links | Subtitle under the Manage Items heading |
| `ariaCloseManageItems` | Close dropdown management | Accessible name for the X that closes Manage Items |
| `addItemButton` | + Add item | Button that starts adding a sub-item. Keep the leading plus sign |
| `loadItemsButton` | Load items from this page | Button that reads navigation links off the current Salesforce page |
| `manageItemsHint` | Sub-items follow this tab's “Open in new tab” setting. Nesting goes two levels deep: child and grandchild. | Explanatory note at the bottom of the Manage Items panel |
| `itemsInTab` | Items in “$NAME$” | Subtitle of the Manage Items panel before the item count is known **has placeholders** |
| `noItemsYet` | No items yet | Shown in the Manage Items panel when a tab has no sub-items |
| `ariaCollapseNamed` | Collapse $NAME$ | Accessible name for the disclosure button when a sub-item list is open **has placeholders** |
| `ariaExpandNamed` | Expand $NAME$ | Accessible name for the disclosure button when a sub-item list is closed **has placeholders** |
| `ariaItemActions` | Actions for $NAME$ | Accessible name for a sub-item row’s action group **has placeholders** |
| `ariaAddItemUnder` | Add an item under $NAME$ | Accessible name for the button that nests a new item under this one **has placeholders** |
| `addSubItemTitle` | Add sub-item | Tooltip on the button that adds a child under a sub-item |
| `ariaPromoteToTab` | Move $NAME$ out to its own tab | Accessible name for the promote button on a child item **has placeholders** |
| `ariaPromoteLevel` | Move $NAME$ up one level | Accessible name for the promote button on a grandchild item **has placeholders** |
| `promoteToTabTitle` | Move out to its own tab | Tooltip on the promote button when the item would become a top-level tab |
| `promoteLevelTitle` | Move up one level | Tooltip on the promote button when the item would move from grandchild to child |
| `loading` | Loading… | Transient button label while sub-items are being read off the page |
| `itemLabelPlaceholder` | Label | Placeholder for a sub-item’s display name field |
| `itemPathPlaceholder` | Path or URL | Placeholder for a sub-item’s destination field |

## Settings (12)

| Key | English | Context |
|---|---|---|
| `compactModeDesc` | Reduces tab item height | Description under the Compact mode toggle |
| `skipDeleteConfirmationDesc` | Delete tabs without a prompt | Description under the Skip delete confirmation toggle |
| `enableProfilesDesc` | Separate tab sets for different orgs | Description under the Enable profiles toggle |
| `storageSectionTitle` | Storage | Settings section heading for where data is kept |
| `syncStorageCardDesc` | Syncs across all your devices | Description on the Sync storage option |
| `localStorageCardDesc` | This device only | Description on the Local storage option |
| `debugSectionTitle` | Debug | Settings section heading for developer tools |
| `previewFirstLaunchLabel` | Preview first-launch wizard | Label for the debug action that opens the welcome wizard read-only |
| `previewFirstLaunchDesc` | Opens the welcome screen without writing anything | Description for the preview action, stressing that no data changes |
| `previewButton` | Preview | Button that opens the first-launch wizard in preview mode |
| `ariaAdvancedSettings` | Open advanced settings in a new tab | Accessible name for the advanced settings link |
| `advancedSettingsLink` | Advanced settings — import, export, danger zone | Link to the full settings page |

## Release notes (4)

| Key | English | Context |
|---|---|---|
| `ariaReleaseNotesPanel` | Release notes | Accessible name for the release-notes panel |
| `releaseNotesSubtitle` | Recent updates to SF Tabs | Subtitle under the What’s New heading |
| `ariaCloseReleaseNotes` | Close release notes | Accessible name for the X that closes the release-notes panel |
| `releaseNotesDismissed` | Release notes dismissed | Status after the user checks “Don’t show again” and closes the notes |

## First-launch wizard and its preview (12)

| Key | English | Context |
|---|---|---|
| `firstLaunchSubtitle` | Pick a starting point. | Subtitle in the welcome wizard |
| `firstLaunchPreviewNote` | Preview — your saved tabs and settings won’t be touched. | Banner shown when the wizard is opened from Settings > Debug |
| `firstLaunchDefaultTabList` | Flows, Installed Packages, Users, Profiles, Permission Sets | Names of the seeded default tabs. These are Salesforce Setup page names — translate only if Salesforce localizes them in the target language |
| `firstLaunchEmptyDesc` | Add your own tabs as you go | Description of the start-empty option |
| `firstLaunchImportDesc` | Opens the settings page so you can load an export file | Description of the import option |
| `firstLaunchProfilesDesc` | Keep separate tab sets per org, switched manually or by URL | Description of the enable-profiles option in the wizard |
| `errorSetupDidNotFinish` | Setup didn’t finish: $ERROR$ | Error when the first-launch wizard fails to write initial data **has placeholders** |
| `previewOutcomeDefaultCount` | a Default profile with $COUNT$ tabs | Fragment describing what the wizard would have created. Used inside previewSummary **has placeholders** |
| `previewOutcomeDefault` | a Default profile with the default tabs | Fragment used when the number of default tabs is unknown. Used inside previewSummary |
| `previewOutcomeEmpty` | an empty Default profile | Fragment describing the start-empty choice. Used inside previewSummary |
| `previewOutcomeImport` | an empty Default profile, then opened the settings page to import | Fragment describing the import choice. Used inside previewSummary |
| `previewSummary` | Preview only — would have created $OUTCOME$, profiles $STATE$. Nothing was saved. | Status shown after closing the wizard in preview mode. $OUTCOME$ is one of the previewOutcome* fragments and $STATE$ is stateOn or stateOff **has placeholders** |

## Delete confirmation (2)

| Key | English | Context |
|---|---|---|
| `deleteTabConfirmTitle` | Delete Tab? | Title of the confirmation dialog shown before deleting a tab |
| `deleteTabConfirmBody` | Are you sure you want to delete $NAME$? This action cannot be undone. | Body of the delete-tab confirmation. $NAME$ is the tab name, shown in bold. **has placeholders** |

## Status and error messages (22)

| Key | English | Context |
|---|---|---|
| `ariaSwitchProfileMenu` | Switch profile | Accessible name for the open profile menu |
| `ariaStartingPoint` | Starting point | Accessible name for the wizard’s option group |
| `errorCouldNotSave` | Could not save: $ERROR$ | Status when a write to browser storage fails. $ERROR$ is the browser’s own message **has placeholders** |
| `errorCouldNotSaveSetting` | Could not save setting: $ERROR$ | Status when saving a single preference fails **has placeholders** |
| `nestingDepthLimit` | Too many levels — nesting stops at parent, child, grandchild. | Error when a drag or promote would nest deeper than three levels |
| `tabNestedUnder` | “$SOURCE$” moved under “$TARGET$” | Status after dragging one tab onto another to group it **has placeholders** |
| `noActiveTab` | No active browser tab detected. | Error when the popup cannot find the tab the user is looking at |
| `openObjectManagerFirst` | Open the $OBJECT$ Object Manager page in Setup, then try again. | Error when scraping sub-items but the content script is not present. $OBJECT$ is a Salesforce object name **has placeholders** |
| `errorReadingNavigation` | Could not read the page navigation. | Fallback error when the content script reports a failure with no message |
| `noNavigationItems` | No navigation items found on this page. | Error when the Salesforce page has no side navigation to import |
| `goToObjectInSetup` | Go to $OBJECT$ in Setup to load its list. | Error when the open page is not the Object Manager page for this tab **has placeholders** |
| `errorLoadingNavigation` | Could not load navigation: $ERROR$ | Error when importing sub-items throws **has placeholders** |
| `itemLabelRequired` | Item label is required. | Validation error when saving a sub-item with no label |
| `itemSaved` | “$NAME$” saved | Status after editing a sub-item **has placeholders** |
| `itemAdded` | “$NAME$” added | Status after adding a sub-item **has placeholders** |
| `itemPromotedToTab` | “$NAME$” moved out to its own tab$EXTRA$ | Status after promoting a sub-item to a top-level tab. $EXTRA$ is an optional “ with N items” clause **has placeholders** |
| `itemPromotedLevel` | “$NAME$” moved up a level$EXTRA$ | Status after promoting a grandchild to a child. $EXTRA$ is an optional “ with N items” clause **has placeholders** |
| `itemDeleted` | Item deleted | Status after deleting a sub-item |
| `tabSavedStatus` | “$NAME$” saved | Status after editing a tab **has placeholders** |
| `tabAddedStatus` | “$NAME$” added | Status after adding a tab **has placeholders** |
| `tabDeletedStatus` | Tab deleted | Status after deleting a tab |
| `errorCouldNotNavigate` | Could not navigate: $ERROR$ | Error when opening a tab’s destination fails **has placeholders** |

