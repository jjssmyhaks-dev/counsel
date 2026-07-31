// Counsel Chrome Extension — Background Service Worker
// Handles side panel, context menu, Google OAuth 2.0, and API forwarding.

const API_BASE = 'http://localhost:3001';

// ── Google OAuth 2.0 Configuration ────────────────────────────────────────
const GOOGLE_AUTH = {
  clientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
  redirectUri: chrome.identity.getRedirectURL(),
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revokeEndpoint: 'https://accounts.google.com/o/oauth2/revoke',
  scopes: [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ],
};

// ── Storage Keys ──────────────────────────────────────────────────────────
const STORAGE_KEYS = {
  GOOGLE_TOKEN: 'counsel_google_token',
  GOOGLE_USER: 'counsel_google_user',
  COUNSEL_TOKEN: 'counselToken',
  EMAIL_COUNT: 'counsel_email_count',
  LAST_SYNC: 'counsel_last_sync',
};

// ── Installation ──────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'counsel-risk-check',
    title: '⚠️ Check Contract Risks with Counsel',
    contexts: ['selection'],
  });
  chrome.contextMenus.create({
    id: 'counsel-summarize',
    title: '📝 Summarize with Counsel',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!info.selectionText) return;

  if (info.menuItemId === 'counsel-risk-check' || info.menuItemId === 'counsel-summarize') {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// ── Google Sign-In Change Listener ────────────────────────────────────────
if (chrome.identity && chrome.identity.onSignInChanged) {
  chrome.identity.onSignInChanged.addListener((account, signedIn) => {
    console.log('[Counsel] Google sign-in changed:', account?.id, signedIn);
    if (!signedIn) {
      // User signed out of Chrome; clear our stored token
      clearGoogleToken();
    }
  });
}

// ── Message Router ────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.type) {
      // ── Counsel Auth ──────────────────────────────────────────────
      case 'GET_TOKEN':
        handleGetToken(sendResponse);
        break;

      case 'SET_TOKEN':
        handleSetToken(message.token, sendResponse);
        break;

      // ── Google OAuth ──────────────────────────────────────────────
      case 'GMAIL_AUTH':
        handleGmailAuth(message.action, sendResponse);
        break;

      case 'GMAIL_GET_TOKEN':
        handleGetGoogleToken(sendResponse);
        break;

      case 'GMAIL_STATUS':
        handleGmailStatus(sendResponse);
        break;

      // ── Gmail API Actions ─────────────────────────────────────────
      case 'GMAIL_COMPOSE':
        handleGmailCompose(message.payload, sendResponse);
        break;

      case 'GMAIL_LIST':
        handleGmailList(message.payload, sendResponse);
        break;

      case 'GMAIL_GET':
        handleGmailGet(message.payload, sendResponse);
        break;

      case 'GMAIL_SEND':
        handleGmailSend(message.payload, sendResponse);
        break;

      // ── Analysis ──────────────────────────────────────────────────
      case 'ANALYZE_TEXT':
        handleAnalyzeText(message.text, sendResponse);
        break;

      default:
        sendResponse({ error: `Unknown message type: ${message.type}` });
    }
  } catch (err) {
    console.error('[Counsel] Message handler error:', err);
    sendResponse({ error: err.message });
  }
}

// ── Counsel Token Handlers ────────────────────────────────────────────────
function handleGetToken(sendResponse) {
  chrome.storage.local.get([STORAGE_KEYS.COUNSEL_TOKEN], (data) => {
    sendResponse({ token: data[STORAGE_KEYS.COUNSEL_TOKEN] || null });
  });
}

function handleSetToken(token, sendResponse) {
  chrome.storage.local.set({ [STORAGE_KEYS.COUNSEL_TOKEN]: token }, () => {
    sendResponse({ success: true });
  });
}

// ── Google OAuth Handlers ─────────────────────────────────────────────────
async function handleGmailAuth(action, sendResponse) {
  switch (action) {
    case 'connect':
      try {
        const result = await launchGoogleOAuthFlow();
        sendResponse({ success: true, user: result.user });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
      break;

    case 'disconnect':
      try {
        await disconnectGoogle();
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
      break;

    case 'refresh':
      try {
        const token = await refreshGoogleToken();
        sendResponse({ success: true, token });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
      break;

    default:
      sendResponse({ error: `Unknown GMAIL_AUTH action: ${action}` });
  }
}

async function handleGetGoogleToken(sendResponse) {
  try {
    const token = await getValidGoogleToken();
    sendResponse({ success: true, token });
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

async function handleGmailStatus(sendResponse) {
  try {
    const token = await getStoredGoogleToken();
    if (!token) {
      sendResponse({ connected: false, user: null });
      return;
    }
    const user = await getStoredGoogleUser();
    sendResponse({ connected: true, user });
  } catch (err) {
    sendResponse({ connected: false, error: err.message });
  }
}

// ── OAuth 2.0 Flow ────────────────────────────────────────────────────────
async function launchGoogleOAuthFlow() {
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', GOOGLE_AUTH.clientId);
  authUrl.searchParams.set('redirect_uri', GOOGLE_AUTH.redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', GOOGLE_AUTH.scopes.join(' '));
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  const redirectUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true,
  });

  if (!redirectUrl) {
    throw new Error('OAuth flow cancelled by user');
  }

  // Extract authorization code from redirect URL
  const urlObj = new URL(redirectUrl);
  const authCode = urlObj.searchParams.get('code');

  if (!authCode) {
    const error = urlObj.searchParams.get('error');
    throw new Error(error || 'Failed to get authorization code');
  }

  // Exchange auth code for tokens via Counsel backend
  const tokenData = await exchangeCodeForTokens(authCode);

  // Store tokens
  await chrome.storage.local.set({
    [STORAGE_KEYS.GOOGLE_TOKEN]: {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + (tokenData.expires_in || 3600) * 1000,
      scope: tokenData.scope,
    },
    [STORAGE_KEYS.GOOGLE_USER]: tokenData.user || null,
  });

  return { user: tokenData.user };
}

async function exchangeCodeForTokens(authCode) {
  try {
    const response = await fetch(`${API_BASE}/api/v1/integrations/google/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: authCode,
        redirect_uri: GOOGLE_AUTH.redirectUri,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Token exchange failed: ${response.status}`);
    }

    return response.json();
  } catch (err) {
    // If backend is unavailable, fall back to direct token exchange
    console.warn('[Counsel] Backend unavailable for token exchange, using direct flow:', err.message);
    return directTokenExchange(authCode);
  }
}

async function directTokenExchange(authCode) {
  const response = await fetch(GOOGLE_AUTH.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: authCode,
      client_id: GOOGLE_AUTH.clientId,
      client_secret: '', // Extension OAuth doesn't use client_secret
      redirect_uri: GOOGLE_AUTH.redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error_description || err.error || `Token exchange failed: ${response.status}`);
  }

  const data = await response.json();

  // Fetch user info
  let user = null;
  try {
    const userResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (userResp.ok) {
      user = await userResp.json();
    }
  } catch {
    // User info is optional
  }

  return { ...data, user };
}

// ── Token Management ──────────────────────────────────────────────────────
async function getStoredGoogleToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.GOOGLE_TOKEN], (result) => {
      resolve(result[STORAGE_KEYS.GOOGLE_TOKEN] || null);
    });
  });
}

async function getStoredGoogleUser() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.GOOGLE_USER], (result) => {
      resolve(result[STORAGE_KEYS.GOOGLE_USER] || null);
    });
  });
}

async function getValidGoogleToken() {
  const tokenData = await getStoredGoogleToken();
  if (!tokenData) {
    throw new Error('Not connected to Google. Please connect your Gmail account.');
  }

  // Check if token is expired or about to expire (within 5 minutes)
  if (tokenData.expires_at && Date.now() >= tokenData.expires_at - 5 * 60 * 1000) {
    if (tokenData.refresh_token) {
      return refreshGoogleToken();
    } else {
      throw new Error('Google token expired and no refresh token available. Please reconnect.');
    }
  }

  return tokenData.access_token;
}

async function refreshGoogleToken() {
  const tokenData = await getStoredGoogleToken();
  if (!tokenData || !tokenData.refresh_token) {
    throw new Error('No refresh token available. Please reconnect your Google account.');
  }

  try {
    // Try backend first
    const response = await fetch(`${API_BASE}/api/v1/integrations/google/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: tokenData.refresh_token }),
    });

    if (response.ok) {
      const data = await response.json();
      const updatedToken = {
        ...tokenData,
        access_token: data.access_token,
        expires_at: Date.now() + (data.expires_in || 3600) * 1000,
      };
      await chrome.storage.local.set({ [STORAGE_KEYS.GOOGLE_TOKEN]: updatedToken });
      return data.access_token;
    }
  } catch {
    // Backend unavailable, try direct refresh
    console.warn('[Counsel] Backend unavailable for token refresh, using direct flow');
  }

  return directRefreshToken(tokenData);
}

async function directRefreshToken(tokenData) {
  const response = await fetch(GOOGLE_AUTH.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: tokenData.refresh_token,
      client_id: GOOGLE_AUTH.clientId,
      grant_type: 'refresh_token',
    }).toString(),
  });

  if (!response.ok) {
    // Refresh failed — clear stored token so user can reconnect
    await clearGoogleToken();
    throw new Error('Token refresh failed. Please reconnect your Google account.');
  }

  const data = await response.json();
  const updatedToken = {
    ...tokenData,
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
  };
  await chrome.storage.local.set({ [STORAGE_KEYS.GOOGLE_TOKEN]: updatedToken });
  return data.access_token;
}

async function disconnectGoogle() {
  const tokenData = await getStoredGoogleToken();
  if (tokenData && tokenData.access_token) {
    // Revoke token on Google's side
    try {
      await fetch(`${GOOGLE_AUTH.revokeEndpoint}?token=${tokenData.access_token}`, {
        method: 'POST',
      });
    } catch {
      // Revocation is best-effort; ignore errors
      console.warn('[Counsel] Token revocation failed (non-critical)');
    }
  }

  await clearGoogleToken();
}

async function clearGoogleToken() {
  await chrome.storage.local.remove([
    STORAGE_KEYS.GOOGLE_TOKEN,
    STORAGE_KEYS.GOOGLE_USER,
    STORAGE_KEYS.EMAIL_COUNT,
    STORAGE_KEYS.LAST_SYNC,
  ]);
}

// ── Gmail API Handlers (proxied through Counsel backend) ──────────────────
async function handleGmailCompose(payload, sendResponse) {
  try {
    const token = await getValidGoogleToken();
    const response = await fetch(`${API_BASE}/api/v1/integrations/google/gmail/compose`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Compose failed: ${response.status}`);
    }

    sendResponse({ success: true, data: await response.json() });
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

async function handleGmailList(payload, sendResponse) {
  try {
    const token = await getValidGoogleToken();
    const query = payload?.query || '';
    const maxResults = payload?.maxResults || 20;

    const response = await fetch(
      `${API_BASE}/api/v1/integrations/google/gmail/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `List failed: ${response.status}`);
    }

    const data = await response.json();

    // Update email count in storage
    if (data.resultSizeEstimate !== undefined) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.EMAIL_COUNT]: data.resultSizeEstimate,
        [STORAGE_KEYS.LAST_SYNC]: Date.now(),
      });
    }

    sendResponse({ success: true, data });
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

async function handleGmailGet(payload, sendResponse) {
  try {
    const token = await getValidGoogleToken();
    const messageId = payload?.messageId;
    if (!messageId) {
      sendResponse({ success: false, error: 'messageId is required' });
      return;
    }

    const response = await fetch(
      `${API_BASE}/api/v1/integrations/google/gmail/messages/${messageId}`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Get message failed: ${response.status}`);
    }

    sendResponse({ success: true, data: await response.json() });
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

async function handleGmailSend(payload, sendResponse) {
  try {
    const token = await getValidGoogleToken();
    const response = await fetch(`${API_BASE}/api/v1/integrations/google/gmail/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Send failed: ${response.status}`);
    }

    sendResponse({ success: true, data: await response.json() });
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

// ── Analysis (unchanged, tightened) ───────────────────────────────────────
async function handleAnalyzeText(text, sendResponse) {
  try {
    const response = await fetch(`${API_BASE}/api/agents/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Analysis failed: ${response.status}`);
    }

    sendResponse(await response.json());
  } catch (err) {
    sendResponse({ error: err.message });
  }
}