/**
 * Counsel Gmail Extension — Shared Types & Constants
 * Defines message types, API contracts, and UI constants.
 */

const CounselConstants = {
  API_BASE_URL: 'http://localhost:3001/api/v1',
  EXTENSION_ID: 'counsel-chrome-extension',
  STORAGE_KEYS: {
    TOKEN: '***',
    USER: 'counsel_user',
    API_URL: 'counsel_api_url',
    AUTO_INJECT: 'counsel_auto_inject',
    DRAFT_TONE: 'counsel_draft_tone',
    SIDE_PANEL_CONTEXT: 'sidePanelContext',
    RECENT_ACTIVITY: 'counsel_recent_activity',
    GOOGLE_TOKEN: 'counsel_google_token',
    GOOGLE_USER: 'counsel_google_user',
    EMAIL_COUNT: 'counsel_email_count',
    LAST_SYNC: 'counsel_last_sync',
  },
  DEFAULT_TONES: [
    { value: 'professional', label: 'Professional' },
    { value: 'concise', label: 'Concise' },
    { value: 'persuasive', label: 'Persuasive' },
    { value: 'friendly', label: 'Friendly' },
    { value: 'formal', label: 'Formal' },
  ],
  MAX_RECENT_ACTIVITY: 50,
  GMAIL_SCOPES: [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ],
};

const CounselActionTypes = {
  OPEN_SIDE_PANEL: 'openSidePanel',
  OPEN_SIDE_PANEL_WITH_CONTEXT: 'openSidePanelWithContext',
  GET_SIDE_PANEL_CONTEXT: 'getSidePanelContext',
  CLEAR_SIDE_PANEL_CONTEXT: 'clearSidePanelContext',
  OPEN_OPTIONS: 'openOptions',
  GET_AUTH_TOKEN: '***',
  SET_AUTH_TOKEN: '***',
  CLEAR_AUTH: 'clearAuth',

  // Sidebar actions
  DRAFT_EMAIL: 'draftEmail',
  ANALYZE_DOCUMENT: 'analyzeDocument',
  SUMMARIZE_EMAIL: 'summarizeEmail',
  EXTRACT_ACTION_ITEMS: 'extractActionItems',
  DRAFT_REPLY: 'draftReply',
  EXTRACT_CLAUSES: 'extractClauses',

  // Gmail OAuth & API actions
  GMAIL_AUTH: 'GMAIL_AUTH',
  GMAIL_GET_TOKEN: 'GMAIL_GET_TOKEN',
  GMAIL_STATUS: 'GMAIL_STATUS',
  GMAIL_COMPOSE: 'GMAIL_COMPOSE',
  GMAIL_LIST: 'GMAIL_LIST',
  GMAIL_GET: 'GMAIL_GET',
  GMAIL_SEND: 'GMAIL_SEND',

  // UI state
  SET_ACTIVE_TAB: 'setActiveTab',
  LOGIN_REQUEST: 'loginRequest',
  LOGIN_SUCCESS: 'loginSuccess',
  LOGOUT: 'logout',
  UPDATE_SETTINGS: 'updateSettings',
  ADD_RECENT_ACTIVITY: 'addRecentActivity',
};

/**
 * @typedef {Object} CounselContext
 * @property {string} type - 'compose' | 'read' | 'general'
 * @property {string} [emailBody] - The email body text
 * @property {string} [emailSubject] - The email subject
 * @property {string} [threadId] - Gmail thread ID
 * @property {string[]} [recipients] - To/CC recipients
 * @property {string} [sender] - From address
 */

/**
 * @typedef {Object} DraftRequest
 * @property {string} instructions - User's drafting instructions
 * @property {string} [context] - Additional context (reply chain, etc.)
 * @property {string} [tone] - Drafting tone
 * @property {string} [emailSubject] - Subject line context
 * @property {string[]} [recipients] - Recipient names/emails
 */

/**
 * @typedef {Object} AnalysisRequest
 * @property {string} content - Document/email content to analyze
 * @property {string} type - 'summary' | 'clauses' | 'risks' | 'action_items'
 * @property {Object} [options] - Analysis options
 */

/**
 * @typedef {Object} CounselUser
 * @property {string} id - User ID
 * @property {string} email - User email
 * @property {string} name - Display name
 * @property {string} firm - Firm/organization name
 */

/**
 * @typedef {Object} GmailComposePayload
 * @property {string} to - Recipient email(s), comma-separated
 * @property {string} subject - Email subject
 * @property {string} body - Email body (plain text or HTML)
 * @property {string[]} [cc] - CC recipients
 * @property {string[]} [bcc] - BCC recipients
 * @property {string} [threadId] - Gmail thread ID for replies
 */

/**
 * @typedef {Object} GmailListQuery
 * @property {string} [query] - Gmail search query (e.g. "is:unread")
 * @property {number} [maxResults] - Max messages to return (default 20)
 */

// Export for module use; also available globally via content script injection
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CounselConstants, CounselActionTypes };
}