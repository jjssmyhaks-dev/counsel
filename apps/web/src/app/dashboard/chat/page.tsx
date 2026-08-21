'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

const serif = 'font-serif';

// ── Types ──────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  toolId?: string;
  actions?: { type: string; label: string; icon: string }[];
  toolSuggestions?: { id: string; name: string; icon: string }[];
  form?: {
    type: string;
    fields: { name: string; label: string; type: string; required: boolean; options?: string[]; placeholder?: string }[];
  };
}

interface ChatTool {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
}

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

const TOOL_ICONS: Record<string, string> = {
  briefcase: '💼',
  'file-up': '📤',
  search: '🔍',
  scale: '⚖️',
  edit: '✍️',
  calendar: '📅',
  shield: '🛡️',
  calculator: '🧮',
  brain: '🧠',
  plug: '🔌',
  send: '➤',
  paperclip: '📎',
  plus: '+',
};

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [threadId, setThreadId] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState<any>(null);
  const [executingSteps, setExecutingSteps] = useState<string[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
    loadInitialMessage();
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  async function loadConversations() {
    try {
      const res: any = await api.post('/chat/history', { action: 'list' });
      setConversations(res.conversations || []);
    } catch {
      // Silently fail — conversations are a bonus feature
    }
  }

  async function loadInitialMessage() {
    try {
      const res: any = await api.post('/chat/message', { message: 'hello' });
      setMessages([{
        id: res.id,
        role: 'assistant',
        content: res.content,
        timestamp: res.timestamp,
        toolSuggestions: res.toolSuggestions,
      }]);
    } catch {
      setMessages([{
        id: 'init',
        role: 'assistant',
        content: 'Welcome to Counsel Chat! I\'m your AI assistant. How can I help with your legal work today?',
        timestamp: new Date().toISOString(),
      }]);
    }
  }

  async function loadConversation(convId: string) {
    try {
      const res: any = await api.post('/chat/history', { action: 'get', conversationId: convId });
      setCurrentConversationId(convId);
      setMessages(res.messages || []);
      setShowHistory(false);
    } catch {
      // Conversation deleted or unavailable
      setCurrentConversationId(null);
      setConversations(prev => prev.filter(c => c.id !== convId));
    }
  }

  async function deleteConversation(convId: string) {
    try {
      await api.post('/chat/history', { action: 'delete', conversationId: convId });
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (currentConversationId === convId) {
        setCurrentConversationId(null);
        loadInitialMessage();
      }
    } catch { /* ignore */ }
  }

  async function newChat() {
    setCurrentConversationId(null);
    setActiveToolId(null);
    setMessages([]);
    setShowHistory(false);
    loadInitialMessage();
  }

  async function saveConversation(msgs: ChatMessage[]) {
    if (msgs.length < 2) return;
    try {
      // Strip non-serializable fields before saving
      const clean = msgs.map(({ id, role, content, timestamp, toolId }) => ({
        id, role, content, timestamp, toolId,
      }));
      // Clean Prisma JSON type — remove null values that Prisma can't handle
      const serializable = clean.map(m => {
        const obj: Record<string, unknown> = { id: m.id, role: m.role, content: m.content, timestamp: m.timestamp };
        if (m.toolId) obj.toolId = m.toolId;
        return obj;
      });
      const res: any = await api.post('/chat/history', {
        action: 'save',
        messages: serializable,
        conversationId: currentConversationId,
      });
      if (res.conversationId && !currentConversationId) {
        setCurrentConversationId(res.conversationId);
      }
      loadConversations();
    } catch { /* ignore */ }
  }

  async function handleSend(e?: React.FormEvent, overrideMessage?: string, overrideToolId?: string | null) {
    if (e) e.preventDefault();
    const msgText = overrideMessage || input;
    const msgToolId = overrideToolId !== undefined ? overrideToolId : activeToolId;

    if (!msgText.trim() && !msgToolId) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: msgText || 'Start',
      timestamp: 'just now',
      toolId: msgToolId || undefined,
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setActiveToolId(null);
    setSending(true);

    try {
      const res: any = await api.post('/chat/message', {
        message: msgText || 'hello',
        toolId: msgToolId || undefined,
        context: { threadId: threadId || undefined },
      });

      // Capture thread_id for continuity
      if (res.threadId) setThreadId(res.threadId);

      // Handle approval flow
      if (res.requiresApproval && res.approvalSteps) {
        setPendingApproval({
          steps: res.approvalSteps,
          originalMessage: msgText,
        });
      }

      const assistantMsg: ChatMessage = {
        id: res.id || (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.content || res.response || 'I received your message.',
        timestamp: res.timestamp || 'just now',
        actions: res.actions,
        toolSuggestions: res.toolSuggestions,
        form: res.form,
      };

      setMessages(prev => {
        const updated = [...prev, assistantMsg];
        // Save asynchronously
        setTimeout(() => saveConversation(updated), 100);
        return updated;
      });
    } catch {
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I had trouble processing that. Please try again.',
        timestamp: 'just now',
      };
      setMessages(prev => [...prev, errMsg]);
    }
    setSending(false);
  }

  function handleToolClick(tool: ChatTool) {
    setActiveToolId(tool.id);
    setInput(`Using: ${tool.name}`);
    inputRef.current?.focus();
    handleSend(undefined, `Use ${tool.name}: ${tool.description}`, tool.id);
  }

  function handleFormSubmit(formType: string) {
    const fields = formValues;
    let formMessage = '';
    switch (formType) {
      case 'create_matter':
        formMessage = 'Create a new ' + (fields.type || 'Legal') + ' matter:\nName: ' + fields.name + '\nClient: ' + fields.clientName + '\nDescription: ' + (fields.description || 'N/A');
        break;
      case 'add_client':
        formMessage = 'Add a new client called ' + fields.name + (fields.pan ? ' PAN ' + fields.pan : '') + (fields.email ? ' email ' + fields.email : '');
        break;
      case 'create_proposal':
        formMessage = 'Create a proposal called ' + fields.title + (fields.client ? ' for ' + fields.client : '') + (fields.budget ? ' budget ' + fields.budget : '') + (fields.timeline ? ' timeline ' + fields.timeline : '');
        break;
      case 'schedule_meeting':
        formMessage = 'Schedule a meeting called ' + fields.title + ' on ' + (fields.date || '2026-08-20 15:00') + (fields.attendees ? ' with ' + fields.attendees : '');
        break;
      case 'compliance_check':
        formMessage = 'Check this provision against ' + (fields.framework || 'GDPR') + ':\n\n' + fields.clause;
        break;
      case 'financial_analysis':
        formMessage = 'Calculate financial metrics for cash flows: ' + fields.cashFlows + ' at ' + (fields.discountRate || '0.10') + ' discount rate';
        break;
      default:
        formMessage = JSON.stringify(fields, null, 2);
    }
    handleSend(undefined, formMessage, null);
  }

  async function handleApproval(approve: boolean, stepIds?: string[]) {
    if (!pendingApproval) return;
    setPendingApproval(null);
    setSending(true);

    const approvalMsg = approve
      ? (stepIds ? `approve ${stepIds.join(', ')}` : 'approve all')
      : 'reject';

    try {
      const res: any = await api.post('/chat/message', {
        message: approvalMsg,
        context: {
          threadId: threadId || undefined,
          approved_steps: approve ? (stepIds || pendingApproval.steps.map((s: any) => s.step_id)) : [],
        },
      });

      if (res.threadId) setThreadId(res.threadId);

      const assistantMsg: ChatMessage = {
        id: res.id || (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.content || (approve ? '✅ Approved and executed.' : '❌ Rejected.'),
        timestamp: res.timestamp || 'just now',
        toolSuggestions: res.toolSuggestions,
      };

      setMessages(prev => {
        const updated = [...prev, assistantMsg];
        setTimeout(() => saveConversation(updated), 100);
        return updated;
      });
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Error processing approval.',
        timestamp: 'just now',
      }]);
    }
    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setMessages(prev => [...prev, {
      id: `upload-${Date.now()}`,
      role: 'system',
      content: `Uploading "${file.name}"...`,
      timestamp: 'just now',
    }]);

    api.upload('/documents', formData)
      .then((res: any) => {
        setMessages(prev => [...prev, {
          id: `done-${Date.now()}`,
          role: 'assistant',
          content: `✅ **${file.name}** uploaded successfully!\n\nI've added it to your document library. You can now:\n• Search within this document\n• Extract key clauses\n• Compare against your playbook\n• Ask questions about its contents`,
          timestamp: 'just now',
          toolSuggestions: [
            { id: 'search_documents', name: 'Search This Document', icon: 'search' },
            { id: 'check_compliance', name: 'Check Compliance', icon: 'shield' },
          ],
        }]);
      })
      .catch(() => {
        setMessages(prev => [...prev, {
          id: `fail-${Date.now()}`,
          role: 'assistant',
          content: `❌ Failed to upload "${file.name}". Please try again.`,
          timestamp: 'just now',
        }]);
      });
  }

  // ── Tool definitions ─────────────────────────────────────────────────────
  const CHAT_TOOLS: ChatTool[] = [
    { id: 'create_matter', name: 'Matter', description: 'Create matter', icon: 'briefcase', category: 'work' },
    { id: 'add_client', name: 'Client', description: 'Add client', icon: 'user-plus', category: 'ca' },
    { id: 'upload_document', name: 'Upload', description: 'Upload docs', icon: 'file-up', category: 'documents' },
    { id: 'search_documents', name: 'Search', description: 'Search docs', icon: 'search', category: 'documents' },
    { id: 'legal_research', name: 'Research', description: 'Legal research', icon: 'scale', category: 'research' },
    { id: 'draft_document', name: 'Draft', description: 'Draft docs', icon: 'edit', category: 'drafts' },
    { id: 'create_proposal', name: 'Proposal', description: 'Proposals', icon: 'file-text', category: 'consulting' },
    { id: 'market_intel', name: 'Intel', description: 'Market intel', icon: 'trending-up', category: 'consulting' },
    { id: 'schedule_meeting', name: 'Meeting', description: 'Schedule', icon: 'calendar', category: 'meetings' },
    { id: 'compliance_calendar', name: 'Filings', description: 'Tax filings', icon: 'clipboard-check', category: 'ca' },
    { id: 'check_compliance', name: 'Comply', description: 'Compliance', icon: 'shield', category: 'compliance' },
    { id: 'financial_analysis', name: 'Finance', description: 'NPV/IRR', icon: 'calculator', category: 'analysis' },
    { id: 'reconciliation', name: 'Recon', description: 'Reconciliation', icon: 'refresh-cw', category: 'ca' },
    { id: 'manage_engagements', name: 'Engage', description: 'Engagements', icon: 'clipboard-list', category: 'consulting' },
    { id: 'manage_integrations', name: 'Integrate', description: 'Integrations', icon: 'plug', category: 'integrations' },
  ];

  // ── Markdown Renderer ────────────────────────────────────────────────────
  function renderContent(content: string) {
    // Simple markdown-like rendering
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeContent = '';
    let codeLang = '';

    lines.forEach((line, i) => {
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <pre key={`code-${i}`} className="bg-black/[0.04] dark:bg-slate-800 rounded-lg p-3 my-2 overflow-x-auto text-[12px] font-mono text-[#0c0a09] dark:text-white">
              <code>{codeContent}</code>
            </pre>
          );
          codeContent = '';
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
          codeLang = line.replace('```', '').trim();
        }
        return;
      }
      if (inCodeBlock) {
        codeContent += (codeContent ? '\n' : '') + line;
        return;
      }

      let processed = line;
      // Bold
      processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      // Inline code
      processed = processed.replace(/`([^`]+)`/g, '<code class="bg-black/[0.04] dark:bg-slate-800 px-1 rounded text-[12px] font-mono">$1</code>');

      if (processed.trim().startsWith('•') || processed.trim().startsWith('-')) {
        elements.push(
          <p key={i} className="flex gap-2 text-[13px] leading-relaxed text-[#0c0a09] dark:text-white">
            <span className="text-[#969e9b] select-none">•</span>
            <span dangerouslySetInnerHTML={{ __html: processed.replace(/^[•-]\s*/, '') }} />
          </p>
        );
      } else if (processed.trim().startsWith('#')) {
        elements.push(
          <h3 key={i} className="text-[15px] font-semibold text-[#0c0a09] dark:text-white mt-3 mb-1" dangerouslySetInnerHTML={{ __html: processed.replace(/^#+\s*/, '') }} />
        );
      } else if (processed.trim()) {
        elements.push(
          <p key={i} className="text-[13px] leading-relaxed text-[#0c0a09] dark:text-white" dangerouslySetInnerHTML={{ __html: processed }} />
        );
      }
    });

    return elements;
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-4rem)]" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      {/* ── Conversation Sidebar ──────────────────────────────────────── */}
      {sidebarOpen && (
        <div className="w-[280px] shrink-0 border-r border-black/[0.04] dark:border-slate-800 bg-[#faf8f5] dark:bg-slate-900/50 flex flex-col">
          <div className="p-3 border-b border-black/[0.04] dark:border-slate-800">
            <button
              onClick={newChat}
              className="w-full flex items-center gap-2 px-3 py-2.5 bg-[#0c0a09] text-white rounded-xl text-[13px] font-medium hover:bg-[#0a8a5f] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Chat
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations.map(conv => (
              <div
                key={conv.id}
                className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  currentConversationId === conv.id
                    ? 'bg-black/[0.04] dark:bg-slate-800'
                    : 'hover:bg-black/[0.02] dark:hover:bg-slate-800/50'
                }`}
                onClick={() => loadConversation(conv.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[#0c0a09] dark:text-white truncate">{conv.title}</p>
                  <p className="text-[10px] text-[#969e9b]">{new Date(conv.updatedAt).toLocaleDateString()}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all"
                >
                  <svg className="w-3.5 h-3.5 text-[#969e9b] hover:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Main Chat Area ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-black/[0.04] dark:border-slate-800 bg-white dark:bg-slate-950/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg hover:bg-black/[0.04] dark:hover:bg-slate-800 transition-colors"
            >
              <svg className="w-5 h-5 text-[#717d79]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <h1 className={`${serif} text-[1.15rem] font-semibold text-[#0c0a09] dark:text-white`}>Chat</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-[#15b881]/10 text-[#0a8a5f] text-[11px] font-medium rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-[#15b881] rounded-full animate-pulse" />
              Active
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] ${
                msg.role === 'user'
                  ? 'bg-[#0c0a09] text-white rounded-2xl rounded-br-md px-4 py-3'
                  : msg.role === 'system'
                    ? 'bg-[#f0f0f0] dark:bg-slate-800/50 text-[#717d79] rounded-xl px-4 py-2 flex items-center gap-2'
                    : 'bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-slate-800 rounded-2xl rounded-bl-md px-4 py-3'
              }`}>
                {msg.role === 'system' ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin w-3 h-3 border-2 border-[#15b881] border-t-transparent rounded-full" />
                    <span className="text-[12px]">{msg.content}</span>
                  </div>
                ) : (
                  <div className="text-[13px] leading-relaxed space-y-1">
                    {renderContent(msg.content)}
                  </div>
                )}

                {/* Action buttons */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-black/[0.06] dark:border-slate-700">
                    {msg.actions.map(action => (
                      <button
                        key={action.type}
                        onClick={() => {
                          const tool = CHAT_TOOLS.find(t => t.id === action.type);
                          if (tool) handleToolClick(tool);
                        }}
                        className="px-3 py-1.5 bg-[#15b881] text-white text-[11px] font-semibold rounded-lg hover:bg-[#0a8a5f] transition-colors flex items-center gap-1.5"
                      >
                        {TOOL_ICONS[action.icon] && <span className="text-xs">{TOOL_ICONS[action.icon]}</span>}
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Tool suggestions */}
                {msg.toolSuggestions && msg.toolSuggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-black/[0.06] dark:border-slate-700">
                    {msg.toolSuggestions.map(tool => (
                      <button
                        key={tool.id}
                        onClick={() => {
                          const fullTool = CHAT_TOOLS.find(t => t.id === tool.id);
                          if (fullTool) handleToolClick(fullTool);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-black/[0.03] dark:bg-slate-800 text-[#0c0a09] dark:text-white hover:bg-black/[0.06] dark:hover:bg-slate-700 transition-colors border border-black/[0.04] dark:border-slate-800"
                      >
                        {TOOL_ICONS[tool.icon] && <span className="text-xs">{TOOL_ICONS[tool.icon]}</span>}
                        {tool.name}
                      </button>
                    ))}
                  </div>
                )}

                {/* In-chat forms */}
                {msg.form && (
                  <div className="mt-3 pt-3 border-t border-black/[0.06] dark:border-slate-700">
                    <div className="space-y-2.5">
                      {msg.form.fields.map(field => (
                        <div key={field.name}>
                          <label className="block text-[11px] font-medium text-[#717d79] dark:text-[#969e9b] mb-1">
                            {field.label} {field.required && '*'}
                          </label>
                          {field.type === 'select' ? (
                            <select
                              className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-slate-700 rounded-lg text-[12px] focus:outline-none focus:ring-1 focus:ring-[#15b881]"
                              onChange={e => setFormValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                              value={formValues[field.name] || ''}
                            >
                              <option value="">Select...</option>
                              {field.options?.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : field.type === 'textarea' ? (
                            <textarea
                              className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-slate-700 rounded-lg text-[12px] focus:outline-none focus:ring-1 focus:ring-[#15b881] resize-none"
                              rows={3}
                              placeholder={field.placeholder}
                              onChange={e => setFormValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                            />
                          ) : (
                            <input
                              type="text"
                              className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-slate-700 rounded-lg text-[12px] focus:outline-none focus:ring-1 focus:ring-[#15b881]"
                              placeholder={field.placeholder}
                              onChange={e => setFormValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                            />
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => handleFormSubmit(msg.form!.type)}
                        className="w-full px-4 py-2 bg-[#15b881] text-white rounded-lg text-[12px] font-semibold hover:bg-[#0a8a5f] transition-colors"
                      >
                        Submit
                      </button>
                    </div>
                  </div>
                )}

                <p className="text-[10px] text-[#969e9b] dark:text-slate-500 mt-1.5">{msg.timestamp}</p>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-slate-800 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1.5 items-center">
                  <div className="w-2 h-2 bg-[#15b881] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-[#15b881] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-[#15b881] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <p className="text-[10px] text-[#969e9b] mt-1">Processing your request...</p>
              </div>
            </div>
          )}

          {/* Approval card */}
          {pendingApproval && (
            <div className="flex justify-start">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-2xl rounded-bl-md px-5 py-4 max-w-[75%]">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <span className="text-[13px] font-semibold text-amber-800 dark:text-amber-200">Approval Required</span>
                </div>
                <p className="text-[12px] text-amber-700 dark:text-amber-300 mb-3">The following actions require your approval before execution:</p>
                <div className="space-y-2 mb-4">
                  {pendingApproval.steps.map((step: any) => (
                    <div key={step.step_id} className="bg-white dark:bg-slate-800 rounded-lg px-3 py-2 border border-amber-100 dark:border-amber-700/20">
                      <div className="text-[12px] font-medium text-[#0c0a09] dark:text-white">{step.name}</div>
                      <div className="text-[11px] text-[#717d79] dark:text-[#969e9b]">{step.reason}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApproval(true)}
                    className="flex-1 px-4 py-2 bg-[#15b881] text-white rounded-lg text-[12px] font-semibold hover:bg-[#0a8a5f] transition-colors flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Approve All
                  </button>
                  <button
                    onClick={() => handleApproval(false)}
                    className="px-4 py-2 bg-white dark:bg-slate-800 text-[#717d79] dark:text-[#969e9b] border border-black/[0.08] dark:border-slate-700 rounded-lg text-[12px] font-medium hover:bg-black/[0.03] transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Tool Picker Bar ─────────────────────────────────────────── */}
        <div className="px-6 pb-2">
          <div className="flex gap-1.5 flex-wrap">
            {CHAT_TOOLS.map(tool => (
              <button
                key={tool.id}
                onClick={() => handleToolClick(tool)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all border ${
                  activeToolId === tool.id
                    ? 'bg-[#15b881] text-white border-[#15b881] shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-[#717d79] border-black/[0.06] dark:border-slate-800 hover:border-[#15b881]/30 hover:text-[#0c0a09] dark:hover:text-white'
                }`}
              >
                {TOOL_ICONS[tool.icon] && <span className="text-xs">{TOOL_ICONS[tool.icon]}</span>}
                {tool.name}
              </button>
            ))}
          </div>
        </div>

        {/* ── Input Area ──────────────────────────────────────────────── */}
        <div className="px-6 pb-4">
          <form onSubmit={handleSend} className="flex gap-2">
            <div className="flex-1 relative">
              {/* File upload button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute left-3 top-3 p-1 rounded-lg hover:bg-black/[0.04] dark:hover:bg-slate-800 transition-colors text-[#969e9b] hover:text-[#0c0a09] dark:hover:text-white"
                title="Upload file"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                accept=".pdf,.doc,.docx,.txt,.jpg,.png"
              />
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={activeToolId ? `Using ${CHAT_TOOLS.find(t => t.id === activeToolId)?.name} — describe what you need...` : "Ask Counsel anything — analyze, draft, research, manage matters..."}
                className="w-full pl-10 pr-4 py-3 rounded-2xl border border-black/[0.08] dark:border-slate-700 bg-white dark:bg-slate-900 text-[14px] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40 resize-none min-h-[48px] max-h-[200px]"
                rows={1}
                disabled={sending}
              />
              {activeToolId && (
                <button
                  type="button"
                  onClick={() => { setActiveToolId(null); setInput(''); }}
                  className="absolute right-12 top-3 p-1 rounded-full bg-[#15b881]/10 hover:bg-[#15b881]/20 transition-colors"
                >
                  <svg className="w-3 h-3 text-[#0a8a5f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="px-4 py-3 bg-[#0c0a09] text-white rounded-2xl text-[13px] font-medium hover:bg-[#0a8a5f] transition-all disabled:opacity-40 flex items-center gap-1.5 self-end shadow-[0_4px_16px_-8px_rgba(12,10,9,0.4)]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
