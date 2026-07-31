// Counsel — Popup Controller
// Manages popup UI: Gmail OAuth, quick compose, health check, navigation.

document.addEventListener('DOMContentLoaded', async () => {
  // ── DOM References ──────────────────────────────────────────────────
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const gmailStatus = document.getElementById('gmail-status');
  const quickComposeSection = document.getElementById('quick-compose-section');
  const qcStatus = document.getElementById('qc-status');
  const btnLogout = document.getElementById('btn-logout');

  // ── Navigation ─────────────────────────────────────────────────────
  document.getElementById('btn-sidebar').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      chrome.sidePanel.open({ tabId: tab.id });
      window.close();
    });
  });

  document.getElementById('btn-dashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:3000/dashboard' });
    window.close();
  });

  document.getElementById('btn-settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  // ── Initialization ─────────────────────────────────────────────────
  await checkHealth(statusDot, statusText);
  await renderGmailSection(gmailStatus, quickComposeSection);
  await bindQuickCompose(qcStatus);
  await bindLogout(btnLogout);

  // Check counsel auth status
  const counselConnected = await checkCounselStatus();
  if (counselConnected) {
    btnLogout.style.display = 'inline';
  }
});

// ── Health Check ───────────────────────────────────────────────────────────

async function checkHealth(statusDot, statusText) {
  try {
    const resp = await fetch('http://localhost:3001/api/health');
    if (resp.ok) {
      statusDot.className = 'counsel-status-dot counsel-status-dot--connected';
      statusText.textContent = 'API Connected';
    } else {
      statusDot.className = 'counsel-status-dot counsel-status-dot--disconnected';
      statusText.textContent = 'API Error';
    }
  } catch {
    statusDot.className = 'counsel-status-dot counsel-status-dot--disconnected';
    statusText.textContent = 'API Offline';
  }
}

// ── Counsel Auth Status ────────────────────────────────────────────────────

async function checkCounselStatus() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_TOKEN' }, (response) => {
      resolve(!!(response && response.token));
    });
  });
}

// ── Gmail Section ──────────────────────────────────────────────────────────

async function renderGmailSection(container, quickComposeSection) {
  const status = await getGmailStatus();

  if (status.connected) {
    // Show connected state
    const user = status.user || {};
    const email = user.email || user.name || 'Gmail account';
    const emailCount = await getEmailCount();

    container.innerHTML = `
      <div class="counsel-gmail__connected">
        <div class="counsel-gmail__user">
          <span class="counsel-gmail__avatar">${(email[0] || 'G').toUpperCase()}</span>
          <div class="counsel-gmail__user-info">
            <span class="counsel-gmail__email">${escapeHtml(email)}</span>
            ${emailCount !== null ? `<span class="counsel-gmail__count">${emailCount} unread</span>` : ''}
          </div>
        </div>
        <button class="counsel-popup-btn counsel-popup-btn--secondary" id="btn-gmail-disconnect">
          Disconnect
        </button>
      </div>
    `;

    // Bind disconnect
    document.getElementById('btn-gmail-disconnect').addEventListener('click', async () => {
      await disconnectGmail();
      await renderGmailSection(container, quickComposeSection);
    });

    // Show quick compose
    quickComposeSection.style.display = 'block';
  } else {
    // Show disconnected state
    container.innerHTML = `
      <div class="counsel-gmail__disconnected">
        <p class="counsel-gmail__hint">Connect your Gmail to send emails and manage your inbox.</p>
        <button class="counsel-popup-btn counsel-popup-btn--primary counsel-popup-btn--full" id="btn-gmail-connect">
          <span class="counsel-gmail__google-icon">G</span>
          Connect Gmail Account
        </button>
        <div id="gmail-connect-error" class="counsel-error-msg" style="display:none;"></div>
      </div>
    `;

    // Bind connect
    document.getElementById('btn-gmail-connect').addEventListener('click', async () => {
      const btn = document.getElementById('btn-gmail-connect');
      const errorEl = document.getElementById('gmail-connect-error');
      btn.disabled = true;
      btn.textContent = 'Connecting…';
      errorEl.style.display = 'none';

      const result = await connectGmail();
      if (result.success) {
        await renderGmailSection(container, quickComposeSection);
      } else {
        errorEl.textContent = result.error || 'Connection failed';
        errorEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Connect Gmail Account';
      }
    });

    // Hide quick compose
    quickComposeSection.style.display = 'none';
  }
}

// ── Gmail API Helpers ──────────────────────────────────────────────────────

async function getGmailStatus() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GMAIL_STATUS' }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ connected: false });
        return;
      }
      resolve(response || { connected: false });
    });
  });
}

async function getEmailCount() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['counsel_email_count'], (result) => {
      resolve(result.counsel_email_count ?? null);
    });
  });
}

async function connectGmail() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'GMAIL_AUTH', action: 'connect' },
      (response) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response || { success: false, error: 'No response' });
      }
    );
  });
}

async function disconnectGmail() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'GMAIL_AUTH', action: 'disconnect' },
      (response) => {
        resolve(response || { success: false });
      }
    );
  });
}

// ── Quick Compose ──────────────────────────────────────────────────────────

async function bindQuickCompose(statusEl) {
  const btnSend = document.getElementById('btn-send-quick');
  if (!btnSend) return;

  btnSend.addEventListener('click', async () => {
    const to = document.getElementById('qc-to').value.trim();
    const subject = document.getElementById('qc-subject').value.trim();
    const body = document.getElementById('qc-body').value.trim();

    if (!to || !subject || !body) {
      statusEl.textContent = 'Please fill in all fields.';
      statusEl.className = 'counsel-quick-compose__status counsel-quick-compose__status--error';
      return;
    }

    btnSend.disabled = true;
    btnSend.textContent = 'Sending…';
    statusEl.textContent = '';
    statusEl.className = 'counsel-quick-compose__status';

    try {
      const result = await sendQuickEmail({ to, subject, body });
      if (result.success) {
        statusEl.textContent = '✓ Email sent!';
        statusEl.className = 'counsel-quick-compose__status counsel-quick-compose__status--success';
        // Clear form
        document.getElementById('qc-to').value = '';
        document.getElementById('qc-subject').value = '';
        document.getElementById('qc-body').value = '';
      } else {
        statusEl.textContent = result.error || 'Send failed';
        statusEl.className = 'counsel-quick-compose__status counsel-quick-compose__status--error';
      }
    } catch (err) {
      statusEl.textContent = err.message;
      statusEl.className = 'counsel-quick-compose__status counsel-quick-compose__status--error';
    } finally {
      btnSend.disabled = false;
      btnSend.textContent = '✉️ Send';
    }
  });
}

async function sendQuickEmail(payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'GMAIL_SEND', payload },
      (response) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response || { success: false, error: 'No response' });
      }
    );
  });
}

// ── Logout ─────────────────────────────────────────────────────────────────

async function bindLogout(btn) {
  btn.addEventListener('click', async () => {
    await chrome.storage.local.remove(['counselToken', 'counsel_user']);
    btn.style.display = 'none';
    window.close();
  });
}

// ── Utilities ──────────────────────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}