# SF Tabs - Build & Development Guide

## Prerequisites

- Node.js 18+ installed
- Firefox, Chrome, or Edge browser

## Setup

Install dependencies:
```bash
npm install
```

## Important: Browser-Specific Manifests

Due to differences in MV3 implementation, this extension uses **browser-specific manifests**:

- **Chrome/Edge**: Requires `background.service_worker` (true MV3)
- **Firefox**: Requires `background.scripts` array (MV3 with MV2 compatibility)

The build system automatically generates the correct `manifest.json` for each browser:
- **Source**: `manifest.base.json` (tracked in git)
- **Generated**: `manifest.json` (ignored in git, browser-specific)

## Development Commands

### Generate Manifests

Generate browser-specific `manifest.json`:
```bash
npm run manifest:chrome   # Chrome/Edge manifest
npm run manifest:firefox  # Firefox manifest
```

**Note**: The `start:*` and `build:*` commands automatically generate the correct manifest.

### Lint & Validate
Validates manifest.json and checks for common issues:
```bash
npm run lint
```

### Build Extension
Creates a packaged .zip file in `web-ext-artifacts/`:
```bash
npm run build
```

Build browser-specific packages:
```bash
npm run build:chrome   # Generates Chrome manifest, builds sftabs-chrome-2.0.0.zip
npm run build:firefox  # Generates Firefox manifest, builds sftabs-firefox-2.0.0.zip
```

### Test in Browser

**Firefox:**
```bash
npm run start:firefox
```
- Generates Firefox manifest with `background.scripts`
- Opens Firefox with a temporary profile
- Automatically loads the extension
- Opens Salesforce login page
- Auto-reloads extension on file changes

**Chrome:**
```bash
npm run start:chrome
```
- Generates Chrome manifest with `background.service_worker`
- Opens Chrome/Chromium
- Automatically loads the extension
- Opens Salesforce login page
- Auto-reloads extension on file changes

### Sign for Firefox (AMO)
For Firefox Add-ons submission:
```bash
npm run sign:firefox
```
Requires API credentials from Mozilla.

## Cross-Browser Compatibility

### Why Separate Manifests?

**Chrome/Edge** (Strict MV3):
- ✅ Requires `background.service_worker`
- ❌ **Rejects** `background.scripts` (MV2 property) with error

**Firefox 109+** (Incomplete MV3):
- ❌ `background.service_worker` not supported yet
- ✅ Requires `background.scripts` array (MV2-style)

**Solution**: Generate browser-specific manifests at build time.

### Manifest Generation Flow

```
manifest.base.json (source)
         |
         v
  build-manifest.js (script)
         |
         +-- Chrome --> manifest.json (service_worker)
         |
         +-- Firefox -> manifest.json (scripts array)
```

### Content Security Policy
Both manifests include CSP for enhanced security:
```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'"
}
```

## File Structure

```
sftabs/
├── manifest.base.json      # Base manifest (tracked in git)
├── manifest.json           # Generated manifest (gitignored, browser-specific)
├── build-manifest.js       # Manifest generation script
├── background.js           # Service worker/background script
├── popup/                  # Popup UI and logic
├── content/                # Content scripts for Salesforce
├── icons/                  # Extension icons
├── package.json            # NPM scripts and dependencies
├── web-ext-config.cjs      # web-ext configuration
└── web-ext-artifacts/      # Build output (gitignored)
```

## Ignored Files

### In Git (.gitignore)
- `manifest.json` (generated, not committed)
- `node_modules/`
- `web-ext-artifacts/`
- Build artifacts (*.zip, *.xpi)

### In Build (web-ext-config.cjs)
- `manifest.base.json` (source only)
- `build-manifest.js` (build script)
- `node_modules/`
- Documentation files (*.md)
- Config files (package.json, web-ext-config.cjs)

## Distribution

### Chrome Web Store
1. Build: `npm run build:chrome`
2. This generates Chrome-specific manifest with `service_worker`
3. Upload `web-ext-artifacts/sftabs-chrome-2.0.0.zip` to Chrome Web Store

### Firefox Add-ons (AMO)
1. Build: `npm run build:firefox`
2. This generates Firefox-specific manifest with `scripts` array
3. Upload `web-ext-artifacts/sftabs-firefox-2.0.0.zip` to Firefox Add-ons

### Edge Add-ons
1. Build: `npm run build:chrome` (Edge uses Chromium)
2. Upload to Microsoft Edge Add-ons Developer Center

## Troubleshooting

### Chrome: "background.scripts requires manifest version 2 or lower"
**Fix**: Run `npm run manifest:chrome` to generate the Chrome-specific manifest.

**Root cause**: You have a Firefox manifest active. Chrome rejects the `scripts` property.

### Firefox: "background.service_worker is not supported"
**Fix**: Run `npm run manifest:firefox` to generate the Firefox-specific manifest.

**Root cause**: You have a Chrome manifest active. Firefox doesn't support service workers yet.

### "manifest.json not found" after git pull
**Expected**: `manifest.json` is gitignored (generated file).

**Fix**: Run `npm run manifest:chrome` or `npm run manifest:firefox` depending on which browser you're testing.

### Build includes wrong manifest
The `build:chrome` and `build:firefox` commands automatically generate the correct manifest before building. Always use these specific commands for browser-specific builds.

## Development Workflow

### Starting Development
1. Clone repo: `git clone https://github.com/chrisrouse/sftabs`
2. Install: `npm install`
3. Choose browser: `npm run manifest:chrome` or `npm run manifest:firefox`
4. Start testing: `npm run start:chrome` or `npm run start:firefox`

### Switching Browsers
```bash
# Switch from Chrome to Firefox
npm run manifest:firefox
npm run start:firefox

# Switch from Firefox to Chrome
npm run manifest:chrome
npm run start:chrome
```

### Before Committing
- Never commit `manifest.json` (it's gitignored)
- Always commit changes to `manifest.base.json`
- The build system will generate browser-specific manifests

## Resources

- [web-ext Documentation](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/)
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Firefox Extension Workshop](https://extensionworkshop.com/)
- [Edge Extensions](https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/)
