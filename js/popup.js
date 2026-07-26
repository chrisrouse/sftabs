/**
 * popup.js — Phase 1 interactive mockup
 * Uses MOCK_DATA to drive all UI. No real browser.storage calls.
 * All behaviour mirrors the real popup so Phase 2 wiring is a
 * data-source swap, not a structural rewrite.
 */

// ── State ──────────────────────────────────────────────────────
let state = {
  tabs:            [...MOCK_DATA.tabs],
  profiles:        [...MOCK_DATA.profiles],
  settings:        { ...MOCK_DATA.settings },
  activeView:      'empty',   // 'empty' | 'edit' | 'settings' | 'release-notes'
  editingTabId:    null,
  profileDropdownOpen: false,
  pendingDeleteId: null,
};

// ── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderTabList();
  renderProfileChip();
  renderProfileDropdown();
  applyTheme(state.settings.theme);
  applyDensity(state.settings.compactMode);
  showView('empty');
  bindEvents();
});

// ── Rendering ──────────────────────────────────────────────────

function renderTabList() {
  const list = document.getElementById('tab-list');
  if (!state.tabs.length) {
    list.innerHTML = `<li class="tab-list-empty" role="listitem">
      <p style="padding:16px 12px;font-size:12px;color:var(--t-weak);text-align:center;">No tabs yet — add your first one!</p>
    </li>`;
    return;
  }
  list.innerHTML = state.tabs
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(tab => tabItemHTML(tab))
    .join('');
}

function tabItemHTML(tab) {
  const type   = tabType(tab);
  const badge  = tabBadgeLabel(type);
  const name   = esc(tab.label);
  const path   = tab.path ? esc(tab.path) : '';
  const newTabOn = tab.openInNewTab ? 'is-on' : '';
  const newTabAriaLabel = tab.openInNewTab
    ? `Open in new tab: on — click to toggle off`
    : `Open in new tab: off — click to toggle on`;

  return `
  <li class="tab-item" role="listitem" data-id="${tab.id}" data-type="${type}" tabindex="-1">
    <div class="drag-handle" aria-hidden="true" title="Drag to reorder">
      <div class="drag-dots">
        <span></span><span></span>
        <span></span><span></span>
        <span></span><span></span>
      </div>
    </div>
    <div class="tab-info">
      <div class="tab-info-top">
        <span class="tab-badge tab-badge--${type}" aria-label="${badge} tab">${badge}</span>
        <span class="tab-name">${name}</span>
        ${tab.hasDropdown ? `<span class="tab-count">${tab.dropdownItems.length}<span class="sr-only"> dropdown items</span></span>` : ''}
      </div>
      ${path ? `<span class="tab-path">${path}</span>` : ''}
      ${tab.hasDropdown ? `<span class="tab-dropdown-note">▾ ${tab.dropdownItems.length} dropdown items</span>` : ''}
    </div>
    <div class="tab-actions" role="group" aria-label="Actions for ${name} tab">
      <button class="tab-btn tab-btn--move tab-btn--up"
        aria-label="Move ${name} up" title="Move up" data-action="move-up" data-id="${tab.id}">
        <svg viewBox="0 0 520 520" fill="currentColor" aria-hidden="true" focusable="false"><path d="M414 210c8-8 8-19 0-27L264 36a20 20 0 0 0-28 0L86 183c-8 8-8 19 0 27l28 27c8 8 20 8 28 0l47-46c8-8 22-2 22 9v270c0 10 9 20 20 20h40c11 0 20-11 20-20V200c0-12 14-17 22-9l47 46c8 8 20 8 28 0z"/></svg>
      </button>
      <button class="tab-btn tab-btn--move tab-btn--down"
        aria-label="Move ${name} down" title="Move down" data-action="move-down" data-id="${tab.id}">
        <svg viewBox="0 0 520 520" fill="currentColor" aria-hidden="true" focusable="false"><path d="M96 310c-8 8-8 19 0 27l150 147c8 8 20 8 28 0l151-147c8-8 8-19 0-27l-28-27a20 20 0 0 0-28 0l-47 46c-8 8-22 3-22-9V50c0-10-9-20-20-20h-40c-11 0-20 11-20 20v270c0 12-14 17-22 9l-47-46a20 20 0 0 0-28 0z"/></svg>
      </button>
      <button class="tab-btn tab-btn--edit"
        aria-label="Edit ${name}" title="Edit" data-action="edit" data-id="${tab.id}">
        <svg viewBox="0 0 520 520" fill="currentColor" aria-hidden="true" focusable="false"><path d="m95 334 89 89c4 4 10 4 14 0l222-223c4-4 4-10 0-14l-88-88a10 10 0 0 0-14 0L95 321c-4 4-4 10 0 13M361 57a10 10 0 0 0 0 14l88 88c4 4 10 4 14 0l25-25a38 38 0 0 0 0-55l-47-47a40 40 0 0 0-57 0zM21 482c-2 10 7 19 17 17l109-26c4-1 7-3 9-5l2-2c2-2 3-9-1-13l-90-90c-4-4-11-3-13-1l-2 2a20 20 0 0 0-5 9z"/></svg>
      </button>
      <button class="tab-btn tab-btn--newtab ${newTabOn}"
        aria-label="${newTabAriaLabel}" aria-pressed="${!!tab.openInNewTab}"
        title="Open in new tab" data-action="toggle-newtab" data-id="${tab.id}">
        <svg viewBox="0 0 520 520" fill="currentColor" aria-hidden="true" focusable="false"><path d="M487 20H296c-8 0-16 5-16 13v30c0 8 7 17 16 17h79c9 0 14 10 7 16L212 266c-6 6-6 15 0 21l21 21c6 6 15 6 21 0l170-170c6-6 16-2 16 7v79c0 8 8 17 16 17h29c8 0 15-9 15-17V34c0-9-5-14-13-14M363 255l-34 35q-9 9-9 21v114c0 8-7 15-15 15H95c-8 0-15-7-15-15V215c0-8 7-15 15-15h115c8 0 16-3 21-9l34-34c6-6 2-17-7-17H60a40 40 0 0 0-40 40v280a40 40 0 0 0 40 40h280a40 40 0 0 0 40-40V262c0-9-11-13-17-7"/></svg>
      </button>
      <button class="tab-btn tab-btn--delete"
        aria-label="Delete ${name}" title="Delete" data-action="delete" data-id="${tab.id}">
        <svg viewBox="0 0 52 52" fill="currentColor" aria-hidden="true" focusable="false"><path d="M45.5 10H33V6a4 4 0 0 0-4-4h-6a4 4 0 0 0-4 4v4H6.5c-.8 0-1.5.7-1.5 1.5v3c0 .8.7 1.5 1.5 1.5h39c.8 0 1.5-.7 1.5-1.5v-3c0-.8-.7-1.5-1.5-1.5M23 7c0-.6.4-1 1-1h4c.6 0 1 .4 1 1v3h-6zm18.5 13h-31c-.8 0-1.5.7-1.5 1.5V45a5 5 0 0 0 5 5h24a5 5 0 0 0 5-5V21.5c0-.8-.7-1.5-1.5-1.5M23 42c0 .6-.4 1-1 1h-2c-.6 0-1-.4-1-1V28c0-.6.4-1 1-1h2c.6 0 1 .4 1 1zm10 0c0 .6-.4 1-1 1h-2c-.6 0-1-.4-1-1V28c0-.6.4-1 1-1h2c.6 0 1 .4 1 1z"/></svg>
      </button>
    </div>
  </li>`;
}

function renderProfileChip() {
  const active = state.profiles.find(p => p.id === state.settings.activeProfileId);
  if (!active) return;
  document.getElementById('profile-chip-name').textContent = active.name;
  document.getElementById('profile-chip-dot').style.background = active.color;
}

function renderProfileDropdown() {
  const dropdown = document.getElementById('profile-dropdown');
  const active   = state.settings.activeProfileId;

  dropdown.innerHTML = `
    <div class="profile-dropdown-header">Profiles</div>
    ${state.profiles.map(p => `
      <button class="profile-option" role="option"
        aria-selected="${p.id === active}"
        data-profile-id="${p.id}">
        <span class="profile-option-dot" style="background:${p.color}"></span>
        <span>${esc(p.name)}</span>
        ${p.id === active ? `<span class="profile-option-check" aria-hidden="true">✓</span>` : ''}
      </button>
    `).join('')}`;
}

// ── View management ────────────────────────────────────────────

function showView(viewName) {
  const tray  = document.getElementById('panel-tray');
  const views = ['edit-tab', 'settings', 'release-notes', 'dropdowns'];

  if (viewName === 'empty') {
    tray.classList.remove('is-open');
    views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) el.hidden = true;
    });
  } else {
    views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) el.hidden = (v !== viewName);
    });
    tray.classList.add('is-open');
  }

  // Clear editing highlight unless we're showing the edit form or dropdowns
  if (viewName !== 'edit-tab' && viewName !== 'dropdowns') {
    clearEditingHighlight();
  }

  state.activeView = viewName;

  const settingsBtn = document.getElementById('btn-footer-settings');
  if (settingsBtn) settingsBtn.setAttribute('aria-pressed', viewName === 'settings' ? 'true' : 'false');
}

function clearEditingHighlight() {
  document.querySelectorAll('.tab-item.is-editing').forEach(el => el.classList.remove('is-editing'));
  document.getElementById('tab-list').classList.remove('has-editing');
}

// ── Edit form ──────────────────────────────────────────────────

function openEditTab(tabId) {
  const tab = state.tabs.find(t => t.id === tabId);
  if (!tab) return;

  if (tab.hasDropdown) {
    openDropdownManagement(tabId);
    return;
  }

  state.editingTabId = tabId;

  // Highlight the tab being edited, dim the others
  document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('is-editing'));
  document.getElementById('tab-list').classList.add('has-editing');
  const tabEl = document.querySelector(`.tab-item[data-id="${tabId}"]`);
  if (tabEl) tabEl.classList.add('is-editing');

  document.getElementById('edit-panel-title').textContent    = 'Edit Tab';
  document.getElementById('edit-panel-subtitle').textContent = `Editing "${tab.label}"`;
  document.getElementById('input-tab-name').value    = tab.label;
  document.getElementById('input-tab-path').value    = tab.path || '';
  document.getElementById('input-is-object').checked    = !!tab.isObject;
  document.getElementById('input-is-custom-url').checked = !!tab.isCustomUrl;
  document.getElementById('input-open-new-tab').checked  = !!tab.openInNewTab;
  updateCharCount('input-tab-name', 'tab-name-count', 30);

  showView('edit-tab');
  document.getElementById('input-tab-name').focus();
}

function openAddTab() {
  state.editingTabId = null;

  document.getElementById('edit-panel-title').textContent    = 'Add Tab';
  document.getElementById('edit-panel-subtitle').textContent = 'Create a new custom navigation tab.';
  document.getElementById('input-tab-name').value    = '';
  document.getElementById('input-tab-path').value    = '';
  document.getElementById('input-is-object').checked    = false;
  document.getElementById('input-is-custom-url').checked = false;
  document.getElementById('input-open-new-tab').checked  = false;
  updateCharCount('input-tab-name', 'tab-name-count', 30);

  showView('edit-tab');
  document.getElementById('input-tab-name').focus();
}

function openDropdownManagement(tabId) {
  const tab = state.tabs.find(t => t.id === tabId);
  if (!tab || !tab.hasDropdown) return;

  state.editingTabId = tabId;

  // Highlight the tab being edited
  document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('is-editing'));
  document.getElementById('tab-list').classList.add('has-editing');
  const tabEl = document.querySelector(`.tab-item[data-id="${tabId}"]`);
  if (tabEl) tabEl.classList.add('is-editing');

  document.getElementById('dropdown-title').textContent = 'Manage Items';
  document.getElementById('dropdown-subtitle').textContent = `Items in "${tab.label}"`;

  renderDropdownItems(tabId);
  showView('dropdowns');
}

function renderDropdownItems(tabId) {
  const tab = state.tabs.find(t => t.id === tabId);
  if (!tab) return;

  const list = document.getElementById('dropdown-items-list');
  list.innerHTML = '';

  if (!tab.dropdownItems || tab.dropdownItems.length === 0) {
    list.innerHTML = `<li style="padding: 16px 12px; text-align: center; color: var(--t-weak); font-size: 12px;">No items yet</li>`;
    return;
  }

  tab.dropdownItems.forEach((item, idx) => {
    const li = document.createElement('li');
    li.className = 'dropdown-item';
    li.setAttribute('role', 'listitem');
    li.setAttribute('data-index', idx);
    li.innerHTML = `
      <div class="dropdown-item-info">
        <div class="dropdown-item-label">${esc(item.label)}</div>
        <div class="dropdown-item-path">${esc(item.path)}</div>
      </div>
      <div class="dropdown-item-actions" role="group" aria-label="Actions for ${esc(item.label)}">
        <button class="dropdown-item-btn" data-action="edit-dropdown" data-index="${idx}" aria-label="Edit ${esc(item.label)}" title="Edit">
          <svg viewBox="0 0 520 520" fill="currentColor" aria-hidden="true" focusable="false"><path d="m95 334 89 89c4 4 10 4 14 0l222-223c4-4 4-10 0-14l-88-88a10 10 0 0 0-14 0L95 321c-4 4-4 10 0 13M361 57a10 10 0 0 0 0 14l88 88c4 4 10 4 14 0l25-25a38 38 0 0 0 0-55l-47-47a40 40 0 0 0-57 0zM21 482c-2 10 7 19 17 17l109-26c4-1 7-3 9-5l2-2c2-2 3-9-1-13l-90-90c-4-4-11-3-13-1l-2 2a20 20 0 0 0-5 9z"/></svg>
        </button>
        <button class="dropdown-item-btn" data-action="delete-dropdown" data-index="${idx}" aria-label="Delete ${esc(item.label)}" title="Delete">
          <svg viewBox="0 0 52 52" fill="currentColor" aria-hidden="true" focusable="false"><path d="M45.5 10H33V6a4 4 0 0 0-4-4h-6a4 4 0 0 0-4 4v4H6.5c-.8 0-1.5.7-1.5 1.5v3c0 .8.7 1.5 1.5 1.5h39c.8 0 1.5-.7 1.5-1.5v-3c0-.8-.7-1.5-1.5-1.5M23 7c0-.6.4-1 1-1h4c.6 0 1 .4 1 1v3h-6zm18.5 13h-31c-.8 0-1.5.7-1.5 1.5V45a5 5 0 0 0 5 5h24a5 5 0 0 0 5-5V21.5c0-.8-.7-1.5-1.5-1.5M23 42c0 .6-.4 1-1 1h-2c-.6 0-1-.4-1-1V28c0-.6.4-1 1-1h2c.6 0 1 .4 1 1zm10 0c0 .6-.4 1-1 1h-2c-.6 0-1-.4-1-1V28c0-.6.4-1 1-1h2c.6 0 1 .4 1 1z"/></svg>
        </button>
      </div>
    `;
    list.appendChild(li);
  });
}

function saveTab(e) {
  e.preventDefault();
  const nameInput = document.getElementById('input-tab-name');
  const name = nameInput.value.trim();

  if (!name) {
    document.getElementById('tab-name-error').hidden = false;
    nameInput.setAttribute('aria-invalid', 'true');
    nameInput.focus();
    return;
  }
  document.getElementById('tab-name-error').hidden = true;
  nameInput.removeAttribute('aria-invalid');

  const updates = {
    label:       name,
    path:        document.getElementById('input-tab-path').value.trim(),
    isObject:    document.getElementById('input-is-object').checked,
    isCustomUrl: document.getElementById('input-is-custom-url').checked,
    openInNewTab:document.getElementById('input-open-new-tab').checked,
  };

  if (state.editingTabId) {
    // Update existing
    state.tabs = state.tabs.map(t =>
      t.id === state.editingTabId ? { ...t, ...updates } : t
    );
    showStatus(`"${name}" saved`);
  } else {
    // Create new
    const newTab = {
      id:           `tab_${Date.now()}`,
      position:     state.tabs.length,
      hasDropdown:  false,
      dropdownItems:[],
      isSetupObject:false,
      ...updates,
    };
    state.tabs = [...state.tabs, newTab];
    showStatus(`"${name}" added`);
  }

  renderTabList();
  bindTabListEvents();
  showView('empty');
}

// ── Tab actions ────────────────────────────────────────────────

function deleteTab(tabId) {
  const tab = state.tabs.find(t => t.id === tabId);
  if (!tab) return;

  if (state.settings.skipDeleteConfirmation) {
    confirmDelete(tabId);
    return;
  }
  // Show modal
  document.getElementById('modal-delete-name').textContent = tab.label;
  state.pendingDeleteId = tabId;
  document.getElementById('modal-delete').hidden = false;
  document.getElementById('modal-delete-cancel').focus();
}

function confirmDelete(tabId) {
  const id = tabId || state.pendingDeleteId;
  state.tabs = state.tabs.filter(t => t.id !== id);
  state.pendingDeleteId = null;
  document.getElementById('modal-delete').hidden = true;
  renderTabList();
  bindTabListEvents();
  if (state.editingTabId === id) showView('empty');
  showStatus('Tab deleted');
}

function toggleNewTab(tabId) {
  state.tabs = state.tabs.map(t =>
    t.id === tabId ? { ...t, openInNewTab: !t.openInNewTab } : t
  );
  renderTabList();
  bindTabListEvents();
}

function moveTab(tabId, direction) {
  const sorted = state.tabs.slice().sort((a, b) => a.position - b.position);
  const idx = sorted.findIndex(t => t.id === tabId);
  if (idx === -1) return;
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= sorted.length) return;

  // Swap positions
  const tempPos = sorted[idx].position;
  sorted[idx].position = sorted[swapIdx].position;
  sorted[swapIdx].position = tempPos;

  state.tabs = sorted;
  renderTabList();
  bindTabListEvents();

  // Restore focus to the moved tab
  const movedTab = document.querySelector(`[data-id="${tabId}"]`);
  if (movedTab) movedTab.focus();
}

// ── Profile switching ──────────────────────────────────────────

function switchProfile(profileId) {
  state.settings.activeProfileId = profileId;
  renderProfileChip();
  renderProfileDropdown();
  closeProfileDropdown();
  showStatus(`Switched to ${state.profiles.find(p => p.id === profileId)?.name || 'profile'}`);
}

function openProfileDropdown() {
  state.profileDropdownOpen = true;
  const dropdown = document.getElementById('profile-dropdown');
  dropdown.hidden = false;
  document.getElementById('btn-profile-switcher').setAttribute('aria-expanded', 'true');
  dropdown.querySelector('.profile-option')?.focus();
}

function closeProfileDropdown() {
  state.profileDropdownOpen = false;
  const dropdown = document.getElementById('profile-dropdown');
  dropdown.hidden = true;
  document.getElementById('btn-profile-switcher').setAttribute('aria-expanded', 'false');
}

// ── Theme ──────────────────────────────────────────────────────

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', theme);
  }
  state.settings.theme = theme;
}

/**
 * Display density. Sets data-density on <html>; the --sft-*-var-* hooks in
 * tokens.css resolve to SLDS compact values, so components that use those
 * hooks reflow without any per-component overrides.
 */
function applyDensity(isCompact) {
  document.documentElement.setAttribute('data-density', isCompact ? 'compact' : 'comfy');
}

// ── Settings panel ─────────────────────────────────────────────

function syncSettingsPanel() {
  const themeButtons = document.querySelectorAll('.seg-btn[data-theme-val]');
  themeButtons.forEach(btn => {
    const active = btn.dataset.themeVal === state.settings.theme;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  document.getElementById('setting-compact').checked       = state.settings.compactMode;
  document.getElementById('setting-skip-delete').checked   = state.settings.skipDeleteConfirmation;
  document.getElementById('setting-profiles').checked      = state.settings.profilesEnabled;
  const storageRadio = document.querySelector(`input[name="storage-type"][value="${state.settings.useSyncStorage ? 'sync' : 'local'}"]`);
  if (storageRadio) storageRadio.checked = true;
}

// ── Toast ──────────────────────────────────────────────────────

let statusTimer = null;
function showStatus(msg, type = 'success') {
  const region = document.getElementById('status-region');
  region.textContent = msg;
  region.className = `status-region status-${type}`;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    region.textContent = '';
    region.className = 'status-region';
  }, 4800); // SLDS duration-toast-short
}

// ── Char counter ───────────────────────────────────────────────

function updateCharCount(inputId, countId, max) {
  const val = document.getElementById(inputId)?.value.length || 0;
  const el  = document.getElementById(countId);
  if (el) el.textContent = `${val}/${max}`;
}

// ── Helpers ────────────────────────────────────────────────────

function tabType(tab) {
  if (tab.isCustomUrl)   return 'custom';
  if (tab.isSetupObject) return 'setup';
  if (tab.isObject)      return 'object';
  return 'standard';
}

function tabBadgeLabel(type) {
  return { object: 'Obj', setup: 'Setup', custom: 'URL', standard: 'Tab' }[type] || 'Tab';
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Event binding ──────────────────────────────────────────────

function bindEvents() {
  // Header
  document.getElementById('btn-profile-switcher').addEventListener('click', () => {
    state.profileDropdownOpen ? closeProfileDropdown() : openProfileDropdown();
  });

  document.getElementById('btn-release-notes').addEventListener('click', () => {
    showView('release-notes');
  });

  // Toolbar
  document.getElementById('btn-add-tab').addEventListener('click', openAddTab);
  document.getElementById('btn-quick-add').addEventListener('click', () => {
    showStatus('Quick add: no active Salesforce page detected in mock mode.', 'error');
  });
  // btn-empty-add-tab no longer in DOM (empty state moved to left panel)

  // Edit form
  document.getElementById('form-edit-tab').addEventListener('submit', saveTab);
  document.getElementById('btn-close-edit').addEventListener('click', () => showView('empty'));
  document.getElementById('btn-cancel-edit').addEventListener('click', () => showView('empty'));
  document.getElementById('input-tab-name').addEventListener('input', (e) => {
    updateCharCount('input-tab-name', 'tab-name-count', 30);
    document.getElementById('tab-name-error').hidden = true;
    e.target.removeAttribute('aria-invalid');
  });

  // Settings
  document.getElementById('btn-footer-settings').addEventListener('click', () => {
    if (state.activeView === 'settings') {
      showView('empty');
    } else {
      syncSettingsPanel();
      showView('settings');
    }
  });

  document.querySelectorAll('.seg-btn[data-theme-val]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.seg-btn[data-theme-val]').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      applyTheme(btn.dataset.themeVal);
    });
  });

  document.getElementById('setting-compact').addEventListener('change', e => {
    state.settings.compactMode = e.target.checked;
    applyDensity(e.target.checked);
  });

  document.getElementById('setting-skip-delete').addEventListener('change', e => {
    state.settings.skipDeleteConfirmation = e.target.checked;
  });

  document.getElementById('setting-profiles').addEventListener('change', e => {
    state.settings.profilesEnabled = e.target.checked;
    document.querySelector('.header-center').style.visibility = e.target.checked ? 'visible' : 'hidden';
  });

  document.getElementById('btn-advanced-settings').addEventListener('click', e => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('popup/settings.html') });
  });

  // Footer theme toggle

  // Release notes
  document.getElementById('btn-close-release-notes').addEventListener('click', () => {
    document.getElementById('btn-release-notes').style.display = 'none';
    showView('empty');
  });
  document.getElementById('btn-got-it').addEventListener('click', () => {
    document.getElementById('btn-release-notes').style.display = 'none';
    showView('empty');
    showStatus('Release notes dismissed');
  });

  // Dropdown management
  document.getElementById('btn-close-dropdowns').addEventListener('click', () => {
    showView('empty');
  });

  document.getElementById('btn-add-dropdown-item').addEventListener('click', () => {
    showStatus('Add dropdown item: Coming soon in Phase 3', 'info');
  });

  document.getElementById('dropdown-items-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, index } = btn.dataset;
    if (action === 'edit-dropdown') {
      showStatus(`Edit dropdown item #${index}: Coming soon in Phase 3`, 'info');
    }
    if (action === 'delete-dropdown') {
      const tab = state.tabs.find(t => t.id === state.editingTabId);
      if (tab && tab.dropdownItems) {
        tab.dropdownItems.splice(parseInt(index), 1);
        renderDropdownItems(state.editingTabId);
        showStatus('Dropdown item deleted');
      }
    }
  });

  // Modal: delete
  document.getElementById('modal-delete-cancel').addEventListener('click', () => {
    document.getElementById('modal-delete').hidden = true;
    state.pendingDeleteId = null;
  });
  document.getElementById('modal-delete-confirm').addEventListener('click', () => confirmDelete());

  // Profile dropdown
  document.getElementById('profile-dropdown').addEventListener('click', e => {
    const option = e.target.closest('.profile-option');
    if (option) switchProfile(option.dataset.profileId);
  });

  // Close dropdown on outside click
  document.addEventListener('click', e => {
    if (state.profileDropdownOpen &&
        !e.target.closest('#profile-dropdown') &&
        !e.target.closest('#btn-profile-switcher')) {
      closeProfileDropdown();
    }
  });

  // Close modal on overlay click
  document.getElementById('modal-delete').addEventListener('click', e => {
    if (e.target === e.currentTarget) {
      document.getElementById('modal-delete').hidden = true;
      state.pendingDeleteId = null;
    }
  });

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!document.getElementById('modal-delete').hidden) {
        document.getElementById('modal-delete').hidden = true;
        state.pendingDeleteId = null;
      } else if (state.profileDropdownOpen) {
        closeProfileDropdown();
        document.getElementById('btn-profile-switcher').focus();
      } else if (state.activeView !== 'empty') {
        showView('empty');
      }
    }
  });

  bindTabListEvents();
}

const handleTabListClick = e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (action === 'edit')        openEditTab(id);
  if (action === 'delete')      deleteTab(id);
  if (action === 'toggle-newtab') toggleNewTab(id);
  if (action === 'move-up')     moveTab(id, 'up');
  if (action === 'move-down')   moveTab(id, 'down');
};

function bindTabListEvents() {
  const tabList = document.getElementById('tab-list');
  tabList.removeEventListener('click', handleTabListClick);
  tabList.addEventListener('click', handleTabListClick);
}
