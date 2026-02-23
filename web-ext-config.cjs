// web-ext configuration for SF Tabs
module.exports = {
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
    'web-ext-config.cjs',
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
    // Salesforce CLI config
    '.sfdx/**',
    // Beta-only icon assets (not used in production release)
    'icons/sftabs-beta*',
    'icons/sftabs_beta*'
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
