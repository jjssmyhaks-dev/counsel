// Counsel Chrome Extension — Sidebar Panel
// Handles quick actions: summarize, draft, risk check, research

const API_BASE = 'http://localhost:3001';
const AI_BASE = 'http://localhost:8000';

let authToken = null;

document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');
  const outputEl = document.getElementById('output');

  // Check connection
  checkHealth(statusEl);

  // Restore token from storage
  chrome.storage.local.get(['counselToken'], (data) => {
    authToken = data.counselToken || null;
    updateStatus(statusEl, authToken ? 'Connected' : 'Signed out', authToken ? 'connected' : 'error');
  });

  // Button handlers
  document.getElementById('btn-summarize').addEventListener('click', () => summarizeEmail(outputEl));
  document.getElementById('btn-draft').addEventListener('click', () => draftReply(outputEl));
  document.getElementById('btn-risk').addEventListener('click', () => checkRisk(outputEl));
  document.getElementById('btn-research').addEventListener('click', () => researchTopic(outputEl));
});

function updateStatus(el, text, cls) {
  el.textContent = text;
  el.className = `status ${cls || ''}`;
}

async function checkHealth(el) {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (res.ok) updateStatus(el, 'API Connected', 'connected');
    else updateStatus(el, 'API Unhealthy', 'error');
  } catch {
    updateStatus(el, 'API Offline', 'error');
  }
}

async function summarizeEmail(outputEl) {
  outputEl.textContent = 'Loading email content…';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Try to extract Gmail thread content
        const els = document.querySelectorAll('[data-message-id] .ii, .gmail_quote');
        if (els.length === 0) return document.body.innerText.substring(0, 5000);
        return Array.from(els).map(e => e.innerText).join('\n---\n').substring(0, 5000);
      }
    });
    const text = result[0]?.result || 'No email content found.';
    outputEl.textContent = 'Summarizing…';

    const res = await fetch(`${AI_BASE}/agents/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `Summarize this email thread:\n\n${text}`,
        firm_id: 'extension',
        top_k: 0,
      }),
    });
    const data = await res.json();
    outputEl.textContent = data.raw_output || JSON.stringify(data, null, 2);
  } catch (e) {
    outputEl.textContent = `Error: ${e.message}`;
  }
}

async function draftReply(outputEl) {
  outputEl.textContent = 'Extracting context…';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body.innerText.substring(0, 4000),
    });
    const text = result[0]?.result || '';
    outputEl.textContent = 'Drafting reply…';

    const res = await fetch(`${AI_BASE}/agents/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draft_type: 'email',
        instructions: `Draft a professional reply to the following email thread context. Keep it concise and actionable. Context:\n${text}`,
      }),
    });
    const data = await res.json();
    outputEl.textContent = data.raw_output || JSON.stringify(data, null, 2);
  } catch (e) {
    outputEl.textContent = `Error: ${e.message}`;
  }
}

async function checkRisk(outputEl) {
  outputEl.textContent = 'Select text from an email and right-click → "Check Contract Risks" to analyze.';
}

async function researchTopic(outputEl) {
  const query = prompt('Enter a research topic or question:');
  if (!query) return;
  outputEl.textContent = 'Researching…';

  try {
    const res = await fetch(`${AI_BASE}/agents/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, firm_id: 'extension', top_k: 5 }),
    });
    const data = await res.json();
    outputEl.textContent = data.raw_output || JSON.stringify(data, null, 2);
  } catch (e) {
    outputEl.textContent = `Error: ${e.message}`;
  }
}
