/**
 * Counsel Gmail Extension — Gmail Compose Integration
 * Injects a "Draft with Counsel" button into the Gmail compose window.
 * Detects compose via MutationObserver on Gmail's dynamic DOM.
 */

(function () {
  'use strict';

  const COMPOSE_SELECTORS = [
    '[role="dialog"][aria-label*="compose" i]',
    '[role="dialog"][aria-label*="New Message" i]',
    '[role="dialog"][aria-label*="Write" i]',
    'div.M9',           // Common compose wrapper class
    'div[class*="compose"]',
    'div.nH.Hd[role="dialog"]',  // Gmail compose dialog
    'div.AD',           // Another compose class
  ];

  const TOOLBAR_SELECTORS = [
    '.aoD',             // Top toolbar area
    '.gU.Up',           // Bottom toolbar
    '.dC',              // Send button area
    '[gh="tm"]',        // Toolbar marker
    '.G-tF',            // Button group
    '.aDh',             // Toolbar wrapper
    'table.aoP',        // Compose table
  ];

  let composeObserver = null;
  let toolbarCheckInterval = null;

  /**
   * Check if a compose window is present in the DOM.
   */
  function findComposeWindow() {
    for (const sel of COMPOSE_SELECTORS) {
      try {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) return el; // visible
      } catch (_) { /* invalid selector */ }
    }
    return null;
  }

  /**
   * Find the toolbar within a compose window.
   */
  function findToolbar(composeEl) {
    for (const sel of TOOLBAR_SELECTORS) {
      try {
        const el = composeEl.querySelector(sel);
        if (el) return el;
      } catch (_) { /* invalid selector */ }
    }
    // Fallback: look for any row of buttons
    const buttonRows = composeEl.querySelectorAll('table tbody tr');
    for (const row of buttonRows) {
      const buttons = row.querySelectorAll('td');
      if (buttons.length > 1) return row;
    }
    return composeEl;
  }

  /**
   * Extract compose context (recipients, subject, existing body).
   */
  function extractComposeContext(composeEl) {
    const context = {
      type: 'compose',
      recipients: [],
      emailSubject: '',
      emailBody: '',
    };

    // Extract To/CC/BCC fields
    const toFields = composeEl.querySelectorAll('[name="to"], input[class*="aT"], textarea[name="to"]');
    toFields.forEach((f) => {
      const val = f.value || f.textContent || f.innerText || '';
      if (val) context.recipients.push(val.trim());
    });

    // If no explicit recipients, try collecting from visible person chips
    if (context.recipients.length === 0) {
      const chips = composeEl.querySelectorAll('[data-hovercard-id], [email], [data-name]');
      chips.forEach((c) => {
        const email = c.getAttribute('email') || c.getAttribute('data-hovercard-id') || '';
        if (email && email.includes('@')) context.recipients.push(email);
      });

      // Try text-based recipient fields
      const recipientAreas = composeEl.querySelectorAll('[role="textbox"], div[contenteditable="true"]');
      let foundSubject = false;
      recipientAreas.forEach((area) => {
        const text = area.textContent || '';
        if (!foundSubject && (text.includes('Subject') || area.getAttribute('aria-label')?.includes('Subject'))) {
          foundSubject = true;
        } else if (text && text.includes('@')) {
          context.recipients.push(text.trim());
        }
      });
    }

    // Extract subject
    const subjectInput = composeEl.querySelector('[name="subject"], [name="subjectbox"], input[class*="aoT"]');
    if (subjectInput && subjectInput.value) {
      context.emailSubject = subjectInput.value;
    } else {
      // Fallback subject extraction
      const inputs = composeEl.querySelectorAll('input[type="text"]');
      for (const inp of inputs) {
        if (inp.placeholder?.toLowerCase().includes('subject') || inp.name === 'subjectbox') {
          context.emailSubject = inp.value || '';
          break;
        }
      }
    }

    // Extract body if present
    const bodyEl = composeEl.querySelector('[role="textbox"][aria-label*="Body"], [contenteditable="true"][aria-label*="Body"], div.Am.Al');
    if (bodyEl) {
      context.emailBody = bodyEl.innerText || bodyEl.textContent || '';
    }

    return context;
  }

  /**
   * Create the "Draft with Counsel" button element.
   */
  function createDraftButton() {
    const container = document.createElement('div');
    container.className = 'counsel-compose-btn-wrapper';
    container.style.cssText = 'display:inline-flex;align-items:center;margin:0 2px;';

    const button = document.createElement('button');
    button.className = 'counsel-draft-btn';
    button.textContent = '✎ Draft with Counsel';
    button.title = 'Open Counsel drafting assistant in sidebar';
    button.type = 'button';

    // Gmail-matching button styles
    button.style.cssText = [
      'font-family: "Google Sans", Roboto, RobotoDraft, Helvetica, Arial, sans-serif',
      'font-size: 13px',
      'font-weight: 500',
      'color: #1a73e8',
      'background: #e8f0fe',
      'border: none',
      'border-radius: 4px',
      'padding: 0 12px',
      'height: 32px',
      'cursor: pointer',
      'white-space: nowrap',
      'transition: background 0.2s, box-shadow 0.2s',
      'display: inline-flex',
      'align-items: center',
      'gap: 4px',
    ].join(';');

    button.addEventListener('mouseenter', () => {
      button.style.background = '#d2e3fc';
      button.style.boxShadow = '0 1px 2px rgba(0,0,0,0.12)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = '#e8f0fe';
      button.style.boxShadow = 'none';
    });

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const composeEl = findComposeWindow();
      const context = composeEl ? extractComposeContext(composeEl) : { type: 'compose' };

      chrome.runtime.sendMessage({
        action: 'openSidePanelWithContext',
        context: context,
      }).catch((err) => {
        console.warn('[Counsel] Failed to open side panel:', err.message);
      });
    });

    container.appendChild(button);
    return container;
  }

  /**
   * Inject the button into the compose toolbar.
   */
  function injectButton(composeEl) {
    // Don't inject twice
    if (composeEl.querySelector('.counsel-draft-btn')) return;

    const toolbar = findToolbar(composeEl);

    // Find a good insertion point — near existing buttons
    let insertionPoint = null;

    // Try to find the send button area to insert before it
    const sendBtn = toolbar.querySelector('[role="button"][aria-label*="Send"]');
    if (sendBtn) {
      insertionPoint = sendBtn.closest('td') || sendBtn.parentElement;
    }

    // Fallback: append to toolbar
    if (!insertionPoint) {
      // Look for last visible row
      const rows = toolbar.querySelectorAll('tr, div');
      insertionPoint = toolbar;
      for (const row of rows) {
        if (row.offsetParent !== null) insertionPoint = row;
      }
    }

    const btn = createDraftButton();
    insertionPoint.insertAdjacentElement('afterend', btn);
  }

  /**
   * Handle compose window detection.
   */
  function handleComposeDetected(composeEl) {
    // Give Gmail time to fully render toolbar
    setTimeout(() => {
      injectButton(composeEl);
    }, 500);

    // Also try again after a delay in case toolbar is lazy-loaded
    setTimeout(() => {
      injectButton(composeEl);
    }, 1500);
  }

  /**
   * Reset: remove any injected buttons when compose closes.
   */
  function cleanupButtons() {
    document.querySelectorAll('.counsel-draft-btn').forEach((btn) => {
      btn.closest('.counsel-compose-btn-wrapper')?.remove();
    });
  }

  // ── MutationObserver ────────────────────────────────────────────────────

  function startObserver() {
    if (composeObserver) return;

    let lastComposeState = false;

    composeObserver = new MutationObserver(() => {
      const composeEl = findComposeWindow();
      const composeOpen = !!composeEl;

      if (composeOpen !== lastComposeState) {
        lastComposeState = composeOpen;
        if (composeOpen) {
          handleComposeDetected(composeEl);
        } else {
          cleanupButtons();
        }
      } else if (composeOpen) {
        // Compose still open — check if button needs injection
        if (!document.querySelector('.counsel-draft-btn')) {
          injectButton(composeEl);
        }
      }
    });

    composeObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
    });
  }

  // ── Init ────────────────────────────────────────────────────────────────

  function init() {
    // Check if compose already open
    const composeEl = findComposeWindow();
    if (composeEl) {
      handleComposeDetected(composeEl);
    }

    startObserver();

    // Periodic re-check for robustness
    setInterval(() => {
      const composeEl = findComposeWindow();
      if (composeEl && !document.querySelector('.counsel-draft-btn')) {
        injectButton(composeEl);
      }
    }, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
