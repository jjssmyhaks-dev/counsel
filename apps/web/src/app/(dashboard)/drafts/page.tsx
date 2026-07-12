'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { mockGetDrafts, mockGetMatters } from '@/lib/api';
import type { Draft, Matter } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function TypeBadge({ type }: { type: Draft['type'] }) {
  const variant = type === 'email' ? 'info' : type === 'memo' ? 'warning' : type === 'report' ? 'success' : type === 'brief' ? 'info' : 'neutral';
  return <Badge variant={variant}>{type.charAt(0).toUpperCase() + type.slice(1)}</Badge>;
}

function StatusBadgeUI({ status }: { status: Draft['status'] }) {
  const variant = status === 'draft' ? 'neutral' : status === 'generating' ? 'warning' : 'success';
  return <Badge variant={variant} dot>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
}

export default function DraftsPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewDraft, setShowNewDraft] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // New draft form
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<Draft['type']>('memo');
  const [newInstructions, setNewInstructions] = useState('');
  const [newMatterId, setNewMatterId] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [draftsResp, mattersResp] = await Promise.all([mockGetDrafts(), mockGetMatters()]);
      setDrafts(draftsResp.data);
      setMatters(mattersResp.data);
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
        <div className="page-header !mb-0">
          <h1>Drafts</h1>
          <p>Create, edit, and finalize AI-assisted legal drafts</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setShowNewDraft(true)}>
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Draft
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && <ErrorState message={error} onRetry={loadData} />}

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 space-y-4 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-5 bg-slate-200 rounded w-1/3" />
                <div className="h-5 bg-slate-200 rounded-full w-16" />
                <div className="h-5 bg-slate-200 rounded-full w-20" />
                <div className="h-5 bg-slate-100 rounded w-1/4" />
                <div className="h-5 bg-slate-100 rounded w-20 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && !error && drafts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Title</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Type</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">Matter</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase hidden lg:table-cell">Created</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((draft) => (
                  <tr key={draft.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-slate-900">{draft.title}</p>
                    </td>
                    <td className="px-5 py-3.5"><TypeBadge type={draft.type} /></td>
                    <td className="px-5 py-3.5"><StatusBadgeUI status={draft.status} /></td>
                    <td className="px-5 py-3.5 text-sm text-slate-600 hidden md:table-cell max-w-[200px] truncate">
                      {draft.matterName}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-500 hidden lg:table-cell">
                      {formatDate(draft.createdAt)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => router.push(`/drafts/${draft.id}`)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteConfirmId(draft.id)}>
                          <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </Button>
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
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <EmptyState
            title="No drafts yet"
            description="Create your first AI-assisted legal draft to get started."
            actionLabel="Create Draft"
            onAction={() => setShowNewDraft(true)}
            icon={
              <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            }
          />
        </div>
      )}

      {/* New Draft Modal */}
      <Modal open={showNewDraft} onClose={() => setShowNewDraft(false)} title="Create New Draft" size="lg">
        <div className="space-y-4">
          <Input
            label="Draft Title"
            placeholder="e.g., Client Update Email - Brighton Dispute"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Type</label>
            <div className="flex gap-2 flex-wrap">
              {(['email', 'memo', 'report', 'letter', 'brief'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setNewType(t)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    newType === t
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <Select
            label="Matter"
            options={[
              { value: '', label: 'Select a matter...' },
              ...matters.map((m) => ({ value: m.id, label: `${m.name} (${m.clientName})` })),
            ]}
            value={newMatterId}
            onChange={(e) => setNewMatterId(e.target.value)}
          />
          <Textarea
            label="Instructions"
            placeholder="Describe what you want this draft to cover. Be as specific as possible for best results..."
            value={newInstructions}
            onChange={(e) => setNewInstructions(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setShowNewDraft(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!newTitle.trim() || !newMatterId}>
            Create &amp; Open
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="Delete Draft" size="sm">
        <p className="text-sm text-slate-600">
          Are you sure you want to delete this draft? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
