// popup/js/popup-release-notes.js
// Manages the "What's New" release notes panel

const RELEASE_NOTES_VERSION = '2.0.1.0';

const SFTabsReleaseNotes = {
  /**
   * Initialize release notes: show the header button if unseen.
   */
  async init() {
    const result = await chrome.storage.local.get('seenReleaseNotesVersion');
    if (result.seenReleaseNotesVersion !== RELEASE_NOTES_VERSION) {
      document.getElementById('release-notes-button').style.display = '';
    }

    document.getElementById('release-notes-button').addEventListener('click', () => this.show());
    document.getElementById('release-notes-close-button').addEventListener('click', () => this.hide());
  },

  /**
   * Show the release notes panel and mark this version as seen.
   */
  async show() {
    // Persist that user has seen this version's notes
    await chrome.storage.local.set({ seenReleaseNotesVersion: RELEASE_NOTES_VERSION });

    // Hide the button (won't come back until a new version ships)
    document.getElementById('release-notes-button').style.display = 'none';

    // Use the same inline-style pattern as showMainContent()/showActionPanel()
    const mainContent = document.getElementById('main-content');
    const actionPanel = document.getElementById('action-panel');
    const panel = document.getElementById('release-notes-panel');

    mainContent.classList.remove('active');
    mainContent.style.display = 'none';
    actionPanel.classList.remove('active');
    actionPanel.style.display = 'none';

    // Expand popup to max height and show panel
    document.querySelector('.container').classList.add('release-notes-open');
    panel.style.display = 'block';
    panel.scrollTop = 0;
  },

  /**
   * Close the release notes panel and return to main content.
   */
  hide() {
    const panel = document.getElementById('release-notes-panel');
    panel.style.display = 'none';
    document.querySelector('.container').classList.remove('release-notes-open');
    // Delegate back to the shared showMainContent so all state is cleaned up correctly
    if (window.SFTabs && window.SFTabs.main && window.SFTabs.main.showMainContent) {
      window.SFTabs.main.showMainContent();
    }
  }
};
