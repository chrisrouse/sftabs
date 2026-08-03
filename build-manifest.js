#!/usr/bin/env node
/**
 * Build browser-specific manifest.json files
 *
 * Chrome/Edge: Uses service_worker (MV3)
 * Firefox: Uses scripts array (MV3 with MV2 compatibility)
 */

const fs = require('fs');
const path = require('path');

const baseManifest = require('./manifest.base.json');

// Target browser from command line argument
const target = process.argv[2] || 'chrome';

function buildManifest(browser) {
  const manifest = JSON.parse(JSON.stringify(baseManifest));

  if (browser === 'firefox') {
    // Firefox: Use scripts array (MV2-style background for MV3).
    // shared/utils.js comes first because background.js calls its org matching
    // and cannot importScripts — Firefox's background is an event page, not a
    // worker. Chrome imports it at the top of background.js instead.
    manifest.background = {
      scripts: ['popup/js/shared/utils.js', 'background.js']
    };
  } else {
    // Chrome/Edge: Use service_worker (true MV3)
    manifest.background = {
      service_worker: 'background.js'
    };
  }

  return manifest;
}

function writeManifest(browser) {
  const manifest = buildManifest(browser);
  const outputPath = path.join(__dirname, 'manifest.json');

  fs.writeFileSync(
    outputPath,
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8'
  );
}

// Validate target
if (!['chrome', 'firefox'].includes(target)) {
  process.exit(1);
}

// Build and write manifest
writeManifest(target);
