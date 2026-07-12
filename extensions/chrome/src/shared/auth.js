/**
 * Counsel Chrome Extension — Auth Manager
 * Handles login/logout/token persistence via chrome.storage.local.
 */

class AuthManager {
  constructor() {
    this._storage = chrome.storage.local;
    this._token = null;
    this._user = null;
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
    ]);
    this._token = result[ CounselConstants.STORAGE_KEYS.TOKEN ] || null;
    this._user = result[ CounselConstants.STORAGE_KEYS.USER ] || null;
    this._initialized = true;
  }

  /**
   * Log in with email/password against the Counsel API.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{success: boolean, user?: Object, error?: string}>}
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
   * @returns {Promise<string|null>}
   */
  async getToken() {
    if (!this._initialized) await this.init();
    return this._token;
  }

  /**
   * Check if the user is currently logged in.
   * @returns {Promise<boolean>}
   */
  async isLoggedIn() {
    if (!this._initialized) await this.init();
    return !!this._token;
  }

  /**
   * Get current user info.
   * @returns {Promise<Object|null>}
   */
  async getUser() {
    if (!this._initialized) await this.init();
    return this._user;
  }

  /**
   * Set a token manually (e.g., from Options page).
   * @param {string} token
   * @param {Object} [user]
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

  /**
   * Resolve the API base URL from settings or default.
   * @returns {Promise<string>}
   */
  async _getApiUrl() {
    const result = await this._storage.get(CounselConstants.STORAGE_KEYS.API_URL);
    return result[ CounselConstants.STORAGE_KEYS.API_URL ] || CounselConstants.API_BASE_URL;
  }
}

// Singleton
const counselAuth = new AuthManager();
