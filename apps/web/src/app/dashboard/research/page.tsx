'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { ResearchBrief, Matter } from '@/lib/types';

const serif = 'font-serif';

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusBadgeUI({ status }: { status: ResearchBrief['status'] }) {
  const map: Record<string, { bg: string; dot: string; label: string }> = {
    pending: { bg: 'bg-[#fef8e6] text-[#b45309]', dot: 'bg-amber-500', label: 'Pending' },
    researching: { bg: 'bg-[#eaf7f0] text-[#0a8a5f]', dot: 'bg-[#15b881]', label: 'Processing' },
    completed: { bg: 'bg-[#eaf7f0] text-[#0a8a5f]', dot: 'bg-[#15b881]', label: 'Completed' },
    failed: { bg: 'bg-[#fdf0ee] text-[#c2452e]', dot: 'bg-[#f0705b]', label: 'Failed' },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${s.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export default function ResearchPage() {
  const router = useRouter();
  const [briefs, setBriefs] = useState<ResearchBrief[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewResearch, setShowNewResearch] = useState(false);
  const [creating, setCreating] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newQuery, setNewQuery] = useState('');
  const [newMatterId, setNewMatterId] = useState('');
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [researchResp, mattersResp] = await Promise.all([
        api.get<{ data: ResearchBrief[] }>('/research'),
        api.get<{ data: Matter[] }>('/matters'),
      ]);
      setBriefs(researchResp.data);
      setMatters(mattersResp.data);
    } catch {
      setError('Failed to load research briefs.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newTitle.trim() || !newQuery.trim() || !newMatterId) return;
    setCreating(true);
    try {
      const brief = await api.post<ResearchBrief>('/research', {
        title: newTitle,
        query: newQuery,
        matterId: newMatterId,
        sources: selectedDocs,
      });
      setBriefs((prev) => [brief, ...prev]);
      setShowNewResearch(false);
      resetForm();
    } catch {
      setError('Failed to create research brief.');
    } finally {
      setCreating(false);
    }
  }

  function resetForm() {
    setNewTitle('');
    setNewQuery('');
    setNewMatterId('');
    setSelectedDocs([]);
  }

  const SAMPLE_DOCS = [
    'Quantum Dynamics - Merger Agreement v3.pdf',
    'Evergreen - Patent Filing US2026-001234.pdf',
    'Brighton - Lease Agreement 2024.docx',
    'NovaTech - Data Processing Agreement.pdf',
    'Thompson - Settlement Agreement Draft.pdf',
    'Quantum - Regulatory Filing SEC.pdf',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`${serif} text-[1.75rem] font-normal tracking-[-0.02em] text-[#0c0a09] dark:text-white`}>Research &amp; Synthesis</h1>
          <p className="text-[13px] text-[#717d79] dark:text-[#969e9b] mt-1">AI-powered legal research briefs, precedent analysis, and memo synthesis</p>
        </div>
        <button
          onClick={() => setShowNewResearch(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0c0a09] hover:bg-[#0a8a5f] text-white text-[13px] font-medium transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          New Research
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-[#fdf0ee] border border-[#f0705b]/20 text-[#c2452e] px-4 py-3 rounded-xl text-[13px] flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadData} className="text-[#0a8a5f] hover:text-[#15b881] font-medium ml-2">Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.04] dark:border-slate-800 p-6 animate-pulse">
              <div className="h-5 bg-black/[0.04] rounded w-3/4 mb-3" />
              <div className="h-3 bg-black/[0.03] rounded w-1/2 mb-2" />
              <div className="h-6 bg-black/[0.04] rounded-full w-20 mb-3" />
              <div className="h-3 bg-black/[0.03] rounded w-full mb-1" />
              <div className="h-3 bg-black/[0.03] rounded w-2/3 mb-4" />
              <div className="h-8 bg-black/[0.04] rounded w-24" />
            </div>
          ))}
        </div>
      )}

      {/* Research Grid */}
      {!loading && !error && briefs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {briefs.map((brief) => (
            <div
              key={brief.id}
              onClick={() => router.push(`/dashboard/research/${brief.id}`)}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.04] dark:border-slate-800 p-5 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-medium text-[13px] text-[#0c0a09] dark:text-white leading-snug pr-2 flex-1 group-hover:text-[#0a8a5f] transition-colors">
                  {brief.title}
                </h3>
              </div>
              <p className="text-[11px] text-[#969e9b] dark:text-[#717d79] mb-3">{brief.matterName}</p>
              <div className="mb-3">
                <StatusBadgeUI status={brief.status} />
              </div>
              {brief.findings ? (
                <p className="text-[12px] text-[#717d79] dark:text-[#969e9b] line-clamp-3 mb-3 flex-1">
                  {brief.findings.substring(0, 120)}{brief.findings.length > 120 ? '...' : ''}
                </p>
              ) : (
                <p className="text-[12px] text-[#969e9b] italic mb-3 flex-1">
                  {brief.status === 'researching' ? 'Research in progress...' : 'No findings yet'}
                </p>
              )}
              <div className="flex items-center justify-between mt-auto pt-3 border-t border-black/[0.04] dark:border-slate-800">
                <span className="text-[11px] text-[#969e9b]">{formatDate(brief.createdAt)}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/research/${brief.id}`); }}
                  className="px-3 py-1.5 text-[12px] font-medium rounded-xl border border-[#15b881]/40 text-[#0a8a5f] hover:bg-[#eaf7f0] transition-colors"
                >
                  View
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && briefs.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.04] dark:border-slate-800 shadow-sm">
          <div className="py-16 text-center">
            <svg className="w-16 h-16 text-black/[0.06] mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 className={`${serif} text-lg font-normal tracking-[-0.02em] text-[#0c0a09] dark:text-white mb-1`}>No research briefs yet</h3>
            <p className="text-[13px] text-[#969e9b] dark:text-[#717d79] max-w-md mx-auto mb-6">Start your first legal research query. Our AI will search through your firm&apos;s documents, precedent, and external sources.</p>
            <button
              onClick={() => setShowNewResearch(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0c0a09] hover:bg-[#0a8a5f] text-white text-[13px] font-medium transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Start Research
            </button>
          </div>
        </div>
      )}

      {/* New Research Modal */}
      {showNewResearch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => { setShowNewResearch(false); resetForm(); }} />
          <div className="relative bg-white rounded-2xl border border-black/[0.04] shadow-lg w-full max-w-lg p-6 space-y-4">
            <h2 className={`${serif} text-xl font-normal tracking-[-0.02em] text-[#0c0a09]`}>New Research Brief</h2>

            <div>
              <label className="block text-[13px] font-medium text-[#717d79] mb-1.5">Brief Title</label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., Delaware Merger Agreement Precedent Review"
                className="w-full px-3 py-2.5 rounded-xl border border-black/[0.08] text-[13px] text-[#0c0a09] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#717d79] mb-1.5">Research Query</label>
              <textarea
                value={newQuery}
                onChange={(e) => setNewQuery(e.target.value)}
                placeholder="Describe what you need researched. Be specific about jurisdiction, legal issues, key terms..."
                rows={4}
                className="w-full px-3 py-2.5 rounded-xl border border-black/[0.08] text-[13px] text-[#0c0a09] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40 resize-none"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#717d79] mb-1.5">Related Matter</label>
              <select
                value={newMatterId}
                onChange={(e) => setNewMatterId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-black/[0.08] text-[13px] text-[#0c0a09] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40"
              >
                <option value="">Select a matter...</option>
                {matters.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.clientName})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#717d79] mb-1.5">Source Documents (optional)</label>
              <p className="text-[11px] text-[#969e9b] mb-2">Select specific documents to prioritize in research</p>
              <div className="max-h-36 overflow-y-auto border border-black/[0.04] rounded-xl">
                {SAMPLE_DOCS.map((doc, i) => {
                  const isSelected = selectedDocs.includes(doc);
                  return (
                    <label
                      key={i}
                      className={`flex items-center gap-2 px-3 py-2 hover:bg-[#fefdfb] cursor-pointer text-[13px] transition-colors ${isSelected ? 'bg-[#eaf7f0]' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => setSelectedDocs((prev) => prev.includes(doc) ? prev.filter((d) => d !== doc) : [...prev, doc])}
                        className="rounded border-black/[0.08]"
                      />
                      <span className="text-[#717d79]">{doc}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => { setShowNewResearch(false); resetForm(); }} className="px-4 py-2 rounded-xl text-[13px] font-medium bg-white border border-black/[0.08] text-[#717d79] hover:bg-[#fefdfb] transition-colors">Cancel</button>
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim() || !newQuery.trim() || !newMatterId || creating}
                className="px-4 py-2 rounded-xl text-[13px] font-medium bg-[#0c0a09] hover:bg-[#0a8a5f] text-white transition-colors disabled:opacity-50"
              >
                {creating ? 'Starting...' : 'Start Research'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
