/**
 * Counsel Chrome Extension — Auth Manager
 * Handles login/logout/token persistence and Google OAuth 2.0 via chrome.storage.local.
 */

class AuthManager {
  constructor() {
    this._storage = chrome.storage.local;
    this._token = null;
    this._user = null;
    this._googleToken = null;
    this._googleUser = null;
    this._initialized = false;
  }

  /**
   * Initialize — load persisted auth state from storage.
   */
  async init() {
    if (this._initialized) return;
    const result = await this._storage.get([
      CounselConstants.STORAGE_KEYS.TOKEN,
      CounselConstants.STORAGE_KEYS.USER,
      CounselConstants.STORAGE_KEYS.GOOGLE_TOKEN,
      CounselConstants.STORAGE_KEYS.GOOGLE_USER,
    ]);
    this._token = result[CounselConstants.STORAGE_KEYS.TOKEN] || null;
    this._user = result[CounselConstants.STORAGE_KEYS.USER] || null;
    this._googleToken = result[CounselConstants.STORAGE_KEYS.GOOGLE_TOKEN] || null;
    this._googleUser = result[CounselConstants.STORAGE_KEYS.GOOGLE_USER] || null;
    this._initialized = true;
  }

  // ── Counsel Auth ────────────────────────────────────────────────────────

  /**
   * Log in with email/password against the Counsel API.
   */
  async login(email, password) {
    const apiUrl = await this._getApiUrl();

    try {
      const resp = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ message: 'Login failed' }));
        return { success: false, error: err.message || 'Invalid credentials' };
      }

      const data = await resp.json();
      this._token = data.token;
      this._user = data.user || { email };

      await this._storage.set({
        [CounselConstants.STORAGE_KEYS.TOKEN]: this._token,
        [CounselConstants.STORAGE_KEYS.USER]: this._user,
      });

      return { success: true, user: this._user };
    } catch (e) {
      return { success: false, error: 'Network error: ' + e.message };
    }
  }

  /**
   * Get the current auth token.
   */
  async getToken() {
    if (!this._initialized) await this.init();
    return this._token;
  }

  /**
   * Check if the user is currently logged in.
   */
  async isLoggedIn() {
    if (!this._initialized) await this.init();
    return !!this._token;
  }

  /**
   * Get current user info.
   */
  async getUser() {
    if (!this._initialized) await this.init();
    return this._user;
  }

  /**
   * Set a token manually (e.g., from Options page).
   */
  async setToken(token, user) {
    this._token = token;
    if (user) this._user = user;
    await this._storage.set({
      [CounselConstants.STORAGE_KEYS.TOKEN]: this._token,
      [CounselConstants.STORAGE_KEYS.USER]: this._user,
    });
  }

  /**
   * Log out — clear token and user from storage.
   */
  async logout() {
    this._token = null;
    this._user = null;
    await this._storage.remove([
      CounselConstants.STORAGE_KEYS.TOKEN,
      CounselConstants.STORAGE_KEYS.USER,
    ]);
  }

  // ── Google OAuth 2.0 ────────────────────────────────────────────────────

  /**
   * Initiate Google OAuth 2.0 connection flow via the background service worker.
   * @returns {Promise<{success: boolean, user?: Object, error?: string}>}
   */
  async connectGoogle() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'GMAIL_AUTH', action: 'connect' },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
            return;
          }
          if (response && response.success) {
            this._googleUser = response.user;
            this._googleToken = true; // We don't store the raw token here, SW handles it
            resolve({ success: true, user: response.user });
          } else {
            resolve({ success: false, error: response?.error || 'OAuth connection failed' });
          }
        }
      );
    });
  }

  /**
   * Get a valid Google access token for API calls.
   * @returns {Promise<string>}
   */
  async getGoogleToken() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'GMAIL_GET_TOKEN' },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (response && response.success) {
            resolve(response.token);
          } else {
            reject(new Error(response?.error || 'Failed to get Google token'));
          }
        }
      );
    });
  }

  /**
   * Check if Google is currently connected.
   * @returns {Promise<boolean>}
   */
  async isGoogleConnected() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'GMAIL_STATUS' },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve(false);
            return;
          }
          resolve(response?.connected === true);
        }
      );
    });
  }

  /**
   * Get current Google user info.
   * @returns {Promise<Object|null>}
   */
  async getGoogleUser() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'GMAIL_STATUS' },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(response?.user || null);
        }
      );
    });
  }

  /**
   * Disconnect Google account and revoke token.
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async disconnectGoogle() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'GMAIL_AUTH', action: 'disconnect' },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
            return;
          }
          if (response && response.success) {
            this._googleToken = null;
            this._googleUser = null;
            resolve({ success: true });
          } else {
            resolve({ success: false, error: response?.error || 'Disconnect failed' });
          }
        }
      );
    });
  }

  /**
   * Refresh Google token.
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async refreshGoogleToken() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'GMAIL_AUTH', action: 'refresh' },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
            return;
          }
          resolve(response || { success: false, error: 'Refresh failed' });
        }
      );
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  /**
   * Resolve the API base URL from settings or default.
   */
  async _getApiUrl() {
    const result = await this._storage.get(CounselConstants.STORAGE_KEYS.API_URL);
    return result[CounselConstants.STORAGE_KEYS.API_URL] || CounselConstants.API_BASE_URL;
  }
}

// Singleton
const counselAuth = new AuthManager();