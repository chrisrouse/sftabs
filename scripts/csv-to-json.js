#!/usr/bin/env node
/**
 * csv-to-json.js
 *
 * Converts _locales/messages.csv into per-language messages.json files.
 * Run this after updating translations in Google Sheets and downloading
 * the updated CSV.
 *
 * CSV format expected:
 *   identifier, en-US, [lang…], context
 *
 * - The first column is always the key identifier.
 * - The last column is always the translator context/notes.
 * - Every column in between is a language (e.g. en-US, de, es-ES).
 * - Empty cells fall back to English (en-US column).
 * - \n in cell values becomes a real newline in the generated JSON.
 * - $PLACEHOLDER$ patterns auto-generate Chrome i18n placeholder blocks
 *   (content: "$1", "$2", ... in first-seen order).
 *
 * Language-to-locale folder mapping:
 *   en-US → _locales/en/
 *   de    → _locales/de/
 *   es-ES → _locales/es_ES/
 *   (add more in LOCALE_MAP below as needed)
 *
 * Usage:  node scripts/csv-to-json.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT   = path.join(__dirname, '..');
const CSV_IN = path.join(ROOT, '_locales', 'messages.csv');

/** Maps CSV column header → _locales subfolder name */
const LOCALE_MAP = {
  'en-US': 'en',
  'en':    'en',
  'de':    'de',
  'es-ES': 'es',
  'es':    'es',
  'fr':    'fr',
  'fr-FR': 'fr',
  'pt-BR': 'pt_BR',
  'ja':    'ja',
  'zh-CN': 'zh_CN',
  'ko':    'ko',
  'it':    'it',
  'nl':    'nl',
};

// ---------------------------------------------------------------------------
// CSV parser — handles quoted fields containing commas, double-quotes, and
// embedded newlines per RFC 4180.
// ---------------------------------------------------------------------------
function parseCSV(content) {
  const rows  = [];
  let   row   = [];
  let   field = '';
  let   inQ   = false;
  let   i     = 0;

  while (i < content.length) {
    const ch   = content[i];
    const next = content[i + 1];

    if (inQ) {
      if (ch === '"' && next === '"') { field += '"'; i += 2; continue; }
      if (ch === '"')                 { inQ = false;  i++;    continue; }
      field += ch; i++; continue;
    }

    if (ch === '"')  { inQ = true; i++; continue; }
    if (ch === ',')  { row.push(field); field = ''; i++; continue; }

    if (ch === '\r' && next === '\n') {
      row.push(field); rows.push(row); row = []; field = ''; i += 2; continue;
    }
    if (ch === '\n') {
      row.push(field); rows.push(row); row = []; field = ''; i++; continue;
    }

    field += ch; i++;
  }

  // Flush any trailing content
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.some(f => f.trim() !== '')) rows.push(row);
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Auto-generate Chrome i18n placeholders from $WORD$ patterns.
// Each unique placeholder word gets content "$1", "$2", ... in first-seen
// order — matching the argument array passed to chrome.i18n.getMessage().
// ---------------------------------------------------------------------------
function buildPlaceholders(message) {
  const placeholders = {};
  const seen         = new Set();
  let   argIndex     = 1;
  let   match;
  const re           = /\$([A-Z0-9_]+)\$/g;

  while ((match = re.exec(message)) !== null) {
    const name = match[1].toLowerCase();
    if (!seen.has(name)) {
      placeholders[name] = { content: `$${argIndex}` };
      seen.add(name);
      argIndex++;
    }
  }

  return placeholders;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
if (!fs.existsSync(CSV_IN)) {
  console.error(`Error: ${CSV_IN} not found.\nRun "npm run i18n:export" first to generate it.`);
  process.exit(1);
}

const rows = parseCSV(fs.readFileSync(CSV_IN, 'utf8'));
if (rows.length < 2) {
  console.error('CSV appears empty or invalid.');
  process.exit(1);
}

const headers     = rows[0];
const contextIdx  = headers.length - 1;   // last column = context
const langHeaders = headers.slice(1, contextIdx); // columns between identifier and context

if (langHeaders[0] !== 'en-US' && langHeaders[0] !== 'en') {
  console.warn(`Warning: expected first language column to be "en-US", got "${langHeaders[0]}".`);
}

const enIdx = 1; // en-US is always column index 1

console.log(`Language columns: ${langHeaders.join(', ')}\n`);

for (const langHeader of langHeaders) {
  const langIdx = headers.indexOf(langHeader);
  const locale  = LOCALE_MAP[langHeader] || langHeader.replace('-', '_');

  const messages = {};
  let   count    = 0;

  for (const row of rows.slice(1)) {
    const key     = (row[0]          || '').trim();
    if (!key) continue;

    const enText   = (row[enIdx]      || '').trim();
    const langText = (row[langIdx]    || '').trim();
    const context  = (row[contextIdx] || '').trim();

    // Use translated text when available, otherwise fall back to English
    const rawMessage = langText || enText;
    if (!rawMessage) continue;

    // Convert literal \n sequences to real newlines for JSON
    const message = rawMessage.replace(/\\n/g, '\n');

    const entry = { message };
    if (context) entry.description = context;

    const placeholders = buildPlaceholders(message);
    if (Object.keys(placeholders).length > 0) {
      entry.placeholders = placeholders;
    }

    messages[key] = entry;
    count++;
  }

  const outDir  = path.join(ROOT, '_locales', locale);
  const outFile = path.join(outDir, 'messages.json');

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(messages, null, 2) + '\n', 'utf8');

  console.log(`✓ _locales/${locale}/messages.json  (${count} keys)`);
}

console.log('\nDone!');
