/**
 * Counsel Chrome Extension — Popup Controller
 * Quick-access panel with status, actions, and recent activity.
 */

(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  // ── State ────────────────────────────────────────────────────────────────

  let isLoggedIn = false;

  // ── DOM References ──────────────────────────────────────────────────────

  const statusDot = $('#popup-status-dot');
  const statusText = $('#popup-status-text');
  const accountSection = $('#popup-account');
  const accountAvatar = $('#popup-avatar');
  const accountName = $('#popup-account-name');
  const accountEmail = $('#popup-account-email');
  const activityList = $('#popup-activity-list');
  const logoutLink = $('#popup-logout');

  // ── Init ────────────────────────────────────────────────────────────────

  async function init() {
    await counselAuth.init();
    await updateStatus();
    await loadActivity();
    bindEvents();
  }

  async function updateStatus() {
    isLoggedIn = await counselAuth.isLoggedIn();
    const user = await counselAuth.getUser();

    if (isLoggedIn && user) {
      statusDot.className = 'counsel-status-dot counsel-status-dot--connected';
      statusText.textContent = 'Connected — ' + (user.firm || 'Demo Firm');

      accountSection.style.display = 'flex';
      const initial = (user.name || user.email || 'U')[0].toUpperCase();
      accountAvatar.textContent = initial;
      accountName.textContent = user.name || user.email;
      accountEmail.textContent = user.email || user.firm || '';
      logoutLink.style.display = 'inline';
    } else {
      statusDot.className = 'counsel-status-dot counsel-status-dot--disconnected';
      statusText.textContent = 'Not signed in';

      accountSection.style.display = 'none';
      logoutLink.style.display = 'none';
    }
  }

  async function loadActivity() {
    const result = await chrome.storage.local.get(CounselConstants.STORAGE_KEYS.RECENT_ACTIVITY);
    const activities = result[ CounselConstants.STORAGE_KEYS.RECENT_ACTIVITY ] || [];

    if (activities.length === 0) {
      activityList.innerHTML = '<div class="counsel-popup__empty">No recent activity</div>';
      return;
    }

    // Show last 5
    const recent = activities.slice(-5).reverse();
    activityList.innerHTML = recent.map((a) => {
      const time = a.timestamp ? formatTime(a.timestamp) : '';
      const icon = getActivityIcon(a.type);
      return `
        <div class="counsel-popup__activity-item">
          <span class="counsel-popup__activity-icon">${icon}</span>
          <div>
            <div class="counsel-popup__activity-text">${escapeHtml(a.label || a.type)}</div>
            ${time ? `<div class="counsel-popup__activity-time">${time}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  function getActivityIcon(type) {
    const icons = {
      'draft': '✎',
      'analyze': '🔍',
      'summarize': '📋',
      'action_items': '✅',
      'risks': '⚠️',
      'clauses': '📄',
      'reply': '✉️',
      'login': '🔑',
    };
    return icons[type] || '📌';
  }

  function formatTime(ts) {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const hours = Math.floor(diffMins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Actions ─────────────────────────────────────────────────────────────

  function openWebApp() {
    chrome.tabs.create({ url: 'http://localhost:3001' });
  }

  async function openSidebar() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
      }
    } catch (err) {
      console.warn('[Counsel Popup] Failed to open side panel:', err.message);
      // Fallback: open as a tab
      chrome.tabs.create({ url: chrome.runtime.getURL('src/sidebar/sidebar.html') });
    }
    window.close();
  }

  async function analyzeCurrentPage() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        // Send message to content script to extract content
        await chrome.tabs.sendMessage(tab.id, { action: 'extractPageContent' });
        await addActivity({
          type: 'analyze',
          label: 'Analyzed current page',
          timestamp: Date.now(),
        });
      }
      window.close();
    } catch (err) {
      console.warn('[Counsel Popup] Cannot analyze this page:', err.message);
    }
  }

  function openSettings() {
    chrome.runtime.openOptionsPage();
    window.close();
  }

  async function handleLogout() {
    await counselAuth.logout();
    chrome.runtime.sendMessage({ action: 'clearAuth' });
    await updateStatus();
    await loadActivity();
  }

  // ── Activity Tracking ────────────────────────────────────────────────────

  async function addActivity(item) {
    const result = await chrome.storage.local.get(CounselConstants.STORAGE_KEYS.RECENT_ACTIVITY);
    let activities = result[ CounselConstants.STORAGE_KEYS.RECENT_ACTIVITY ] || [];
    activities.push(item);
    // Keep only the most recent
    if (activities.length > CounselConstants.MAX_RECENT_ACTIVITY) {
      activities = activities.slice(-CounselConstants.MAX_RECENT_ACTIVITY);
    }
    await chrome.storage.local.set({ [CounselConstants.STORAGE_KEYS.RECENT_ACTIVITY]: activities });
  }

  // ── Event Binding ──────────────────────────────────────────────────────

  function bindEvents() {
    $('#popup-open-app')?.addEventListener('click', openWebApp);
    $('#popup-open-sidebar')?.addEventListener('click', openSidebar);
    $('#popup-analyze-page')?.addEventListener('click', analyzeCurrentPage);
    $('#popup-settings')?.addEventListener('click', (e) => {
      e.preventDefault();
      openSettings();
    });
    $('#popup-logout')?.addEventListener('click', (e) => {
      e.preventDefault();
      handleLogout();
    });
  }

  // ── Start ───────────────────────────────────────────────────────────────

  init();
})();
