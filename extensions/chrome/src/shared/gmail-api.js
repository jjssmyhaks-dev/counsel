/**
 * Counsel Chrome Extension — Gmail API Client Wrapper
 * Communicates with the Counsel backend Gmail proxy endpoint.
 * All Gmail API calls are proxied through /api/v1/integrations/google/gmail/*
 */

class GmailApiClient {
  constructor() {
    this._baseUrl = 'http://localhost:3001';
    this._initialized = false;
  }

  /**
   * Initialize by loading stored API URL.
   */
  async init() {
    if (this._initialized) return;
    const result = await chrome.storage.local.get(CounselConstants.STORAGE_KEYS.API_URL);
    if (result[CounselConstants.STORAGE_KEYS.API_URL]) {
      // API_URL is stored as full base like 'http://localhost:3001/api/v1'
      const url = result[CounselConstants.STORAGE_KEYS.API_URL];
      // Strip trailing /api/v1 to get base URL for integration endpoints
      this._baseUrl = url.replace(/\/api\/v1\/?$/, '') || 'http://localhost:3001';
    }
    this._initialized = true;
  }

  /**
   * Get the base integration URL.
   */
  _getIntegrationBase() {
    return `${this._baseUrl}/api/v1/integrations/google/gmail`;
  }

  /**
   * Make a proxied Gmail API call through the service worker.
   * The SW handles token management and calls the backend proxy.
   */
  async _call(method, endpoint, payload = null) {
    const messageType = this._endpointToMessageType(method, endpoint);
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: messageType, payload },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (response && response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response?.error || `Gmail API call failed: ${messageType}`));
          }
        }
      );
    });
  }

  _endpointToMessageType(method, endpoint) {
    const map = {
      'POST:messages': 'GMAIL_COMPOSE',
      'GET:messages': 'GMAIL_LIST',
      'SEND:messages': 'GMAIL_SEND',
      'GET:message': 'GMAIL_GET',
    };
    return map[`${method}:${endpoint}`] || 'GMAIL_LIST';
  }

  /**
   * List Gmail messages matching a query.
   * @param {Object} [options]
   * @param {string} [options.query] - Gmail search query (e.g. "is:unread", "from:example@mail.com")
   * @param {number} [options.maxResults=20] - Maximum number of messages to return
   * @returns {Promise<{messages: Object[], nextPageToken?: string, resultSizeEstimate: number}>}
   */
  async listMessages(options = {}) {
    return this._call('GET', 'messages', {
      query: options.query || '',
      maxResults: options.maxResults || 20,
    });
  }

  /**
   * Get a single Gmail message by ID.
   * @param {string} messageId - The Gmail message ID
   * @returns {Promise<Object>} Full message object with headers, body, etc.
   */
  async getMessage(messageId) {
    return this._call('GET', 'message', { messageId });
  }

  /**
   * Send an email through Gmail.
   * @param {Object} params
   * @param {string} params.to - Recipient email(s), comma-separated
   * @param {string} params.subject - Email subject line
   * @param {string} params.body - Email body (plain text or HTML)
   * @param {string[]} [params.cc] - CC recipients
   * @param {string[]} [params.bcc] - BCC recipients
   * @param {string} [params.threadId] - Gmail thread ID for replies
   * @returns {Promise<{id: string, threadId: string, labelIds: string[]}>}
   */
  async sendEmail(params) {
    if (!params.to) throw new Error('Recipient (to) is required');
    if (!params.subject) throw new Error('Subject is required');
    if (!params.body) throw new Error('Body is required');

    return this._call('SEND', 'messages', {
      to: params.to,
      subject: params.subject,
      body: params.body,
      cc: params.cc || [],
      bcc: params.bcc || [],
      threadId: params.threadId || null,
    });
  }

  /**
   * Create a draft email in Gmail (for review before sending).
   * @param {Object} params - Same as sendEmail
   * @returns {Promise<Object>}
   */
  async createDraft(params) {
    return this._call('POST', 'messages', {
      ...params,
      draft: true,
    });
  }

  /**
   * Get the count of unread emails.
   * @returns {Promise<number>}
   */
  async getUnreadCount() {
    const result = await this.listMessages({ query: 'is:unread', maxResults: 1 });
    return result.resultSizeEstimate || 0;
  }

  /**
   * Get recent emails from the inbox.
   * @param {number} [maxResults=10]
   * @returns {Promise<Object[]>}
   */
  async getRecentEmails(maxResults = 10) {
    const result = await this.listMessages({
      query: 'in:inbox',
      maxResults,
    });
    return result.messages || [];
  }
}

// Singleton
const gmailApi = new GmailApiClient();