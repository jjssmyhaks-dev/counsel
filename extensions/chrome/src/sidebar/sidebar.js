/**
 * Counsel Chrome Extension — Sidebar Controller
 * Manages all sidebar UI interactions, tabs, drafting, analysis, and quick actions.
 */

(function () {
  'use strict';

  // ── State ────────────────────────────────────────────────────────────────

  let currentTab = 'draft';
  let currentContext = null;
  let currentDraftResult = '';
  let currentAnalysisType = '';

  // ── DOM References ──────────────────────────────────────────────────────

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // Auth
  const loginForm = $('#counsel-login-form');
  const loginEmail = $('#counsel-login-email');
  const loginPassword = $('#counsel-login-password');
  const loginBtn = $('#counsel-login-btn');
  const loginError = $('#counsel-login-error');
  const userInfo = $('#counsel-user-info');
  const userName = $('#counsel-user-name');
  const userFirm = $('#counsel-user-firm');
  const userAvatar = $('#counsel-user-avatar');

  // Tabs
  const tabs = $$('.counsel-tab');
  const tabContents = $$('.counsel-tab-content');

  // Draft tab
  const draftInstructions = $('#counsel-draft-instructions');
  const draftTone = $('#counsel-draft-tone');
  const draftContext = $('#counsel-draft-context');
  const draftSubjectBadge = $('#counsel-draft-email-subject');
  const draftGenerate = $('#counsel-draft-generate');
  const draftResult = $('#counsel-draft-result');
  const draftOutput = $('#counsel-draft-output');
  const draftCopy = $('#counsel-draft-copy');
  const draftRegenerate = $('#counsel-draft-regenerate');
  const draftInsert = $('#counsel-draft-insert');

  // Analyze tab
  const analyzeContent = $('#counsel-analyze-content');
  const analyzeCurrent = $('#counsel-analyze-current');
  const analyzeSummary = $('#counsel-analyze-summary');
  const analyzeClauses = $('#counsel-analyze-clauses');
  const analyzeRisks = $('#counsel-analyze-risks');
  const analyzeLoading = $('#counsel-analyze-loading');
  const analyzeError = $('#counsel-analyze-error');
  const analyzeResult = $('#counsel-analyze-result');
  const analyzeOutput = $('#counsel-analyze-output');
  const analyzeResultTitle = $('#counsel-analyze-result-title');
  const analyzeClear = $('#counsel-analyze-clear');

  // Quick tab
  const quickContext = $('#counsel-quick-context');
  const quickSubject = $('#counsel-quick-subject');
  const quickSender = $('#counsel-quick-sender');
  const quickBodyPreview = $('#counsel-quick-body-preview');
  const quickResult = $('#counsel-quick-result');
  const quickOutput = $('#counsel-quick-output');
  const quickResultTitle = $('#counsel-quick-result-title');
  const quickCopy = $('#counsel-quick-copy');

  // Footer
  const statusIndicator = $('#counsel-status-indicator');

  // ── Init ────────────────────────────────────────────────────────────────

  async function init() {
    await counselAuth.init();
    await counselApi.init();
    await loadSettings();
    await updateAuthUI();
    await loadSidePanelContext();
    bindEvents();
    updateStatusIndicator();
  }

  /**
   * Load persisted settings (tone, etc.).
   */
  async function loadSettings() {
    const result = await chrome.storage.local.get(CounselConstants.STORAGE_KEYS.DRAFT_TONE);
    if (result[ CounselConstants.STORAGE_KEYS.DRAFT_TONE ]) {
      draftTone.value = result[ CounselConstants.STORAGE_KEYS.DRAFT_TONE ];
    }
  }

  /**
   * Load context passed from content script via storage.
   */
  async function loadSidePanelContext() {
    const result = await chrome.storage.local.get(CounselConstants.STORAGE_KEYS.SIDE_PANEL_CONTEXT);
    if (result.sidePanelContext) {
      currentContext = result.sidePanelContext;
      applyContext(currentContext);
      // Clear after loading
      chrome.storage.local.remove(CounselConstants.STORAGE_KEYS.SIDE_PANEL_CONTEXT);
    }
  }

  /**
   * Apply context data to the appropriate UI elements.
   */
  function applyContext(context) {
    if (!context) return;

    // Show context badge in draft tab
    if (context.emailSubject) {
      draftSubjectBadge.textContent = '✉️ ' + context.emailSubject;
      draftSubjectBadge.style.display = 'block';
    }

    // Pre-fill context area
    let ctxParts = [];
    if (context.recipients && context.recipients.length > 0) {
      ctxParts.push('To: ' + context.recipients.join(', '));
    }
    if (context.emailSubject) {
      ctxParts.push('Subject: ' + context.emailSubject);
    }
    if (context.emailBody) {
      ctxParts.push('Body: ' + context.emailBody.substring(0, 500) + (context.emailBody.length > 500 ? '...' : ''));
    }
    draftContext.value = ctxParts.join('\n');

    // Populate analyze content if provided
    if (context.emailBody && !analyzeContent.value) {
      analyzeContent.value = context.emailBody;
    }

    // Populate quick context
    if (context.type === 'read' || context.emailBody) {
      quickContext.style.display = 'block';
      if (context.emailSubject) quickSubject.textContent = context.emailSubject;
      if (context.sender) quickSender.textContent = 'From: ' + context.sender;
      if (context.emailBody) {
        quickBodyPreview.textContent = context.emailBody.substring(0, 500);
      }
    }

    // If context has a specific action, trigger the relevant tab
    if (context.action) {
      const actionToTab = {
        'draft_reply': 'draft',
        'analyze': 'analyze',
        'summarize': 'quick',
        'action_items': 'quick',
        'draft': 'draft',
      };
      const targetTab = actionToTab[context.action];
      if (targetTab) {
        switchTab(targetTab);
        if (targetTab === 'quick') {
          setTimeout(() => {
            if (context.action === 'summarize') quickSummarize();
            else if (context.action === 'action_items') quickExtractActions();
          }, 300);
        }
        if (targetTab === 'draft' && context.action === 'draft_reply') {
          draftInstructions.value = 'Draft a reply to this email';
        }
      }
    }
  }

  // ── Auth UI ─────────────────────────────────────────────────────────────

  async function updateAuthUI() {
    const loggedIn = await counselAuth.isLoggedIn();
    const user = await counselAuth.getUser();

    if (loggedIn && user) {
      loginForm.style.display = 'none';
      userInfo.style.display = 'block';
      if (user.name) userName.textContent = user.name;
      else if (user.email) userName.textContent = user.email;
      if (user.firm) userFirm.textContent = user.firm;
      const initial = (user.name || user.email || 'U')[0].toUpperCase();
      userAvatar.textContent = initial;
    } else {
      loginForm.style.display = 'block';
      userInfo.style.display = 'none';
    }
  }

  function showLoginError(msg) {
    loginError.textContent = msg;
    loginError.style.display = 'block';
    setTimeout(() => { loginError.style.display = 'none'; }, 5000);
  }

  async function handleLogin() {
    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    if (!email || !password) {
      showLoginError('Please enter email and password');
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in...';

    const result = await counselAuth.login(email, password);

    if (result.success) {
      loginEmail.value = '';
      loginPassword.value = '';
      await updateAuthUI();
      // Notify background of new token
      chrome.runtime.sendMessage({
        action: 'setAuthToken',
        token: await counselAuth.getToken(),
        user: await counselAuth.getUser(),
      });
    } else {
      showLoginError(result.error || 'Login failed');
    }

    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign In';
  }

  // ── Tab Switching ──────────────────────────────────────────────────────

  function switchTab(tabName) {
    currentTab = tabName;
    tabs.forEach((t) => t.classList.toggle('counsel-tab--active', t.dataset.tab === tabName));
    tabContents.forEach((tc) => {
      tc.style.display = tc.id === 'counsel-tab-' + tabName ? 'block' : 'none';
    });
  }

  // ── Drafting ─────────────────────────────────────────────────────────────

  async function handleDraftGenerate() {
    const instructions = draftInstructions.value.trim();
    if (!instructions) {
      showLoginError('Please describe what the email should say');
      return;
    }

    draftGenerate.disabled = true;
    draftGenerate.innerHTML = '<span class="counsel-spinner"></span> Generating...';
    draftResult.style.display = 'none';

    try {
      const result = await counselApi.draftEmail({
        instructions: instructions,
        tone: draftTone.value,
        context: draftContext.value,
        emailSubject: currentContext?.emailSubject || '',
        recipients: currentContext?.recipients || [],
      });

      currentDraftResult = result.draft || result.content || JSON.stringify(result);
      draftOutput.textContent = currentDraftResult;
      draftResult.style.display = 'block';
      draftResult.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      showLoginError('Draft generation failed: ' + err.message);
    }

    draftGenerate.disabled = false;
    draftGenerate.textContent = 'Generate Draft';
  }

  function handleDraftCopy() {
    if (!currentDraftResult) return;
    navigator.clipboard.writeText(currentDraftResult).then(() => {
      draftCopy.textContent = '✓ Copied';
      setTimeout(() => { draftCopy.textContent = '📋 Copy'; }, 2000);
    }).catch(() => {
      // Fallback: select text
      const range = document.createRange();
      range.selectNode(draftOutput);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    });
  }

  function handleDraftRegenerate() {
    draftResult.style.display = 'none';
    handleDraftGenerate();
  }

  async function handleDraftInsert() {
    if (!currentDraftResult) return;

    // Try to send the draft back to the content script to insert into Gmail compose
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id && tab.url.includes('mail.google.com')) {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'insertDraft',
          draft: currentDraftResult,
        });
        draftInsert.textContent = '✓ Inserted';
        setTimeout(() => { draftInsert.textContent = '📥 Insert'; }, 2000);
      }
    } catch (_) {
      // Fall back to copy
      handleDraftCopy();
      draftInsert.textContent = '✓ Copied instead';
      setTimeout(() => { draftInsert.textContent = '📥 Insert'; }, 2000);
    }
  }

  // ── Analysis ─────────────────────────────────────────────────────────────

  async function handleAnalyze(type) {
    const content = analyzeContent.value.trim();
    if (!content) {
      analyzeError.style.display = 'block';
      analyzeError.textContent = 'Please enter or paste content to analyze.';
      return;
    }

    currentAnalysisType = type;
    analyzeError.style.display = 'none';
    analyzeLoading.style.display = 'flex';
    analyzeResult.style.display = 'none';

    try {
      let result;
      switch (type) {
        case 'summary':
          result = await counselApi.summarize(content);
          analyzeResultTitle.textContent = 'Email Summary';
          analyzeOutput.textContent = result.summary || result.content || JSON.stringify(result);
          break;
        case 'clauses':
          result = await counselApi.extractClauses(content);
          analyzeResultTitle.textContent = 'Extracted Clauses';
          analyzeOutput.textContent = formatClauses(result);
          break;
        case 'risks':
          result = await counselApi.identifyRisks(content);
          analyzeResultTitle.textContent = 'Risk Flags';
          analyzeOutput.textContent = formatRisks(result);
          break;
      }
      analyzeResult.style.display = 'block';
      analyzeResult.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      analyzeError.style.display = 'block';
      analyzeError.textContent = 'Analysis failed: ' + err.message;
    }

    analyzeLoading.style.display = 'none';
  }

  function formatClauses(result) {
    const clauses = result.clauses || result.content || [];
    if (!Array.isArray(clauses) || clauses.length === 0) {
      return JSON.stringify(result, null, 2);
    }
    return clauses.map((c, i) => {
      const title = c.title || c.type || `Clause ${i + 1}`;
      const text = c.text || c.content || '';
      return `## ${title}\n${text}\n`;
    }).join('\n');
  }

  function formatRisks(result) {
    const risks = result.risks || result.content || [];
    if (!Array.isArray(risks) || risks.length === 0) {
      return JSON.stringify(result, null, 2);
    }
    return risks.map((r, i) => {
      const sev = r.severity || 'medium';
      const emoji = sev === 'high' ? '🔴' : sev === 'medium' ? '🟡' : '🟢';
      const desc = r.description || r.text || JSON.stringify(r);
      return `${emoji} **${sev.toUpperCase()}**: ${desc}`;
    }).join('\n\n');
  }

  async function handleAnalyzeCurrentEmail() {
    if (!currentContext?.emailBody) {
      analyzeError.style.display = 'block';
      analyzeError.textContent = 'No email content available. Open an email first.';
      return;
    }
    analyzeContent.value = currentContext.emailBody;
    analyzeError.style.display = 'none';
  }

  // ── Quick Actions ────────────────────────────────────────────────────────

  async function quickSummarize() {
    const body = currentContext?.emailBody || analyzeContent.value.trim();
    if (!body) {
      showQuickError('No email content available.');
      return;
    }

    quickResult.style.display = 'none';
    showQuickLoading();

    try {
      const result = await counselApi.summarize(body);
      quickResultTitle.textContent = 'Email Summary';
      quickOutput.textContent = result.summary || result.content || JSON.stringify(result);
      quickResult.style.display = 'block';
    } catch (err) {
      showQuickError('Summarization failed: ' + err.message);
    }

    hideQuickLoading();
  }

  async function quickExtractActions() {
    const body = currentContext?.emailBody || analyzeContent.value.trim();
    if (!body) {
      showQuickError('No email content available.');
      return;
    }

    quickResult.style.display = 'none';
    showQuickLoading();

    try {
      const result = await counselApi.extractActionItems(body);
      quickResultTitle.textContent = 'Action Items';
      const items = result.actionItems || result.content || [];
      if (Array.isArray(items) && items.length > 0) {
        quickOutput.textContent = items.map((item, i) => `${i + 1}. ${item}`).join('\n');
      } else {
        quickOutput.textContent = JSON.stringify(result, null, 2);
      }
      quickResult.style.display = 'block';
    } catch (err) {
      showQuickError('Action extraction failed: ' + err.message);
    }

    hideQuickLoading();
  }

  async function quickDraftReply() {
    if (!currentContext?.emailBody && !analyzeContent.value.trim()) {
      showQuickError('No email content available.');
      return;
    }
    // Switch to draft tab with context
    switchTab('draft');
    draftInstructions.value = 'Draft a reply to the email below';
  }

  function showQuickLoading() {
    const existing = $('.counsel-quick-loading');
    if (existing) existing.remove();
    const loader = document.createElement('div');
    loader.className = 'counsel-quick-loading counsel-loading';
    loader.style.cssText = 'margin-top: 8px;';
    loader.innerHTML = '<span class="counsel-spinner"></span> Processing...';
    quickContext.parentElement.insertBefore(loader, quickResult);
  }

  function hideQuickLoading() {
    const loader = $('.counsel-quick-loading');
    if (loader) loader.remove();
  }

  function showQuickError(msg) {
    quickResult.style.display = 'block';
    quickResultTitle.textContent = 'Error';
    quickOutput.textContent = msg;
    quickOutput.style.color = 'var(--counsel-error)';
  }

  function handleQuickCopy() {
    const text = quickOutput.textContent;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      quickCopy.textContent = '✓ Copied';
      setTimeout(() => { quickCopy.textContent = '📋 Copy'; }, 2000);
    });
  }

  // ── Status Indicator ────────────────────────────────────────────────────

  async function updateStatusIndicator() {
    const loggedIn = await counselAuth.isLoggedIn();
    if (loggedIn) {
      statusIndicator.textContent = '● Connected';
      statusIndicator.className = 'counsel-status';
    } else {
      statusIndicator.textContent = '● Not signed in';
      statusIndicator.className = 'counsel-status counsel-status--disconnected';
    }
  }

  // ── Settings ────────────────────────────────────────────────────────────

  function openSettings() {
    chrome.runtime.sendMessage({ action: 'openOptions' });
  }

  // ── Event Binding ──────────────────────────────────────────────────────

  function bindEvents() {
    // Close sidebar
    $('#counsel-close-btn')?.addEventListener('click', () => {
      window.close();
    });

    // Tabs
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Login
    loginBtn?.addEventListener('click', handleLogin);
    loginPassword?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleLogin();
    });

    // Open options / manual token
    $('#counsel-open-options')?.addEventListener('click', (e) => {
      e.preventDefault();
      openSettings();
    });

    // Draft
    draftGenerate?.addEventListener('click', handleDraftGenerate);
    draftCopy?.addEventListener('click', handleDraftCopy);
    draftRegenerate?.addEventListener('click', handleDraftRegenerate);
    draftInsert?.addEventListener('click', handleDraftInsert);

    // Analyze
    analyzeSummary?.addEventListener('click', () => handleAnalyze('summary'));
    analyzeClauses?.addEventListener('click', () => handleAnalyze('clauses'));
    analyzeRisks?.addEventListener('click', () => handleAnalyze('risks'));
    analyzeCurrent?.addEventListener('click', handleAnalyzeCurrentEmail);
    analyzeClear?.addEventListener('click', () => {
      analyzeResult.style.display = 'none';
      analyzeContent.value = '';
      analyzeError.style.display = 'none';
    });

    // Quick actions
    $('#counsel-quick-summarize')?.addEventListener('click', quickSummarize);
    $('#counsel-quick-actions')?.addEventListener('click', quickExtractActions);
    $('#counsel-quick-draft-reply')?.addEventListener('click', quickDraftReply);
    quickCopy?.addEventListener('click', handleQuickCopy);

    // Settings
    $('#counsel-open-settings')?.addEventListener('click', openSettings);

    // Listen for messages from content script
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'counsel_context') {
        currentContext = event.data.context;
        applyContext(currentContext);
      }
    });

    // Listen for storage changes
    chrome.storage.onChanged.addListener(async (changes) => {
      if (changes[ CounselConstants.STORAGE_KEYS.TOKEN ]) {
        await updateAuthUI();
        updateStatusIndicator();
      }
      if (changes[ CounselConstants.STORAGE_KEYS.SIDE_PANEL_CONTEXT ]) {
        if (changes[ CounselConstants.STORAGE_KEYS.SIDE_PANEL_CONTEXT ].newValue) {
          currentContext = changes[ CounselConstants.STORAGE_KEYS.SIDE_PANEL_CONTEXT ].newValue;
          applyContext(currentContext);
          chrome.storage.local.remove(CounselConstants.STORAGE_KEYS.SIDE_PANEL_CONTEXT);
        }
      }
    });
  }

  // ── Start ───────────────────────────────────────────────────────────────

  init();
})();
