#!/usr/bin/env node
/**
 * Importing profiles restores the ones already here rather than copying them.
 *
 * Every imported profile used to get a fresh id. Restoring your own backup
 * therefore added a second Default, Dev1, Staging and so on beside the
 * originals, and the imported settings still named the original ids — so the
 * popup went on showing the old profiles, and the restored tabs sat in copies
 * nothing pointed at. From the user's side the import did nothing.
 *
 * Runs the real settings.js import against the real storage layer, with an
 * in-memory storage area standing in for the browser's.
 *
 * Run: npm test
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
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

function storageArea() {
  const data = {};
  return {
    get: async keys => {
      if (keys == null) return structuredClone(data);
      const list = typeof keys === 'string' ? [keys] : keys;
      return Object.fromEntries(list.filter(k => k in data).map(k => [k, structuredClone(data[k])]));
    },
    set: async items => { Object.entries(items).forEach(([k, v]) => { data[k] = structuredClone(v); }); },
    remove: async keys => { [].concat(keys).forEach(k => delete data[k]); },
  };
}

/** A settings page with its scripts loaded, over empty storage. */
function loadSettingsPage() {
  const context = {
    console, structuredClone, Blob, TextEncoder,
    browser: {
      storage: { sync: storageArea(), local: storageArea(), onChanged: { addListener() {} } },
    },
    chrome: { i18n: { getMessage: key => key } },
    document: { addEventListener() {} },
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  [
    'popup/js/shared/constants.js',
    'popup/js/shared/utils.js',
    'popup/js/storage-chunking.js',
    'popup/js/popup-storage.js',
    'popup/settings.js',
  ].forEach(file => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file }));
  return context;
}

const tab = (id, label) => ({ id, label, path: label, position: 0 });

async function run() {
  // ── Restoring a backup of this install ──
  {
    const page = loadSettingsPage();
    const storage = page.SFTabs.storage;
    await storage.saveProfiles([
      { id: 'p_dev', name: 'Dev1', isDefault: true, urlPatterns: ['acme--dev1'], position: 0 },
      { id: 'p_mine', name: 'Not in the file', urlPatterns: [], position: 1 },
    ], false);
    await storage.saveProfileTabs('p_dev', [tab('old', 'Emptied Out')]);
    await storage.saveUserSettings({ ...page.SFTabs.constants.DEFAULT_SETTINGS,
      profilesEnabled: true, activeProfileId: 'p_dev' }, true, false);
    await page.loadUserSettings();

    const file = {
      version: '2.0.0',
      settings: { activeProfileId: 'p_dev', themeMode: 'dark' },
      profiles: [
        { id: 'p_dev', name: 'Dev1', isDefault: true, urlPatterns: ['acme--dev1'], position: 0 },
        { id: 'p_qa', name: 'QA', urlPatterns: ['acme--qa'], position: 2 },
      ],
      profileData: {
        p_dev: [tab('flows', 'Flows'), tab('users', 'Users')],
        p_qa: [tab('perms', 'Permission Sets')],
      },
    };
    await page.importSelectedProfiles(file, ['p_dev', 'p_qa'], true);

    const profiles = await storage.getProfiles();
    const settings = await storage.getUserSettings();
    const names = profiles.map(p => p.name);

    check('a profile already here is not copied', names.filter(n => n === 'Dev1').length === 1,
      names.join(', '));
    check('its tabs are replaced with the ones in the file',
      (await storage.getProfileTabs('p_dev')).map(t => t.label).join() === 'Flows,Users');
    check('a profile new to this install is added under its own id',
      profiles.some(p => p.id === 'p_qa') && (await storage.getProfileTabs('p_qa')).length === 1);
    check('a profile the file does not mention is left alone',
      profiles.some(p => p.id === 'p_mine'));
    check('the imported active profile exists, so the popup shows the restored tabs',
      profiles.some(p => p.id === settings.activeProfileId), settings.activeProfileId);
  }

  // ── A file from another install ──
  {
    const page = loadSettingsPage();
    const storage = page.SFTabs.storage;
    await storage.saveProfiles([{ id: 'p_here', name: 'Dev1', urlPatterns: [], position: 0 }], false);
    await storage.saveProfileTabs('p_here', [tab('mine', 'Mine')]);
    await page.loadUserSettings();

    await page.importSelectedProfiles({
      version: '2.0.0',
      settings: {},
      profiles: [{ id: 'p_elsewhere', name: 'Dev1', urlPatterns: [], position: 0 }],
      profileData: { p_elsewhere: [tab('theirs', 'Theirs')] },
    }, ['p_elsewhere'], false);

    const profiles = await storage.getProfiles();
    check('a different install\'s profile is added, even under a matching name',
      profiles.length === 2);
    check('and the profile already here keeps its own tabs',
      (await storage.getProfileTabs('p_here')).map(t => t.label).join() === 'Mine');
  }
}

run().then(() => {
  console.log('\n' + passed + '/' + (passed + failed) + ' passed');
  process.exit(failed ? 1 : 0);
});
