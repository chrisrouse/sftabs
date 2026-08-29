---
layout: v3
title: Home
# Builds its own hero, tiles and cards, so it is not wrapped in one.
card: false
description: Documentation for SF Tabs 3.0 — custom tabs, org colors, profiles and quick access for the Salesforce Setup menu.
redirect_from:
  - /v3/
---

<div class="v3-hero">
  <h1>SF Tabs 3.0</h1>
  <p>Custom navigation for the Salesforce Setup menu — and a few ways to tell your orgs apart.</p>
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
