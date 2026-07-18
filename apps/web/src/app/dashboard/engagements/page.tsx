'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

const serif = 'font-serif';

interface Engagement {
  id: string;
  projectName: string;
  clientName: string;
  status: 'active' | 'planning' | 'completed' | 'on-hold';
  progress: number;
  budget: string;
  startDate: string;
  endDate: string;
  team: number;
}

const mockEngagements: Engagement[] = [
  { id: '1', projectName: 'Digital Strategy 2026', clientName: 'Meridian Health', status: 'active', progress: 65, budget: '$450K', startDate: '2026-04-01', endDate: '2026-10-15', team: 6 },
  { id: '2', projectName: 'Op Model Redesign', clientName: 'NexGen Manufacturing', status: 'active', progress: 38, budget: '$320K', startDate: '2026-06-01', endDate: '2026-12-20', team: 4 },
  { id: '3', projectName: 'Market Entry: APAC', clientName: 'Synthwave Software', status: 'planning', progress: 12, budget: '$680K', startDate: '2026-08-15', endDate: '2027-03-01', team: 8 },
  { id: '4', projectName: 'Post-Merger Integration', clientName: 'Apex Capital', status: 'completed', progress: 100, budget: '$250K', startDate: '2026-02-01', endDate: '2026-07-01', team: 5 },
  { id: '5', projectName: 'ESG Strategy Development', clientName: 'Greenfield Energy', status: 'on-hold', progress: 45, budget: '$190K', startDate: '2026-05-01', endDate: '2026-11-01', team: 3 },
];

const statusColors: Record<string, string> = {
  active: 'bg-[#15b881]/10 text-[#0a8a5f] border-[#15b881]/30',
  planning: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-slate-100 text-slate-600 border-slate-200',
  'on-hold': 'bg-red-50 text-red-600 border-red-200',
};

export default function EngagementsPage() {
  const [engagements] = useState<Engagement[]>(mockEngagements);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = engagements.filter(e => {
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    if (search && !e.projectName.toLowerCase().includes(search.toLowerCase()) && !e.clientName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-8" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`${serif} text-[1.75rem] font-normal tracking-[-0.02em] text-[#0c0a09] dark:text-white`}>Engagements</h1>
          <p className="text-[13px] text-[#717d79] dark:text-[#969e9b] mt-1">Track and manage consulting engagements</p>
        </div>
        <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0c0a09] text-white text-[13px] font-medium hover:bg-[#0a8a5f] transition-colors shadow-[0_4px_12px_-4px_rgba(12,10,9,0.3)]">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          New Engagement
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Active', value: engagements.filter(e => e.status === 'active').length, color: '#0a8a5f', bg: '#eaf7f0' },
          { label: 'Planning', value: engagements.filter(e => e.status === 'planning').length, color: '#b45309', bg: '#fffbeb' },
          { label: 'Completed', value: engagements.filter(e => e.status === 'completed').length, color: '#475569', bg: '#f8fafc' },
          { label: 'Total Revenue', value: `$${engagements.reduce((s, e) => s + parseInt(e.budget.replace(/[^0-9]/g, '')), 0).toLocaleString()}K`, color: '#0c0a09', bg: '#fefdfb' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.04] dark:border-slate-800 p-4">
            <p className="text-[12px] text-[#969e9b]">{s.label}</p>
            <p className={`${serif} text-xl font-normal tracking-[-0.02em] mt-1`} style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#969e9b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search engagements..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-black/[0.08] dark:border-slate-700 bg-white dark:bg-slate-900 text-[14px] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'active', 'planning', 'completed', 'on-hold'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-xl text-[12px] font-medium border-2 transition-all ${
                statusFilter === s ? 'border-[#15b881] bg-[#eaf7f0] text-[#0a8a5f]' : 'border-black/[0.06] text-[#717d79] hover:border-[#15b881]/30'
              }`}>{s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.04] dark:border-slate-800 overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-black/[0.04] dark:border-slate-800">
              <th className="text-left py-3 px-5 text-[12px] font-medium text-[#969e9b] tracking-[0.03em] uppercase">Project</th>
              <th className="text-left py-3 px-5 text-[12px] font-medium text-[#969e9b] tracking-[0.03em] uppercase">Client</th>
              <th className="text-left py-3 px-5 text-[12px] font-medium text-[#969e9b] tracking-[0.03em] uppercase">Status</th>
              <th className="text-left py-3 px-5 text-[12px] font-medium text-[#969e9b] tracking-[0.03em] uppercase">Progress</th>
              <th className="text-left py-3 px-5 text-[12px] font-medium text-[#969e9b] tracking-[0.03em] uppercase">Budget</th>
              <th className="text-left py-3 px-5 text-[12px] font-medium text-[#969e9b] tracking-[0.03em] uppercase">Timeline</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id} className="border-b border-black/[0.02] dark:border-slate-800/50 hover:bg-[#eaf7f0]/30 dark:hover:bg-slate-800/30 transition-colors">
                <td className="py-3.5 px-5">
                  <p className="font-medium text-[#0c0a09] dark:text-white">{e.projectName}</p>
                </td>
                <td className="py-3.5 px-5 text-[#717d79]">{e.clientName}</td>
                <td className="py-3.5 px-5">
                  <span className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-medium border ${statusColors[e.status]}`}>{e.status.charAt(0).toUpperCase() + e.status.slice(1)}</span>
                </td>
                <td className="py-3.5 px-5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-black/[0.04] dark:bg-slate-700 rounded-full max-w-[80px]">
                      <div className="h-full bg-[#15b881] rounded-full transition-all" style={{ width: `${e.progress}%` }} />
                    </div>
                    <span className="text-[12px] text-[#969e9b]">{e.progress}%</span>
                  </div>
                </td>
                <td className="py-3.5 px-5 text-[#717d79]">{e.budget}</td>
                <td className="py-3.5 px-5 text-[#717d79] text-[12px]">{e.startDate} → {e.endDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-[#969e9b] text-[13px]">No engagements found.</div>
        )}
      </div>
    </div>
  );
}
