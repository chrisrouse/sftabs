// docs/snippets/seed-v2-install.js
//
// Write a realistic SF Tabs 2.1.1 install into storage, so the upgrade to 3.0.0
// can be walked by hand before release. That path cannot be rehearsed
// afterwards and cannot be reached by using the extension normally.
//
// USE A THROWAWAY BROWSER PROFILE. This clears both storage areas first, and
// clearing sync propagates to every device signed into the same browser
// account. It is not undoable.
//
// 1. Fresh browser profile, install 2.1.1 (or 3.0.0 — the data is what matters)
// 2. Right-click the toolbar icon -> Inspect popup
// 3. Chrome needs `allow pasting` typed into the console once
// 4. Paste this, wait for "seeded"
// 5. Load 3.0.0 over it, reload the extension, open the popup
//
// Then check, in this order:
//   - the popup opens on a tab list rather than an error or an empty panel
//   - the Prod profile lists three tabs; it was chunked, so this is the one
//     that goes silently empty if reassembly is wrong
//   - Settings shows dark theme and "skip delete confirmation" on
//   - the floating button is where it was: right edge, Setup pages only
//   - Org Colors, tab colors, header menu and the banner are all OFF
//   - docs/snippets/profile-report.js says "local mirror in step"
//
// The same fixture is asserted automatically by test/v2-upgrade.test.js, and a
// test fails if this copy drifts from docs/test-fixtures/v2-install.json.

(async function () {
  'use strict';

  const api = globalThis.browser?.storage ? globalThis.browser : globalThis.chrome;
  if (!api?.storage) {
    console.error('Run this on an extension page — right-click the toolbar icon, Inspect popup.');
    return;
  }

  const V2_INSTALL = {
    "_comment": [
      "A realistic SF Tabs 2.1.1 install, as it sits in storage the moment before",
      "3.0.0 replaces it. Used two ways:",
      "",
      "  test/v2-upgrade.test.js   runs v3's readers over it on every npm test",
      "  docs/snippets/seed-v2-install.js  writes it into a browser so the upgrade",
      "                                     can be walked by hand before release",
      "",
      "Chosen to be awkward on purpose, since the easy shape proves nothing:",
      "  - sync storage, which is what most installs use",
      "  - a chunked profile, whose tabs live in _chunk_N and not under the key",
      "  - a floatingButton written before side/offset/layout existed, carrying",
      "    only the legacy `position` percentage",
      "  - profiles with linked orgs, so auto-switch has something to resolve",
      "  - a v1-era customTabs list still sitting there, as it does on old installs",
      "  - none of the six settings keys 3.0.0 added"
    ],
    "local": {
      "deviceSettings": {
        "useSyncStorage": true
      },
      "userSettings": {
        "themeMode": "dark",
        "compactMode": false,
        "skipDeleteConfirmation": true,
        "useSyncStorage": true,
        "profilesEnabled": true,
        "autoSwitchProfiles": true,
        "activeProfileId": "1699999999999_prodv2",
        "defaultProfileId": "1699999999998_defaultv2",
        "floatingButton": {
          "enabled": true,
          "position": 40,
          "location": "setup-only",
          "defaultVisibility": true,
          "visibilityRules": [],
          "buttonSize": "medium",
          "showLabel": false
        }
      },
      "migrationCompleted": "2.1.1",
      "seenReleaseNotesVersion": "2.1.0",
      "firstLaunchCompleted": true
    },
    "sync": {
      "userSettings": {
        "themeMode": "dark",
        "compactMode": false,
        "skipDeleteConfirmation": true,
        "profilesEnabled": true,
        "autoSwitchProfiles": true,
        "activeProfileId": "1699999999999_prodv2",
        "defaultProfileId": "1699999999998_defaultv2",
        "floatingButton": {
          "enabled": true,
          "position": 40,
          "location": "setup-only",
          "defaultVisibility": true,
          "visibilityRules": [],
          "buttonSize": "medium",
          "showLabel": false
        }
      },
      "firstLaunchCompleted": true,
      "profiles": [
        {
          "id": "1699999999998_defaultv2",
          "name": "Default",
          "isDefault": true,
          "urlPatterns": [],
          "createdAt": "2025-11-14T09:00:00.000Z",
          "lastActive": "2026-08-01T12:00:00.000Z"
        },
        {
          "id": "1699999999999_prodv2",
          "name": "Prod",
          "isDefault": false,
          "urlPatterns": [
            "acme"
          ],
          "createdAt": "2025-11-14T09:05:00.000Z",
          "lastActive": "2026-08-02T12:00:00.000Z"
        }
      ],
      "profile_1699999999998_defaultv2_tabs": [
        {
          "id": "t_flows",
          "label": "Flows",
          "path": "Flows",
          "position": 0,
          "openInNewTab": false,
          "isObject": false,
          "isCustomUrl": false,
          "isSetupObject": false
        },
        {
          "id": "t_users",
          "label": "Users",
          "path": "ManageUsers",
          "position": 1,
          "openInNewTab": false,
          "isObject": false,
          "isCustomUrl": false,
          "isSetupObject": false
        },
        {
          "id": "t_obj",
          "label": "Account",
          "path": "ObjectManager/Account",
          "position": 2,
          "openInNewTab": false,
          "isObject": false,
          "isCustomUrl": false,
          "isSetupObject": true,
          "dropdownItems": [
            {
              "id": "t_obj_fields",
              "label": "Fields & Relationships",
              "path": "ObjectManager/Account/FieldsAndRelationships/view",
              "parentId": "t_obj"
            }
          ]
        }
      ],
      "profile_1699999999999_prodv2_tabs_metadata": {
        "chunked": true,
        "chunkCount": 2
      },
      "profile_1699999999999_prodv2_tabs_chunk_0": "[{\"id\":\"p_flows\",\"label\":\"Flows\",\"path\":\"Flows\",\"position\":0,\"openInNewTab\":false,\"isObject\":false,\"isCustomUrl\":false,\"isSetupObject\":false},{\"id\":\"p_perm\",\"label\":\"Permission Sets\",\"path\":\"PermSets\",\"position\":1,\"openInNewTab\":false,\"isObject\":false,\"isCustomUrl\":false,\"isSetupObject\":false},",
      "profile_1699999999999_prodv2_tabs_chunk_1": "{\"id\":\"p_url\",\"label\":\"Status\",\"path\":\"https://status.salesforce.com\",\"position\":2,\"openInNewTab\":true,\"isObject\":false,\"isCustomUrl\":true,\"isSetupObject\":false}]",
      "customTabs": [
        {
          "id": "v1_flows",
          "label": "Flows (v1)",
          "path": "Flows",
          "position": 0
        }
      ]
    }
  };

  const { _comment, ...areas } = V2_INSTALL;

  await api.storage.local.clear();
  try {
    await api.storage.sync.clear();
  } catch (error) {
    console.warn('sync could not be cleared:', error.message);
  }

  await api.storage.local.set(areas.local);
  await api.storage.sync.set(areas.sync);

  console.log('%cseeded a 2.1.1 install', 'font-weight:bold');
  console.log('local:', Object.keys(areas.local).join(', '));
  console.log('sync :', Object.keys(areas.sync).join(', '));
  console.log('\nNow load 3.0.0 over it and reload the extension. Close this popup ' +
    'first — it is holding the old settings in memory and will write them back ' +
    'if you touch anything.');
})();
