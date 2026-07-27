// Counsel — Gmail Compose Injection
// Injects AI-powered compose helpers into Gmail's compose window.

(function() {
  'use strict';

  const MINT = '#15b881';
  const MINT_DARK = '#0a8a5f';

  function createButton(text, onClick) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      margin: 4px;
      padding: 6px 14px;
      background: ${MINT};
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      font-family: Inter, Arial, sans-serif;
    `;
    btn.addEventListener('mouseenter', () => btn.style.background = MINT_DARK);
    btn.addEventListener('mouseleave', () => btn.style.background = MINT);
    btn.addEventListener('click', onClick);
    return btn;
  }

  function injectCounselToolbar() {
    // Find Gmail compose toolbar
    const toolbars = document.querySelectorAll('[role="toolbar"], .aoD');
    if (toolbars.length === 0) {
      setTimeout(injectCounselToolbar, 2000);
      return;
    }

    // Avoid duplicate injection
    if (document.querySelector('.counsel-ai-btn')) return;

    const toolbar = toolbars[0];
    const container = document.createElement('span');
    container.className = 'counsel-ai-toolbar';
    container.style.cssText = 'display:inline-flex;align-items:center;margin-left:8px;';

    const draftBtn = createButton('✨ Draft with AI', () => {
      alert('Opening Counsel sidebar — draft your email with AI assistance.');
      // Trigger side panel open
      window.postMessage({ type: 'COUNSEL_OPEN_SIDEBAR', action: 'draft' }, '*');
    });

    container.appendChild(draftBtn);
    toolbar.appendChild(container);
  }

  // Observe DOM for compose window appearance
  const observer = new MutationObserver(() => {
    if (document.querySelector('[role="dialog"]') || document.querySelector('.aDs')) {
      injectCounselToolbar();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Initial check
  injectCounselToolbar();
})();
