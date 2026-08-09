---
layout: v3
title: Quick Access
description: Three ways to reach your tabs and capture a page without opening the SF Tabs popup.
---

# Quick Access

SF Tabs gives you three ways to reach your tabs, or capture the page you're on, without opening the popup. They all do the same two jobs — get to a tab, or capture the page you're on — from different places in Salesforce. You can turn on any combination of them, and you can still add a tab from the popup itself.

## The Header Menu

Turn on **Show a menu in the Salesforce header** (Settings > Button) to add a bookmark button to Salesforce's own header, beside Favorites, styled to match it.

It's a split button, like Favorites:

- The **left half** (bookmark icon) captures the page you're on as a tab — no popup, no dialog. The page simply appears in your tabs.
- The **right half** (chevron) opens a menu listing your tabs.

The bookmark icon fills in to show when the page you're on is already one of your tabs.

The header menu works everywhere in Salesforce, not only in Setup, and works alongside the floating button or on its own.

<div class="v3-shot">Screenshot: the split bookmark button in the Salesforce header, next to Favorites</div>

## The Floating Button

Turn on **Enable floating button** (Settings > Button) to add a button on top of Salesforce pages that opens a panel listing your tabs.

The floating button has several options:

| Option | What it controls |
| --- | --- |
| Layout | Edge drawer (a handle on the side), round button, or labeled pill |
| Edge | Docks to the left or right side |
| Offset from top | Distance from the top, in pixels, so it stays put when the window resizes |
| Location | Everywhere, only in Setup, or outside Setup |

The panel lists your tabs, including nested ones, and highlights the tab matching the page you're on.

<div class="v3-shot">Screenshot: the floating button panel open over a Salesforce page, showing the tab list with the current page highlighted</div>

## Quick Add in the Setup Tab Bar

Turn on **Quick Add in the Salesforce menu bar** (Settings > Tabs) to add a "+" at the end of your tabs in the Setup menu bar. Clicking it captures the current page without opening the popup.

<div class="v3-shot">Screenshot: the "+" button at the end of the tab row in Setup</div>

## A Few Things That Apply to All Three

- Capture works on record pages and list views, not just Setup pages.
- **Quick Add adds to all profiles** (Settings > Profiles) sends a captured page to every profile rather than only the active one. This is off by default. See [Profiles]({{ '/v3/profiles' | relative_url }}) for how profiles work.
- You can always add a tab from the popup itself, no matter which of these you have turned on.

See [Tabs]({{ '/v3/tabs' | relative_url }}) for how captured tabs behave once they're added, and [Settings]({{ '/v3/settings' | relative_url }}) for where each of these options lives.
