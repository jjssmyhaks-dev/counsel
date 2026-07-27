// Counsel Chrome Extension — Background Service Worker
// Handles side panel, context menu, and auth token management.

const API_BASE = 'http://localhost:3001';

// Allow users to right-click selected text → analyze contracts
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

  if (info.menuItemId === 'counsel-risk-check') {
    // Open side panel and send selected text
    chrome.sidePanel.open({ tabId: tab.id }).then(() => {
      // The side panel will pick up the selected text via scripting
    });
  }

  if (info.menuItemId === 'counsel-summarize') {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_TOKEN') {
    chrome.storage.local.get(['counselToken'], (data) => {
      sendResponse({ token: data.counselToken || null });
    });
    return true; // Keep channel open for async response
  }

  if (message.type === 'SET_TOKEN') {
    chrome.storage.local.set({ counselToken: message.token }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'ANALYZE_TEXT') {
    fetch(`${API_BASE}/api/agents/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message.text }),
    })
      .then(r => r.json())
      .then(data => sendResponse(data))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
});
