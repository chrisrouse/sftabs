// content/env-banner.js
// A bar across the top of the page naming the org you are in.
//
// The favicon tint answers "which org is this tab" at a glance in the tab strip.
// This answers it while you are looking at the page, which is where an action
// taken in the wrong org actually happens. Same color for both, from the same
// per-org and per-environment configuration — orgColorFor in shared utils — so
// the two can never disagree about what an org looks like.
//
// Grew out of the Salesforce Experience Cloud Banner extension, which did this
// for Builder pages and knew only sandbox and production. Here it runs on every
// Salesforce host the extension matches and knows all seven environments.

(function () {
  'use strict';

  const BANNER_ID = 'sftabs-env-banner';

  /**
   * Lightning's global header. The bar goes INSIDE it, above the skip links,
   * which is where Salesforce puts its own system messages — the Agentforce
   * notice, sandbox expiry warnings — so the header sizes itself around the bar
   * exactly as it does around those.
   *
   * The first attempt was a fixed strip plus padding on body, and it covered the
   * header instead of moving it: Lightning lays out inside a full-height
   * container that padding on body does not shift. Anything overlaying the top
   * of a Lightning page hides the system messages that live there.
   */
  const HEADER_SELECTOR = '#oneHeader, .slds-global-header_container';

  /** Aura boots after DOMContentLoaded, so the header may not be there yet. */
  const POLL_MS = 400;
  const POLL_TRIES = 25;   // ~10s, then this page simply has no header

  /** The padding we added to body, so it can be taken back exactly. */
  let appliedPadding = null;

  let active = false;
  let placementObserver = null;
  let poll = null;
  let pollsLeft = 0;

  const utils = () => window.SFTabs && window.SFTabs.utils;

  /**
   * "ACME--DEV1 · SANDBOX", or just the environment.
   *
   * The org identifier is what distinguishes two sandboxes of the same org,
   * which is the case per-org color overrides exist for — so it is worth
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

  // ── Placement ────────────────────────────────────────────────────

  function padBody(bar) {
    if (appliedPadding !== null) return;
    appliedPadding = document.body.style.paddingTop || '';
    const height = bar.offsetHeight;
    document.body.style.setProperty(
      'padding-top', `calc(${appliedPadding || '0px'} + ${height}px)`, 'important');
  }

  function unpadBody() {
    if (appliedPadding === null) return;
    // Restore whatever the page had, rather than clearing outright: Salesforce
    // sets its own padding on body in some layouts.
    if (appliedPadding === '') document.body.style.removeProperty('padding-top');
    else document.body.style.setProperty('padding-top', appliedPadding);
    appliedPadding = null;
  }

  /**
   * Put the bar in the best place available right now, and keep it there.
   *
   * Safe to call repeatedly: it moves the existing node rather than redrawing,
   * so promoting a fixed bar to an inline one when Aura finishes booting is a
   * reposition, not a flash.
   */
  function settle(bar) {
    const header = document.querySelector(HEADER_SELECTOR);

    if (header) {
      if (bar.parentNode !== header) header.insertBefore(bar, header.firstChild);
      bar.dataset.placement = 'inline';
      unpadBody();          // in flow now; the header carries the height
      stopPolling();
      watchPlacement(bar, header);
      return;
    }

    // No Lightning header: Experience Builder, and any page that renders its own
    // chrome. Overlay it and push the page down instead.
    if (bar.parentNode !== document.body) document.body.appendChild(bar);
    bar.dataset.placement = 'fixed';
    padBody(bar);
    startPolling(bar);
  }

  /**
   * Aura discards injected nodes when it re-renders, and can replace the header
   * element outright. Both are cheap childList watches — no subtree, since the
   * only two things that matter are our node leaving the header and the header
   * leaving its parent.
   */
  function watchPlacement(bar, header) {
    if (placementObserver) placementObserver.disconnect();
    placementObserver = new MutationObserver(debounce(() => {
      if (!active) return;
      if (bar.parentNode !== document.querySelector(HEADER_SELECTOR)) settle(bar);
    }, 250));
    placementObserver.observe(header, { childList: true });
    if (header.parentNode) placementObserver.observe(header.parentNode, { childList: true });
  }

  function startPolling(bar) {
    if (poll) return;
    pollsLeft = POLL_TRIES;
    poll = setInterval(() => {
      if (!active || pollsLeft-- <= 0) { stopPolling(); return; }
      if (document.querySelector(HEADER_SELECTOR)) settle(bar);
    }, POLL_MS);
  }

  function stopPolling() {
    if (!poll) return;
    clearInterval(poll);
    poll = null;
  }

  // ── Draw and remove ──────────────────────────────────────────────

  function remove() {
    active = false;
    stopPolling();
    if (placementObserver) {
      placementObserver.disconnect();
      placementObserver = null;
    }
    document.getElementById(BANNER_ID)?.remove();
    unpadBody();
  }

  function draw(color, text) {
    remove();

    const bar = document.createElement('div');
    bar.id = BANNER_ID;
    bar.setAttribute('role', 'status');
    bar.textContent = text;
    bar.style.setProperty('background', color, 'important');
    bar.style.setProperty('color', utils().readableInk(color), 'important');

    active = true;
    settle(bar);
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
