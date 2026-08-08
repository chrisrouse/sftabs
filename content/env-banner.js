// content/env-banner.js
// A bar across the top of the page naming the org you are in.
//
// The favicon tint answers "which org is this tab" at a glance in the tab strip.
// This answers it while you are looking at the page, which is where an action
// taken in the wrong org actually happens. Same colour for both, from the same
// per-org and per-environment configuration — orgColorFor in shared utils — so
// the two can never disagree about what an org looks like.
//
// Grew out of the Salesforce Experience Cloud Banner extension, which did this
// for Builder pages and knew only sandbox and production. Here it runs on every
// Salesforce host the extension matches and knows all seven environments.

(function () {
  'use strict';

  const BANNER_ID = 'sftabs-env-banner';

  /** The padding we added to body, so it can be taken back exactly. */
  let appliedPadding = null;

  const utils = () => window.SFTabs && window.SFTabs.utils;

  /**
   * "ACME--DEV1 · SANDBOX", or just the environment.
   *
   * The org identifier is what distinguishes two sandboxes of the same org,
   * which is the case per-org colour overrides exist for — so it is worth
   * showing by default, and the setting is there for people who find it noisy.
   */
  function bannerText(url, showOrgName) {
    const u = utils();
    const environment = u.detectOrgEnvironment(url);
    if (!environment) return null;

    const label = (chrome.i18n.getMessage('orgEnv_' + environment) || environment).toUpperCase();
    if (!showOrgName) return label;

    const identifier = u.extractOrgIdentifier(url);
    return identifier ? `${identifier.toUpperCase()} · ${label}` : label;
  }

  function remove() {
    document.getElementById(BANNER_ID)?.remove();
    if (appliedPadding !== null) {
      // Restore whatever the page had, rather than clearing outright: Salesforce
      // sets its own padding on body in some layouts.
      if (appliedPadding === '') document.body.style.removeProperty('padding-top');
      else document.body.style.setProperty('padding-top', appliedPadding);
      appliedPadding = null;
    }
  }

  function draw(color, text) {
    remove();

    const bar = document.createElement('div');
    bar.id = BANNER_ID;
    bar.setAttribute('role', 'status');
    bar.textContent = text;
    bar.style.setProperty('background', color, 'important');
    bar.style.setProperty('color', utils().readableInk(color), 'important');

    document.body.appendChild(bar);

    // Push the page down by the height it actually rendered at, so a longer org
    // name that wraps does not end up sitting over the header.
    appliedPadding = document.body.style.paddingTop || '';
    const height = bar.offsetHeight;
    document.body.style.setProperty(
      'padding-top', `calc(${appliedPadding || '0px'} + ${height}px)`, 'important');
  }

  async function apply() {
    const u = utils();
    if (!u || !u.orgBannerColor) return;

    let settings;
    try {
      settings = (await browser.storage.local.get('userSettings')).userSettings || {};
    } catch {
      return;
    }

    const color = u.orgBannerColor(window.location.href, settings.orgColors);
    if (!color) { remove(); return; }

    const showOrgName = settings.orgColors.bannerShowOrgName !== false;
    const text = bannerText(window.location.href, showOrgName);
    if (!text) { remove(); return; }

    draw(color, text);
  }

  function start() {
    apply();

    if (browser.storage && browser.storage.onChanged) {
      // Only the settings this bar draws from. A settings write fires twice —
      // sync, then the local mirror — and redrawing for an unrelated change
      // would flash the bar, which is the exact fault fixed elsewhere in these
      // content scripts.
      const onChange = debounce(changes => {
        if (window.SFTabs?.utils?.settingsChanged(changes.userSettings,
              ['orgColors'])) apply();
      }, 150);

      browser.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' && area !== 'sync') return;
        onChange(changes);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
