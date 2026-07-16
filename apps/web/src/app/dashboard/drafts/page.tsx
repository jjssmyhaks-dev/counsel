'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { Draft, Matter } from '@/lib/types';

const serif = 'font-serif';

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function TypeBadge({ type }: { type: Draft['type'] }) {
  const map: Record<string, string> = {
    email: 'bg-[#eaf7f0] text-[#0a8a5f]',
    memo: 'bg-[#fef8e6] text-[#b45309]',
    report: 'bg-[#eaf7f0] text-[#0a8a5f]',
    letter: 'bg-[#f0f0f0] text-[#4b5551]',
    brief: 'bg-[#eaf7f0] text-[#0a8a5f]',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${map[type] || 'bg-[#f0f0f0] text-[#717d79]'}`}>
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </span>
  );
}

function StatusBadgeUI({ status }: { status: Draft['status'] }) {
  const map: Record<string, { bg: string; dot: string }> = {
    draft: { bg: 'bg-[#f0f0f0] text-[#717d79]', dot: 'bg-[#969e9b]' },
    generating: { bg: 'bg-[#fef8e6] text-[#b45309]', dot: 'bg-amber-500' },
    completed: { bg: 'bg-[#eaf7f0] text-[#0a8a5f]', dot: 'bg-[#15b881]' },
  };
  const s = map[status] || map.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${s.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function DraftsPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewDraft, setShowNewDraft] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<Draft['type']>('memo');
  const [newInstructions, setNewInstructions] = useState('');
  const [newMatterId, setNewMatterId] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const draftsResp = await api.get<{ data: Draft[] }>('/drafts');
      setDrafts(draftsResp.data);
    } catch {
      setError('Failed to load drafts.');
    } finally {
      setLoading(false);
    }
  }

  function handleCreate() {
    if (!newTitle.trim() || !newMatterId) return;
    const draft: Draft = {
      id: `draft-${Date.now()}`,
      title: newTitle,
      type: newType,
      status: 'draft',
      content: '',
      instructions: newInstructions,
      matterId: newMatterId,
      matterName: matters.find((m) => m.id === newMatterId)?.name || '',
      createdBy: 'user-001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setDrafts((prev) => [draft, ...prev]);
    setShowNewDraft(false);
    setNewTitle('');
    setNewInstructions('');
    setNewMatterId('');
    setNewType('memo');
  }

  function handleDelete(id: string) {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    setDeleteConfirmId(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`${serif} text-[1.75rem] font-normal tracking-[-0.02em] text-[#0c0a09] dark:text-white`}>Drafts</h1>
          <p className="text-[13px] text-[#717d79] dark:text-[#969e9b] mt-1">Create, edit, and finalize AI-assisted legal drafts</p>
        </div>
        <button
          onClick={() => setShowNewDraft(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0c0a09] hover:bg-[#0a8a5f] text-white text-[13px] font-medium transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          New Draft
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
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.04] dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-5 space-y-4 animate-pulse">
            {[1,2,3,4,5,6].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-4 bg-black/[0.04] rounded w-1/3" />
                <div className="h-4 bg-black/[0.04] rounded-full w-16" />
                <div className="h-4 bg-black/[0.04] rounded-full w-20" />
                <div className="h-4 bg-black/[0.03] rounded w-1/4" />
                <div className="h-4 bg-black/[0.03] rounded w-20 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && !error && drafts.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.04] dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-black/[0.04] dark:border-slate-800 bg-[#fefdfb]/50">
                  {['Title','Type','Status','Matter','Created','Actions'].map((h, idx) => (
                    <th key={h} className={`text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#969e9b] dark:text-[#717d79] ${idx === 3 ? 'hidden md:table-cell' : ''} ${idx === 4 ? 'hidden lg:table-cell' : ''} ${idx === 5 ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drafts.map((draft) => (
                  <tr key={draft.id} className="border-b border-black/[0.02] dark:border-slate-800 hover:bg-black/[0.02] dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-medium text-[#0c0a09] dark:text-white">{draft.title}</p>
                    </td>
                    <td className="px-5 py-3.5"><TypeBadge type={draft.type} /></td>
                    <td className="px-5 py-3.5"><StatusBadgeUI status={draft.status} /></td>
                    <td className="px-5 py-3.5 text-[13px] text-[#717d79] dark:text-[#969e9b] hidden md:table-cell max-w-[200px] truncate">{draft.matterName}</td>
                    <td className="px-5 py-3.5 text-[13px] text-[#969e9b] dark:text-[#717d79] hidden lg:table-cell">{formatDate(draft.createdAt)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/drafts/${draft.id}`); }}
                          className="px-3 py-1.5 text-[12px] font-medium rounded-xl border border-[#15b881]/40 text-[#0a8a5f] hover:bg-[#eaf7f0] transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(draft.id); }}
                          className="p-1.5 rounded-lg hover:bg-black/[0.04] transition-colors"
                        >
                          <svg className="w-4 h-4 text-[#f0705b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && drafts.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.04] dark:border-slate-800 shadow-sm">
          <div className="py-16 text-center">
            <svg className="w-16 h-16 text-black/[0.06] mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <h3 className={`${serif} text-lg font-normal tracking-[-0.02em] text-[#0c0a09] dark:text-white mb-1`}>No drafts yet</h3>
            <p className="text-[13px] text-[#969e9b] dark:text-[#717d79] max-w-md mx-auto mb-6">Create your first AI-assisted legal draft to get started.</p>
            <button
              onClick={() => setShowNewDraft(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0c0a09] hover:bg-[#0a8a5f] text-white text-[13px] font-medium transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Create Draft
            </button>
          </div>
        </div>
      )}

      {/* New Draft Modal */}
      {showNewDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setShowNewDraft(false)} />
          <div className="relative bg-white rounded-2xl border border-black/[0.04] shadow-lg w-full max-w-lg p-6 space-y-4">
            <h2 className={`${serif} text-xl font-normal tracking-[-0.02em] text-[#0c0a09]`}>Create New Draft</h2>

            <div>
              <label className="block text-[13px] font-medium text-[#717d79] mb-1.5">Draft Title</label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., Client Update Email - Brighton Dispute"
                className="w-full px-3 py-2.5 rounded-xl border border-black/[0.08] text-[13px] text-[#0c0a09] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#717d79] mb-1.5">Type</label>
              <div className="flex gap-2 flex-wrap">
                {(['email', 'memo', 'report', 'letter', 'brief'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setNewType(t)}
                    className={`px-3 py-1.5 rounded-xl text-[13px] font-medium border transition-colors ${
                      newType === t
                        ? 'bg-[#0c0a09] text-white border-[#0c0a09]'
                        : 'bg-white text-[#717d79] border-black/[0.08] hover:bg-[#fefdfb]'
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#717d79] mb-1.5">Matter</label>
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
              <label className="block text-[13px] font-medium text-[#717d79] mb-1.5">Instructions</label>
              <textarea
                value={newInstructions}
                onChange={(e) => setNewInstructions(e.target.value)}
                placeholder="Describe what you want this draft to cover..."
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl border border-black/[0.08] text-[13px] text-[#0c0a09] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40 resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowNewDraft(false)} className="px-4 py-2 rounded-xl text-[13px] font-medium bg-white border border-black/[0.08] text-[#717d79] hover:bg-[#fefdfb] transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={!newTitle.trim() || !newMatterId} className="px-4 py-2 rounded-xl text-[13px] font-medium bg-[#0c0a09] hover:bg-[#0a8a5f] text-white transition-colors disabled:opacity-50">Create &amp; Open</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setDeleteConfirmId(null)} />
          <div className="relative bg-white rounded-2xl border border-black/[0.04] shadow-lg w-full max-w-sm p-6 space-y-4">
            <h2 className={`${serif} text-xl font-normal tracking-[-0.02em] text-[#0c0a09]`}>Delete Draft</h2>
            <p className="text-[13px] text-[#717d79] dark:text-[#969e9b]">Are you sure you want to delete this draft? This action cannot be undone.</p>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 rounded-xl text-[13px] font-medium bg-white border border-black/[0.08] text-[#717d79] hover:bg-[#fefdfb] transition-colors">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirmId)} className="px-4 py-2 rounded-xl text-[13px] font-medium bg-[#fdf0ee] text-[#c2452e] border border-[#f0705b]/20 hover:bg-[#fdf0ee]/80 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
