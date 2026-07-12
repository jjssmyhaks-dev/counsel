/**
 * Counsel Chrome Extension — API Client
 * Communicates with the Counsel backend API.
 */

class CounselApiClient {
  constructor() {
    this._baseUrl = CounselConstants.API_BASE_URL;
    this._authManager = counselAuth;
    this._initialized = false;
  }

  /**
   * Initialize by loading stored API URL and auth.
   */
  async init() {
    if (this._initialized) return;
    await this._authManager.init();
    const result = await chrome.storage.local.get(CounselConstants.STORAGE_KEYS.API_URL);
    if (result[ CounselConstants.STORAGE_KEYS.API_URL ]) {
      this._baseUrl = result[ CounselConstants.STORAGE_KEYS.API_URL ];
    }
    this._initialized = true;
  }

  /**
   * Set a custom API base URL.
   * @param {string} url
   */
  async setBaseUrl(url) {
    this._baseUrl = url;
    await chrome.storage.local.set({ [CounselConstants.STORAGE_KEYS.API_URL]: url });
  }

  /**
   * Make an authenticated API request.
   * @param {string} endpoint - e.g. '/draft/email'
   * @param {Object} options
   * @param {string} [options.method='POST']
   * @param {Object} [options.body]
   * @returns {Promise<Object>}
   */
  async request(endpoint, options = {}) {
    if (!this._initialized) await this.init();

    const method = options.method || (options.body ? 'POST' : 'GET');
    const url = `${this._baseUrl}${endpoint}`;

    const headers = { 'Content-Type': 'application/json' };

    const token = await this._authManager.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const fetchOptions = { method, headers };
    if (options.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const resp = await fetch(url, fetchOptions);

    if (resp.status === 401) {
      await this._authManager.logout();
      throw new Error('Authentication expired. Please log in again.');
    }

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      const msg = errBody.message || errBody.error || `Request failed with status ${resp.status}`;
      throw new Error(msg);
    }

    return resp.json();
  }

  // ── Drafting ────────────────────────────────────────────────────────────

  /**
   * Draft an email from instructions.
   * @param {DraftRequest} params
   * @returns {Promise<{draft: string, subject?: string}>}
   */
  async draftEmail(params) {
    return this.request('/draft/email', {
      body: {
        instructions: params.instructions,
        context: params.context || '',
        tone: params.tone || 'professional',
        emailSubject: params.emailSubject || '',
        recipients: params.recipients || [],
      },
    });
  }

  // ── Analysis ─────────────────────────────────────────────────────────────

  /**
   * Analyze email or document content.
   * @param {AnalysisRequest} params
   * @returns {Promise<Object>}
   */
  async analyze(params) {
    return this.request('/analyze', {
      body: {
        content: params.content,
        type: params.type,
        options: params.options || {},
      },
    });
  }

  /**
   * Summarize an email.
   * @param {string} content
   * @returns {Promise<{summary: string}>}
   */
  async summarize(content) {
    return this.request('/analyze/summarize', {
      body: { content },
    });
  }

  /**
   * Extract action items from content.
   * @param {string} content
   * @returns {Promise<{actionItems: string[]}>}
   */
  async extractActionItems(content) {
    return this.request('/analyze/action-items', {
      body: { content },
    });
  }

  /**
   * Extract clauses from a document.
   * @param {string} content
   * @returns {Promise<{clauses: Object[]}>}
   */
  async extractClauses(content) {
    return this.request('/analyze/clauses', {
      body: { content },
    });
  }

  /**
   * Identify risks in a document.
   * @param {string} content
   * @returns {Promise<{risks: Object[]}>}
   */
  async identifyRisks(content) {
    return this.request('/analyze/risks', {
      body: { content },
    });
  }

  // ── Health / Status ──────────────────────────────────────────────────────

  /**
   * Check if the API is reachable.
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      await this.request('/health', { method: 'GET' });
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton
const counselApi = new CounselApiClient();
