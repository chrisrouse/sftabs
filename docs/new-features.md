---
layout: default
title: New Features
---

# What's New in v2.0

SF Tabs v2.0 introduces powerful new features to help you manage tabs across multiple Salesforce orgs and organize your setup pages more efficiently.


## 🆕 Major Features

### Profiles

Create multiple tab configurations for different Salesforce orgs, projects, or work contexts. Each profile can have its own unique collection of tabs.

**Key capabilities:**
- **Multiple profiles** - Create unlimited profiles for different orgs or use cases
- **Automatic switching** - Profiles can automatically switch based on Salesforce org URL patterns
- **URL pattern matching** - Configure MyDomain patterns for each profile
- **Easy management** - Create, edit, rename, and delete profiles through a dedicated interface
- **Profile cloning** - Duplicate existing profiles to create new ones quickly

**Use cases:**
- Separate profiles for Production, Sandbox, Developer Edition, and Scratch orgs
- Different profiles for different clients or projects (consultants)
- Role-based profiles (Admin, Developer, Configuration)

[Learn more about Profiles →](profiles)

---

### Dropdown Menus

Organize related tabs under dropdown menus for a cleaner, more organized Setup menu experience.

**Two types of dropdowns:**

#### 1. Object Manager Dropdowns (Automatic)
Automatically generate dropdown menus for Salesforce objects with all their sub-pages:
- Details
- Fields & Relationships
- Page Layouts
- Buttons, Links, and Actions
- Validation Rules
- Triggers
- And more...

#### 2. Manual Dropdowns (Drag & Drop)
Create custom dropdown menus by dragging tabs onto a parent tab:
- Group related Setup pages together
- Create folder-style containers
- Build hierarchical menu structures
- Reorder dropdown items easily

**Benefits:**
- Reduces clutter in your Setup menu
- Groups related functionality together
- Provides better organization for complex setups
- Supports nested navigation patterns

[Learn more about Dropdown Menus →](managing-tabs#creating-dropdown-menus)

---

### Flexible Storage Options

Choose between two storage modes based on your needs and usage patterns.

#### Sync Storage (Recommended)
- **Cloud-based** - Automatically syncs across all your devices
- **Cross-device** - Same tabs on desktop, laptop, etc.
- **Capacity** - ~50 tabs (8KB browser sync storage limit)
- **Data chunking** - Automatically splits data into smaller chunks
- **Best for** - Most users with moderate tab counts

#### Local Storage
- **Device-specific** - Stored only on this device
- **Unlimited** - No practical limit on tab count (several MB available)
- **No sync** - Does not sync to other devices
- **Best for** - Power users with many tabs or device-specific setups

**Migration support:**
- Seamlessly switch between storage types in Settings
- Data automatically transfers when changing storage mode
- No data loss during storage migration

[Learn more about Storage Options →](settings#data)

---

## 🔧 Improvements & Enhancements

### Enhanced Data Architecture
- New profile-based data model supporting multiple tab sets
- Improved data chunking for better sync storage handling
- More efficient storage utilization

### Migration Wizard
When upgrading to v2.0, a migration wizard guides you through the transition:
- **Automatic detection** - Detects when migration is needed
- **Data preservation** - All existing tabs are preserved
- **User control** - Choose when to migrate and which options to enable
- **Progress tracking** - Real-time progress feedback during migration
- **Backup option** - Export your data before migrating

[Learn about the Migration Wizard →](upgrading)

### Settings Reorganization
The settings page has been reorganized into clear sections:
- **Appearance** - Theme and compact mode
- **Behavior** - Delete confirmations and other behaviors
- **Sync & Storage** - Storage location preferences
- **Profiles** - Profile feature toggle and auto-switching
- **Keyboard Shortcuts** - Quick access to shortcut configuration

---

## 📋 Migration Guide

If you're upgrading from a previous version, here's what to expect:

### Before Migration
1. **Export a backup** - Optional but recommended
2. **Review your current tabs** - Ensure everything is as expected
3. **Check storage type** - Know whether you're using Sync or Local storage

### During Migration
1. **Migration wizard appears** - Automatically shown on first launch of v2.0
2. **Choose options** - Select storage type and profile preferences
3. **Migration runs** - Takes only a few seconds
4. **Completion** - Confirmation that migration succeeded

### After Migration
1. **All tabs preserved** - Your tabs are now in a "Default" profile
2. **Explore new features** - Try creating additional profiles
3. **Set up dropdowns** - Organize your tabs with dropdown menus
4. **Configure auto-switching** - Add URL patterns for automatic profile switching

[View detailed migration documentation →](upgrading)

---

## 🚀 Getting Started with New Features

### Try Profiles
1. Go to Settings → Enable "Profiles"
2. Click the profiles button in the popup header
3. Create a new profile for a different org
4. Add URL patterns for automatic switching

### Create Dropdown Menus
1. Navigate to an Object Manager page in Salesforce
2. Add it as a tab in SF Tabs
3. Edit the tab and click "Setup as Object Dropdown"
4. Or drag one tab onto another to create a manual dropdown

### Optimize Storage
1. Go to Settings → Sync & Storage
2. Choose your preferred storage location
3. Enable or disable cross-device sync based on your needs

---

## 💡 Tips & Best Practices

**For Profiles:**
- Use descriptive names (max 30 characters)
- Set up URL patterns for frequently-used orgs
- Create a profile for each major environment (Prod, UAT, Dev)
- Consider role-based profiles (Admin vs. Developer)

**For Dropdowns:**
- Group related Setup pages together
- Use Object Manager dropdowns for comprehensive object access
- Keep dropdown depth shallow (one level) for best usability
- Create folder-style tabs for logical groupings

**For Storage:**
- Start with Sync Storage unless you have many tabs
- Switch to Local Storage if you exceed ~50 tabs
- Use different storage types for different devices if needed
- Export backups regularly regardless of storage type

---

## 🐛 Known Issues & Limitations

### Limitations
- Nested dropdowns (dropdowns within dropdowns) are not recommended, but they are supported
- Profile names are limited to 30 characters
- Sync storage has a ~50 tab limit due to browser restrictions
- URL pattern matching requires MyDomain to be enabled

### Planned Improvements
We're always working to improve SF Tabs. Check our [GitHub Issues](https://github.com/chrisrouse/sftabs/issues) page for upcoming features and to submit feature requests.

---

## 📚 Additional Resources

- [Complete User Guide](getting-started) - Detailed documentation for all features
- [Configuration Reference](configuration) - JSON configuration file format
- [Keyboard Shortcuts](keyboard-shortcuts) - Set up keyboard shortcuts for quick access
- [GitHub Repository](https://github.com/chrisrouse/sftabs) - Source code and issue tracking

---

## ❓ Questions or Issues?

If you encounter any problems or have questions about the new features:

1. **Check the User Guide** - [Read the documentation](getting-started)
2. **Search existing issues** - [GitHub Issues](https://github.com/chrisrouse/sftabs/issues)
3. **Report a bug** - [Open a new issue](https://github.com/chrisrouse/sftabs/issues/new)
4. **Request a feature** - Share your ideas on GitHub

We're here to help! The SF Tabs community is active and responsive on GitHub.
