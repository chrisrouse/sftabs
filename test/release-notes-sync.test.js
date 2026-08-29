#!/usr/bin/env node
/**
 * docs/release-notes.md is generated. This is what stops it drifting.
 *
 * CHANGELOG.md is the one place release copy is authored, and it already gets
 * copied into popup.html by hand during a release. The docs page is a second
 * copy, and the docs site cannot read the changelog at build time: Jekyll's
 * source is docs/, CHANGELOG.md is above it, and GitHub Pages runs in safe mode
 * so no plugin or symlink can reach out of the source directory.
 *
 * A copy nobody checks is a copy that goes stale. The repo has already been
 * bitten by exactly this: the manifest sat at 2.1.1 while the changelog said
 * 2.1.2, because the bump depended on someone remembering it. So rather than
 * trusting the release checklist, this re-runs the renderer and compares.
 *
 * If this fails, you edited CHANGELOG.md without regenerating:
 *
 *     npm run docs:release-notes
 *
 * Run: npm test
 */
const fs = require('fs');
const { build, PAGE } = require('../scripts/build-release-notes.js');

let passed = 0;
let failed = 0;

function check(label, ok, detail) {
  if (ok) {
    passed++;
    console.log('ok    ' + label + (detail ? '  — ' + detail : ''));
  } else {
    failed++;
    console.log('FAIL  ' + label + (detail ? '  — ' + detail : ''));
  }
}

check('the generated page exists', fs.existsSync(PAGE),
  'run: npm run docs:release-notes');

if (fs.existsSync(PAGE)) {
  const onDisk = fs.readFileSync(PAGE, 'utf8');
  const expected = build();

  check('the docs page matches CHANGELOG.md', onDisk === expected,
    onDisk === expected ? 'in sync'
      : 'stale — run: npm run docs:release-notes');

  // The version the page claims is read from the manifest, not from the
  // changelog's topmost heading. Those can legitimately differ mid-release
  // (notes written before the bump), and the page must not promise a version
  // nobody can install.
  const shipping = require('../manifest.base.json').version;
  check('the page names the version the extension ships',
    onDisk.includes(`The current release is **${shipping}**`), shipping);

  // Every version in the changelog reaches the page. A parser that anchored on
  // the `---` rules between sections would silently drop 2.1.2, which has none.
  const { parseChangelog, CHANGELOG } = require('../scripts/build-release-notes.js');
  const versions = parseChangelog(fs.readFileSync(CHANGELOG, 'utf8')).map(s => s.version);
  check('every changelog version is on the page',
    versions.length > 0 && versions.every(v => onDisk.includes(`## ${v}`)),
    versions.join(', '));

  // The preamble above the first heading contains a bold line that looks exactly
  // like an entry title. It is instructions for the maintainer, not release copy.
  check('the maintainer preamble is not published',
    !onDisk.includes('Releasing a new version'),
    'it would read as a release note');

  check('the page is a Jekyll page in the v3 layout',
    /^---\nlayout: v3\n/.test(onDisk));

  check('and says it is generated, so nobody edits it by hand',
    onDisk.includes('GENERATED FILE'));
}

console.log('\n' + passed + '/' + (passed + failed) + ' passed');
process.exit(failed ? 1 : 0);
