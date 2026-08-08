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

  /**
   * `color|text` of what is on screen, or null for nothing.
   *
   * Redrawing is remove-then-insert, which flashes, so apply() has to be able to
   * tell "nothing I render has changed" from "this is the same settings write
   * arriving twice". Comparing against what is actually rendered does that
   * better than diffing the stored value can: it cannot be fooled by a change
   * record, and it self-heals if the two ever drift apart.
   */
  let rendered = null;

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
    rendered = null;
    stopPolling();
    if (placementObserver) {
      placementObserver.disconnect();
      placementObserver = null;
    }
    document.getElementById(BANNER_ID)?.remove();
    unpadBody();
  }

  function paint(bar, color, text) {
    bar.textContent = text;
    bar.style.setProperty('background', color, 'important');
    bar.style.setProperty('color', utils().readableInk(color), 'important');
  }

  /**
   * Update the bar in place when there is already one.
   *
   * Removing and re-inserting is visible twice over: the slide-in replays, and
   * inside Lightning's header the removal reflows it. Turning the org name off
   * changes nothing but the text, so it should change nothing but the text.
   *
   * A rebuild is only needed when there is no bar to update — the first draw,
   * or the first one after the feature was switched off.
   */
  function draw(color, text) {
    const existing = active ? document.getElementById(BANNER_ID) : null;
    if (existing) {
      paint(existing, color, text);
      // Overlaid, the page is held down by a padding sized to the old text; a
      // shorter label that no longer wraps would leave a gap. In flow, the
      // header resizes itself and there is nothing to correct.
      if (existing.dataset.placement === 'fixed') {
        unpadBody();
        padBody(existing);
      }
      return;
    }

    remove();

    const bar = document.createElement('div');
    bar.id = BANNER_ID;
    bar.setAttribute('role', 'status');
    paint(bar, color, text);

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

    // Nothing to do if this is already what is on screen.
    const signature = `${color}|${text}`;
    if (signature === rendered && document.getElementById(BANNER_ID)) return;

    draw(color, text);
    rendered = signature;
  }

  /**
   * Lightning is a single-page app, so moving between Setup and a record page
   * never reloads this script — and `bannerLocation` is decided from the URL.
   * Without this, "Only in Setup" was only ever evaluated against whichever page
   * happened to be open when the tab was loaded.
   *
   * Polling the href rather than patching history: same approach favicon.js
   * takes, and the read below only happens when the URL has actually moved.
   */
  function watchUrl() {
    let last = window.location.href;
    setInterval(() => {
      if (window.location.href === last) return;
      last = window.location.href;
      apply();
    }, 1000);
  }

  function start() {
    apply();
    watchUrl();

    if (browser.storage && browser.storage.onChanged) {
      // Any settings write, not just the ones this bar reads.
      //
      // The narrower gate other surfaces use — settingsChanged(changes, [...]) —
      // exists because a redraw is destructive and a settings write fires twice,
      // once for sync and once for the local mirror. apply() now compares
      // against what is rendered, so a redundant call costs one storage read and
      // touches nothing. That makes the gate no longer worth its failure mode:
      // when it is wrong, the bar silently stops responding, and the user has to
      // reload the page to see a setting they just changed.
      const onChange = debounce(() => apply(), 150);

      browser.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' && area !== 'sync') return;
        if (!changes.userSettings) return;
        onChange();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
