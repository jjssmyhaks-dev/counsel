// Counsel — Gmail Compose Injection
// Injects AI-powered compose helpers into Gmail's compose window.
// Uses real OAuth token for API calls via the service worker.

(function() {
  'use strict';

  const MINT = '#15b881';
  const MINT_DARK = '#0a8a5f';

  // ── State ────────────────────────────────────────────────────────────────
  let gmailConnected = false;

  /**
   * Check Gmail connection status via service worker.
   */
  async function checkGmailStatus() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GMAIL_STATUS' }, (response) => {
        gmailConnected = !!(response && response.connected);
        resolve(gmailConnected);
      });
    });
  }

  /**
   * Get a valid OAuth token for Gmail API calls.
   */
  async function getGoogleToken() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'GMAIL_GET_TOKEN' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response && response.success) {
          resolve(response.token);
        } else {
          reject(new Error(response?.error || 'Not connected to Gmail'));
        }
      });
    });
  }

  /**
   * Send an email draft via the Gmail API through the Counsel backend.
   */
  async function sendGmailDraft(payload) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'GMAIL_SEND', payload },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (response && response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response?.error || 'Failed to send email'));
          }
        }
      );
    });
  }

  /**
   * Create a styled button in the Gmail compose toolbar.
   */
  function createCounselButton(text, onClick, icon) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      margin: 0 3px;
      padding: 5px 12px;
      background: ${MINT};
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      font-family: Inter, 'Google Sans', Arial, sans-serif;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
      transition: background 0.15s;
    `;
    if (icon) {
      btn.innerHTML = `${icon} ${text}`;
    }
    btn.addEventListener('mouseenter', () => btn.style.background = MINT_DARK);
    btn.addEventListener('mouseleave', () => btn.style.background = MINT);
    btn.addEventListener('click', onClick);
    return btn;
  }

  /**
   * Extract the current compose window's content.
   */
  function extractComposeContent() {
    // Try to find the active compose window
    const composeWindows = document.querySelectorAll('[role="dialog"] .Am.Al.editable, [role="textbox"][aria-label*="Message"], .editable[contenteditable="true"]');
    for (const el of composeWindows) {
      const text = (el.innerText || el.textContent || '').trim();
      if (text) return text;
    }

    // Fallback: try any visible compose area
    const visibleEditable = Array.from(document.querySelectorAll('[contenteditable="true"]'))
      .find(el => el.offsetParent !== null && el.innerText?.trim());
    if (visibleEditable) return visibleEditable.innerText.trim();

    return '';
  }

  /**
   * Extract recipient from the compose window.
   */
  function extractRecipients() {
    const toFields = document.querySelectorAll('[name="to"], [aria-label*="To"], [peoplekit-id] input');
    const recipients = [];
    for (const field of toFields) {
      const val = field.value || field.textContent || '';
      if (val && val.includes('@')) recipients.push(val.trim());
    }
    return recipients;
  }

  /**
   * Extract subject from the compose window.
   */
  function extractSubject() {
    const subjectField = document.querySelector('[name="subjectbox"], [aria-label*="Subject"]');
    return subjectField ? (subjectField.value || '').trim() : '';
  }

  /**
   * Show a toast notification in the Gmail UI.
   */
  function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: ${isError ? '#d93025' : '#1e8e3e'};
      color: white;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 13px;
      font-family: Inter, 'Google Sans', Arial, sans-serif;
      font-weight: 500;
      z-index: 99999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: counselFadeIn 0.2s ease;
    `;
    document.body.appendChild(toast);

    // Add animation style if not already present
    if (!document.getElementById('counsel-toast-style')) {
      const style = document.createElement('style');
      style.id = 'counsel-toast-style';
      style.textContent = '@keyframes counselFadeIn { from { opacity: 0; transform: translateX(-50%) translateY(10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }';
      document.head.appendChild(style);
    }

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Inject the Counsel AI toolbar into the compose window.
   */
  async function injectCounselToolbar() {
    // Check connection status
    await checkGmailStatus();

    // Avoid duplicate injection
    if (document.querySelector('.counsel-ai-btn')) {
      updateToolbarState();
      return;
    }

    // Find Gmail compose toolbar
    const toolbars = document.querySelectorAll('[role="toolbar"], .aoD, .aDh');
    if (toolbars.length === 0) {
      setTimeout(injectCounselToolbar, 2000);
      return;
    }

    const toolbar = toolbars[0];
    const container = document.createElement('span');
    container.className = 'counsel-ai-toolbar';
    container.style.cssText = 'display:inline-flex;align-items:center;margin-left:6px;gap:4px;';

    // AI Draft button
    const draftBtn = createCounselButton('AI Draft', () => {
      handleDraftWithAI();
    }, '✨');
    draftBtn.classList.add('counsel-ai-btn');
    container.appendChild(draftBtn);

    // Send with Counsel button — only show if Gmail is connected
    const sendBtn = createCounselButton('Send via Counsel', () => {
      handleSendViaCounsel();
    }, '📤');
    sendBtn.classList.add('counsel-ai-btn', 'counsel-send-btn');
    sendBtn.style.background = '#1a73e8';
    sendBtn.addEventListener('mouseenter', () => sendBtn.style.background = '#1557b0');
    sendBtn.addEventListener('mouseleave', () => sendBtn.style.background = '#1a73e8');
    if (!gmailConnected) {
      sendBtn.style.opacity = '0.5';
      sendBtn.style.cursor = 'not-allowed';
      sendBtn.title = 'Connect Gmail to send via Counsel';
    }
    container.appendChild(sendBtn);

    toolbar.appendChild(container);
  }

  /**
   * Update toolbar button states based on connection status.
   */
  function updateToolbarState() {
    const sendBtns = document.querySelectorAll('.counsel-send-btn');
    sendBtns.forEach((btn) => {
      if (gmailConnected) {
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.title = 'Send via Counsel OAuth';
      } else {
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
        btn.title = 'Connect Gmail to send via Counsel';
      }
    });
  }

  /**
   * Handle "AI Draft" button click — opens the side panel.
   */
  function handleDraftWithAI() {
    const content = extractComposeContent();
    const subject = extractSubject();
    const recipients = extractRecipients();

    // Store context for the side panel
    const context = {
      type: 'compose',
      emailBody: content,
      emailSubject: subject,
      recipients,
    };

    chrome.runtime.sendMessage({
      type: 'openSidePanelWithContext',
      context,
    }, () => {
      // Best-effort: open side panel
      window.postMessage({ type: 'COUNSEL_OPEN_SIDEBAR', action: 'draft', context }, '*');
    });

    showToast('Opening Counsel AI draft assistant…');
  }

  /**
   * Handle "Send via Counsel" — sends the email using the Gmail API with OAuth.
   */
  async function handleSendViaCounsel() {
    if (!gmailConnected) {
      showToast('Please connect your Gmail account in the Counsel popup first.', true);
      return;
    }

    const subject = extractSubject();
    const recipients = extractRecipients();
    const body = extractComposeContent();

    if (!recipients.length) {
      showToast('Please enter at least one recipient.', true);
      return;
    }

    if (!subject && !body) {
      showToast('Please enter a subject and message body.', true);
      return;
    }

    showToast('Sending email via Counsel…');

    try {
      await sendGmailDraft({
        to: recipients.join(', '),
        subject: subject || '(no subject)',
        body: body,
      });

      showToast('✓ Email sent successfully!');

      // Try to close the compose window
      const sendButton = document.querySelector('[role="dialog"] [aria-label*="Send"], .aoO [role="button"][aria-label*="Send"]');
      if (sendButton) {
        // Trigger Gmail's native send-to-close behavior
        sendButton.click();
      }
    } catch (err) {
      showToast(`Failed to send: ${err.message}`, true);
    }
  }

  // ── Initialization ───────────────────────────────────────────────────────
  // Observe DOM for compose window appearance
  const observer = new MutationObserver(async () => {
    if (document.querySelector('[role="dialog"]') || document.querySelector('.aDs') || document.querySelector('.aoD')) {
      await checkGmailStatus();
      injectCounselToolbar();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Initial check
  (async () => {
    await checkGmailStatus();
    injectCounselToolbar();
  })();

  // Listen for connection status changes from other parts of the extension
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'GMAIL_CONNECTION_CHANGED') {
      checkGmailStatus().then(() => updateToolbarState());
    }
  });
})();