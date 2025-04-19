# Changelog

## [1.0.1] - April 19, 2025

### Enhancements
- Hover color for tabs now follows the branding of the current theme in you org.

### Bug fixes
- Improved handling of tabs across multiple tabs or windows so that they no longer randomly disappear. 
- There was an issue where switching between Object Manager, a custom tab, and back again would also cause all of the tabs to change to the active styling.

### Notes
- Setting the custom active tab is tricky due to how Salesforce handles the tabs. For now, only hover color works.

## [1.0.0] - April 8, 2025

### Initial Release 🚀

#### Features
- Add, edit, and remove custom Salesforce setup tabs
- Customize tab names and paths
- Option to open tabs in new browser tab
- Drag-and-drop tab reordering
- Quick tab creation from current setup page
- Adjustable panel height
- Theme customization (light/dark/system)
- Import/Export configuration functionality
- Persistent local storage of tab configurations

#### Technical Details
- Fully client-side implementation
- Zero external data transmission
- Browser storage sync for configuration