---
layout: v3
title: Home
description: Documentation for SF Tabs 3.0 — custom tabs, org colors, profiles and quick access for the Salesforce Setup menu.
---

<div class="v3-hero">
  <h1>SF Tabs 3.0</h1>
  <p>Custom navigation for the Salesforce Setup menu — and a few ways to tell your orgs apart.</p>
</div>

<div class="v3-notice">
  <i class="bi bi-info-circle-fill" aria-hidden="true"></i>
  <p><strong>Version 3 is in review at the browser stores.</strong> These pages describe 3.0 and are being written now. If you are running 2.1.1 from the Chrome Web Store or Firefox Add-ons, the <a href="{{ '/' | relative_url }}">version 2 documentation</a> is the one you want. You can install 3.0 early from the <a href="https://github.com/chrisrouse/sftabs/releases/tag/v3.0.0">GitHub release</a>.</p>
</div>

<ul class="v3-tiles">
{%- for s in site.data.v3_sections %}
  {%- if s.ready %}
  <li>
    <a class="v3-tile" href="{{ s.url | relative_url }}">
      <i class="bi {{ s.icon }}" aria-hidden="true"></i>
      <span class="v3-tile-title">{{ s.title }}</span>
      <span class="v3-tile-blurb">{{ s.blurb }}</span>
    </a>
  </li>
  {%- else %}
  <li>
    <div class="v3-tile is-pending" aria-disabled="true">
      <i class="bi {{ s.icon }}" aria-hidden="true"></i>
      <span class="v3-tile-title">{{ s.title }}</span>
      <span class="v3-tile-blurb">{{ s.blurb }}</span>
      <span class="v3-tile-soon">Coming soon</span>
    </div>
  </li>
  {%- endif %}
{%- endfor %}
</ul>

<div class="v3-card">
  <h2>What changed in 3.0</h2>
  <p>Settings moved back into the popup, so there is no separate page to hunt for. Every Salesforce tab's icon can carry a color picked from the kind of org you are in, and an optional banner names the org across the top of the page. Individual tabs can take a color too.</p>
  <p>There is a new SF Tabs menu in Salesforce's own header, next to Favorites, and a one-click way to capture the page you are on — from that menu, or from a <code>+</code> at the end of your tab bar. Tabs you drag in the Setup bar now keep their new order, and a tab can belong to more than one profile.</p>
  <p>The full list is in the <a href="https://github.com/chrisrouse/sftabs/releases/tag/v3.0.0">3.0.0 release notes</a>.</p>
</div>
