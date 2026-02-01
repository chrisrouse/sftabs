/**
 * GitHub API Integration for SF Tabs Translation App
 * Handles both authenticated PR submissions and anonymous issue submissions
 */

class GitHubAPI {
  constructor(config = {}) {
    // GitHub OAuth App credentials
    this.clientId = config.clientId || 'Ov23liVOQVccopZalzY2';
    this.repoOwner = config.repoOwner || 'chrisrouse';
    this.repoName = config.repoName || 'sftabs';
    this.baseUrl = 'https://api.github.com';

    this.token = null;
    this.user = null;
  }

  /**
   * Start authentication - uses GitHub forking workflow for web browsers
   */
  async startAuthentication() {
    return {
      method: 'manual',
      promptUser: () => this.showManualPRPrompt(),
    };
  }

  /**
   * Show manual PR prompt - guides user through GitHub PR creation
   */
  showManualPRPrompt() {
    return new Promise((resolve) => {
      const prData = JSON.parse(sessionStorage.getItem('sf-tabs-pr-data') || '{}');

      const translationJson = JSON.stringify({
        language: prData.language,
        strings: prData.strings || {},
        timestamp: prData.timestamp,
      }, null, 2);

      // Create modal
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;

      modal.innerHTML = `
        <div style="
          background: white;
          border-radius: 12px;
          padding: 2rem;
          max-width: 600px;
          max-height: 85vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        ">
          <h2 style="margin-top: 0; color: #333;">Submit as Pull Request</h2>

          <div style="background: #e7f1ff; border-left: 4px solid #0d6efd; padding: 1rem; border-radius: 6px; margin-bottom: 1.5rem;">
            <p style="margin: 0; color: #003d99;"><strong>💡 Easier Option:</strong> Use "Submit via Issue" instead—no GitHub account needed!</p>
          </div>

          <p style="color: #666; font-weight: 600;">To create a Pull Request:</p>

          <ol style="color: #666; line-height: 1.8;">
            <li><strong>Copy your translations</strong> (the JSON below)</li>
            <li><strong>Fork the repository:</strong> <a href="https://github.com/chrisrouse/sftabs/fork" target="_blank" style="color: #0d6efd; font-weight: 600;">github.com/chrisrouse/sftabs</a></li>
            <li><strong>Edit</strong> <code>docs/translations/master.json</code></li>
            <li><strong>Paste</strong> your translation data into the corresponding language fields</li>
            <li><strong>Commit & Create Pull Request</strong> back to main repo</li>
          </ol>

          <div style="background: #f6f8fa; border: 1px solid #ddd; border-radius: 8px; padding: 1rem; margin: 1.5rem 0;">
            <p style="margin: 0 0 0.5rem 0; font-size: 0.85rem; color: #666;"><strong>Your Translation Data:</strong></p>
            <textarea readonly style="
              width: 100%;
              height: 150px;
              padding: 0.75rem;
              border: 1px solid #ddd;
              border-radius: 4px;
              font-family: monospace;
              font-size: 0.7rem;
              background: white;
            " id="translation-data">${translationJson}</textarea>
            <button onclick="const ta = document.getElementById('translation-data'); ta.select(); document.execCommand('copy'); this.textContent = '✓ Copied!'; setTimeout(() => this.textContent = '📋 Copy', 2000);" style="
              margin-top: 0.75rem;
              padding: 0.6rem 1rem;
              background: #0d6efd;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-weight: 600;
            ">📋 Copy</button>
          </div>

          <div style="display: flex; gap: 1rem;">
            <button onclick="this.closest('div').parentElement.parentElement.remove()" style="
              flex: 1;
              padding: 0.75rem;
              background: #6c757d;
              color: white;
              border: none;
              border-radius: 6px;
              cursor: pointer;
            ">Close</button>
            <a href="https://github.com/chrisrouse/sftabs/fork" target="_blank" style="
              flex: 1;
              padding: 0.75rem;
              background: #28a745;
              color: white;
              text-align: center;
              text-decoration: none;
              border-radius: 6px;
            ">🔗 Fork Repo</a>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      resolve();
    });
  }

  /**
   * Create pull request - stores data for manual submission
   */
  async createPullRequest(language, translations) {
    sessionStorage.setItem('sf-tabs-pr-data', JSON.stringify({
      language,
      strings: translations,
      timestamp: new Date().toISOString(),
      count: Object.keys(translations).length,
    }));

    return { success: true, manual: true };
  }

  /**
   * Create a GitHub issue for anonymous translation submission
   */
  async createIssue(language, translations, contributorInfo = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/repos/${this.repoOwner}/${this.repoName}/issues`, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `Translation Contribution: ${language.toUpperCase()} (${Object.keys(translations).length} strings)`,
          body: this.generateIssueDescription(language, translations, contributorInfo),
          labels: ['translation', 'contribution'],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create issue');
      }

      const issue = await response.json();

      return {
        success: true,
        issueUrl: issue.html_url,
        issueNumber: issue.number,
      };
    } catch (error) {
      throw new Error(`Failed to create issue: ${error.message}`);
    }
  }

  /**
   * Generate issue description
   */
  generateIssueDescription(language, translations, contributorInfo = {}) {
    const languageName = {
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      ja: 'Japanese',
    }[language] || language;

    const translationJson = JSON.stringify(
      {
        language,
        strings: translations,
      },
      null,
      2
    );

    let description = `## Translation Contribution

**Language:** ${languageName} (${language})
**Strings Translated:** ${Object.keys(translations).length}

### Translations

\`\`\`json
${translationJson}
\`\`\`

### Contributor Information
`;

    if (contributorInfo.name) {
      description += `**Name:** ${contributorInfo.name}\n`;
    }
    if (contributorInfo.email) {
      description += `**Email:** ${contributorInfo.email}\n`;
    }

    description += `
---
*Submitted via SF Tabs Translation App*`;

    return description;
  }
}

// Export for use in browser
window.GitHubAPI = GitHubAPI;
