---
layout: v3
title: Org Colors
description: Color-code your browser tab icon and add a page banner so production and sandbox never look the same.
---

# Org Colors

Production and a sandbox look identical in a row of browser tabs, right up until the moment they don't. Org Colors makes them tell themselves apart, using two surfaces that share one color so they can never disagree:

1. **Color the browser tab icon** — Tints the Salesforce icon in your browser tab so you can tell orgs apart at a glance.
2. **Show a banner on the page** — A colored bar across the top of every Salesforce page, in the same color as the tab icon.

You can turn either one on by itself, or both together.

<div class="v3-shot">Screenshot: the Org Colors settings section with the tab icon and banner toggles</div>

## How the Color Is Chosen

SF Tabs decides which color to use in two steps:

1. **Environment defaults.** Every org gets a default color based on its environment. SF Tabs recognizes seven environments:

   | Environment |
   | --- |
   | Production |
   | Sandbox |
   | Developer (Developer Edition) |
   | Patch |
   | Scratch |
   | Demo |
   | Trailhead Playground |

2. **Per-org overrides.** An entry for a specific org overrides the environment default for that org alone.

Per-org entries exist because the hostname alone can't tell two sandboxes of the same org apart — several sandboxes all look like `acme--name.sandbox`. A per-org override is the only way to give each one its own color. There's a button to capture the org you're currently on, so you don't have to type its identifier by hand.

<div class="v3-shot">Screenshot: the per-org color list with the "capture current org" button</div>

## Editing Environment Defaults

Environment defaults can be edited to whatever colors you prefer, and reset back to the shipped defaults at any time.

## The Banner

Turning on **Show a banner on the page** adds a colored bar across the top of every Salesforce page. It sits inside the Salesforce header, above the page content — it moves the page down rather than covering it.

### Include the Org Name

By default, the banner shows just the environment, such as "SANDBOX." Turning on **Include the org name** shows something like "ACME--DEV1 · SANDBOX" instead — useful once you're working across several sandboxes of the same org and "SANDBOX" alone doesn't tell them apart.

### Banner Location

The banner also takes a location choice, the same one used by the floating button:

- Everywhere
- Only in Setup
- Outside Setup

<div class="v3-shot">Screenshot: the banner across the top of a Salesforce Setup page, showing the org name and environment</div>

## Where It Works

Org Colors works on every Salesforce host the extension runs on, including Experience Cloud and Experience Builder pages.

## Migrating from Another Extension

If you installed a separate extension purely to color your orgs, you no longer need it — Org Colors covers the tab icon and the page banner in one place.

See [Settings]({{ '/v3/settings' | relative_url }}) for where these options live, and [Quick Access]({{ '/v3/quick-access' | relative_url }}) for the floating button's shared location setting.
