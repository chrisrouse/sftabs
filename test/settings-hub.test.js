#!/usr/bin/env node
/**
 * The Settings hub.
 *
 * Settings is a grid of tiles that open a section in place. Four things can
 * break silently as sections keep arriving from popup/settings.html, and none
 * of them throws — you just get a tile that does nothing, or a header stuck
 * saying "Settings":
 *
 *   1. a tile whose data-settings-section names no section, or the reverse
 *   2. a section shipped visible, so two show at once
 *   3. a section with no .settings-section-title, which showSettingsSection()
 *      reads to retitle the header
 *   4. a section promoted to a top-level panel-view, which would falsify the
 *      `activeView === 'settings'` and `!== 'empty'` comparisons the rest of
 *      the popup makes — the same trap as the old `activeView === 'edit'` bug,
 *      where the stored value was 'edit-tab' and the guard never fired
 *
 * Run: npm test
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'popup.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'js/popup.js'), 'utf8');

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

const panel = html.slice(
  html.indexOf('id="view-settings"'),
  html.indexOf('<!-- View: Release Notes')
);

const tiles = [...panel.matchAll(/class="settings-tile" data-settings-section="([a-z-]+)"/g)].map(m => m[1]);
const sections = [...panel.matchAll(/class="settings-section" data-settings-section="([a-z-]+)"/g)].map(m => m[1]);

// ── 1. Tiles and sections pair up ──
check('there is at least one tile', tiles.length > 0, tiles.join(', '));
check('every tile opens a section that exists',
  tiles.every(t => sections.includes(t)),
  tiles.filter(t => !sections.includes(t)).join(', ') || 'all matched');
check('every section is reachable from a tile',
  sections.every(s => tiles.includes(s)),
  sections.filter(s => !tiles.includes(s)).join(', ') || 'all reachable');
check('no tile is declared twice', new Set(tiles).size === tiles.length);

// ── 2. Resting state: hub showing, everything else put away ──
check('the hub is visible at rest',
  !/id="settings-hub"[^>]*\shidden[\s>]/.test(panel));
check('every section ships hidden',
  sections.every(id => {
    const at = panel.indexOf(`data-settings-section="${id}"\n`);
    const tag = panel.slice(panel.lastIndexOf('<section', at), panel.indexOf('>', at) + 1);
    return /\shidden[\s>]/.test(tag);
  }));
check('the back button ships hidden',
  /id="btn-settings-back"[^>]*\shidden[\s>]/.test(panel));

// ── 3. Each section can name itself in the header ──
sections.forEach(id => {
  const from = panel.indexOf(`data-settings-section="${id}"`);
  const body = panel.slice(from, panel.indexOf('</section>', from));
  check(`section "${id}" carries a title for the header`,
    body.includes('settings-section-title'));
});

// ── 4. Settings stays one panel-view ──
// showView() owns the tray's top-level views. If a settings section is ever
// added there, `activeView === 'settings'` stops being true while a section is
// open and the footer gear silently stops reflecting its own state.
const viewsLine = /const views = \[([^\]]+)\]/.exec(js);
check('showView still declares its view list', Boolean(viewsLine));
if (viewsLine) {
  const views = viewsLine[1].split(',').map(v => v.trim().replace(/'/g, ''));
  check('no settings section leaked into showView\'s view list',
    !views.some(v => v.startsWith('settings-')),
    views.join(' '));
  check('settings is still a single view', views.filter(v => v === 'settings').length === 1);
}

// ── 5. The controls that moved are all still present, exactly once ──
// They moved between parents in the DOM; their handlers bind by id, so a typo
// during the move is silent until someone clicks the control.
['setting-compact', 'setting-tab-colors', 'row-tab-color-style', 'setting-skip-delete',
 'setting-profiles', 'setting-auto-switch', 'auto-switch-hint', 'profiles-manage',
 'profiles-list', 'btn-new-profile-from-list',
 'btn-advanced-settings', 'settings-title', 'settings-hub'].forEach(id => {
  const n = (panel.match(new RegExp(`id="${id}"`, 'g')) || []).length;
  check(`#${id} appears exactly once in the panel`, n === 1, n === 1 ? '' : `found ${n}`);
});

check('the theme control survived the move',
  (panel.match(/data-theme-val="/g) || []).length === 3);
check('the storage radios survived the move',
  (panel.match(/name="storage-type"/g) || []).length === 2);

// ── 6. Profiles is managed in its section, not a sheet of its own ──
// The list used to live in a separate panel-view reached through a Manage
// button. Both are gone; if either comes back, the feature has two homes again.
check('the standalone profiles sheet is gone', !html.includes('id="view-profiles"'));
check('nothing still routes to it', !/showView\('profiles'\)/.test(js));
check('the Manage button is gone', !panel.includes('btn-manage-profiles-settings'));
check('everything below the enable toggle hides as one block',
  /id="profiles-manage"/.test(panel) && /getElementById\('profiles-manage'\)/.test(js));

// ── 7. "Start with" only ever appears while creating ──
// Shown when editing, it would offer to replace a profile's existing tabs.
check('the seed group ships hidden',
  /id="group-profile-seed"[^>]*\shidden[\s>]/.test(html));
check('it offers three starting points',
  (html.match(/name="profile-seed"/g) || []).length === 3);
check('empty is the preselected starting point',
  /value="none" checked/.test(html));
check('the copy picker starts disabled, since copy is not preselected',
  /id="input-profile-seed-source"[\s\S]{0,120}?disabled/.test(html));
check('the form tracks creating separately from the autosaved id',
  /profileFormIsNew/.test(js) && /state\.profileFormIsNew = !profile/.test(js));
check('editing hides the control rather than disabling it',
  /group\.hidden = !state\.profileFormIsNew/.test(js));

console.log('\n' + passed + '/' + (passed + failed) + ' passed');
process.exit(failed ? 1 : 0);
