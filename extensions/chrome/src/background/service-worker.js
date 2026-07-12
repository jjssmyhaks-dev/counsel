/**
 * Counsel Chrome Extension — Background Service Worker
 * Handles side panel opening, message routing, and auth token refresh.
 */

const COUNSEL_API_BASE = 'http://localhost:3001/api/v1';

// ── Side Panel ──────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Counsel] Extension installed v' + chrome.runtime.getManifest().version);
});

// Allow content scripts to open the side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openSidePanel') {
    chrome.sidePanel.open({ windowId: sender.tab.windowId })
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // async response
  }

  if (message.action === 'openSidePanelWithContext') {
    // Store context for side panel to read
    chrome.storage.local.set({ sidePanelContext: message.context }).then(() => {
      return chrome.sidePanel.open({ windowId: sender.tab.windowId });
    }).then(() => {
      sendResponse({ success: true });
    }).catch((err) => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (message.action === 'getSidePanelContext') {
    chrome.storage.local.get('sidePanelContext').then((result) => {
      sendResponse({ context: result.sidePanelContext || null });
    });
    return true;
  }

  if (message.action === 'clearSidePanelContext') {
    chrome.storage.local.remove('sidePanelContext').then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.action === 'openOptions') {
    chrome.runtime.openOptionsPage();
    return false;
  }

  // Auth token requests from content scripts
  if (message.action === 'getAuthToken') {
    chrome.storage.local.get(['counsel_token', 'counsel_user']).then((result) => {
      sendResponse({ token: result.counsel_token || null, user: result.counsel_user || null });
    });
    return true;
  }

  if (message.action === 'setAuthToken') {
    const data = { counsel_token: message.token };
    if (message.user) data.counsel_user = message.user;
    chrome.storage.local.set(data).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.action === 'clearAuth') {
    chrome.storage.local.remove(['counsel_token', 'counsel_user']).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  return false;
});

// ── Token Refresh ───────────────────────────────────────────────────────────

async function refreshToken() {
  const { counsel_token, counsel_api_url } = await chrome.storage.local.get([
    'counsel_token', 'counsel_api_url'
  ]);

  if (!counsel_token) return;

  const apiBase = counsel_api_url || COUNSEL_API_BASE;

  try {
    const resp = await fetch(`${apiBase}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: counsel_token }),
    });

    if (resp.ok) {
      const data = await resp.json();
      await chrome.storage.local.set({ counsel_token: data.token });
      console.log('[Counsel] Token refreshed');
    } else if (resp.status === 401) {
      // Token expired irrecoverably
      await chrome.storage.local.remove(['counsel_token', 'counsel_user']);
      console.log('[Counsel] Token expired, cleared auth');
    }
  } catch (e) {
    console.warn('[Counsel] Token refresh failed:', e.message);
  }
}

// Attempt token refresh every 30 minutes
chrome.alarms.create('tokenRefresh', { periodInMinutes: 30 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'tokenRefresh') {
    refreshToken();
  }
});

// Also refresh on startup
refreshToken();

console.log('[Counsel] Background service worker initialized');
