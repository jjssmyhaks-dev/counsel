'use client';

import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';

const serif = "font-serif";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  hasActions?: boolean;
}

export default function ChatCopilotPage() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', text: "Welcome to Counsel Copilot! I can help you analyze documents, draft text, research questions, and manage your matters. What would you like to do?", timestamp: 'now' },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input, timestamp: 'just now' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    // Simulate AI response
    await new Promise(r => setTimeout(r, 1200));
    const responses = [
      "I've analyzed the document. Here are the key findings: 3 high-risk clauses found in the indemnification section. I recommend reviewing sections 4.2 and 4.5.",
      "Let me draft that for you. I'll generate a standard NDA with your firm's playbook preferences — mutual non-disclosure, 3-year term, California governing law.",
      "Based on my research, here's what I found: *Smith v. Jones (2023)* sets precedent for this scenario. The court ruled that reasonable accommodation must be provided within 30 days.",
      "I've scheduled the follow-up meeting and extracted these action items from the transcript: 1) Review contract by Friday, 2) Send client update by Monday, 3) Finalize budget by Wednesday.",
      "Your usage this month: 45/50 documents processed. You're at 90% of your plan cap. Consider upgrading to Growth for unlimited documents.",
    ];
    const assistantMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      text: responses[Math.floor(Math.random() * responses.length)],
      timestamp: 'just now',
      hasActions: Math.random() > 0.5,
    };
    setMessages(prev => [...prev, assistantMsg]);
    setSending(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <div className="mb-4">
        <h1 className={`${serif} text-[1.75rem] font-normal tracking-[-0.02em] text-[#0c0a09] dark:text-white`}>Chat Copilot</h1>
        <p className="text-[13px] text-[#717d79] dark:text-[#969e9b] mt-1">Ask questions, get analysis, and approve agent actions</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 bg-[#faf8f5] dark:bg-slate-900/50 rounded-2xl border border-black/[0.04] dark:border-slate-800 p-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-[#0c0a09] text-white rounded-br-lg'
                : 'bg-white dark:bg-slate-800 border border-black/[0.06] dark:border-slate-700 text-[#0c0a09] dark:text-white rounded-bl-lg'
            }`}>
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              {msg.hasActions && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-black/[0.06] dark:border-slate-700">
                  <button className="px-3 py-1.5 bg-[#15b881] text-white text-[11px] font-semibold rounded-lg hover:bg-[#0a8a5f] transition-colors">Approve</button>
                  <button className="px-3 py-1.5 bg-white dark:bg-slate-700 text-[#717d79] text-[11px] font-semibold rounded-lg border border-black/[0.08] hover:bg-black/[0.02] transition-colors">Review</button>
                  <button className="px-3 py-1.5 bg-white dark:bg-slate-700 text-[#c2452e] text-[11px] font-semibold rounded-lg border border-black/[0.08] hover:bg-red-50 transition-colors">Reject</button>
                </div>
              )}
              <p className="text-[10px] text-[#969e9b] dark:text-slate-500 mt-1.5">{msg.timestamp}</p>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-slate-800 border border-black/[0.06] dark:border-slate-700 rounded-2xl rounded-bl-lg px-4 py-3">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-[#15b881] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-[#15b881] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-[#15b881] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-3">
        <div className="flex-1 relative">
          <input value={input} onChange={e => setInput(e.target.value)}
            placeholder="Ask Counsel anything — analyze, draft, research..."
            className="w-full px-4 py-3 pr-12 rounded-xl border border-black/[0.08] dark:border-slate-700 bg-white dark:bg-slate-900 text-[14px] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40" />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#969e9b] bg-[#f0f0f0] dark:bg-slate-800 px-1.5 py-0.5 rounded border border-black/[0.06] font-mono">⌘↵</kbd>
        </div>
        <button type="submit" disabled={sending || !input.trim()}
          className="px-5 py-3 bg-[#0c0a09] text-white rounded-xl text-[13px] font-medium hover:bg-[#0a8a5f] transition-all disabled:opacity-50 flex items-center gap-2 shadow-[0_8px_24px_-8px_rgba(12,10,9,0.4)]">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
          Send
        </button>
      </form>
    </div>
  );
}
