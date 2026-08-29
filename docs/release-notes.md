---
layout: v3
title: Release Notes
description: What changed in each release of SF Tabs, newest first.
---

<!-- GENERATED FILE — do not edit by hand.
     Source: CHANGELOG.md · Renderer: scripts/build-release-notes.js
     Run `npm run docs:release-notes` after editing the changelog. -->

# Release Notes

The current release is **3.0.1**. These notes are also in the extension itself — open the popup and click the bell.

## 3.0.1

### A couple small UI adjustments to the footer

Changed the text color to white to be easier to read and fixed an issue where alerts in the footer could sometimes be wider than the popup.

### Fixed org colors escaping Salesforce environments

Fixed an issue where the org colors could escape Salesforce environments and change the favicon on other sites like developer.salesforce.com.

### Fixed saving Experience Cloud sites with Quick Add

Fixed an issue that prevented saving Experience Cloud sites with Quick Add. These links are saved as Custom URLs and unique to each org, so you will want to use Profiles if you're saving links to Experience Cloud Builder pages.

---

## 3.0.0

New look, same great extension -- now with even more features! Thanks for using SF Tabs.

### Settings have moved back into the popup

All of your settings have been moved back into the popup to make it faster and easier to customize SF Tabs the way you want. Click on the gear icon in the bottom right corner to open the new settings panel and take a look around. All of your existing settings have been kept, they're just in a new place. Import/Export is still on a separate screen since extensions don't handle file browser popups very well.

### Tell your orgs apart with just a glance

If you have a separate extension installed for setting your org colors, you no longer need it! You can now set colors for every org you work in or just allow SF Tabs to set the colors for you using the built in default settings. Want to make it even more obvious where you are? Enable the org banner! You can see your org name and your environment name along with the matching color you set for your tabs. Banners work across setup, object pages, and Experience Cloud. Check Settings > Org Colors for all of the options. Want to highlight specific tabs in your custom tabs? Well, you can do that now, too. Go to Settings > Tabs to enable this feature. This setting plays nicely with org themes, allowing Salesforce to control the hover and active tab settings.

### Get there faster

There is a new menu option that you can add to every page next to Salesforce's own Favorites menu. This gives you a faster way to access your favorite objects or setup pages. The floating menu button has also been improved and has some new options. Go to Settings > Button to configure the menus.

### New tabs in fewer clicks

You can still open the popup to add a new tab, but now you can enable a new button in the tab bar to add the current page. Go to Settings > Tabs to enable this feature. The SF Tabs header menu also gives you the ability to just click on the icon to add the current page without having to open the extension's popup.

### Drag tabs to reorder

This one is less of a new feature and more taking advantage of something Salesforce just did for us. If you drag your tabs while in setup, you can re-arrange them. This order is now captured by SF Tabs and saved.

### Improved profiles

New tabs can be added to one profile or all profiles. You can edit individual tabs and choose which profiles to include it in, or you can go to Settings > Profiles and choose to have new tabs added to all profiles automatically. Profile management hasn't changed much, but the UI has been cleaned up a bit. Profiles also support more org types, like Trailhead, scratch orgs, etc., for auto-switching. The new profile experience has also been improved. Profiles also support separate windows now. This didn't work before.

### Leave a review

In 14 days, you'll be asked to leave a review if you're liking SF Tabs. This shows up in the popup above the footer, and either answer settles it for good — you won't be asked twice.

### Lots of code cleanup and performance improvements

The code has been cleaned up a lot and a lot of little bugs you may have never noticed have been found and fixed.

---

## 2.1.2

### Fixes an issue with data storage

When switching between Sync and Local Storage options. Stale data could get left behind which have caused data loss if you switched back and forth between storage options.

### Release Notes

You found them! New releases will now have release notes published on [github](https://github.com/chrisrouse/sftabs/releases) and available in the extension. After you've had a chance to read the release notes, check the box to hide them. The next time there is an update, you'll be shown the new notes.
