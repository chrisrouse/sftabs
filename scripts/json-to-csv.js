#!/usr/bin/env node
/**
 * json-to-csv.js
 *
 * Exports all translation keys from _locales/en/messages.json and
 * _locales/en/first-launch.json into a single _locales/messages.csv file
 * suitable for collaborative translation via Google Sheets.
 *
 * CSV format:
 *   identifier, en-US, de, es-ES, context
 *
 * - identifier: the Chrome i18n key name
 * - en-US:      English source text ($PLACEHOLDER$ syntax preserved)
 * - de, es-ES:  empty columns for translators to fill in
 * - context:    developer notes explaining the string and its placeholders
 *
 * \n in message strings is stored as the literal 2-char sequence \n
 * so multi-line messages display safely in Google Sheets.
 *
 * Usage:  node scripts/json-to-csv.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUTPUT = path.join(ROOT, '_locales', 'messages.csv');

// Language columns to include (currently empty — for translators to fill in)
const LANGUAGE_COLUMNS = ['de', 'es-ES'];

/**
 * Wrap a CSV field value in quotes if it contains a comma, double-quote,
 * or newline. Escapes internal double-quotes as "".
 */
function csvField(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function readJSON(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`  Warning: ${filePath} not found, skipping.`);
    return {};
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const mainMessages = readJSON(path.join(ROOT, '_locales', 'en', 'messages.json'));
const firstLaunch  = readJSON(path.join(ROOT, '_locales', 'en', 'first-launch.json'));

// Merge — first-launch keys come after main keys
const allMessages = { ...mainMessages, ...firstLaunch };

const header = ['identifier', 'en-US', ...LANGUAGE_COLUMNS, 'context'];
const lines = [header.map(csvField).join(',')];

for (const [key, entry] of Object.entries(allMessages)) {
  const message     = (entry.message || '').replace(/\n/g, '\\n');
  const description = entry.description || '';

  const row = [
    key,
    message,
    ...LANGUAGE_COLUMNS.map(() => ''),
    description,
  ];
  lines.push(row.map(csvField).join(','));
}

fs.writeFileSync(OUTPUT, lines.join('\n') + '\n', 'utf8');
console.log(`✓ Generated ${path.relative(ROOT, OUTPUT)} with ${lines.length - 1} keys`);
