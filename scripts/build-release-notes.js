#!/usr/bin/env node
/**
 * Render CHANGELOG.md into docs/release-notes.md.
 *
 * The docs site is a Jekyll site rooted at docs/, and CHANGELOG.md is at the
 * repo root — outside Jekyll's source. GitHub Pages runs Jekyll in safe mode, so
 * there is no plugin and no symlink that could read it at build time. The notes
 * therefore have to be copied into docs/, and a copy is a thing that drifts.
 *
 * So the copy is generated rather than written, and test/release-notes-sync
 * re-runs this renderer and fails if the committed page does not match. A
 * forgotten sync breaks `npm test` instead of silently publishing stale notes —
 * the same hazard the popup.html sync already carries, which is documented in
 * .claude/commands/release.md and is why the manifest once sat a version behind.
 *
 * CHANGELOG.md stays the single place release copy is authored.
 *
 * Usage:  node scripts/build-release-notes.js          (writes the page)
 *         node scripts/build-release-notes.js --check   (exit 1 if stale)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CHANGELOG = path.join(ROOT, 'CHANGELOG.md');
const PAGE = path.join(ROOT, 'docs', 'release-notes.md');

/**
 * Pull the released versions out of CHANGELOG.md, newest first.
 *
 * Deliberately keyed on the `## x.y.z` headings alone. The `---` rules between
 * sections are inconsistent in the file — 3.0.1 and 3.0.0 have one, 2.1.2 does
 * not — so anything that relied on them would drop a version. The preamble
 * above the first heading contains a `**Releasing a new version:**` line that
 * looks exactly like an entry title, which is the other reason to anchor on the
 * headings and ignore everything before the first one.
 *
 * A section may open with an intro paragraph before its first `**Title**` entry
 * (3.0.0 does); that is kept as the version's lede.
 */
function parseChangelog(text) {
  const sections = [];
  const heading = /^## (\d+\.\d+\.\d+)\s*$/gm;

  const marks = [];
  let match;
  while ((match = heading.exec(text)) !== null) {
    marks.push({ version: match[1], start: match.index + match[0].length });
  }

  marks.forEach((mark, index) => {
    const end = index + 1 < marks.length
      ? text.lastIndexOf('\n## ', marks[index + 1].start)
      : text.length;
    const body = text.slice(mark.start, end);
    sections.push({ version: mark.version, ...parseSection(body) });
  });

  return sections;
}

/** One version's body: an optional lede, then `**Title**` + description pairs. */
function parseSection(body) {
  // A trailing horizontal rule belongs to the boundary, not to the content
  const cleaned = body.replace(/\n---\s*$/, '').trim();

  const entries = [];
  const entry = /^\*\*(.+?)\*\*\s*$/gm;

  const marks = [];
  let match;
  while ((match = entry.exec(cleaned)) !== null) {
    marks.push({ title: match[1].trim(), from: match.index, to: match.index + match[0].length });
  }

  const lede = (marks.length ? cleaned.slice(0, marks[0].from) : cleaned).trim();

  marks.forEach((mark, index) => {
    const end = index + 1 < marks.length ? marks[index + 1].from : cleaned.length;
    entries.push({
      title: mark.title,
      description: cleaned.slice(mark.to, end).trim(),
    });
  });

  return { lede, entries };
}

/**
 * The Jekyll page.
 *
 * Markdown rather than HTML: kramdown is configured with GFM input, and some
 * descriptions carry inline links (2.1.2 links to the GitHub releases page)
 * which would otherwise need escaping by hand. Entry titles become `###` so
 * each one gets an anchor a support reply can link to.
 */
function render(sections, currentVersion) {
  const out = [];

  out.push('---');
  out.push('layout: v3');
  out.push('title: Release Notes');
  out.push("description: What changed in each release of SF Tabs, newest first.");
  out.push('---');
  out.push('');
  out.push('<!-- GENERATED FILE — do not edit by hand.');
  out.push('     Source: CHANGELOG.md · Renderer: scripts/build-release-notes.js');
  out.push('     Run `npm run docs:release-notes` after editing the changelog. -->');
  out.push('');
  out.push('# Release Notes');
  out.push('');
  out.push(`The current release is **${currentVersion}**. These notes are also in the ` +
           'extension itself — open the popup and click the bell.');
  out.push('');

  sections.forEach((section, index) => {
    if (index > 0) out.push('---');
    out.push('');
    out.push(`## ${section.version}`);
    out.push('');
    if (section.lede) {
      out.push(section.lede);
      out.push('');
    }
    section.entries.forEach(item => {
      out.push(`### ${item.title}`);
      out.push('');
      out.push(item.description);
      out.push('');
    });
  });

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

/** The version the extension actually ships, so the page cannot claim another. */
function currentVersion() {
  return require(path.join(ROOT, 'manifest.base.json')).version;
}

function build() {
  const sections = parseChangelog(fs.readFileSync(CHANGELOG, 'utf8'));
  if (!sections.length) throw new Error('no `## x.y.z` sections found in CHANGELOG.md');
  return render(sections, currentVersion());
}

if (require.main === module) {
  const expected = build();
  if (process.argv.includes('--check')) {
    const actual = fs.existsSync(PAGE) ? fs.readFileSync(PAGE, 'utf8') : '';
    if (actual !== expected) {
      console.error('docs/release-notes.md is out of date — run: npm run docs:release-notes');
      process.exit(1);
    }
    console.log('docs/release-notes.md is in sync with CHANGELOG.md');
  } else {
    fs.writeFileSync(PAGE, expected);
    const count = parseChangelog(fs.readFileSync(CHANGELOG, 'utf8'))
      .reduce((n, s) => n + s.entries.length, 0);
    console.log(`wrote docs/release-notes.md — ${count} items across ` +
                `${parseChangelog(fs.readFileSync(CHANGELOG, 'utf8')).length} versions`);
  }
}

module.exports = { parseChangelog, parseSection, render, build, PAGE, CHANGELOG };
