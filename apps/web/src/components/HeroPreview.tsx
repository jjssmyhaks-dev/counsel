'use client';

import { useState, useRef, useEffect } from 'react';

const serif = 'font-serif';

type TabKey = 'contracts' | 'matters' | 'assistant' | 'playbooks' | 'research' | 'meetings';

const sidebarConfig: { key: TabKey; label: string; icon: string; badge?: string }[] = [
  { key: 'matters', label: 'Matters', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', badge: '47' },
  { key: 'contracts', label: 'Contracts', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', badge: '12' },
  { key: 'playbooks', label: 'Playbooks', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  { key: 'assistant', label: 'Ask AI', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
  { key: 'research', label: 'Research', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', badge: '3' },
  { key: 'meetings', label: 'Meetings', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', badge: '5' },
];

interface StatBlock { l: string; v: string; trend?: string; }
interface RowItem { c: string; s: string; ok: boolean; meta?: string; }
interface TabContent {
  label: string;
  title: string;
  subtitle?: string;
  stats: StatBlock[];
  rows: RowItem[];
  columns?: boolean;
}

const content: Record<TabKey, TabContent> = {
  contracts: {
    label: 'Contract Review',
    title: 'Acme × Northwind MSA',
    subtitle: 'Master Services Agreement · 47 pages · Last reviewed 2h ago',
    stats: [
      { l: 'Clauses detected', v: '247/263', trend: '94% matched' },
      { l: 'Risk flags', v: '12', trend: '3 critical' },
      { l: 'Playbook deviations', v: '4', trend: 'Below threshold' },
    ],
    rows: [
      { c: '§5.2 Indemnification', s: 'Aligned', ok: true, meta: 'Liability cap 15%' },
      { c: '§11.1 Limitation of Liability', s: 'Review needed', ok: false, meta: 'Cap below floor' },
      { c: '§14.3 Termination', s: 'Aligned', ok: true, meta: '30-day notice' },
      { c: '§8.7 Data Privacy', s: 'Aligned', ok: true, meta: 'GDPR + CCPA' },
      { c: '§3.1 Payment Terms', s: 'Flag', ok: false, meta: 'Escrow missing' },
    ],
  },
  matters: {
    label: 'Active Matters',
    title: 'Sterling & Associates',
    subtitle: 'Firm dashboard · 342 active · $2.8B combined value',
    stats: [
      { l: 'Active matters', v: '342', trend: '+12 this month' },
      { l: 'Due this week', v: '8', trend: '3 urgent' },
      { l: 'Avg. turnaround', v: '4.3 days', trend: 'Up 0.2' },
    ],
    rows: [
      { c: 'Sterling M&A', s: 'Due diligence', ok: true, meta: 'Docs: 147 · Due: Jul 28' },
      { c: 'Wilson v. State', s: 'Discovery', ok: false, meta: '14 docs pending review' },
      { c: 'Evans Settlement', s: 'Negotiation', ok: true, meta: 'Counter-offer drafted' },
      { c: 'Brighton Lease', s: 'Document review', ok: true, meta: '19 clauses flagged' },
    ],
    columns: true,
  },
  assistant: {
    label: 'AI Assistant',
    title: 'Ask anything about your firm',
    subtitle: 'Real-time answers from documents, playbooks & precedents',
    stats: [
      { l: 'Queries today', v: '1,247', trend: '↑ 18%' },
      { l: 'Avg. response', v: '1.8s', trend: '99.2% accuracy' },
      { l: 'Documents indexed', v: '34,821', trend: 'Across 3 firm libraries' },
    ],
    rows: [
      { c: 'Latest update on Wilson deposition?', s: '2 docs updated', ok: true, meta: 'Today, 10:42 AM' },
      { c: 'Draft summary of Sterling M&A for partner review', s: 'Generated, 8 sources', ok: true, meta: '3m ago' },
      { c: 'What indemnification caps do we use for SaaS?', s: 'Standard is 12-month, $5M cap', ok: true, meta: 'From playbook rule #47' },
      { c: 'Check force majeure in Brighton lease', s: 'Clause found, no deviations', ok: true, meta: '5s ago' },
    ],
  },
  playbooks: {
    label: 'Playbook Engine',
    title: 'M&A Standard Playbook v3',
    subtitle: '86 rules · 23 clause types · Last edit: 2 days ago',
    stats: [
      { l: 'Rules active', v: '86', trend: 'Last updated 2d ago' },
      { l: 'Clause coverage', v: '23/23', trend: 'Full coverage' },
      { l: 'Matters using', v: '47', trend: 'All active deals' },
    ],
    rows: [
      { c: 'Indemnification Cap', s: '10-15% purchase price', ok: true, meta: 'Applied to all M&A' },
      { c: 'Non-Compete Duration', s: 'Max 24 months', ok: true, meta: 'State law override' },
      { c: 'Governing Law', s: 'Delaware (default)', ok: true, meta: 'NY fallback available' },
      { c: 'Escrow Holdback', s: '10% for 18 months', ok: true, meta: 'Negotiable to 6-12%' },
    ],
  },
  research: {
    label: 'Legal Research',
    title: 'Indemnification in M&A',
    subtitle: 'Research brief · Started Jul 14 · 34 citations found',
    stats: [
      { l: 'Documents scanned', v: '12,847', trend: 'Firm + public sources' },
      { l: 'Citations found', v: '34', trend: '15 statutes, 19 cases' },
      { l: 'Confidence', v: '97%', trend: 'High quality sources' },
    ],
    rows: [
      { c: 'Merger Agreement §8.2', s: 'Primary source', ok: true, meta: 'Del. Code Ann. tit. 8' },
      { c: 'Delaware Code §251', s: 'Statutory reference', ok: true, meta: 'Merger procedure' },
      { c: 'Stark v. Retail Partners', s: 'Precedent', ok: true, meta: 'Del. Ch. 2025' },
      { c: 'ABA Model Merger Agreement', s: 'Commentary', ok: true, meta: '§3.04-3.07' },
    ],
  },
  meetings: {
    label: 'Meeting Intelligence',
    title: 'Sterling M&A Strategy',
    subtitle: 'Jul 8, 2026 · 52m · 4 participants · 12 action items',
    stats: [
      { l: 'Action items', v: '12', trend: '4 completed, 8 open' },
      { l: 'Key decisions', v: '4', trend: 'All documented' },
      { l: 'Transcript', v: '8,432 words', trend: '52 min recording' },
    ],
    rows: [
      { c: 'James Sterling', s: 'Opening + strategy', ok: true, meta: '18 min · Partner' },
      { c: 'Sarah Chen', s: 'Due diligence update', ok: true, meta: '14 min · Sr. Associate' },
      { c: 'Mike Torres', s: 'Risk assessment', ok: false, meta: '12 min · 3 flags raised' },
      { c: 'Lisa Park', s: 'Regulatory overview', ok: true, meta: '8 min · Of Counsel' },
    ],
  },
};

export default function HeroPreview() {
  const [activeTab, setActiveTab] = useState<TabKey>('contracts');
  const [animKey, setAnimKey] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  function switchTab(key: TabKey) {
    if (key === activeTab) return;
    setAnimKey((prev) => prev + 1);
    setActiveTab(key);
  }

  const current = content[activeTab];

  return (
    <div className="relative">
      {/* Ambient glow behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-10 -z-10 transition-opacity duration-700"
        style={{ background: 'radial-gradient(55% 50% at 55% 40%, rgba(21,184,129,0.24), transparent 65%)' }}
      />

      <div className="rounded-2xl border border-black/[0.05] bg-white shadow-[0_20px_70px_-30px_rgba(0,0,0,0.18),0_0_1px_rgba(0,0,0,0.06)] overflow-hidden">
        {/* macOS-style toolbar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-black/[0.03] bg-[#fcfbf9]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f0705b] hover:bg-[#e05b48] transition-colors cursor-default" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#f2c14e] hover:bg-[#e0b044] transition-colors cursor-default" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#15b881] hover:bg-[#0a8a5f] transition-colors cursor-default" />
          <span className="ml-3 text-[11px] text-[#969e9b] font-mono tracking-tight">counsel.app/{activeTab}</span>
          <div className="flex-1" />
          <span className="text-[10px] text-[#969e9b] font-mono uppercase tracking-[0.08em]">Live</span>
        </div>

        {/* Main layout: sidebar + content */}
        <div className="grid grid-cols-[170px_1fr] min-h-[330px]">
          {/* Sidebar nav */}
          <aside className="border-r border-black/[0.03] bg-[#fdfcf9] py-3 flex flex-col">
            <div className="px-3 mb-2">
              <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#969e9b]">Workspace</span>
            </div>
            <nav className="space-y-0.5 px-2 flex-1">
              {sidebarConfig.map((item) => (
                <button
                  key={item.key}
                  onMouseEnter={() => switchTab(item.key)}
                  onClick={() => switchTab(item.key)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] transition-all duration-200 ${
                    activeTab === item.key
                      ? 'bg-[#eaf7f0] text-[#0a8a5f] font-medium shadow-[inset_0_1px_2px_rgba(21,184,129,0.08)]'
                      : 'text-[#717d79] hover:bg-[#f0faf5] hover:text-[#0c0a09]'
                  }`}
                >
                  <svg className="w-[15px] h-[15px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  <span className="truncate flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <span className={`text-[10px] font-medium px-1.5 min-w-[20px] text-center rounded-full ${
                      activeTab === item.key ? 'bg-[#15b881]/15 text-[#0a8a5f]' : 'bg-black/[0.04] text-[#969e9b]'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>
            {/* Bottom status */}
            <div className="mx-3 mt-3 pt-3 border-t border-black/[0.03]">
              <div className="flex items-center gap-2 text-[10px] text-[#969e9b]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#15b881] animate-pulse" />
                <span>All systems operational</span>
              </div>
            </div>
          </aside>

          {/* Content panel */}
          <div key={animKey} className="p-5" ref={contentRef}>
            {/* Animated fade-in wrapper */}
            <div className="animate-[slideIn_0.35s_ease]">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0a8a5f] bg-[#eaf7f0] px-2 py-0.5 rounded-full">
                  {current.label}
                </span>
                <span className="text-[10px] text-[#969e9b]">· Updated just now</span>
              </div>

              <h3 className={`${serif} text-[15px] font-semibold tracking-[-0.01em] text-[#0c0a09] leading-snug`}>{current.title}</h3>
              {current.subtitle && (
                <p className="text-[11px] text-[#969e9b] mt-0.5">{current.subtitle}</p>
              )}

              {/* Stats */}
              <div className={`mt-4 grid ${current.columns ? 'grid-cols-3 gap-2.5' : 'grid-cols-3 gap-2.5'}`}>
                {current.stats.map((s) => (
                  <div key={s.l} className="rounded-lg border border-black/[0.04] bg-[#fefdfb] p-2.5 hover:border-[#15b881]/20 transition-colors cursor-default group">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#969e9b] mb-1">{s.l}</div>
                    <div className="text-[17px] font-bold text-[#0c0a09] tabular-nums tracking-[-0.01em] leading-none">{s.v}</div>
                    {s.trend && <div className="text-[10px] text-[#969e9b] mt-1 leading-tight">{s.trend}</div>}
                  </div>
                ))}
              </div>

              {/* Rows - either list or two-column grid */}
              <div className={`mt-3 ${current.columns ? 'grid grid-cols-2 gap-2' : 'space-y-1.5'}`}>
                {current.rows.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 rounded-lg border border-black/[0.03] px-3 py-2 text-[11px] hover:border-[#15b881]/15 transition-all duration-200 bg-white cursor-default group"
                  >
                    <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.ok ? 'bg-[#15b881]' : 'bg-[#f0705b]'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[#0c0a09] font-medium truncate">{r.c}</span>
                        <span className={`flex-shrink-0 text-[10px] font-medium ${r.ok ? 'text-[#0a8a5f]' : 'text-[#c2452e]'}`}>
                          {r.s}
                        </span>
                      </div>
                      {r.meta && <div className="text-[10px] text-[#969e9b] mt-0.5 leading-tight">{r.meta}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
