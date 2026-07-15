'use client';

import { useState } from 'react';

type TabKey = 'contracts' | 'assistant' | 'matters' | 'playbooks' | 'research' | 'meetings';

const sideItems: { key: TabKey; label: string }[] = [
  { key: 'assistant', label: 'Assistant' },
  { key: 'matters', label: 'Matters' },
  { key: 'playbooks', label: 'Playbooks' },
  { key: 'contracts', label: 'Contracts' },
  { key: 'research', label: 'Research' },
  { key: 'meetings', label: 'Meetings' },
];

type ContentMap = Record<TabKey, {
  label: string;
  title: string;
  stats: { l: string; v: string }[];
  rows: { c: string; s: string; ok: boolean }[];
}>;

const contentMap: ContentMap = {
  assistant: {
    label: 'AI Assistant',
    title: 'Ask anything about your matters',
    stats: [{ l: 'Queries today', v: '1,247' }, { l: 'Avg. response', v: '1.8s' }, { l: 'Accuracy', v: '99.2%' }],
    rows: [
      { c: 'Latest on Wilson deposition?', s: '2 docs updated', ok: true },
      { c: 'Draft response to opposing counsel', s: 'Generated', ok: true },
      { c: 'Summarize Sterling M&A docs', s: '3 contracts, 247 clauses', ok: true },
    ],
  },
  matters: {
    label: 'Active Matters',
    title: 'Sterling & Associates — Matter Overview',
    stats: [{ l: 'Active matters', v: '342' }, { l: 'This month', v: '47' }, { l: 'Avg. duration', v: '18d' }],
    rows: [
      { c: 'Sterling M&A', s: 'Due diligence phase', ok: true },
      { c: 'Wilson v. State', s: 'Discovery — 14 docs pending', ok: false },
      { c: 'Evans Settlement', s: 'Drafting counter-offer', ok: true },
    ],
  },
  playbooks: {
    label: 'Playbook Engine',
    title: 'M&A Standard Playbook v3',
    stats: [{ l: 'Rules defined', v: '86' }, { l: 'Clauses covered', v: '23' }, { l: 'Last updated', v: '2d ago' }],
    rows: [
      { c: 'Indemnification cap', s: '10-15% of purchase price', ok: true },
      { c: 'Non-compete duration', s: 'Max 24 months', ok: true },
      { c: 'Governing law', s: 'Delaware preferred', ok: true },
    ],
  },
  contracts: {
    label: 'Contract Review',
    title: 'Acme × Northwind Master Services Agreement',
    stats: [{ l: 'Clauses matched', v: '247' }, { l: 'Risk flags', v: '12' }, { l: 'Deviations', v: '3' }],
    rows: [
      { c: 'Indemnification', s: 'Aligned with playbook', ok: true },
      { c: 'Limitation of Liability', s: 'Cap below floor — negotiate', ok: false },
      { c: 'Termination for convenience', s: 'Aligned with playbook', ok: true },
    ],
  },
  research: {
    label: 'Legal Research',
    title: 'Research: Indemnification in M&A',
    stats: [{ l: 'Documents searched', v: '12,847' }, { l: 'Citations found', v: '34' }, { l: 'Confidence', v: '97%' }],
    rows: [
      { c: 'Merger Agreement §8.2', s: 'Primary source', ok: true },
      { c: 'Delaware Code §251', s: 'Statutory reference', ok: true },
      { c: 'Stark v. Retail Partners', s: '2025 precedent', ok: true },
    ],
  },
  meetings: {
    label: 'Meeting Intelligence',
    title: 'Sterling M&A Strategy Session — Jul 8',
    stats: [{ l: 'Duration', v: '52m' }, { l: 'Speakers', v: '4' }, { l: 'Action items', v: '12' }],
    rows: [
      { c: 'James Sterling', s: 'Opening remarks', ok: true },
      { c: 'Sarah Chen', s: 'Due diligence update', ok: true },
      { c: 'Mike Torres', s: 'Risk assessment review', ok: true },
    ],
  },
};

export default function HeroPreview() {
  const [activeTab, setActiveTab] = useState<TabKey>('contracts');
  const content = contentMap[activeTab];

  return (
    <div className="relative group">
      {/* radial glow */}
      <div aria-hidden className="pointer-events-none absolute -inset-16 -z-10 opacity-70 transition-opacity duration-500"
        style={{ background: `radial-gradient(60% 55% at 60% 40%, rgba(21,184,129,0.28), rgba(21,184,129,0) 70%)` }}
      />
      {/* line-field artwork */}
      <svg aria-hidden viewBox="0 0 600 320" className="absolute -top-10 -right-10 w-[110%] -z-10 opacity-70">
        {Array.from({ length: 28 }).map((_, i) => (
          <path key={i} d={`M ${-40 + i * 12} 320 Q ${300} ${20 + i * 6} ${640 - i * 8} ${40 + i * 4}`}
            fill="none" stroke={`hsl(${150 - i * 2} 70% ${55 - i * 0.4}%)`} strokeWidth="1" />
        ))}
      </svg>

      <div className="rounded-2xl border border-black/[0.06] bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.15)] overflow-hidden">
        {/* toolbar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-black/[0.04] bg-[#fafaf7]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f0705b]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#f2c14e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#15b881]" />
          <span className="ml-4 text-[11px] text-[#969e9b] font-mono">counsel.app / {activeTab} / overview</span>
        </div>
        <div className="grid grid-cols-[180px_1fr] min-h-[310px]">
          {/* sidebar */}
          <div className="border-r border-black/[0.04] p-3 space-y-1 text-[12px] text-[#717d79] bg-[#fdfcf9]">
            <div className="px-2 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[#969e9b]">Workspace</div>
            {sideItems.map((item) => (
              <button
                key={item.key}
                onMouseEnter={() => setActiveTab(item.key)}
                onClick={() => setActiveTab(item.key)}
                className={`w-full text-left px-2 py-1.5 rounded-md transition-colors duration-200 ${
                  activeTab === item.key
                    ? 'bg-[#eaf7f0] text-[#0a8a5f] font-medium'
                    : 'hover:bg-[#f0faf5] hover:text-[#0c0a09]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {/* content panel */}
          <div className="p-6" key={activeTab}>
            <div className="text-[11px] uppercase tracking-[0.12em] text-[#969e9b] animate-[fadeIn_0.3s_ease]">{content.label}</div>
            <h4 className="mt-1 text-[17px] font-semibold tracking-[-0.01em] text-[#0c0a09] animate-[fadeIn_0.3s_ease]">{content.title}</h4>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {content.stats.map((s) => (
                <div key={s.l} className="rounded-lg border border-black/[0.05] p-3 hover:border-[#15b881]/30 transition-colors cursor-default">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-[#969e9b]">{s.l}</div>
                  <div className="text-[19px] font-semibold text-[#0c0a09] tabular-nums">{s.v}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {content.rows.map((r, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-black/[0.05] px-3 py-2 text-[12px] hover:border-[#15b881]/20 transition-colors cursor-default">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${r.ok ? 'bg-[#15b881]' : 'bg-[#f0705b]'}`} />
                    <span className="text-[#0c0a09] font-medium">{r.c}</span>
                  </div>
                  <span className={r.ok ? 'text-[#0a8a5f]' : 'text-[#c2452e]'}>{r.s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
