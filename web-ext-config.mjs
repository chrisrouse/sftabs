// web-ext configuration for SF Tabs
//
// ESM with `export default`, not CommonJS. web-ext 8.10 reads a .cjs config's
// sandbox rather than its exports, so `module.exports = {...}` arrives as a
// top-level key literally named "module.exports" and it refuses to start:
//   UsageError: The config option "module.exports" must be specified in camel case
// The effect was silent until you tried to build — every web-ext command failed,
// which also meant the ignore list below was never applied.
export default {
  // Source directory (root of extension)
  sourceDir: './',

  // Files to ignore when building/packaging
  ignoreFiles: [
    'node_modules/**',
    'web-ext-artifacts/**',
    '.git/**',
    '.github/**',
    '.claude/**',
    '.gitignore',
    // Mac hidden files
    '.DS_Store',
    '**/.DS_Store',
    '._*',
    '**/._*',
    '.Spotlight-V100',
    '.Trashes',
    '.fseventsd',
    '__MACOSX',
    '__MACOSX/**',
    // Project files
    'package.json',
    'package-lock.json',
    'web-ext-config.mjs',
    'manifest.base.json',
    'build-manifest.js',
    // Documentation
    'README.md',
    'CHANGELOG.md',
    'LICENSE.md',
    'PRIVACYPOLICY.md',
    'TESTING_STATUS.md',
    'BUILD.md',
    'TRANSLATION_REFERENCE.md',
    'translations.csv',
    'docs',
    'docs/**',
    'wiki',
    'wiki/**',
    // IDE files
    '.vscode/**',
    '.idea/**',
    // Other
    '*.log',
    '*.md',
    'dark-mode-improvements.html',
    'design-examples.html',
    'first-launch-preview.html',
    // Utility scripts (build/translation tools)
    'scripts',
    'scripts/**',
    // Tests
    'test',
    'test/**',
    // Salesforce CLI config
    '.sfdx/**',

    // ── Repo-only assets ──
    // Kept in version control, not shipped. Each was going into the package
    // for want of a line here; between them they were about a tenth of it.

    // The translation round-trip: npm run i18n:export writes this, i18n:build
    // reads it back into the three messages.json. Working file, not a runtime
    // one, and the largest single thing that was shipping by mistake.
    '_locales/messages.csv',
    '_locales/messages.gsheet',

    // Vendored SLDS source. The extension inlines these paths into its own
    // markup rather than fetching the files, so they are provenance for
    // whoever next needs to check a glyph against the original.
    'icons/slds',
    'icons/slds/**',

    // Referenced only by the GitHub Pages site under docs/, which is itself
    // excluded above.
    'icons/invert.png',
    'icons/sftabs_blue.svg'
  ],

  // Build configuration
  build: {
    overwriteDest: true,
    filename: 'sftabs-{version}.zip'
  },

  // Run configuration for testing
  run: {
    // Firefox specific settings
    firefox: 'firefox',
    // Uses temporary profile by default (change firefoxProfile to use persistent profile)

    // Chrome specific settings
    chromiumBinary: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',

    // URLs to open when testing
    startUrl: [
      'https://login.salesforce.com'
    ],

    // Browser console logging
    browserConsole: true
  },

  // Lint configuration
  lint: {
    pretty: true,
    warningsAsErrors: false
  }
};
