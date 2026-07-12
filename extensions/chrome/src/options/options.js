/**
 * Counsel Chrome Extension — Options Page Controller
 * API settings, preferences, and account management.
 */

(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  // ── DOM References ──────────────────────────────────────────────────────

  const apiUrlInput = $('#options-api-url');
  const apiTokenInput = $('#options-api-token');
  const testConnectionBtn = $('#options-test-connection');
  const saveApiBtn = $('#options-save-api');
  const connectionStatus = $('#options-connection-status');
  const autoInjectToggle = $('#options-auto-inject');
  const defaultToneSelect = $('#options-default-tone');
  const savePrefsBtn = $('#options-save-prefs');
  const accountInfo = $('#options-account-info');
  const clearDataBtn = $('#options-clear-data');
  const toast = $('#options-toast');

  // ── Init ────────────────────────────────────────────────────────────────

  async function init() {
    await counselAuth.init();
    await loadSettings();
    await updateAccountInfo();
    bindEvents();
  }

  /**
   * Load persisted settings into the form.
   */
  async function loadSettings() {
    const result = await chrome.storage.local.get([
      CounselConstants.STORAGE_KEYS.API_URL,
      CounselConstants.STORAGE_KEYS.TOKEN,
      CounselConstants.STORAGE_KEYS.AUTO_INJECT,
      CounselConstants.STORAGE_KEYS.DRAFT_TONE,
    ]);

    if (result[ CounselConstants.STORAGE_KEYS.API_URL ]) {
      apiUrlInput.value = result[ CounselConstants.STORAGE_KEYS.API_URL ];
    } else {
      apiUrlInput.value = CounselConstants.API_BASE_URL;
    }

    if (result[ CounselConstants.STORAGE_KEYS.TOKEN ]) {
      apiTokenInput.value = result[ CounselConstants.STORAGE_KEYS.TOKEN ].substring(0, 20) + '...';
    }

    // Auto-inject: default true if not set
    const autoInject = result[ CounselConstants.STORAGE_KEYS.AUTO_INJECT ];
    autoInjectToggle.checked = autoInject !== false;

    if (result[ CounselConstants.STORAGE_KEYS.DRAFT_TONE ]) {
      defaultToneSelect.value = result[ CounselConstants.STORAGE_KEYS.DRAFT_TONE ];
    }
  }

  /**
   * Show logged-in user info.
   */
  async function updateAccountInfo() {
    const loggedIn = await counselAuth.isLoggedIn();
    const user = await counselAuth.getUser();
    if (loggedIn && user) {
      accountInfo.innerHTML = `
        Signed in as <strong>${escapeHtml(user.name || user.email)}</strong>
        ${user.firm ? ' &middot; ' + escapeHtml(user.firm) : ''}
      `;
    } else {
      accountInfo.innerHTML = '<em>Not signed in</em>';
    }
  }

  // ── Actions ─────────────────────────────────────────────────────────────

  async function saveApiSettings() {
    const apiUrl = apiUrlInput.value.trim();
    const tokenRaw = apiTokenInput.value.trim();

    if (apiUrl) {
      await chrome.storage.local.set({ [CounselConstants.STORAGE_KEYS.API_URL]: apiUrl });
    }

    // Only save token if it's a new one (not masked)
    if (tokenRaw && !tokenRaw.endsWith('...') && tokenRaw.length > 10) {
      await chrome.storage.local.set({ [CounselConstants.STORAGE_KEYS.TOKEN]: tokenRaw });
      // Also update auth manager
      await counselAuth.setToken(tokenRaw);
    }

    // Update API client base URL
    await counselApi.setBaseUrl(apiUrl || CounselConstants.API_BASE_URL);

    showToast('API settings saved');
  }

  async function testConnection() {
    const apiUrl = apiUrlInput.value.trim() || CounselConstants.API_BASE_URL;
    connectionStatus.innerHTML = '<span style="color:#1a73e8;">⏳ Testing connection...</span>';

    try {
      await counselApi.setBaseUrl(apiUrl);
      const ok = await counselApi.healthCheck();
      if (ok) {
        connectionStatus.innerHTML = '<span style="color:var(--success);">✓ Connection successful</span>';
      } else {
        connectionStatus.innerHTML = '<span style="color:var(--error);">✗ Connection failed — check the URL</span>';
      }
    } catch (e) {
      connectionStatus.innerHTML =
        '<span style="color:var(--error);">✗ Connection error: ' + escapeHtml(e.message) + '</span>';
    }
  }

  async function savePreferences() {
    await chrome.storage.local.set({
      [CounselConstants.STORAGE_KEYS.AUTO_INJECT]: autoInjectToggle.checked,
      [CounselConstants.STORAGE_KEYS.DRAFT_TONE]: defaultToneSelect.value,
    });
    showToast('Preferences saved');
  }

  async function clearAllData() {
    if (!confirm('Are you sure? This will clear all settings, tokens, and activity data. ' +
                 'You will need to sign in again.')) {
      return;
    }

    await chrome.storage.local.clear();
    await counselAuth.logout();

    // Reset form
    apiUrlInput.value = CounselConstants.API_BASE_URL;
    apiTokenInput.value = '';
    autoInjectToggle.checked = true;
    defaultToneSelect.value = 'professional';
    connectionStatus.innerHTML = '';
    accountInfo.innerHTML = '<em>Not signed in</em>';

    showToast('All data cleared');
  }

  // ── Toast ──────────────────────────────────────────────────────────────

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('counsel-save-toast--visible');
    setTimeout(() => {
      toast.classList.remove('counsel-save-toast--visible');
    }, 2500);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  // ── Event Binding ──────────────────────────────────────────────────────

  function bindEvents() {
    saveApiBtn?.addEventListener('click', saveApiSettings);
    testConnectionBtn?.addEventListener('click', testConnection);
    savePrefsBtn?.addEventListener('click', savePreferences);
    clearDataBtn?.addEventListener('click', clearAllData);
  }

  // ── Start ───────────────────────────────────────────────────────────────

  init();
})();
