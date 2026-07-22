'use client';

import { useState } from 'react';

const serif = "font-serif";

interface AgentTask {
  id: string;
  agent: string;
  action: string;
  status: 'completed' | 'pending_approval' | 'running' | 'failed';
  document?: string;
  timestamp: string;
  details: string;
}

const MOCK_TASKS: AgentTask[] = [
  { id: '1', agent: 'Clause Extractor', action: 'Extract indemnity clause', status: 'completed', document: 'M&A Agreement v3.pdf', timestamp: '2 min ago', details: 'Found 3 indemnity clauses. Risk: Medium.' },
  { id: '2', agent: 'Risk Analyzer', action: 'Assess limitation of liability', status: 'pending_approval', document: 'Partnership Agreement.pdf', timestamp: '5 min ago', details: 'Recommends cap of $500K. Awaiting approval.' },
  { id: '3', agent: 'Legal Drafter', action: 'Generate NDA from template', status: 'completed', document: '—', timestamp: '12 min ago', details: 'NDA drafted for Acme Corp. Ready in Drafts.' },
  { id: '4', agent: 'Research Agent', action: 'Search GDPR precedent cases', status: 'running', document: '—', timestamp: 'now', details: 'Querying knowledge base for Art. 17 cases...' },
  { id: '5', agent: 'Clause Extractor', action: 'Extract payment terms', status: 'completed', document: 'Vendor Agreement Q3.pdf', timestamp: '1 hr ago', details: 'Found net-30 terms, early payment discount 2%.' },
  { id: '6', agent: 'Risk Analyzer', action: 'Flag non-compete clause', status: 'failed', document: 'Employment Offer.pdf', timestamp: '2 hr ago', details: 'Clause too broad — exceeds state law by 6 months.' },
];

const statusColors: Record<string, string> = {
  completed: 'bg-[#eaf7f0] text-[#0a8a5f] border-[#15b881]/30',
  pending_approval: 'bg-amber-50 text-amber-700 border-amber-200',
  running: 'bg-blue-50 text-blue-600 border-blue-200',
  failed: 'bg-red-50 text-red-600 border-red-200',
};

const statusIcons: Record<string, string> = {
  completed: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  pending_approval: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  running: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  failed: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
};

export default function AgentTasksPage() {
  const [tasks] = useState<AgentTask[]>(MOCK_TASKS);
  const [filter, setFilter] = useState<string>('all');

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);

  return (
    <div className="space-y-8" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <div>
        <h1 className={`${serif} text-[1.75rem] font-normal tracking-[-0.02em] text-[#0c0a09] dark:text-white`}>Agent Tasks</h1>
        <p className="text-[13px] text-[#717d79] dark:text-[#969e9b] mt-1">Live feed of AI agent actions across your firm</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Completed Today', value: tasks.filter(t => t.status === 'completed').length, color: '#0a8a5f' },
          { label: 'Pending Approval', value: tasks.filter(t => t.status === 'pending_approval').length, color: '#b45309' },
          { label: 'Running', value: tasks.filter(t => t.status === 'running').length, color: '#2563eb' },
          { label: 'Failed', value: tasks.filter(t => t.status === 'failed').length, color: '#dc2626' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.04] dark:border-slate-800 p-4">
            <p className="text-[12px] text-[#969e9b]">{s.label}</p>
            <p className={`${serif} text-xl font-normal tracking-[-0.02em] mt-1`} style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'pending_approval', 'running', 'completed', 'failed'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-xl text-[12px] font-medium border-2 transition-all ${
              filter === s ? 'border-[#15b881] bg-[#eaf7f0] text-[#0a8a5f]' : 'border-black/[0.06] text-[#717d79] hover:border-[#15b881]/30'
            }`}>{s === 'all' ? 'All' : s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</button>
        ))}
      </div>

      {/* Task feed */}
      <div className="space-y-3">
        {filtered.map(task => (
          <div key={task.id} className="bg-white dark:bg-slate-900 rounded-xl border border-black/[0.04] dark:border-slate-800 p-4 flex items-start gap-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${statusColors[task.status].split(' ')[0]}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: statusColors[task.status].split(' ')[1] }}>
                <path strokeLinecap="round" strokeLinejoin="round" d={statusIcons[task.status]} />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-medium text-[#0c0a09] dark:text-white">{task.agent}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${statusColors[task.status]}`}>
                  {task.status.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-[12px] text-[#717d79] mt-1">{task.action}</p>
              {task.document && task.document !== '—' && (
                <p className="text-[11px] text-[#969e9b] mt-0.5">📄 {task.document}</p>
              )}
              <p className="text-[11px] text-[#969e9b] mt-1">{task.details}</p>
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <span className="text-[11px] text-[#969e9b]">{task.timestamp}</span>
              {task.status === 'pending_approval' && (
                <div className="flex gap-1.5">
                  <button className="px-3 py-1 bg-[#15b881] text-white text-[11px] font-medium rounded-lg hover:bg-[#0a8a5f] transition-colors">Approve</button>
                  <button className="px-3 py-1 bg-red-50 text-red-600 text-[11px] font-medium rounded-lg hover:bg-red-100 transition-colors">Reject</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
