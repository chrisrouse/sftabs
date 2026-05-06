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
      </div>
      ${path ? `<span class="tab-path">${path}</span>` : ''}
      ${tab.hasDropdown ? `<span class="tab-path" style="color:var(--c-accent);font-size:10px;">▾ ${tab.dropdownItems.length} dropdown items</span>` : ''}
    </div>
    <div class="tab-actions" role="group" aria-label="Actions for ${name} tab">
      <button class="tab-btn tab-btn--move tab-btn--up"
        aria-label="Move ${name} up" title="Move up" data-action="move-up" data-id="${tab.id}">
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false"><path d="M8 3l-5 5h3.5v5h3V8H13L8 3z"/></svg>
      </button>
      <button class="tab-btn tab-btn--move tab-btn--down"
        aria-label="Move ${name} down" title="Move down" data-action="move-down" data-id="${tab.id}">
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false"><path d="M8 13l5-5H9.5V3h-3v5H3l5 5z"/></svg>
      </button>
      <button class="tab-btn tab-btn--edit"
        aria-label="Edit ${name}" title="Edit" data-action="edit" data-id="${tab.id}">
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false"><path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 000-.354l-1.086-1.086zM11.189 6.25L9.75 4.81 3.23 11.328c-.03.03-.05.064-.06.1l-.665 2.326 2.325-.665a.196.196 0 00.1-.06L11.19 6.25z"/></svg>
      </button>
      <button class="tab-btn tab-btn--newtab ${newTabOn}"
        aria-label="${newTabAriaLabel}" aria-pressed="${!!tab.openInNewTab}"
        title="Open in new tab" data-action="toggle-newtab" data-id="${tab.id}">
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false"><path d="M3.75 2h3.5a.75.75 0 010 1.5h-3.5a.25.25 0 00-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25v-3.5a.75.75 0 011.5 0v3.5A1.75 1.75 0 0112.25 14h-8.5A1.75 1.75 0 012 12.25v-8.5C2 2.784 2.784 2 3.75 2zm6.854-1h4.146a.25.25 0 01.25.25v4.146a.25.25 0 01-.427.177L13.03 4.03 9.28 7.78a.751.751 0 01-1.042-.018.751.751 0 01-.018-1.042l3.75-3.75-1.543-1.543A.25.25 0 0110.604 1z"/></svg>
      </button>
      <button class="tab-btn tab-btn--delete"
        aria-label="Delete ${name}" title="Delete" data-action="delete" data-id="${tab.id}">
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false"><path d="M11 1.75V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 00.249.225h5.19a.25.25 0 00.249-.225l.66-6.6a.75.75 0 011.492.149l-.66 6.6A1.748 1.748 0 0110.595 15h-5.19a1.75 1.75 0 01-1.741-1.575l-.66-6.6a.75.75 0 011.492-.15ZM6.5 1.75V3h3V1.75a.25.25 0 00-.25-.25h-2.5a.25.25 0 00-.25.25Z"/></svg>
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
  const views = ['edit-tab', 'settings', 'release-notes'];

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

  // Clear editing highlight unless we're showing the edit form
  if (viewName !== 'edit-tab') {
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

function saveTab(e) {
  e.preventDefault();
  const nameInput = document.getElementById('input-tab-name');
  const name = nameInput.value.trim();

  if (!name) {
    document.getElementById('tab-name-error').hidden = false;
    nameInput.focus();
    return;
  }
  document.getElementById('tab-name-error').hidden = true;

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
    showToast(`"${name}" saved`);
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
    showToast(`"${name}" added`);
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
  showToast('Tab deleted');
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
  showToast(`Switched to ${state.profiles.find(p => p.id === profileId)?.name || 'profile'}`);
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

  // Keep theme footer button appearance in sync
  const btn = document.getElementById('btn-toggle-theme');
  if (btn) btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
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

let toastTimer = null;
function showToast(msg, type = 'success') {
  const region = document.getElementById('toast-region');
  region.textContent = msg;
  region.className = `toast-region toast-${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    region.textContent = '';
    region.className = 'toast-region';
  }, 3000);
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
    showToast('Quick add: no active Salesforce page detected in mock mode.', 'error');
  });
  // btn-empty-add-tab no longer in DOM (empty state moved to left panel)

  // Edit form
  document.getElementById('form-edit-tab').addEventListener('submit', saveTab);
  document.getElementById('btn-close-edit').addEventListener('click', () => showView('empty'));
  document.getElementById('btn-cancel-edit').addEventListener('click', () => showView('empty'));
  document.getElementById('input-tab-name').addEventListener('input', () => {
    updateCharCount('input-tab-name', 'tab-name-count', 30);
    document.getElementById('tab-name-error').hidden = true;
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
    document.querySelector('.tab-list').classList.toggle('compact', e.target.checked);
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
  document.getElementById('btn-toggle-theme').addEventListener('click', toggleTheme);

  // Release notes
  document.getElementById('btn-close-release-notes').addEventListener('click', () => {
    document.getElementById('btn-release-notes').style.display = 'none';
    showView('empty');
  });
  document.getElementById('btn-got-it').addEventListener('click', () => {
    document.getElementById('btn-release-notes').style.display = 'none';
    showView('empty');
    showToast('Release notes dismissed');
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
