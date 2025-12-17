# SF Tabs Translation Reference

This document lists all translatable strings in the SF Tabs extension, organized by location and context.

**Total Strings: ~120**

---

## Extension Metadata

**Location:** `manifest.json`

| Message Key | English Text | Context |
|------------|--------------|---------|
| `extensionName` | "SF Tabs" | Extension name shown in browser |
| `extensionDescription` | "Add custom tabs to the Salesforce setup menu." | Extension description in store |

---

## Popup Interface

**Location:** `popup/popup.html`

### Header
| Message Key | English Text | Context |
|------------|--------------|---------|
| `popupTitle` | "SF Tabs" | Main popup title |

### Tabs Section
| Message Key | English Text | Context |
|------------|--------------|---------|
| `tabsHeader` | "Tabs" | Section header |
| `addNewTab` | "Add New Tab" | Button to add new tab |
| `tabName` | "Tab Name" | Input label for tab name |
| `tabPath` | "Tab Path" | Input label for tab path |
| `saveTab` | "Save" | Save tab button |
| `editTab` | "Edit Tab" | Edit tab button |
| `deleteTab` | "Delete Tab" | Delete tab button |
| `moveTabUp` | "Move Up" | Move tab up button |
| `moveTabDown` | "Move Down" | Move tab down button |

### Settings Section (Popup)
| Message Key | English Text | Context |
|------------|--------------|---------|
| `settingsHeader` | "Settings" | Section header |
| `openFullSettingsButton` | "Open Full Settings Page" | Button text |
| `openFullSettingsHelp` | "Try the new standalone settings page with a better layout and all configuration options in one place" | Help text below button |
| `themeMode` | "Theme Mode" | Theme setting label |
| `themeLight` | "Light" | Light theme option |
| `themeDark` | "Dark" | Dark theme option |
| `themeSystem` | "System" | System theme option |
| `compactMode` | "Compact Mode" | Compact mode checkbox label |
| `compactModeDescription` | "Display tabs in a more condensed layout" | Help text |
| `skipDeleteConfirmation` | "Skip Delete Confirmation" | Checkbox label |
| `skipDeleteConfirmationDescription` | "Don't ask for confirmation when deleting tabs" | Help text |
| `manageConfig` | "Manage Configuration" | Button text |
| `resetToDefaults` | "Reset to Defaults" | Button text |

---

## Settings Page

**Location:** `popup/settings.html`

### Header
| Message Key | English Text | Context |
|------------|--------------|---------|
| `settingsPageTitle` | "SF Tabs Settings" | Page title (H1) |
| `settingsSubtitle` | "Customize your SF Tabs experience" | Subtitle below title |
| `versionInfo` | "SF Tabs v$VERSION$" | Version number (with placeholder) |
| `changelog` | "Changelog" | Link to changelog |

### Appearance Section
| Message Key | English Text | Context |
|------------|--------------|---------|
| `appearanceSection` | "Appearance" | Section heading with icon |
| `appearanceDescription` | "Customize the look and feel of your extension" | Section description |
| (Theme settings - same as popup) | | |

### Behavior Section
| Message Key | English Text | Context |
|------------|--------------|---------|
| `behaviorSection` | "Behavior" | Section heading |
| `behaviorDescription` | "Control how the extension behaves" | Section description |
| (Skip delete confirmation - same as popup) | | |

### Sync & Storage Section
| Message Key | English Text | Context |
|------------|--------------|---------|
| `syncStorageSection` | "Sync & Storage" | Section heading |
| `syncStorageDescription` | "Manage how your tabs are stored and synced" | Section description |
| `useSyncStorage` | "Cross-Device Sync" | Checkbox label |
| `useSyncStorageDescription` | "Sync your tabs across all devices using browser sync" | Help text |

### Profiles Section
| Message Key | English Text | Context |
|------------|--------------|---------|
| `profilesSection` | "Profiles" | Section heading |
| `profilesDescription` | "Organize tabs into different profiles for different Salesforce orgs" | Section description |
| `enableProfiles` | "Enable Profiles" | Checkbox label |
| `enableProfilesDescription` | "Create separate sets of tabs for different Salesforce orgs" | Help text |
| `autoSwitchProfiles` | "Auto-Switch Profiles" | Checkbox label |
| `autoSwitchProfilesDescription` | "Automatically switch to the appropriate profile based on the current Salesforce org's URL" | Help text |

### Keyboard Shortcuts Section
| Message Key | English Text | Context |
|------------|--------------|---------|
| `keyboardShortcutsSection` | "Keyboard Shortcuts" | Section heading |
| `keyboardShortcutsDescription` | "Set up keyboard shortcuts to quickly access your tabs" | Section description |
| `configureKeyboardShortcuts` | "Configure Keyboard Shortcuts" | Button text |
| `keyboardShortcutsHelp` | "Set keyboard shortcuts to quickly open tabs 1-10 by position" | Help text |

### Import & Export Section
| Message Key | English Text | Context |
|------------|--------------|---------|
| `importExportSection` | "Import & Export" | Section heading |
| `importExportDescription` | "Backup and restore your configuration" | Section description |
| `exportButton` | "Export" | Button text |
| `exportActionTitle` | "Export" | Action card title |
| `exportActionDescription` | "Save to file" | Action card description |
| `importButton` | "Import" | Button text |
| `importActionTitle` | "Import" | Action card title |
| `importActionDescription` | "Restore from backup" | Action card description |

### Danger Zone Section
| Message Key | English Text | Context |
|------------|--------------|---------|
| `dangerZoneSection` | "Danger Zone" | Section heading (red) |
| `dangerZoneDescription` | "Irreversible actions that will affect your data" | Section description |
| `resetButton` | "Reset to Defaults" | Button text |
| `resetButtonDescription` | "This will remove all custom tabs and reset all settings to their default values. This action cannot be undone." | Help text |

---

## Modal Dialogs

**Location:** `popup/settings.html` and JavaScript

### Export Modal
| Message Key | English Text | Context |
|------------|--------------|---------|
| `exportModalTitle` | "Export Configuration" | Modal title |
| `exportModalPrompt` | "Select what you want to export:" | Prompt text |
| `exportEverything` | "Everything" | Checkbox label |
| `exportEverythingDescription` | "Export all settings and profiles" | Help text |
| `exportSettingsOnly` | "Settings" | Checkbox label |
| `cancelButton` | "Cancel" | Button text (all modals) |
| `exportConfirmButton` | "Export" | Confirm button text |

### Import Modal
| Message Key | English Text | Context |
|------------|--------------|---------|
| `importModalTitle` | "Import Configuration" | Modal title |
| `importModalPrompt` | "Where would you like to import this configuration?" | Prompt text |
| `importOverwriteProfile` | "Overwrite existing profile" | Radio button label |
| `importCreateProfile` | "Create new profile" | Radio button label |
| `selectProfile` | "Select profile:" | Dropdown label |
| `selectProfilePlaceholder` | "Choose a profile..." | Dropdown placeholder |
| `newProfileName` | "Profile name:" | Input label |
| `newProfileNamePlaceholder` | "Enter profile name" | Input placeholder |
| `importConfirmButton` | "Import" | Confirm button text |

### Reset Confirmation Modal
| Message Key | English Text | Context |
|------------|--------------|---------|
| `resetModalTitle` | "Reset to Defaults" | Modal title |
| `resetModalPrompt` | "Are you sure you want to reset to default tabs and settings? This will:" | Prompt text |
| `resetModalItem1` | "Remove all custom tabs" | List item |
| `resetModalItem2` | "Remove all profiles" | List item |
| `resetModalItem3` | "Reset all settings to defaults" | List item |
| `resetModalWarning` | "This action cannot be undone!" | Warning text (bold/red) |
| `confirmButton` | "Confirm" | Confirm button text |

---

## Confirmation Dialogs

**Location:** JavaScript `confirm()` dialogs

### Sync Storage Confirmations
| Message Key | English Text | Context |
|------------|--------------|---------|
| `enableSyncConfirmMessage` | "Enable cross-device sync?\n\nYour tabs will be synced across all your computers using browser sync. This allows you to access your custom tabs on any device where you're signed in.\n\nNote: Large configurations (>100KB) may not sync properly. Click OK to continue." | Shown when enabling sync |
| `disableSyncConfirmMessage` | "Disable cross-device sync?\n\nYour tabs will only be stored on this computer. They will not sync to other devices.\n\nClick OK to continue." | Shown when disabling sync |

### Profile Confirmations
| Message Key | English Text | Context |
|------------|--------------|---------|
| `disableProfilesConfirmMessage` | "Disable profiles?\n\nThis will merge all tabs from all profiles into a single tab list. You can re-enable profiles later.\n\nClick OK to continue." | Shown when disabling profiles |

---

## Status Messages

**Location:** JavaScript status notifications (bottom-right popup)

### Success Messages
| Message Key | English Text | Context |
|------------|--------------|---------|
| `settingsSaved` | "Settings saved" | After saving settings |
| `settingsReset` | "All settings and tabs reset to defaults" | After reset |
| `configExported` | "Configuration exported successfully" | After export |
| `configImported` | "Configuration imported successfully" | After import |
| `tabsImportedToProfile` | "Tabs imported to selected profile" | After profile-specific import |
| `profileCreated` | "New profile created with imported tabs" | After creating new profile |
| `syncEnabled` | "Sync enabled - tabs will now sync across devices" | After enabling sync |
| `syncDisabled` | "Sync disabled - tabs stored locally only" | After disabling sync |

### Error Messages
| Message Key | English Text | Context |
|------------|--------------|---------|
| `errorSavingSettings` | "Error saving settings: $ERROR$" | When settings save fails |
| `errorExport` | "Export failed: $ERROR$" | When export fails |
| `errorImport` | "Import failed: $ERROR$" | When import fails |
| `errorReset` | "Reset failed: $ERROR$" | When reset fails |
| `errorInvalidConfig` | "Invalid configuration file - missing required fields" | When import file is invalid |
| `selectProfileError` | "Please select a profile" | When no profile selected in import modal |
| `profileNameError` | "Please enter a profile name" | When profile name is empty |
| `couldNotOpenShortcuts` | "Could not open shortcuts page" | When keyboard shortcuts page fails to open |
| `couldNotDetectBrowser` | "Could not detect browser type" | When browser detection fails |

---

## Keyboard Commands

**Location:** `manifest.json` commands section

| Message Key | English Text | Context |
|------------|--------------|---------|
| `commandTab1` | "Tab 1" | Keyboard shortcut description |
| `commandTab2` | "Tab 2" | Keyboard shortcut description |
| `commandTab3` | "Tab 3" | Keyboard shortcut description |
| `commandTab4` | "Tab 4" | Keyboard shortcut description |
| `commandTab5` | "Tab 5" | Keyboard shortcut description |
| `commandTab6` | "Tab 6" | Keyboard shortcut description |
| `commandTab7` | "Tab 7" | Keyboard shortcut description |
| `commandTab8` | "Tab 8" | Keyboard shortcut description |
| `commandTab9` | "Tab 9" | Keyboard shortcut description |
| `commandTab10` | "Tab 10" | Keyboard shortcut description |

---

## Translation Notes

### General Guidelines
1. **Maintain tone**: The extension uses friendly, professional language
2. **Keep it concise**: Space is limited in the UI, especially for buttons and labels
3. **Be consistent**: Use the same terminology throughout (e.g., "tabs" not "bookmarks")
4. **Preserve formatting**: Maintain `\n` for line breaks in confirmation dialogs
5. **Test placeholders**: Messages with `$VARIABLE$` will have values inserted at runtime

### Salesforce-Specific Terms
- **"Salesforce org"**: The term "org" is common in Salesforce terminology and may not need translation
- **"Setup menu"**: Refers to the Salesforce Setup menu - use official Salesforce translation if available
- **"Tab"**: In this context, refers to navigation tabs, not browser tabs

### Technical Terms to Keep in English
- "Sync" (as in cross-device synchronization) - commonly used internationally
- "Import/Export" - standard file operations
- "Profile" - used in software context

### Context-Specific Notes
- **Theme names** (Light/Dark/System): Keep simple and universally understood
- **Modal button text**: Should be action-oriented and clear
- **Error messages**: Should be helpful and not overly technical

---

## File Structure for New Languages

To add a new language (e.g., Spanish):

1. Create directory: `_locales/es/`
2. Copy `_locales/en/messages.json` to `_locales/es/messages.json`
3. Translate all `"message"` values (keep keys and structure the same)
4. Do NOT translate `"description"` fields - these are for translators' reference
5. Test the extension with the new language

---

## Priority Languages

Recommended order for translation based on Salesforce user base:

1. **English** (en) - ✅ Complete
2. **Spanish** (es) - Large Salesforce market
3. **French** (fr) - Salesforce commonly used in France/Canada
4. **German** (de) - Strong European market
5. **Japanese** (ja) - Major Asian market
6. **Portuguese** (pt_BR) - Brazilian market
7. **Italian** (it) - European market
8. **Dutch** (nl) - European market

---

## Testing Translations

After adding a new language:

1. Set browser language to the target language
2. Reload the extension
3. Check all UI elements for:
   - Correct translation
   - No text overflow or truncation
   - Proper formatting (line breaks, placeholders)
4. Test all modal dialogs
5. Verify error messages appear correctly

---

## Translation Tools

Recommended tools for translation:

- **DeepL**: High-quality machine translation
- **Google Translate**: Widely available
- **Crowdin/Lokalise**: Professional translation management platforms
- **Native speakers**: Always preferred for final review

---

## Questions?

For translation questions or issues:
- GitHub Issues: https://github.com/chrisrouse/sftabs/issues
- Tag issues with "translation" label
