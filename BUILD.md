# SF Tabs - Build & Development Guide

## Prerequisites

- Node.js 18+ installed
- Firefox, Chrome, or Edge browser

## Setup

Install dependencies:
```bash
npm install
```

## Development Commands

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
npm run build:chrome   # sftabs-chrome-1.5.0.zip
npm run build:firefox  # sftabs-firefox-1.5.0.zip
```

### Test in Browser

**Firefox:**
```bash
npm run start:firefox
```
- Opens Firefox with a temporary profile
- Automatically loads the extension
- Opens Salesforce login page
- Auto-reloads extension on file changes

**Chrome:**
```bash
npm run start:chrome
```
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

### Manifest Hybrid Approach
The `manifest.json` includes both MV3 properties for universal compatibility:

```json
"background": {
  "service_worker": "background.js",  // Chrome/Edge use this
  "scripts": ["background.js"]         // Firefox requires this
}
```

**Why?**
- **Chrome/Edge**: Fully support MV3 service workers, ignore `scripts`
- **Firefox 109+**: MV3 support incomplete, still needs `scripts` array
- **Warning**: web-ext will show a warning about `service_worker` - this is expected

### Content Security Policy
Added for enhanced security across all browsers:
```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'"
}
```

## File Structure

```
sftabs/
├── manifest.json           # Extension manifest (hybrid MV3)
├── background.js           # Service worker/background script
├── popup/                  # Popup UI and logic
├── content/                # Content scripts for Salesforce
├── icons/                  # Extension icons
├── package.json            # NPM scripts and dependencies
├── web-ext-config.cjs      # web-ext configuration
└── web-ext-artifacts/      # Build output (gitignored)
```

## Ignored Files in Build

The following are excluded from the packaged extension:
- `node_modules/`
- `web-ext-artifacts/`
- `.git/`
- Documentation files (*.md)
- Config files (package.json, web-ext-config.cjs)
- IDE folders (.vscode, .idea)

## Distribution

### Chrome Web Store
1. Build: `npm run build:chrome`
2. Upload `web-ext-artifacts/sftabs-chrome-1.5.0.zip` to Chrome Web Store Developer Dashboard

### Firefox Add-ons (AMO)
1. Build: `npm run build:firefox`
2. Upload `web-ext-artifacts/sftabs-firefox-1.5.0.zip` to Firefox Add-ons Developer Hub

### Edge Add-ons
1. Build: `npm run build:chrome` (Edge uses Chromium)
2. Upload to Microsoft Edge Add-ons Developer Center

## Troubleshooting

### "service_worker is not supported" warning in Firefox
**Expected behavior.** Firefox's MV3 implementation still requires `scripts` array. The extension works correctly despite the warning.

### Chrome shows deprecated "scripts" warning
**Harmless.** Chrome ignores the `scripts` property and uses `service_worker`. The warning can be ignored.

### Build artifacts not excluded
Ensure `.gitignore` includes:
```
node_modules/
web-ext-artifacts/
*.zip
*.xpi
```

## Resources

- [web-ext Documentation](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/)
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Firefox Extension Workshop](https://extensionworkshop.com/)
- [Edge Extensions](https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/)
