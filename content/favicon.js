// content/favicon.js
// Tints the browser tab's favicon so orgs can be told apart in the tab strip.
//
// Neither Chrome nor Firefox lets an extension colour a tab, put a border on
// one, or style the tab strip at all. The favicon is the only pixels a page can
// hand the browser, which is why every extension that appears to colour a tab
// is really doing this.
//
// The colour comes from shared utils: an org's environment supplies a default,
// and a per-org entry overrides it. Both are resolved from the URL, so this
// file holds no matching logic of its own.

(function () {
  'use strict';

  const MARK = 'data-sftabs-favicon';
  const ICON_SELECTOR = 'link[rel~="icon" i]';

  /** Icon links the page owned before we replaced them, kept so we can put them back. */
  let displaced = [];
  let painted = null;
  let applying = false;

  /**
   * Settings, read from local storage.
   *
   * saveUserSettings mirrors the whole settings object to local on every write,
   * whichever area is preferred, so one read covers both. The gap is a change
   * made on another device: it lands in sync, and this copy stays stale until
   * something writes locally. Acceptable for a colour; it would not be for tabs.
   */
  async function readOrgColors() {
    try {
      const stored = await browser.storage.local.get('userSettings');
      return (stored.userSettings || {}).orgColors || null;
    } catch {
      return null;
    }
  }

  /**
   * Replace the page's icons with ours.
   *
   * The originals are detached rather than deleted. Browsers pick among several
   * icon links by their own rules, so leaving the page's in place and hoping
   * ours wins is not something to rely on — but neither is destroying them,
   * because switching the feature off has to give the page its icon back.
   */
  function paint(color) {
    const head = document.head;
    if (!head) return;

    const ours = document.createElement('link');
    ours.setAttribute(MARK, '');
    ours.rel = 'icon';
    ours.type = 'image/svg+xml';
    ours.href = window.SFTabs.utils.orgFaviconDataUrl(color);

    const existing = [...head.querySelectorAll(ICON_SELECTOR)];
    const theirs = existing.filter(link => !link.hasAttribute(MARK));
    if (theirs.length) displaced = theirs;

    existing.forEach(link => link.remove());
    head.appendChild(ours);
  }

  /** Put the page's own icons back. */
  function restore() {
    const head = document.head;
    if (!head) return;
    head.querySelectorAll(`[${MARK}]`).forEach(link => link.remove());
    displaced.forEach(link => head.appendChild(link));
    displaced = [];
  }

  async function apply() {
    const utils = window.SFTabs && window.SFTabs.utils;
    if (!utils || !utils.resolveOrgColor) return;

    const color = utils.resolveOrgColor(window.location.href, await readOrgColors());
    if (color === painted) return;

    applying = true;
    painted = color;
    if (color) paint(color);
    else restore();
    // Let the observer see our own mutation land before it starts reacting again
    setTimeout(() => { applying = false; }, 0);
  }

  /**
   * Lightning rewrites the icon link as you navigate, and a single-page app
   * navigates constantly — so the icon has to be reasserted, not just set once.
   */
  function watchHead() {
    if (!document.head) return;
    new MutationObserver(records => {
      if (applying || !painted) return;
      const pageChangedIcons = records.some(record =>
        [...record.addedNodes, ...record.removedNodes].some(node =>
          node.nodeType === 1 && node.matches?.(ICON_SELECTOR) && !node.hasAttribute(MARK)));
      if (pageChangedIcons) paint(painted);
    }).observe(document.head, { childList: true });
  }

  /** The URL changes without a reload in a single-page app, and with it the org. */
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
    watchHead();
    watchUrl();

    if (browser.storage && browser.storage.onChanged) {
      browser.storage.onChanged.addListener((changes, area) => {
        if ((area === 'local' || area === 'sync') && changes.userSettings) apply();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
