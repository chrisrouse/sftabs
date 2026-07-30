# Localization

All three locales are complete: **554 keys** in `en`, `de` and `es`, with no gaps
in either direction.

## How it works

Two mechanisms, because neither covers both cases:

- **Static copy** in `popup.html` uses `__MSG_key__` tokens, substituted by
  `popup/js/shared/i18n-helper.js`. It walks text nodes and attributes once at
  load, so it must be the first script tag.
- **Runtime copy** built by `js/popup.js` goes through that file's local `t()`
  helper. The DOM pass above runs once and never sees generated markup, so tab
  rows, sub-item rows, status messages and the wizard all need `t()`. It returns
  the key when one is missing, so a typo shows as the key rather than a blank.

`default_locale` is `en`, so any key a locale lacks falls back to English rather
than rendering empty.

## Conventions

Follow these when adding strings, so new copy matches the 554 already there.

| | German | Spanish |
|---|---|---|
| Register | Formal (*Sie*) | Formal (*usted*) |
| Our navigation tabs | `Registerkarte` | `pestaña` (feminine — watch agreement) |
| Quoting a name | `"$NAME$"` straight quotes | `"$NAME$"` straight quotes |

**Salesforce proper nouns stay English** — `Setup`, `Object Manager`, `Flows`,
`Permission Sets`. Salesforce localizes some of these in its own UI, but our
seeded tab labels are hardcoded English in `constants.js`, so translating them
in help text would describe something the user cannot see. `firstLaunchDefaultTabList`
is deliberately identical in all three locales for this reason.

### Plurals

Chrome i18n has no plural rules. Counts use paired keys — `migratedTabsForwardOne`
/ `...Many`, `withSubItemsOne` / `...Many`, `itemCountInTabOne` / `...Many` — and
the call site picks with a ternary. A language needing more than two forms needs
the call site changed, not just the strings.

### Composed sentences

A few messages assemble from fragments, so translations must work in position,
not just in isolation:

- `previewSummary` takes a `previewOutcome*` fragment plus `stateOn`/`stateOff`.
- `itemPromotedToTab` and `itemPromotedLevel` take `withSubItems*`.

German verb-final order makes this awkward if the fragment lands at the end, so
the German strings place `$EXTRA$` **before** the verb and `previewSummary` uses a
colon:

    "$NAME$" wurde mit 3 Einträgen in eine eigene Registerkarte verschoben
    Nur Vorschau — erstellt worden wäre: ein Standardprofil mit 5 Registerkarten.

Placeholder *position* is the translator's to choose; the `placeholders` block is
not. Copy it from `en` verbatim — its `content` values (`$1`, `$2`) are what bind
tokens to arguments.

## Not localized, on purpose

- **Release-note bodies** in the What's New panel. `/release` syncs them verbatim
  from `CHANGELOG.md`, and the shipped popup leaves them English too.
- **Version labels** (`v2.1.1`) and the character counter (`0/30`) — digits only.
- **`SF Tabs`** itself, via `extensionName`.

## Status and provenance

The `de` and `es` files are AI-generated, which the extension states in its own
Translations settings section (`translationsBetaDescription`). 429 keys predate
this branch; 125 were added with the v2 popup and translated alongside it.
**Native review is still the right gate** before treating either locale as
finished — particularly anywhere our wording sits next to Salesforce's own
localized UI.

`node scripts/json-to-csv.js` regenerates `_locales/messages.csv` for handing to
translators.

## Known inconsistency

German uses `Registerkarte` for 125 newer keys but plain `Tab` in 69 older ones.
Both are correct German; the split is historical. Sweeping the older keys would
rewrite shipped German text, and two of them (`opensInNewTabTitle`,
`errorAccessingTab`) legitimately mean the *browser* tab rather than one of ours,
so it needs reading key by key rather than find/replace.

## Fixed in passing

Three defects in the shipped Spanish, all from a `tab` → `pestaña` sweep that ran
without checking grammar:

| Key | Was | Now |
|---|---|---|
| `switchProfileHelp` | `sus tpestañas` | `sus pestañas` |
| `emptyStateText` | `tabs personalizados` … `primer prestaña` | `pestañas personalizadas` … `primera pestaña` |
| `confirmModalBody` | `todos las pestañas` | `todas las pestañas` |
| `migrationDefaultProfileNote` | `Todos sus pestañas` | `Todas sus pestañas` |
