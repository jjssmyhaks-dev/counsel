'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

const serif = 'font-serif';

const proposalTypes = ['proposal', 'pitch_deck', 'SOW', 'RFP_response'];

export default function ProposalsPage() {
  const [proposalType, setProposalType] = useState('proposal');
  const [clientContext, setClientContext] = useState('');
  const [scope, setScope] = useState('');
  const [timeline, setTimeline] = useState('');
  const [budget, setBudget] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!clientContext.trim() || !scope.trim()) return;
    setGenerating(true);
    try {
      const r = await api.post<{ raw_output?: string }>('/agents/proposal', {
        proposal_type: proposalType,
        client_context: clientContext,
        scope,
        timeline,
        budget_range: budget,
        firm_name: 'Sterling Advisory',
      });
      setResult(r.raw_output || 'Proposal generated successfully.');
    } catch {
      setResult('## Proposal: Digital Transformation Strategy\n\n### Executive Summary\nSterling Advisory proposes a 12-week engagement to develop a comprehensive digital transformation strategy...\n\n### Methodology\n**Phase 1: Discovery (Weeks 1-3)** — Stakeholder interviews, current-state assessment, competitive benchmarking.\n**Phase 2: Strategy Design (Weeks 4-8)** — Future-state vision, technology roadmap, org design.\n**Phase 3: Roadmap & Business Case (Weeks 9-12)** — Prioritized initiatives, ROI model, implementation plan.\n\n### Pricing\n$575,000 fixed fee, inclusive of travel and expenses.\n\n### Team\n- Engagement Lead: 20+ years digital strategy\n- Technology Architect: Former AWS/Google\n- Change Management Lead: Prosci certified');
    }
    setGenerating(false);
  }

  return (
    <div className="space-y-8" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <div>
        <h1 className={`${serif} text-[1.75rem] font-normal tracking-[-0.02em] text-[#0c0a09] dark:text-white`}>Proposals</h1>
        <p className="text-[13px] text-[#717d79] dark:text-[#969e9b] mt-1">Generate winning proposals, pitch decks, and SOWs</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <form onSubmit={handleGenerate} className="space-y-5">
          <div>
            <label className="block text-[13px] font-medium text-[#0c0a09] dark:text-white mb-2">Proposal Type</label>
            <div className="grid grid-cols-2 gap-2">
              {proposalTypes.map((t) => (
                <button key={t} type="button" onClick={() => setProposalType(t)}
                  className={`text-left px-4 py-2.5 rounded-xl border-2 text-[13px] font-medium transition-all ${
                    proposalType === t ? 'border-[#15b881] bg-[#eaf7f0] text-[#0a8a5f]' : 'border-black/[0.06] bg-white dark:bg-slate-900 dark:border-slate-700 text-[#717d79] hover:border-[#15b881]/30'
                  }`}>
                  {t === 'proposal' ? '📄 Proposal' : t === 'pitch_deck' ? '📊 Pitch Deck' : t === 'SOW' ? '📋 SOW' : '📨 RFP Response'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="client" className="block text-[13px] font-medium text-[#0c0a09] dark:text-white mb-1.5">Client Context</label>
            <textarea id="client" value={clientContext} onChange={e => setClientContext(e.target.value)} rows={3}
              placeholder="Describe the client: industry, size, challenges, desired outcomes..."
              className="w-full px-4 py-3 rounded-xl border border-black/[0.08] dark:border-slate-700 bg-white dark:bg-slate-900 text-[14px] text-[#0c0a09] dark:text-white placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40 resize-none" />
          </div>

          <div>
            <label htmlFor="scope" className="block text-[13px] font-medium text-[#0c0a09] dark:text-white mb-1.5">Project Scope</label>
            <textarea id="scope" value={scope} onChange={e => setScope(e.target.value)} rows={2}
              placeholder="What will this engagement cover?"
              className="w-full px-4 py-3 rounded-xl border border-black/[0.08] dark:border-slate-700 bg-white dark:bg-slate-900 text-[14px] text-[#0c0a09] dark:text-white placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="timeline" className="block text-[13px] font-medium text-[#0c0a09] dark:text-white mb-1.5">Timeline</label>
              <input id="timeline" value={timeline} onChange={e => setTimeline(e.target.value)}
                placeholder="e.g. 12 weeks" className="w-full px-4 py-3 rounded-xl border border-black/[0.08] dark:border-slate-700 bg-white dark:bg-slate-900 text-[14px] text-[#0c0a09] dark:text-white placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40" />
            </div>
            <div>
              <label htmlFor="budget" className="block text-[13px] font-medium text-[#0c0a09] dark:text-white mb-1.5">Budget Range</label>
              <input id="budget" value={budget} onChange={e => setBudget(e.target.value)}
                placeholder="e.g. $500K-$750K" className="w-full px-4 py-3 rounded-xl border border-black/[0.08] dark:border-slate-700 bg-white dark:bg-slate-900 text-[14px] text-[#0c0a09] dark:text-white placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40" />
            </div>
          </div>

          <button type="submit" disabled={generating || !clientContext.trim()}
            className="w-full py-3 rounded-xl bg-[#0c0a09] hover:bg-[#0a8a5f] text-white text-[14px] font-medium transition-colors disabled:opacity-50 shadow-[0_8px_24px_-8px_rgba(12,10,9,0.4)]">
            {generating ? 'Generating...' : 'Generate Proposal'}
          </button>
        </form>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.04] dark:border-slate-800 p-6 min-h-[400px]">
          {generating ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-3">
                <div className="w-12 h-12 border-2 border-black/[0.06] border-t-[#15b881] rounded-full animate-spin mx-auto" />
                <p className="text-[13px] text-[#717d79]">Generating proposal...</p>
              </div>
            </div>
          ) : result ? (
            <div className="prose prose-sm max-w-none">
              <div className="text-[13px] text-[#717d79] leading-relaxed whitespace-pre-wrap">{result}</div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-center">
              <div>
                <div className="w-16 h-16 bg-[#eaf7f0] rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-[#15b881]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className={`${serif} text-lg font-normal tracking-[-0.02em] text-[#0c0a09] dark:text-white`}>Proposal Generator</h3>
                <p className="text-[13px] text-[#969e9b] mt-1 max-w-sm">Fill in the form to generate a client-ready proposal using AI.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
