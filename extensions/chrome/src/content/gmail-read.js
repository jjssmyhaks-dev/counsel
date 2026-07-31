// Counsel — Gmail Read Injection
// Injects AI-powered risk check, summary, and analysis buttons into Gmail threads.
// Uses real OAuth token for authenticated operations.

(function() {
  'use strict';

  const MINT = '#15b881';
  const MINT_DARK = '#0a8a5f';
  let gmailConnected = false;

  /**
   * Check Gmail connection status.
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
   * Get a valid OAuth token.
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
   * Extract the currently visible email content in Gmail.
   */
  function extractEmailContent() {
    // Try Gmail's message body containers
    const selectors = [
      '.a3s.aiL',           // Gmail message body
      '.ii.gt',             // Alternate message body
      '[data-message-id] .ii',
      '.gmail_quote',
    ];

    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        const text = Array.from(els)
          .map(el => el.innerText || el.textContent || '')
          .join('\n---\n')
          .trim();
        if (text.length > 50) return text.substring(0, 8000);
      }
    }

    // Fallback: capture the main content area
    const mainContent = document.querySelector('[role="main"]');
    if (mainContent) {
      return (mainContent.innerText || '').substring(0, 5000);
    }

    return '';
  }

  /**
   * Create a Counsel action button for injection into Gmail.
   */
  function createReadButton(text, onClick, icon) {
    const btn = document.createElement('button');
    btn.innerHTML = `${icon || ''} ${text}`;
    btn.style.cssText = `
      margin: 2px 4px;
      padding: 4px 10px;
      background: ${MINT};
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
      font-family: Inter, 'Google Sans', Arial, sans-serif;
      white-space: nowrap;
      transition: background 0.15s;
    `;
    btn.addEventListener('mouseenter', () => btn.style.background = MINT_DARK);
    btn.addEventListener('mouseleave', () => btn.style.background = MINT);
    btn.addEventListener('click', onClick);
    return btn;
  }

  /**
   * Inject read-mode action buttons near each email header.
   */
  function injectReadButtons() {
    // Avoid double-injection
    if (document.querySelector('.counsel-read-btn')) return;

    // Find email header areas
    const headerAreas = document.querySelectorAll('.ha, .hP, [data-message-id]');
    if (headerAreas.length === 0) return;

    headerAreas.forEach((area, idx) => {
      // Only inject near the first few email headers
      if (idx > 5) return;
      if (area.querySelector('.counsel-read-btn')) return;

      const container = document.createElement('span');
      container.className = 'counsel-read-toolbar';
      container.style.cssText = 'display:inline-flex;align-items:center;margin-left:6px;gap:3px;';

      // Summarize button
      const summarizeBtn = createReadButton('Summarize', () => {
        handleQuickSummary();
      }, '📝');
      summarizeBtn.classList.add('counsel-read-btn');
      container.appendChild(summarizeBtn);

      // Risk check button
      const riskBtn = createReadButton('Risk Check', () => {
        handleRiskCheck();
      }, '⚠️');
      riskBtn.classList.add('counsel-read-btn');
      riskBtn.style.background = '#e37400';
      riskBtn.addEventListener('mouseenter', () => riskBtn.style.background = '#c26400');
      riskBtn.addEventListener('mouseleave', () => riskBtn.style.background = '#e37400');
      container.appendChild(riskBtn);

      // Reply draft button
      const replyBtn = createReadButton('Reply Draft', () => {
        handleDraftReply();
      }, '✍️');
      replyBtn.classList.add('counsel-read-btn');
      container.appendChild(replyBtn);

      area.appendChild(container);
    });
  }

  /**
   * Get selected text or email content and open the side panel.
   */
  function getContentAndOpenSidePanel(action) {
    const selectedText = window.getSelection()?.toString()?.trim();
    const content = selectedText || extractEmailContent();

    if (!content || content.length < 10) {
      showToast('No email content found. Please open an email first.', true);
      return;
    }

    // Store context for the side panel
    const context = {
      type: 'read',
      action,
      emailBody: content,
      emailSubject: extractSubject(),
      sender: extractSender(),
    };

    chrome.runtime.sendMessage({
      type: 'setSidePanelContext',
      context,
    }, () => {
      window.postMessage({ type: 'COUNSEL_OPEN_SIDEBAR', action, context }, '*');
    });
  }

  function extractSubject() {
    const subjectEl = document.querySelector('h2.hP, [data-thread-perm-id] h2');
    return subjectEl ? (subjectEl.textContent || '').trim() : '';
  }

  function extractSender() {
    const senderEl = document.querySelector('.gD, .go');
    return senderEl ? (senderEl.textContent || senderEl.getAttribute('email') || '').trim() : '';
  }

  function handleQuickSummary() {
    getContentAndOpenSidePanel('summarize');
  }

  function handleRiskCheck() {
    getContentAndOpenSidePanel('risks');
  }

  function handleDraftReply() {
    getContentAndOpenSidePanel('draft_reply');
  }

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

    if (!document.getElementById('counsel-read-toast-style')) {
      const style = document.createElement('style');
      style.id = 'counsel-read-toast-style';
      style.textContent = '@keyframes counselFadeIn { from { opacity: 0; transform: translateX(-50%) translateY(10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }';
      document.head.appendChild(style);
    }

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ── Initialization ───────────────────────────────────────────────────────
  let injectAttempts = 0;
  const MAX_ATTEMPTS = 10;

  function tryInject() {
    if (injectAttempts >= MAX_ATTEMPTS) return;
    injectAttempts++;

    // Check if we're on a page with email content
    if (document.querySelector('.ha, .hP, [data-message-id]')) {
      injectReadButtons();
      return;
    }

    // Retry with backoff
    const delay = Math.min(1000 * injectAttempts, 5000);
    setTimeout(tryInject, delay);
  }

  // Observe for dynamically loaded content
  const observer = new MutationObserver(() => {
    if (document.querySelector('.ha, .hP, [data-message-id]')) {
      injectReadButtons();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Start injection attempts
  checkGmailStatus();
  tryInject();

  // Listen for re-connection events
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'GMAIL_CONNECTION_CHANGED') {
      checkGmailStatus();
    }
  });

  console.debug('[Counsel] Gmail read content script loaded (v0.2 with OAuth)');
})();