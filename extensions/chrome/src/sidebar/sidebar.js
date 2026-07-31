// Counsel Chrome Extension — Sidebar Panel
// Handles Gmail OAuth integration, drafting, analysis, and email browsing.

const API_BASE = 'http://localhost:3001';
const AI_BASE = 'http://localhost:8000';

// ── State ──────────────────────────────────────────────────────────────────
let state = {
  gmailConnected: false,
  gmailUser: null,
  emailCount: null,
  messages: [],
  activeTab: 'draft',
};

document.addEventListener('DOMContentLoaded', async () => {
  // ── Check all connection statuses ──────────────────────────────────
  await checkHealth();
  await checkGmailStatus();
  await renderGmailPanel();

  // ── Tab Switching ──────────────────────────────────────────────────
  const tabs = document.querySelectorAll('.counsel-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // ── Draft Tab ──────────────────────────────────────────────────────
  document.getElementById('btn-draft-email').addEventListener('click', () => handleDraftEmail());

  // ── Analyze Tab ────────────────────────────────────────────────────
  document.getElementById('btn-summarize').addEventListener('click', () => handleAnalyze('summarize'));
  document.getElementById('btn-risk').addEventListener('click', () => handleAnalyze('risks'));
  document.getElementById('btn-clauses').addEventListener('click', () => handleAnalyze('clauses'));
  document.getElementById('btn-actions').addEventListener('click', () => handleAnalyze('action_items'));

  // ── Refresh ────────────────────────────────────────────────────────
  document.getElementById('btn-refresh').addEventListener('click', () => {
    checkHealth();
    checkGmailStatus();
    renderGmailPanel();
  });
});

// ── Status Updates ─────────────────────────────────────────────────────────

function updateFooterStatus(text, connected = false) {
  const el = document.getElementById('footer-status');
  if (el) {
    el.textContent = text;
    el.className = connected ? 'counsel-status' : 'counsel-status counsel-status--disconnected';
  }
}

async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (res.ok) {
      updateFooterStatus('API Connected', true);
    } else {
      updateFooterStatus('API Unhealthy');
    }
  } catch {
    updateFooterStatus('API Offline');
  }
}

async function checkGmailStatus() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GMAIL_STATUS' }, (response) => {
      if (chrome.runtime.lastError) {
        state.gmailConnected = false;
        resolve(false);
        return;
      }
      state.gmailConnected = !!(response && response.connected);
      state.gmailUser = response?.user || null;
      resolve(state.gmailConnected);
    });
  });
}

async function getEmailCount() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['counsel_email_count'], (result) => {
      state.emailCount = result.counsel_email_count ?? null;
      resolve(state.emailCount);
    });
  });
}

// ── Tab Switching ──────────────────────────────────────────────────────────

function switchTab(tabName) {
  state.activeTab = tabName;

  // Update tab buttons
  document.querySelectorAll('.counsel-tab').forEach((t) => {
    t.classList.toggle('counsel-tab--active', t.dataset.tab === tabName);
  });

  // Show/hide content
  document.getElementById('tab-draft').style.display = tabName === 'draft' ? 'block' : 'none';
  document.getElementById('tab-analyze').style.display = tabName === 'analyze' ? 'block' : 'none';
  document.getElementById('tab-gmail').style.display = tabName === 'gmail' ? 'block' : 'none';

  // Load Gmail tab content on switch
  if (tabName === 'gmail') {
    loadGmailTab();
  }
}

// ── Gmail Integration Panel (top section) ──────────────────────────────────

async function renderGmailPanel() {
  const panel = document.getElementById('gmail-integration-panel');
  if (!panel) return;

  await getEmailCount();

  if (state.gmailConnected && state.gmailUser) {
    const email = state.gmailUser.email || state.gmailUser.name || 'Gmail';
    panel.innerHTML = `
      <div class="counsel-gmail-bar">
        <div class="counsel-gmail-bar__user">
          <span class="counsel-gmail-bar__avatar">G</span>
          <div>
            <div class="counsel-gmail-bar__email">${escapeHtml(email)}</div>
            <div class="counsel-gmail-bar__count">
              ${state.emailCount !== null ? `${state.emailCount} unread` : 'Gmail connected'}
            </div>
          </div>
        </div>
        <button class="counsel-btn counsel-btn--ghost counsel-btn--sm" id="btn-gmail-disconnect">
          Disconnect
        </button>
      </div>
    `;
    document.getElementById('btn-gmail-disconnect').addEventListener('click', handleDisconnectGmail);
  } else {
    panel.innerHTML = `
      <div class="counsel-gmail-bar counsel-gmail-bar--disconnected">
        <p class="counsel-text--muted counsel-text--sm">Connect your Gmail to draft, send, and analyze emails.</p>
        <button class="counsel-btn counsel-btn--primary counsel-btn--sm" id="btn-gmail-connect">
          🔗 Connect Gmail
        </button>
        <div id="gmail-connect-error" class="counsel-error-msg" style="display:none;"></div>
      </div>
    `;
    document.getElementById('btn-gmail-connect').addEventListener('click', handleConnectGmail);
  }
}

async function handleConnectGmail() {
  const btn = document.getElementById('btn-gmail-connect');
  const errorEl = document.getElementById('gmail-connect-error');
  if (!btn) return;

  btn.disabled = true;
  btn.textContent = 'Connecting…';
  if (errorEl) errorEl.style.display = 'none';

  chrome.runtime.sendMessage(
    { type: 'GMAIL_AUTH', action: 'connect' },
    (response) => {
      if (response && response.success) {
        state.gmailConnected = true;
        state.gmailUser = response.user;
        renderGmailPanel();
      } else {
        if (errorEl) {
          errorEl.textContent = response?.error || 'Connection failed';
          errorEl.style.display = 'block';
        }
        btn.disabled = false;
        btn.textContent = '🔗 Connect Gmail';
      }
    }
  );
}

async function handleDisconnectGmail() {
  chrome.runtime.sendMessage(
    { type: 'GMAIL_AUTH', action: 'disconnect' },
    () => {
      state.gmailConnected = false;
      state.gmailUser = null;
      state.emailCount = null;
      renderGmailPanel();
    }
  );
}

// ── Gmail Tab Content ──────────────────────────────────────────────────────

async function loadGmailTab() {
  const container = document.getElementById('gmail-tab-content');
  if (!container) return;

  if (!state.gmailConnected) {
    container.innerHTML = `
      <div class="counsel-card counsel-card--centered">
        <p class="counsel-text--muted">Connect your Gmail account to view your inbox.</p>
        <button class="counsel-btn counsel-btn--primary counsel-btn--sm" id="btn-gmail-connect-inline">
          🔗 Connect Gmail
        </button>
        <div id="gmail-connect-error-inline" class="counsel-error-msg" style="display:none;"></div>
      </div>
    `;
    document.getElementById('btn-gmail-connect-inline').addEventListener('click', async () => {
      const btn = document.getElementById('btn-gmail-connect-inline');
      const errEl = document.getElementById('gmail-connect-error-inline');
      btn.disabled = true;
      btn.textContent = 'Connecting…';
      errEl.style.display = 'none';

      chrome.runtime.sendMessage(
        { type: 'GMAIL_AUTH', action: 'connect' },
        (response) => {
          if (response && response.success) {
            state.gmailConnected = true;
            state.gmailUser = response.user;
            renderGmailPanel();
            loadGmailTab();
          } else {
            errEl.textContent = response?.error || 'Connection failed';
            errEl.style.display = 'block';
            btn.disabled = false;
            btn.textContent = '🔗 Connect Gmail';
          }
        }
      );
    });
    return;
  }

  // Show loading
  container.innerHTML = `
    <div class="counsel-loading">
      <span class="counsel-spinner"></span>
      Loading inbox…
    </div>
  `;

  await getEmailCount();

  // Fetch recent inbox messages
  try {
    const messages = await fetchGmailMessages('in:inbox', 10);
    renderGmailInbox(container, messages);
  } catch (err) {
    container.innerHTML = `
      <div class="counsel-error-msg">Failed to load emails: ${escapeHtml(err.message)}</div>
      <button class="counsel-btn counsel-btn--secondary counsel-btn--sm" onclick="document.dispatchEvent(new Event('gmail-retry'))">Retry</button>
    `;
  }
}

function fetchGmailMessages(query, maxResults) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'GMAIL_LIST', payload: { query, maxResults } },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response && response.success) {
          state.messages = response.data?.messages || [];
          resolve(state.messages);
        } else {
          reject(new Error(response?.error || 'Failed to fetch messages'));
        }
      }
    );
  });
}

function renderGmailInbox(container, messages) {
  if (!messages || messages.length === 0) {
    container.innerHTML = `
      <div class="counsel-card counsel-card--centered">
        <p class="counsel-text--muted">No recent emails found in your inbox.</p>
      </div>
    `;
    return;
  }

  // Build a quick compose section at top
  let html = `
    <div class="counsel-card">
      <button class="counsel-btn counsel-btn--primary counsel-btn--sm" id="btn-quick-compose-toggle">
        ✉️ Quick Compose
      </button>
      <div id="quick-compose-form" class="counsel-quick-compose" style="display:none;">
        <div class="counsel-form-group">
          <label>To</label>
          <input type="email" id="qc-sidebar-to" class="counsel-input" placeholder="email@example.com" />
        </div>
        <div class="counsel-form-group">
          <label>Subject</label>
          <input type="text" id="qc-sidebar-subject" class="counsel-input" placeholder="Subject" />
        </div>
        <div class="counsel-form-group">
          <label>Body</label>
          <textarea id="qc-sidebar-body" class="counsel-textarea" placeholder="Write your message…" rows="4"></textarea>
        </div>
        <button class="counsel-btn counsel-btn--primary counsel-btn--full" id="btn-send-sidebar">
          Send
        </button>
        <div id="sidebar-qc-status" class="counsel-quick-compose__status"></div>
      </div>
    </div>
    <div class="counsel-card">
      <h4>📬 Recent Inbox</h4>
  `;

  messages.forEach((msg, idx) => {
    const headers = msg.payload?.headers || [];
    const subject = findHeader(headers, 'Subject') || '(no subject)';
    const from = findHeader(headers, 'From') || 'Unknown';
    const date = findHeader(headers, 'Date') || '';
    const snippet = msg.snippet || '';

    html += `
      <div class="counsel-gmail-message" data-id="${escapeHtml(msg.id || '')}">
        <div class="counsel-gmail-message__from">${escapeHtml(from)}</div>
        <div class="counsel-gmail-message__subject">${escapeHtml(subject)}</div>
        <div class="counsel-gmail-message__snippet">${escapeHtml(snippet.substring(0, 100))}</div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;

  // Bind quick compose toggle
  const toggleBtn = document.getElementById('btn-quick-compose-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const form = document.getElementById('quick-compose-form');
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
    });
  }

  // Bind send button
  const sendBtn = document.getElementById('btn-send-sidebar');
  if (sendBtn) {
    sendBtn.addEventListener('click', handleSendSidebarCompose);
  }
}

function findHeader(headers, name) {
  const h = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return h ? h.value : null;
}

async function handleSendSidebarCompose() {
  const to = document.getElementById('qc-sidebar-to').value.trim();
  const subject = document.getElementById('qc-sidebar-subject').value.trim();
  const body = document.getElementById('qc-sidebar-body').value.trim();
  const statusEl = document.getElementById('sidebar-qc-status');
  const btn = document.getElementById('btn-send-sidebar');

  if (!to || !subject || !body) {
    statusEl.textContent = 'All fields are required';
    statusEl.className = 'counsel-error-msg';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Sending…';
  statusEl.textContent = '';
  statusEl.className = '';

  chrome.runtime.sendMessage(
    { type: 'GMAIL_SEND', payload: { to, subject, body } },
    (response) => {
      btn.disabled = false;
      btn.textContent = 'Send';
      if (response && response.success) {
        statusEl.textContent = '✓ Sent!';
        statusEl.className = 'counsel-status';
        // Clear form
        document.getElementById('qc-sidebar-to').value = '';
        document.getElementById('qc-sidebar-subject').value = '';
        document.getElementById('qc-sidebar-body').value = '';
      } else {
        statusEl.textContent = response?.error || 'Failed to send';
        statusEl.className = 'counsel-error-msg';
      }
    }
  );
}

// ── Draft Tab Handler ──────────────────────────────────────────────────────

async function handleDraftEmail() {
  const instructions = document.getElementById('draft-instructions').value.trim();
  const tone = document.getElementById('draft-tone').value;
  const outputEl = document.getElementById('draft-output');
  const loadingEl = document.getElementById('draft-loading');

  if (!instructions) {
    outputEl.style.display = 'block';
    outputEl.textContent = 'Please enter drafting instructions.';
    outputEl.className = 'counsel-error-msg';
    return;
  }

  outputEl.style.display = 'none';
  loadingEl.style.display = 'flex';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let context = '';
    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body.innerText.substring(0, 3000),
      });
      context = result[0]?.result || '';
    } catch {
      // Context is optional
    }

    const res = await fetch(`${AI_BASE}/agents/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draft_type: 'email',
        instructions: `Draft an email with these instructions. Tone: ${tone}. Context from page: ${context}\n\nInstructions: ${instructions}`,
      }),
    });
    const data = await res.json();

    loadingEl.style.display = 'none';
    outputEl.style.display = 'block';
    outputEl.className = 'counsel-draft-output';
    outputEl.textContent = data.raw_output || JSON.stringify(data, null, 2);
  } catch (e) {
    loadingEl.style.display = 'none';
    outputEl.style.display = 'block';
    outputEl.className = 'counsel-error-msg';
    outputEl.textContent = `Error: ${e.message}`;
  }
}

// ── Analyze Tab Handler ────────────────────────────────────────────────────

async function handleAnalyze(analysisType) {
  const outputEl = document.getElementById('analyze-output');
  const loadingEl = document.getElementById('analyze-loading');

  outputEl.style.display = 'none';
  loadingEl.style.display = 'flex';

  try {
    let text;

    // Try to get selected text first, then fall back to full page
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const selection = window.getSelection()?.toString()?.trim();
          if (selection) return selection;
          const els = document.querySelectorAll('[data-message-id] .ii, .gmail_quote');
          if (els.length > 0) {
            return Array.from(els).map(e => e.innerText).join('\n---\n').substring(0, 5000);
          }
          return document.body.innerText.substring(0, 5000);
        },
      });
      text = result[0]?.result || '';
    } catch {
      text = '';
    }

    if (!text) {
      loadingEl.style.display = 'none';
      outputEl.style.display = 'block';
      outputEl.className = 'counsel-error-msg';
      outputEl.textContent = 'No text found. Please select text in an email or open an email first.';
      return;
    }

    const prompts = {
      summarize: `Summarize the following content:\n\n${text}`,
      risks: `Identify and analyze risks in the following content. List each risk with severity level:\n\n${text}`,
      clauses: `Extract key clauses and legal terms from the following content:\n\n${text}`,
      action_items: `Extract action items and to-dos from the following content:\n\n${text}`,
    };

    const res = await fetch(`${AI_BASE}/agents/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: prompts[analysisType] || prompts.summarize,
        firm_id: 'extension',
        top_k: 0,
      }),
    });
    const data = await res.json();

    loadingEl.style.display = 'none';
    outputEl.style.display = 'block';
    outputEl.className = 'counsel-analyze-output';
    outputEl.textContent = data.raw_output || JSON.stringify(data, null, 2);
  } catch (e) {
    loadingEl.style.display = 'none';
    outputEl.style.display = 'block';
    outputEl.className = 'counsel-error-msg';
    outputEl.textContent = `Error: ${e.message}`;
  }
}

// ── Utilities ──────────────────────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}