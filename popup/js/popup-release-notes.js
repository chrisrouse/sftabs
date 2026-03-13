// popup/js/popup-release-notes.js
// Manages the "What's New" release notes panel

const RELEASE_NOTES_VERSION = '2.1.1';

function getStoreUrl() {
  if (navigator.userAgent.includes('Edg/')) {
    return 'https://microsoftedge.microsoft.com/addons/detail/sf-tabs/kchadlkjcefbnojjnmmpcnfnhcfbdjbb';
  }
  if (navigator.userAgent.includes('Firefox/')) {
    return 'https://addons.mozilla.org/en-US/firefox/addon/sf-tabs/';
  }
  return 'https://chromewebstore.google.com/detail/sf-tabs/lkimhffllnjkacnhjfehaihcjilcmdlo';
}

const SFTabsReleaseNotes = {
  /**
   * Initialize release notes: show the header button if not dismissed for this version.
   */
  async init() {
    const result = await chrome.storage.local.get('seenReleaseNotesVersion');
    if (result.seenReleaseNotesVersion !== RELEASE_NOTES_VERSION) {
      document.getElementById('release-notes-button').style.display = '';
    }

    document.getElementById('release-notes-button').addEventListener('click', () => this.show());
    document.getElementById('release-notes-close-button').addEventListener('click', () => this.hide());
    document.getElementById('review-link').href = getStoreUrl();
  },

  /**
   * Show the release notes panel. The button is hidden while the panel is open
   * but will reappear on close unless the user checks "Don't show again".
   */
  show() {
    // Reset the checkbox each time the panel opens
    document.getElementById('release-notes-dismiss-checkbox').checked = false;

    const mainContent = document.getElementById('main-content');
    const actionPanel = document.getElementById('action-panel');
    const panel = document.getElementById('release-notes-panel');

    mainContent.classList.remove('active');
    mainContent.style.display = 'none';
    actionPanel.classList.remove('active');
    actionPanel.style.display = 'none';

    document.querySelector('.container').classList.add('release-notes-open');
    panel.style.display = 'block';
    panel.scrollTop = 0;
  },

  /**
   * Close the release notes panel.
   * If the "Don't show again" checkbox is checked, persist the dismissal so
   * the button won't reappear for this version. Otherwise the button comes back.
   */
  async hide() {
    const dismissed = document.getElementById('release-notes-dismiss-checkbox').checked;

    if (dismissed) {
      await chrome.storage.local.set({ seenReleaseNotesVersion: RELEASE_NOTES_VERSION });
    } else {
      // Put the button back so they can re-open the notes
      document.getElementById('release-notes-button').style.display = '';
    }

    const panel = document.getElementById('release-notes-panel');
    panel.style.display = 'none';
    document.querySelector('.container').classList.remove('release-notes-open');

    if (window.SFTabs && window.SFTabs.main && window.SFTabs.main.showMainContent) {
      window.SFTabs.main.showMainContent();
    }
  }
};
