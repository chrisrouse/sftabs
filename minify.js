#!/usr/bin/env node
/**
 * Minify JavaScript files for distribution
 *
 * - Copies all files to dist/ folder
 * - Minifies all .js files (no obfuscation)
 * - Preserves directory structure
 * - Source code remains in main folder for GitHub
 */

const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const SOURCE_DIR = __dirname;
const DIST_DIR = path.join(__dirname, 'dist');

// Files and directories to exclude
const EXCLUDE = [
  'node_modules',
  'web-ext-artifacts',
  '.git',
  'dist',
  'minify.js',
  'build-manifest.js',
  'manifest.base.json',
  'package.json',
  'package-lock.json',
  'web-ext-config.cjs',
  '.gitignore',
  '.DS_Store',
  'README.md',
  'CHANGELOG.md',
  'LICENSE.md',
  'PRIVACYPOLICY.md',
  'TESTING_STATUS.md',
  'BUILD.md',
  'check-storage.js'
];

// Files to copy without minification
const COPY_ONLY = [
  '.html',
  '.css',
  '.json',
  '.png',
  '.jpg',
  '.svg',
  '.md'
];

/**
 * Check if path should be excluded
 */
function shouldExclude(filePath) {
  const relativePath = path.relative(SOURCE_DIR, filePath);
  return EXCLUDE.some(exclude => relativePath.startsWith(exclude));
}

/**
 * Recursively copy and minify directory
 */
async function processDirectory(sourceDir, distDir) {
  // Create dist directory if it doesn't exist
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const distPath = path.join(distDir, entry.name);

    // Skip excluded files/directories
    if (shouldExclude(sourcePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      // Recursively process subdirectory
      await processDirectory(sourcePath, distPath);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);

      if (ext === '.js') {
        // Minify JavaScript file
        await minifyFile(sourcePath, distPath);
      } else if (COPY_ONLY.includes(ext) || ext === '') {
        // Copy non-JS files as-is
        fs.copyFileSync(sourcePath, distPath);
      }
    }
  }
}

/**
 * Minify a JavaScript file
 */
async function minifyFile(sourcePath, distPath) {
  try {
    const code = fs.readFileSync(sourcePath, 'utf8');

    const result = await minify(code, {
      compress: {
        dead_code: true,
        drop_debugger: true,
        conditionals: true,
        evaluate: true,
        booleans: true,
        loops: true,
        unused: true,
        hoist_funs: true,
        keep_fargs: false,
        hoist_vars: false,
        if_return: true,
        join_vars: true,
        side_effects: true
      },
      mangle: false, // Don't obfuscate variable names
      format: {
        comments: false // Remove comments
      },
      sourceMap: false // No source maps for production
    });

    if (result.code) {
      fs.writeFileSync(distPath, result.code, 'utf8');

      const originalSize = fs.statSync(sourcePath).size;
      const minifiedSize = fs.statSync(distPath).size;
      const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);

      console.log(`✓ ${path.relative(SOURCE_DIR, sourcePath)} → ${minifiedSize} bytes (${savings}% smaller)`);
    } else {
      // Fallback: copy if minification failed
      fs.copyFileSync(sourcePath, distPath);
      console.warn(`⚠ ${path.relative(SOURCE_DIR, sourcePath)} → copied (minification failed)`);
    }
  } catch (error) {
    // Fallback: copy if error
    fs.copyFileSync(sourcePath, distPath);
    console.error(`✗ ${path.relative(SOURCE_DIR, sourcePath)} → copied (error: ${error.message})`);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🔨 Starting minification process...\n');

  // Clean dist directory
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }

  // Process all files
  await processDirectory(SOURCE_DIR, DIST_DIR);

  console.log('\n✅ Minification complete!');
  console.log(`📦 Minified files are in: ${path.relative(SOURCE_DIR, DIST_DIR)}/`);
}

main().catch(error => {
  console.error('❌ Minification failed:', error);
  process.exit(1);
});
