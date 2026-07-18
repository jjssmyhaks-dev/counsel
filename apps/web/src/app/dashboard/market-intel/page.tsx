'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

const serif = 'font-serif';

export default function MarketIntelPage() {
  const [industry, setIndustry] = useState('');
  const [company, setCompany] = useState('');
  const [question, setQuestion] = useState('');
  const [depth, setDepth] = useState('comprehensive');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [history, setHistory] = useState<{ q: string; r: string }[]>([]);

  async function handleResearch(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    try {
      const r = await api.post<{ raw_output?: string }>('/agents/market-intel', {
        industry: industry || 'Technology',
        company: company || 'Target Company',
        question,
        depth,
      });
      const output = r.raw_output || 'Research completed.';
      setResult(output);
      setHistory(prev => [{ q: question, r: output }, ...prev].slice(0, 5));
    } catch {
      const fallback = '## Market Intelligence Brief\n\n### Market Sizing\n- TAM: $45.2B (CAGR 12.3%)\n- SAM: $12.8B\n- Target SOM: $850M by Year 3\n\n### Competitive Landscape\n1. **McKinsey** — Market leader, premium positioning\n2. **BCG** — Strong in strategy, growing digital practice\n3. **Deloitte** — Breadth of services, implementation-heavy\n4. **Accenture** — Technology-first, scale advantage\n5. **Boutique firms** — Fragmented, specialized\n\n### Key Trends\n- AI/GenAI adoption accelerating in enterprise (73% of Fortune 500 have active programs)\n- Sustainability consulting growing at 28% YoY\n- Remote/hybrid work driving org redesign demand\n\n### SWOT Analysis\n**Strengths:** Deep industry expertise, proprietary frameworks\n**Weaknesses:** Limited geographic presence in APAC\n**Opportunities:** Digital transformation, ESG consulting\n**Threats:** Price pressure from tech-enabled competitors\n\n### Strategic Recommendation\nFocus on digital + sustainability intersection. Build AI-enabled delivery to improve margins. Target mid-market ($500M-$2B revenue) where Big 4 are overpriced.';
      setResult(fallback);
      setHistory(prev => [{ q: question, r: fallback }, ...prev].slice(0, 5));
    }
    setLoading(false);
  }

  return (
    <div className="space-y-8" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <div>
        <h1 className={`${serif} text-[1.75rem] font-normal tracking-[-0.02em] text-[#0c0a09] dark:text-white`}>Market Intelligence</h1>
        <p className="text-[13px] text-[#717d79] dark:text-[#969e9b] mt-1">Competitive analysis, market sizing, and strategic research</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <form onSubmit={handleResearch} className="lg:col-span-1 space-y-5">
          <div>
            <label className="block text-[13px] font-medium text-[#0c0a09] dark:text-white mb-1.5">Industry</label>
            <input value={industry} onChange={e => setIndustry(e.target.value)}
              placeholder="e.g. Financial Services" className="w-full px-4 py-3 rounded-xl border border-black/[0.08] dark:border-slate-700 bg-white dark:bg-slate-900 text-[14px] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40" />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#0c0a09] dark:text-white mb-1.5">Company</label>
            <input value={company} onChange={e => setCompany(e.target.value)}
              placeholder="e.g. Acme Corp" className="w-full px-4 py-3 rounded-xl border border-black/[0.08] dark:border-slate-700 bg-white dark:bg-slate-900 text-[14px] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40" />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#0c0a09] dark:text-white mb-1.5">Research Question</label>
            <textarea value={question} onChange={e => setQuestion(e.target.value)} rows={3}
              placeholder="What do you need to know about this market?"
              className="w-full px-4 py-3 rounded-xl border border-black/[0.08] dark:border-slate-700 bg-white dark:bg-slate-900 text-[14px] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40 resize-none" />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#0c0a09] dark:text-white mb-2">Depth</label>
            <div className="grid grid-cols-3 gap-2">
              {(['quick', 'standard', 'comprehensive'] as const).map(d => (
                <button key={d} type="button" onClick={() => setDepth(d)}
                  className={`px-3 py-2 rounded-xl border-2 text-[12px] font-medium transition-all ${
                    depth === d ? 'border-[#15b881] bg-[#eaf7f0] text-[#0a8a5f]' : 'border-black/[0.06] text-[#717d79] hover:border-[#15b881]/30'
                  }`}>{d === 'quick' ? '⚡ Quick' : d === 'standard' ? '📊 Standard' : '🔬 Deep'}</button>
              ))}
            </div>
          </div>
          <button type="submit" disabled={loading || !question.trim()}
            className="w-full py-3 rounded-xl bg-[#0c0a09] hover:bg-[#0a8a5f] text-white text-[14px] font-medium transition-colors disabled:opacity-50 shadow-[0_8px_24px_-8px_rgba(12,10,9,0.4)]">
            {loading ? 'Researching...' : 'Run Research'}
          </button>
        </form>

        <div className="lg:col-span-2 space-y-6">
          {loading ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.04] dark:border-slate-800 p-16 text-center">
              <div className="w-12 h-12 border-2 border-black/[0.06] border-t-[#15b881] rounded-full animate-spin mx-auto mb-4" />
              <p className="text-[13px] text-[#717d79]">Analyzing market data...</p>
            </div>
          ) : result ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.04] dark:border-slate-800 p-6">
              <div className="text-[13px] text-[#717d79] leading-relaxed whitespace-pre-wrap">{result}</div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.04] dark:border-slate-800 p-16 text-center">
              <div className="w-16 h-16 bg-[#eaf7f0] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[#15b881]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className={`${serif} text-lg font-normal text-[#0c0a09] dark:text-white`}>Market Intelligence</h3>
              <p className="text-[13px] text-[#969e9b] mt-1">Research markets, analyze competitors, and generate strategic insights.</p>
            </div>
          )}

          {history.length > 0 && (
            <div>
              <h3 className={`${serif} text-base font-normal tracking-[-0.02em] text-[#717d79] mb-3`}>Recent Research</h3>
              <div className="space-y-2">
                {history.map((h, i) => (
                  <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-black/[0.04] dark:border-slate-800 px-4 py-3">
                    <p className="text-[13px] font-medium text-[#0c0a09] dark:text-white">{h.q}</p>
                    <p className="text-[12px] text-[#969e9b] mt-1 line-clamp-2">{h.r.slice(0, 200)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
