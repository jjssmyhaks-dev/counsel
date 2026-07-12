/**
 * Counsel Gmail Extension — Gmail Read/View Integration
 * Adds "Analyze with Counsel" buttons to email thread views.
 * Supports extraction of email body for analysis, summarization, etc.
 */

(function () {
  'use strict';

  const EMAIL_VIEW_SELECTORS = [
    '[role="main"]',
    'div.Bk',            // Main content area
    'div.aeF',           // Thread container
    'div[class*="a3s"]', // Email body
  ];

  const TOOLBAR_SELECTORS = [
    '.G-tF',             // Button group at top
    '[gh="tm"]',         // Toolbar marker
    '.aeH',              // Toolbar area
    'div[jsaction*="toolbar"]',
    '.ha',               // Reply/forward toolbar
    '.bkK',              // Action buttons
  ];

  const BODY_SELECTORS = [
    '.a3s.aiL',          // Email body div
    'div[class*="a3s"]', // Fallback body class
    '.h7',               // Email content
    'div[class*="ii gt"]', // Another body wrapper
    '.adn.ads',          // Message body container
    'div.a3s',           // Generic
  ];

  let observer = null;
  let injectedEmails = new WeakSet();

  /**
   * Find a visible email thread in the viewport.
   */
  function findEmailViews() {
    const views = [];
    const mainEl = document.querySelector('[role="main"]');
    if (!mainEl) return views;

    // Find individual email cards/segments within a thread
    const emailCards = mainEl.querySelectorAll('.adn.ads, .h7, div[class*="a3s"], .gs');
    emailCards.forEach((card) => {
      if (card.offsetParent !== null) {
        views.push(card);
      }
    });

    // If no cards found, try the main body
    if (views.length === 0) {
      const bodyEl = findEmailBody(mainEl);
      if (bodyEl) views.push(bodyEl);
    }

    return views;
  }

  /**
   * Try to find the email body within a container.
   */
  function findEmailBody(container) {
    for (const sel of BODY_SELECTORS) {
      try {
        const el = container.querySelector(sel);
        if (el && el.innerText && el.innerText.trim().length > 20) return el;
      } catch (_) { /* invalid */ }
    }
    return null;
  }

  /**
   * Find a toolbar to inject into.
   */
  function findToolbar(container) {
    // First try global toolbar
    const globalToolbar = document.querySelector('.G-tF');
    if (globalToolbar) return globalToolbar;

    // Try within container
    for (const sel of TOOLBAR_SELECTORS) {
      try {
        const el = container.querySelector(sel);
        if (el) return el;
      } catch (_) { /* invalid */ }
    }

    return null;
  }

  /**
   * Extract email content from a view element.
   */
  function extractEmailContent(viewEl) {
    const content = {
      type: 'read',
      emailBody: '',
      emailSubject: '',
      sender: '',
      recipients: [],
    };

    // Extract subject
    const subjectEl = document.querySelector('h2[data-thread-perm-id], h2.hP, div.ha h2');
    if (subjectEl) {
      content.emailSubject = (subjectEl.textContent || '').trim();
    }

    // Extract sender from this email card
    const senderEl = viewEl.querySelector('.gD, .gd, span[email]');
    if (senderEl) {
      content.sender = senderEl.getAttribute('email') || senderEl.textContent || '';
    }

    // Extract body
    const bodyEl = viewEl.querySelector('.a3s.aiL, div[class*="a3s"], .h7');
    if (bodyEl) {
      // Get text content without quoted reply markers
      const clone = bodyEl.cloneNode(true);
      // Remove quoted content blocks
      clone.querySelectorAll('.gmail_quote, .gmail_extra, blockquote, .elided-text')
        .forEach((el) => el.remove());
      content.emailBody = (clone.innerText || clone.textContent || '').trim();
    }

    // Extract recipients
    const toEls = viewEl.querySelectorAll('.g2, .hb');
    toEls.forEach((el) => {
      const email = el.getAttribute('email') || el.textContent || '';
      if (email) content.recipients.push(email.trim());
    });

    return content;
  }

  /**
   * Create the "Analyze with Counsel" button.
   */
  function createAnalyzeButton(label, action) {
    const button = document.createElement('button');
    button.className = 'counsel-analyze-btn';
    button.textContent = label;
    button.type = 'button';
    button.title = `Counsel: ${label}`;

    button.style.cssText = [
      'font-family: "Google Sans", Roboto, RobotoDraft, Helvetica, Arial, sans-serif',
      'font-size: 13px',
      'font-weight: 500',
      'color: #1a73e8',
      'background: transparent',
      'border: 1px solid #dadce0',
      'border-radius: 4px',
      'padding: 0 12px',
      'height: 32px',
      'cursor: pointer',
      'white-space: nowrap',
      'transition: background 0.2s, box-shadow 0.2s',
      'display: inline-flex',
      'align-items: center',
      'gap: 4px',
      'margin: '0 2px',
    ].join(';');

    button.addEventListener('mouseenter', () => {
      button.style.background = '#f1f3f4';
      button.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = 'transparent';
      button.style.boxShadow = 'none';
    });

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const viewEl = button.closest('.adn.ads, .h7, div[class*="a3s"]') || findEmailViews()[0];
      const content = viewEl ? extractEmailContent(viewEl) : extractEmailContent(document.body);
      content.action = action;

      chrome.runtime.sendMessage({
        action: 'openSidePanelWithContext',
        context: content,
      }).catch((err) => {
        console.warn('[Counsel] Failed to open side panel:', err.message);
      });
    });

    return button;
  }

  /**
   * Create a container for Counsel buttons.
   */
  function createButtonGroup(viewEl) {
    const wrapper = document.createElement('div');
    wrapper.className = 'counsel-read-actions';
    wrapper.style.cssText = 'display:inline-flex;align-items:center;gap:4px;margin:4px 0;';

    wrapper.appendChild(createAnalyzeButton('🔍 Analyze', 'analyze'));
    wrapper.appendChild(createAnalyzeButton('📋 Summarize', 'summarize'));
    wrapper.appendChild(createAnalyzeButton('✅ Actions', 'action_items'));

    return wrapper;
  }

  /**
   * Inject analysis buttons near an email view.
   */
  function injectButtons(viewEl) {
    if (injectedEmails.has(viewEl)) return;
    injectedEmails.add(viewEl);

    // Try to find a toolbar first
    const toolbar = findToolbar(viewEl);
    if (toolbar && !toolbar.querySelector('.counsel-read-actions')) {
      const group = createButtonGroup(viewEl);
      toolbar.appendChild(group);
      return;
    }

    // Fallback: inject near the email body
    const bodyEl = findEmailBody(viewEl) || viewEl;
    if (bodyEl && !bodyEl.parentElement.querySelector('.counsel-read-actions')) {
      const group = createButtonGroup(viewEl);
      group.style.marginTop = '8px';
      group.style.marginBottom = '8px';
      bodyEl.parentElement.insertBefore(group, bodyEl);
    }
  }

  // ── Observer ────────────────────────────────────────────────────────────

  function handleNewContent() {
    const views = findEmailViews();
    views.forEach((view) => injectButtons(view));

    // Also try global toolbar injection
    const globalToolbar = document.querySelector('.G-tF');
    if (globalToolbar && !globalToolbar.querySelector('.counsel-read-actions')) {
      const group = createButtonGroup(document.body);
      group.style.cssText = 'display:inline-flex;align-items:center;gap:4px;';
      globalToolbar.appendChild(group);
    }
  }

  function startObserver() {
    if (observer) return;

    observer = new MutationObserver(() => {
      handleNewContent();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // ── Init ────────────────────────────────────────────────────────────────

  function init() {
    // Check if already on an email view
    handleNewContent();
    startObserver();

    // Periodic re-check
    setInterval(handleNewContent, 4000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
