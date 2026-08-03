#!/usr/bin/env node
/**
 * Byte counts as people read them.
 *
 * Small enough to be obvious and easy to get subtly wrong: the carry at a unit
 * boundary, the difference between "no size" and "zero bytes", and where the
 * decimal stops being useful.
 *
 * Run: npm test
 */
const { formatBytes } = require('../popup/js/shared/utils.js');

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

const is = (input, want) =>
  check(`${JSON.stringify(input)} -> ${JSON.stringify(want)}`,
    formatBytes(input) === want, JSON.stringify(formatBytes(input)));

// ── Bytes, and the singular ──
is(0, '0 bytes');
is(1, '1 byte');
is(2, '2 bytes');
is(1023, '1023 bytes');

// ── Unit steps, 1024 to the step ──
is(1024, '1 KB');
is(15433, '15 KB');          // the file this was written for
is(1048576, '1 MB');
is(1073741824, '1 GB');
is(1099511627776, '1 TB');

// ── One decimal below ten, none above, where it is only noise ──
is(1536, '1.5 KB');
is(1572864, '1.5 MB');
is(10240, '10 KB');
is(10752, '11 KB');

// ── The carry. 1023.99 KB must not print as "1024 KB" ──
is(1048000, '1023 KB');      // 1023.4 — stays
is(1048570, '1 MB');         // 1023.99 — carries

// ── Absent is not zero ──
// Number(null) is 0, so without a guard a missing size prints a confident
// "0 bytes" for a value we do not have.
is(null, '');
is(undefined, '');
is('', '');

// ── Junk yields nothing rather than NaN ──
is('banana', '');
is(-1, '');
is(NaN, '');
is(Infinity, '');

// ── Strings that are numbers still work, since datasets carry them ──
is('2048', '2 KB');

// Nothing ever reaches the UI as NaN or undefined.
const samples = [0, 1, 999, 1024, 15433, 1048576, null, undefined, 'x', -5, NaN];
check('never returns NaN or undefined',
  samples.every(v => { const out = formatBytes(v); return typeof out === 'string' && !out.includes('NaN'); }));

console.log('\n' + passed + '/' + (passed + failed) + ' passed');
process.exit(failed ? 1 : 0);
