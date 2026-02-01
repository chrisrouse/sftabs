#!/usr/bin/env node

/**
 * Convert translations.csv to JSON format
 * Usage: node scripts/csv-to-json.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const CSV_FILE = path.join(__dirname, '../translations.csv');
const JSON_FILE = path.join(__dirname, '../docs/translations/master.json');

// Ensure output directory exists
const outputDir = path.dirname(JSON_FILE);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

/**
 * Parse CSV line considering quoted fields with line breaks
 * This is a simple parser that handles the specific format of our CSV
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

async function convertCSVtoJSON() {
  const strings = [];
  const fileStream = fs.createReadStream(CSV_FILE, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let headerLine = null;
  let isFirstLine = true;

  for await (const line of rl) {
    if (isFirstLine) {
      headerLine = line;
      isFirstLine = false;
      continue;
    }

    // Skip empty lines
    if (!line.trim()) {
      continue;
    }

    const fields = parseCSVLine(line);

    if (fields.length >= 5) {
      const section = fields[0] || '';
      const key = fields[1] || '';
      const en = fields[2] || '';
      const context = fields[3] || '';
      const es = fields[4] || '';
      const fr = fields[5] || '';
      const de = fields[6] || '';
      const ja = fields[7] || '';

      // Only add if we have a key and English text
      if (key && en) {
        // Mark as non-translatable if it's metadata, brand names, or keyboard commands
        const translatable = !(
          section === 'Extension Metadata' ||
          section === 'Keyboard Commands' ||
          (en === 'SF Tabs' && (key === 'popupTitle' || key === 'extensionName'))
        );

        strings.push({
          key,
          section,
          context,
          en,
          es,
          fr,
          de,
          ja,
          translatable,
        });
      }
    }
  }

  // Create the master JSON structure
  const masterJSON = {
    metadata: {
      version: '2.0.0',
      lastUpdated: new Date().toISOString().split('T')[0],
      languages: ['en', 'es', 'fr', 'de', 'ja'],
      totalStrings: strings.length,
    },
    strings,
  };

  // Write to file with pretty formatting
  fs.writeFileSync(JSON_FILE, JSON.stringify(masterJSON, null, 2));
  console.log(`✓ Created ${JSON_FILE}`);
  console.log(`  Total strings: ${strings.length}`);
  console.log(`  Languages: ${masterJSON.metadata.languages.join(', ')}`);
}

convertCSVtoJSON().catch((err) => {
  console.error('Error converting CSV to JSON:', err);
  process.exit(1);
});
