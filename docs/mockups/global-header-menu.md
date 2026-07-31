# Open question: SF Tabs menu in the Salesforce global header

**Status:** design decided, mockup drawn (`global-header-menu.html`), no code yet.
Awaiting a choice of position in the header row.

## The idea

Instead of overlaying a floating button on the page, inject an SF Tabs entry
directly into Salesforce's own global header — the row containing Favorites,
Global Actions (+), Guidance Center, Help, the Setup gear, Notifications, and
the avatar. Clicking it would open a dropdown menu styled like the Setup gear's
menu.

Appeal: it looks native, sits where users already go for org-level actions,
never overlaps page content, and sidesteps the "floating thing competing with
Salesforce's right-edge utilities" problem entirely.

## Target DOM

```
div.slds-global-header.slds-grid.slds-grid_align-spread
└─ span.button-container-a11y[role=navigation][aria-label="Global Header"]
   └─ div.slds-global-header__item          ← inject a new <li> into the list below
      └─ ul.slds-global-actions
         ├─ li.slds-global-actions__item …  (Favorites)
         ├─ li.slds-global-actions__item …  (Global Actions +)
         ├─ li.slds-global-actions__item …  (Guidance Center)
         ├─ li.slds-global-actions__item_help
         ├─ li.slds-global-actions__item …  (Setup gear)
         ├─ li.slds-global-actions__item_notification
         └─ li.slds-global-actions__item …  (avatar)
```

Each existing item follows the same shape, which we can mirror:

```html
<li class="slds-global-actions__item slds-dropdown-trigger slds-dropdown-trigger_click">
  <button type="button" aria-haspopup="true"
    class="slds-button slds-button_icon slds-button_icon-container
           slds-button_icon-small slds-global-actions__item-action">
    <svg class="slds-icon slds-icon_xx-small" viewBox="0 0 520 520">…</svg>
  </button>
</li>
```

Their dropdowns render as:

```html
<div class="popupTargetContainer menu--nubbin-top uiPopupTarget
            uiMenuList uiMenuList--right uiMenuList--default">
  <div role="menu">
    <div class="menu__header"><span class="text-heading--label">…</span></div>
    <ul role="presentation" class="scrollable">…</ul>
  </div>
</div>
```

## Things to work out before committing

1. **Aura re-renders.** The header is Aura-rendered and will discard injected
   nodes. Needs a MutationObserver to re-inject — the same problem
   `content/tab-renderer.js` already solves for the setup nav bar, so that
   pattern can be reused.
2. **Never select on `data-aura-rendered-by`.** Those ids (`163:84;a`) are
   generated per render and will not be stable. Anchor only on SLDS class
   names.
3. **Injection scope.** The global header exists on every Lightning page, but
   `navigation-parser.js` / `tab-renderer.js` are registered only for
   `/lightning/setup/*`. `floating-button.js` already runs on the broader
   match list, so a header menu would belong with the latter.
4. **Native styling vs our design system.** Reusing SLDS header classes makes
   it look built in, but then it ignores our `--sft-*` tokens and won't follow
   the extension's own theme setting. Decide whether it should look like
   Salesforce or like SF Tabs.
5. **Fragility.** Salesforce can change header markup between releases. The
   floating button is fully self-owned and cannot break this way — worth
   keeping as a fallback if the header injection fails to find its anchor.
6. **Relationship to the existing tab bar.** In Setup we already inject a
   horizontal tab bar. A header menu would be a second surface listing the
   same tabs; decide whether it replaces the floating button only, or also
   serves outside Setup where the tab bar does not appear.

## Decisions taken

- **Alternative, not a replacement.** The floating button stays.
- **Own on/off setting**, independent of `floatingButton`. Both surfaces can be
  on at once, or only the header menu. Not a fourth `floatingButton.layout`
  value, which would have forced a choice between them.
- **Native SLDS styling.** Reuse Salesforce's header and menu classes so it is
  indistinguishable from the Setup gear menu. Consequence, accepted: it follows
  Salesforce's theme rather than the extension's `themeMode`, so it will not go
  dark when the popup does. Item 4 above is settled this way.
- **Scope:** lives with `floating-button.js` in content-script entry 0, which
  already matches all Lightning pages — the header exists everywhere, unlike the
  Setup-only tab bar. Item 3 settled.

- **Icon:** SLDS `bookmark` (vendored to `icons/slds/bookmark.svg`). Not the SF
  Tabs mark, which at 17px reads as SLDS `arrow_right`.
- **Menu treatment:** the Favorites dropdown, not the Setup gear's — nubbin,
  large uppercase label, close button, and a footer action on a grey band.
- **Position: first child of `ul.slds-global-actions`.** Implemented as a
  `prepend`, so it needs no knowledge of its siblings. That matters because the
  row varies by org: some now carry an Agentforce item, and anchoring relative to
  Favorites would break wherever the row differs. The mockup draws both an org
  with the Agentforce item and one without, from the same code path.

## Row contents

Favorites shows a colored record-type icon per entry. Our tabs have no
equivalent — the type badge was removed as noise — so each row is the tab name
over its path, matching the popup. A count and chevron appear where a tab has
sub-items.

## Build notes

- Re-injection after Aura re-renders: reuse the MutationObserver pattern from
  `content/tab-renderer.js`, which already solves this for the Setup nav bar.
- Menu contents mirror the floating panel, including sub-item flyouts, so the
  nested rendering in `content/floating-modal.js` should be reused rather than
  reimplemented.
- Keep the floating button working as the fallback when the header anchor is not
  found, per item 5.
