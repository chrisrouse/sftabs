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

### Overlfow Menu

If you have a large number of tabs, they will now collapse into an overflow menu, ensuring  you can always access your tabs. Sub-menus are also supported in the overflow menu.

<img width="1030" height="596" alt="Screenshot 2026-01-11 at 2 25 59 PM" src="https://github.com/user-attachments/assets/1bd6d81a-adeb-4cc5-a502-aeaca4f91bbb" />

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

### Floating Navigation Menu

A new floating navigation menu can be enabled so that your custom tabs are always available in Salesforce, even if you're working outside of Setup.

<img width="1004" height="532" alt="Screenshot 2026-01-11 at 2 28 42 PM" src="https://github.com/user-attachments/assets/e168479b-3ead-4d2b-aee3-668d739911ea" />

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

## ❓ Questions or Issues?

If you encounter any problems or have questions about the new features:

1. **Check the User Guide** - [Read the documentation](getting-started)
2. **Search existing issues** - [GitHub Issues](https://github.com/chrisrouse/sftabs/issues)
3. **Report a bug** - [Open a new issue](https://github.com/chrisrouse/sftabs/issues/new)
4. **Request a feature** - Share your ideas on GitHub

We're here to help! The SF Tabs community is active and responsive on GitHub.
