#!/usr/bin/env node
/**
 * Asking for a review, once, at the right store.
 *
 * Two rules, both pure, both in shared utils so they can be exercised here
 * rather than only by installing the extension twice and waiting a fortnight.
 *
 * The failure modes worth guarding are asymmetric. Never showing the prompt
 * costs a review. Showing it twice, or on the day someone installs, costs
 * goodwill — and there is no undo, because the person has already seen it. So
 * every ambiguous case resolves towards not asking.
 *
 * Run: npm test
 */
const fs = require('fs');
const path = require('path');
const { storeReviewUrl, reviewPromptDecision } = require('../popup/js/shared/utils.js');

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

const ROOT = path.join(__dirname, '..');
const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;   // fixed: Date.now() would make this test drift

// ── Which store ──
// Nothing the extension ships records where it was installed from. The scheme
// of its own pages does, and the browser decides that.
const chrome = storeReviewUrl('chrome-extension://abcdefghijklmnop/popup.html');
const firefox = storeReviewUrl('moz-extension://11111111-2222-3333-4444-555555555555/popup.html');

check('Firefox is sent to addons.mozilla.org', /^https:\/\/addons\.mozilla\.org\//.test(firefox));
check('Chrome is sent to the Chrome Web Store', /^https:\/\/chromewebstore\.google\.com\//.test(chrome));
check('the two are different listings', chrome !== firefox);
check('both land on the reviews page, not the overview',
  /\/reviews\/?$/.test(chrome) && /\/reviews\/?$/.test(firefox),
  'the ask is for a review; making someone hunt for the tab loses most of them');

// Edge and Brave are chrome-extension:// and have no separate listing here.
check('other Chromium browsers resolve to the Chrome listing',
  storeReviewUrl('chrome-extension://xyz/x.html') === chrome);
check('an unreadable origin does not produce a broken link',
  storeReviewUrl('') === chrome && storeReviewUrl(null) === chrome && storeReviewUrl(undefined) === chrome,
  'the Chrome store is the larger audience, so it is the safer guess');

// The IDs have to match what is actually published; docs/ is where they live.
const install = fs.readFileSync(path.join(ROOT, 'docs/installation.md'), 'utf8');
check('the Chrome listing matches the one the docs link to',
  install.includes(chrome.replace('/reviews', '')),
  'a typo in the extension ID is a 404 on the one page meant to collect reviews');
check('and so does the Firefox listing',
  install.includes(firefox.replace('reviews/', '')));

// ── When to ask ──
check('a fresh install is not asked, it starts a clock',
  reviewPromptDecision(undefined, NOW) === 'start',
  'asking on day one is how a review prompt earns one star');
check('and is still not asked the next day',
  reviewPromptDecision({ after: NOW + 14 * DAY }, NOW + DAY) === 'wait');
check('once the clock runs out, it asks',
  reviewPromptDecision({ after: NOW }, NOW) === 'show');
check('and keeps asking until answered, since a popup may not be reopened for weeks',
  reviewPromptDecision({ after: NOW }, NOW + 100 * DAY) === 'show');

check('either answer settles it for good',
  reviewPromptDecision({ answered: true }, NOW) === 'never' &&
  reviewPromptDecision({ answered: true }, NOW + 1000 * DAY) === 'never',
  'being asked twice is worse than never being asked');
check('an answer outranks a clock that is still running',
  reviewPromptDecision({ answered: true, after: NOW + 14 * DAY }, NOW) === 'never');

// ── State that does not parse ──
check('a missing timestamp restarts the clock rather than showing the prompt',
  reviewPromptDecision({}, NOW) === 'start' &&
  reviewPromptDecision({ after: 'soon' }, NOW) === 'start' &&
  reviewPromptDecision({ after: null }, NOW) === 'start');
check('and null state is treated as a fresh install',
  reviewPromptDecision(null, NOW) === 'start');

// ── The popup honours the decision ──
// Reading these back from source, because the wiring is where the rule gets
// undone: writing the answer to the wrong place, or to the wrong storage area.
const popup = fs.readFileSync(path.join(ROOT, 'js/popup.js'), 'utf8');

check('the popup asks the shared rule rather than re-deriving it',
  /SFTabs\.utils\.reviewPromptDecision\(stored, Date\.now\(\)\)/.test(popup));
check("'start' writes the clock and shows nothing",
  /decision === 'start'[\s\S]{0,300}reviewPrompt: \{ after: Date\.now\(\) \+ REVIEW_PROMPT_DELAY_MS \}/.test(popup));
check('both buttons record the answer',
  /yes\.addEventListener\('click', answered\)/.test(popup) &&
  /no\.addEventListener\('click', answered\)/.test(popup),
  'following the link is as much an answer as declining');

// userSettings is exported, imported and synced. None of those should decide
// whether this device has asked you for a review.
check('the answer is kept out of userSettings',
  /browser\.storage\.local\.set\(\{\s*reviewPrompt/.test(popup) &&
  !/patchSettings\(\{[^}]*reviewPrompt/.test(popup),
  'importing settings must not un-answer a prompt, or answer one for you');
check('storage failures never surface as an error to the user',
  /browser\.storage\.local\.set\(\{ reviewPrompt: \{ answered: true \} \}\)\.catch\(\(\) => \{\}\)/.test(popup),
  'the prompt is already hidden; a failed write is not worth a toast');

console.log('\n' + passed + '/' + (passed + failed) + ' passed');
process.exit(failed ? 1 : 0);
