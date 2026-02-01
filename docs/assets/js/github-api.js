/**
 * GitHub API Integration for SF Tabs Translation App
 * Handles OAuth Device Flow and issue/PR creation
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
   * Start GitHub OAuth Device Flow authentication
   * User will be directed to github.com/login/device to authorize
   */
  async startAuthentication() {
    try {
      // Step 1: Request device code
      const deviceResponse = await fetch('https://github.com/login/device/code', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.clientId,
          scope: 'public_repo',
        }),
      });

      if (!deviceResponse.ok) {
        throw new Error('Failed to initiate device flow');
      }

      const deviceData = await deviceResponse.json();
      const { device_code, user_code, verification_uri, expires_in, interval } = deviceData;

      // Show user the verification code and URI
      return {
        userCode: user_code,
        verificationUri: verification_uri,
        deviceCode: device_code,
        expiresIn: expires_in,
        pollInterval: interval,
        promptUser: () =>
          this.showAuthenticationPrompt(user_code, verification_uri, device_code, interval),
      };
    } catch (error) {
      throw new Error(`Authentication initiation failed: ${error.message}`);
    }
  }

  /**
   * Show authentication prompt modal
   */
  showAuthenticationPrompt(userCode, verificationUri, deviceCode, pollInterval) {
    return new Promise((resolve, reject) => {
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
          max-width: 500px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        ">
          <h2 style="margin-top: 0; color: #333;">Authorize with GitHub</h2>
          <p>To create a Pull Request with your translations, please authorize this app:</p>

          <div style="
            background: #f6f8fa;
            border: 2px solid #0d6efd;
            border-radius: 8px;
            padding: 1.5rem;
            text-align: center;
            margin: 1.5rem 0;
          ">
            <p style="color: #666; margin-top: 0;">1. Visit this URL:</p>
            <a href="${verificationUri}" target="_blank" style="
              display: inline-block;
              padding: 0.75rem 1.5rem;
              background: #0d6efd;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 600;
              margin-bottom: 1rem;
            ">${verificationUri}</a>

            <p style="color: #666;">2. Enter this code:</p>
            <div style="
              font-size: 1.5rem;
              font-weight: 700;
              font-family: monospace;
              color: #0d6efd;
              letter-spacing: 0.2em;
            ">${userCode}</div>
          </div>

          <div style="
            background: #f0fdf4;
            border-left: 4px solid #28a745;
            padding: 1rem;
            border-radius: 6px;
            margin: 1rem 0;
            font-size: 0.9rem;
            color: #22863a;
          ">
            <strong>Waiting for authorization...</strong>
            <p style="margin: 0.5rem 0 0 0;">This window will update automatically once you've authorized the app.</p>
          </div>

          <button onclick="this.closest('div').parentElement.parentElement.remove()" style="
            width: 100%;
            padding: 0.75rem;
            background: #6c757d;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
          ">Cancel</button>
        </div>
      `;

      document.body.appendChild(modal);

      // Poll for token
      this.pollForToken(deviceCode, pollInterval * 1000).then((token) => {
        modal.remove();
        resolve(token);
      });
    });
  }

  /**
   * Poll for access token after device authorization
   */
  async pollForToken(deviceCode, pollInterval) {
    return new Promise((resolve, reject) => {
      const maxAttempts = 120; // 10 minutes with default interval
      let attempts = 0;

      const poll = async () => {
        attempts += 1;

        try {
          const response = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              client_id: this.clientId,
              device_code: deviceCode,
              grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            }),
          });

          const data = await response.json();

          if (data.access_token) {
            this.token = data.access_token;
            resolve(data.access_token);
          } else if (data.error === 'authorization_pending') {
            if (attempts < maxAttempts) {
              setTimeout(poll, pollInterval);
            } else {
              reject(new Error('Authentication timeout'));
            }
          } else {
            reject(new Error(data.error || 'Authentication failed'));
          }
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  }

  /**
   * Get authenticated user info
   */
  async getUser() {
    if (!this.token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${this.baseUrl}/user`, {
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get user info');
    }

    this.user = await response.json();
    return this.user;
  }

  /**
   * Create a pull request with translations
   */
  async createPullRequest(language, translations, metadata = {}) {
    if (!this.token) {
      throw new Error('Not authenticated');
    }

    const user = await this.getUser();
    const timestamp = Date.now();
    const branchName = `translations/${language}-${timestamp}`;

    try {
      // Step 1: Get current master.json
      const currentFileResponse = await this.getFile(
        this.repoOwner,
        this.repoName,
        'docs/translations/master.json'
      );

      // Step 2: Parse existing translations
      const currentContent = JSON.parse(atob(currentFileResponse.content));

      // Step 3: Update with new translations
      const updatedContent = this.mergeTranslations(currentContent, language, translations);

      // Step 4: Commit to new branch
      await this.updateFile(
        user.login,
        this.repoName,
        'docs/translations/master.json',
        {
          message: `Add ${language} translations - ${Object.keys(translations).length} strings`,
          content: btoa(JSON.stringify(updatedContent, null, 2)),
          sha: currentFileResponse.sha,
          branch: branchName,
          fork: true, // Create/use fork
        }
      );

      // Step 5: Create pull request
      const pr = await this.createPR(this.repoOwner, this.repoName, {
        title: `Add ${language.toUpperCase()} translations - ${Object.keys(translations).length} strings`,
        head: `${user.login}:${branchName}`,
        base: 'main',
        body: this.generatePRDescription(language, translations, user),
      });

      return {
        success: true,
        prUrl: pr.html_url,
        prNumber: pr.number,
      };
    } catch (error) {
      throw new Error(`Failed to create pull request: ${error.message}`);
    }
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
   * Get file from repository
   */
  async getFile(owner, repo, path) {
    const response = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/contents/${path}`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        ...(this.token && { 'Authorization': `token ${this.token}` }),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get file: ${path}`);
    }

    return await response.json();
  }

  /**
   * Update or create file in repository
   */
  async updateFile(owner, repo, path, options = {}) {
    const { message, content, sha, branch } = options;

    // For authenticated requests with fork, we need to use the user's fork
    const url = `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}`;

    const body = {
      message,
      content,
      ...(sha && { sha }),
      ...(branch && { branch }),
    };

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to update file: ${error.message}`);
    }

    return await response.json();
  }

  /**
   * Create a pull request
   */
  async createPR(owner, repo, options = {}) {
    const { title, head, base, body } = options;

    const response = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        head,
        base,
        body,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create PR: ${error.message}`);
    }

    return await response.json();
  }

  /**
   * Merge translations into master.json structure
   */
  mergeTranslations(masterContent, language, newTranslations) {
    const updated = { ...masterContent };

    // Update metadata
    updated.metadata.lastUpdated = new Date().toISOString().split('T')[0];

    // Update strings
    updated.strings = updated.strings.map((string) => {
      if (newTranslations[string.key]) {
        return {
          ...string,
          [language]: newTranslations[string.key],
        };
      }
      return string;
    });

    return updated;
  }

  /**
   * Generate PR description
   */
  generatePRDescription(language, translations, user) {
    const languageName = {
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      ja: 'Japanese',
    }[language] || language;

    const translationsList = Object.entries(translations)
      .slice(0, 5)
      .map(([key, value]) => `- \`${key}\`: ${value}`)
      .join('\n');

    return `## Translation Contribution

**Language:** ${languageName} (${language})
**Strings Translated:** ${Object.keys(translations).length}
**Contributor:** @${user.login}

### Preview of Translations

${translationsList}
${Object.keys(translations).length > 5 ? `\n... and ${Object.keys(translations).length - 5} more strings` : ''}

---
*Submitted via SF Tabs Translation App*`;
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
