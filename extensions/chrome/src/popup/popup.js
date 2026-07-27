// Counsel — Popup Controller
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-sidebar').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      chrome.sidePanel.open({ tabId: tab.id });
    });
  });
  document.getElementById('btn-dashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:3000/dashboard' });
  });
  document.getElementById('btn-settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Health check
  fetch('http://localhost:3001/api/health')
    .then(r => r.ok ? 'API Connected' : 'API Error')
    .catch(() => 'API Offline')
    .then(text => { document.getElementById('status').textContent = text; });
});
