#!/usr/bin/env node
/**
 * Every message key the extension asks for must exist, in every locale.
 *
 * There are two ways to ask. Markup uses `__MSG_key__` tokens, substituted by
 * i18n-helper.js at load. Code calls one of three wrappers — t(), msg(), or
 * chrome.i18n.getMessage() — with a literal key.
 *
 * A key that is missing does not throw. chrome.i18n.getMessage returns an empty
 * string, and the popup's t() falls back to printing the key itself, so the
 * failure is a blank label or a raw camelCase identifier in the UI — visible
 * only to whoever happens to open that screen, in that language.
 *
 * That is what makes deleting unused keys risky, and this file is what makes it
 * safe. It also catches the reverse: a locale that has drifted behind the others.
 *
 * On matching, since two earlier attempts at it were wrong:
 *
 *   `\bkey\b` does not match inside `__MSG_key__`. The underscore is a word
 *   character, so there is no boundary between it and the key, and every
 *   markup-only key looked unused.
 *
 *   Matching a bare identifier counts JS variables that happen to share a key's
 *   name — `exportEverything` is both a message and a function parameter — so
 *   dead keys looked alive.
 *
 * Hence: tokens are matched as tokens, and code keys only inside quotes.
 *
 * Run: npm test
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let passed = 0;
let failed = 0;

function check(label, ok, detail) {
  if (ok) {
    passed++;
    console.log('ok    ' + label + (detail ? '  — ' + detail : ''));
  } else {
    failed++;
    console.log('FAIL  ' + label + (detail ? '  — ' + detail : ''));
  }
}

const ROOT = path.join(__dirname, '..');
const LOCALES = ['en', 'de', 'es'];

const messages = Object.fromEntries(LOCALES.map(l =>
  [l, JSON.parse(fs.readFileSync(path.join(ROOT, `_locales/${l}/messages.json`), 'utf8'))]));

/** Shipped files only: tests and docs may mention keys they do not use. */
const shipped = execSync(
  "git ls-files '*.js' '*.html' '*.json' | grep -vE '^test/|^docs/|^scripts/|_locales/'",
  { cwd: ROOT }).toString().trim().split('\n');

// ── What the extension asks for ──
const asked = new Map();   // key -> where it was seen

/** Prefixes assembled at runtime, e.g. t('orgEnv_' + env). */
const dynamicPrefixes = new Set();

for (const rel of shipped) {
  const raw = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  // Comments stripped: i18n-helper.js documents the __MSG_keyName__ shape in
  // prose, and that is not a key reference.
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  const note = k => { if (!asked.has(k)) asked.set(k, rel); };

  // Markup and manifest: __MSG_key__
  for (const m of src.matchAll(/__MSG_([A-Za-z0-9_]+)__/g)) note(m[1]);

  // Code: t('key'), msg('key'), chrome.i18n.getMessage('key'). Quoted, so a
  // variable of the same name is not mistaken for a key reference.
  for (const m of src.matchAll(/\b(?:t|msg|getMessage)\(\s*['"`]([A-Za-z0-9_]+)['"`]/g)) note(m[1]);

  // t(cond ? 'a' : 'b', …) — both arms are literals and both are real keys
  for (const m of src.matchAll(/\b(?:t|msg|getMessage)\(\s*[^)]*\?\s*['"`]([A-Za-z0-9_]+)['"`]\s*:\s*['"`]([A-Za-z0-9_]+)['"`]/g)) {
    note(m[1]); note(m[2]);
  }

  // t('prefix_' + something) — the colour names and the org environments are
  // built this way, so every key under that prefix is live. Missing this is how
  // a first pass at pruning nearly deleted all nineteen of them.
  for (const m of src.matchAll(/\b(?:t|msg|getMessage)\(\s*['"`]([A-Za-z0-9_]+_)['"`]\s*\+/g)) {
    dynamicPrefixes.add(m[1]);
  }
}

// A prefix is not itself a key — the literal matcher above also captured it
// from t('colorName_' + …), which would report it as missing from every locale.
for (const prefix of dynamicPrefixes) asked.delete(prefix);

// Expand each prefix to the keys it can reach
for (const prefix of dynamicPrefixes) {
  for (const key of Object.keys(messages.en)) {
    if (key.startsWith(prefix)) asked.set(key, 'built as ' + prefix + "' + …");
  }
}

check('keys are being asked for at all', asked.size > 100, asked.size + ' distinct keys referenced');

// ── Every one of them exists, in every locale ──
for (const locale of LOCALES) {
  const missing = [...asked.entries()].filter(([k]) => !messages[locale][k]);
  check(`every referenced key exists in ${locale}`,
    missing.length === 0,
    missing.length ? missing.slice(0, 8).map(([k, f]) => `${k} (${f})`).join(', ') : asked.size + ' keys');
}

// ── And nothing is carried that nobody asks for ──
// The locale files are a third of the shipped package, and 264 of these were
// strings belonging to the v2 popup and the stripped settings page. Asserting
// the absence keeps them from creeping back, and it is what makes the pruning
// safe: together with the check above, deleting a key that was in use fails
// this file rather than showing a blank label to whoever opens that screen.
const orphaned = Object.keys(messages.en).filter(k => !asked.has(k));
check('no locale key is carried unreferenced',
  orphaned.length === 0,
  orphaned.length ? orphaned.length + ' unused: ' + orphaned.slice(0, 6).join(', ') + ' …'
                  : Object.keys(messages.en).length + ' keys, all referenced');

// ── The locales do not drift apart ──
const enKeys = new Set(Object.keys(messages.en));
for (const locale of LOCALES.filter(l => l !== 'en')) {
  const keys = new Set(Object.keys(messages[locale]));
  const onlyEn = [...enKeys].filter(k => !keys.has(k));
  const onlyOther = [...keys].filter(k => !enKeys.has(k));
  check(`${locale} carries exactly the same keys as en`,
    onlyEn.length === 0 && onlyOther.length === 0,
    onlyEn.length || onlyOther.length
      ? `missing ${onlyEn.length}, extra ${onlyOther.length}`
      : keys.size + ' keys');
}

// ── Placeholders line up with what callers pass ──
// A key whose message uses $1 needs a placeholders block, or the substitution
// silently prints nothing.
for (const locale of LOCALES) {
  const broken = Object.entries(messages[locale]).filter(([, entry]) => {
    const uses = /\$[A-Za-z0-9_]+\$/.test(entry.message);
    return uses && !entry.placeholders;
  }).map(([k]) => k);
  check(`${locale} declares placeholders wherever a message uses them`,
    broken.length === 0,
    broken.length ? broken.slice(0, 6).join(', ') : 'consistent');
}

console.log('\n' + passed + '/' + (passed + failed) + ' passed');
process.exit(failed ? 1 : 0);
