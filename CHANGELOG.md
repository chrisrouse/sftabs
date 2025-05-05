# Changelog

## [1.2.0] - May 4, 2025
- Updated selectors for light and dark mode. It should automatically use your previous setting, but you may have to reselect the correct mode.
- Added Compact Mode for more efficient tab display. Makes it easier to see more tabs in the popup.
- Enhanced tab type detection with visual indicators (Setup, Object, Custom).
- Better support for Object Manager paths and custom URLs.
- Improved tab creation from current page with intelligent label detection.
- Removed panel height selector since the range was limited by browser defaults.
- Fixed header and improved scrolling in popup
- Improved active tab handling. Removed the active style from the Setup and Object Manager tabs. This occasionally doesn't work due to issues with how long some Setup pages take to load.

## [1.1.0] - April 19, 2025

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