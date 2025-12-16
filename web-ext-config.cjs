// web-ext configuration for SF Tabs
module.exports = {
  // Source directory (root of extension)
  sourceDir: './',

  // Files to ignore when building/packaging
  ignoreFiles: [
    'node_modules/**',
    'web-ext-artifacts/**',
    '.git/**',
    '.gitignore',
    '.DS_Store',
    'package.json',
    'package-lock.json',
    'web-ext-config.cjs',
    'manifest.base.json',
    'build-manifest.js',
    'README.md',
    'CHANGELOG.md',
    'LICENSE.md',
    'PRIVACYPOLICY.md',
    'TESTING_STATUS.md',
    'docs/**',
    '.vscode/**',
    '.idea/**',
    '*.log',
    '*.md'
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
