'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { Matter } from '@/lib/types';

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium status-${status}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function MattersPage() {
  const router = useRouter();
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);

  // New matter form
  const [formName, setFormName] = useState('');
  const [formClient, setFormClient] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formArea, setFormArea] = useState('Corporate M&A');
  const [formSubmitting, setFormSubmitting] = useState(false);

  const serif = 'font-serif';

  const PRACTICE_AREAS = [
    'Corporate M&A', 'Intellectual Property', 'Real Estate', 'Employment Law',
    'Privacy & Data Protection', 'Litigation', 'Tax', 'Banking & Finance',
  ];

  useEffect(() => {
    loadMatters();
  }, []);

  async function loadMatters() {
    setLoading(true);
    setError('');
    try {
      const resp = await api.get<{ data: Matter[] }>('/matters');
      setMatters(resp.data);
    } catch {
      setError('Failed to load matters.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formName || !formClient) return;
    setFormSubmitting(true);
    try {
      const matter = await api.post<Matter>('/matters', {
        name: formName,
        clientName: formClient,
        description: formDesc,
        practiceArea: formArea,
      });
      setMatters((prev) => [matter, ...prev]);
      setShowNew(false);
      setFormName('');
      setFormClient('');
      setFormDesc('');
      setFormArea('Corporate M&A');
    } catch {
      setError('Failed to create matter.');
    } finally {
      setFormSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="skeleton h-8 w-48" />
          <div className="skeleton h-10 w-32 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`${serif} text-2xl font-bold text-[#0c0a09] dark:text-white`}>Matters</h1>
          <p className="text-[#717d79] dark:text-slate-400 text-sm">Manage your firm&apos;s legal matters</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0c0a09] text-white rounded-lg text-sm font-medium hover:bg-[#0a8a5f] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Matter
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadMatters} className="font-medium underline">Retry</button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && matters.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.04)] border border-black/[0.04] dark:border-slate-800 p-12 text-center">
          <div className="w-16 h-16 bg-black/[0.03] dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#969e9b] dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[#0c0a09] dark:text-white mb-1">No matters yet</h3>
          <p className="text-[#717d79] dark:text-slate-400 text-sm mb-4">Create your first matter to start organizing documents and work.</p>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0c0a09] text-white rounded-lg text-sm font-medium hover:bg-[#0a8a5f] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Matter
          </button>
        </div>
      )}

      {/* Matter cards */}
      {matters.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {matters.map((matter) => (
            <div
              key={matter.id}
              onClick={() => router.push(`/matters/${matter.id}`)}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.04)] border border-black/[0.04] dark:border-slate-800 p-5 hover:shadow-md transition-shadow cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs font-medium text-[#717d79] dark:text-slate-400 bg-black/[0.03] dark:bg-slate-800 px-2 py-0.5 rounded">
                  {matter.practiceArea}
                </span>
                <StatusBadge status={matter.status} />
              </div>
              <h3 className="font-semibold text-[#0c0a09] dark:text-white mb-1 group-hover:text-[#0a8a5f] transition-colors line-clamp-2">
                {matter.name}
              </h3>
              <p className="text-sm text-[#717d79] dark:text-slate-400 mb-3 line-clamp-2">{matter.clientName}</p>
              {matter.description && (
                <p className="text-xs text-[#969e9b] dark:text-slate-500 mb-4 line-clamp-2">{matter.description}</p>
              )}
              <div className="flex items-center justify-between pt-3 border-t border-black/[0.04] dark:border-slate-800">
                <div className="flex items-center gap-1 text-xs text-[#717d79] dark:text-slate-400">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {matter.documentCount} docs
                </div>
                <span className="text-xs text-[#969e9b] dark:text-slate-500">Updated {formatDate(matter.updatedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New matter modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowNew(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#0c0a09] dark:text-white">New Matter</h3>
              <button onClick={() => setShowNew(false)} className="text-[#969e9b] dark:text-slate-500 hover:text-[#0c0a09] dark:hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#0c0a09] dark:text-white mb-1">Matter Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., In re Acme Corp Merger"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 text-[#0c0a09] dark:text-white border border-black/[0.08] dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#15b881]/30"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0c0a09] dark:text-white mb-1">Client *</label>
                <input
                  type="text"
                  value={formClient}
                  onChange={(e) => setFormClient(e.target.value)}
                  placeholder="e.g., Acme Corp Inc."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 text-[#0c0a09] dark:text-white border border-black/[0.08] dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#15b881]/30"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0c0a09] dark:text-white mb-1">Description</label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Brief description..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 text-[#0c0a09] dark:text-white border border-black/[0.08] dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 resize-none"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0c0a09] dark:text-white mb-1">Practice Area</label>
                <select
                  value={formArea}
                  onChange={(e) => setFormArea(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 text-[#0c0a09] dark:text-white border border-black/[0.08] dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#15b881]/30"
                >
                  {PRACTICE_AREAS.map((pa) => (
                    <option key={pa} value={pa}>{pa}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowNew(false)} className="flex-1 px-4 py-2 bg-white dark:bg-slate-800 border border-black/[0.06] dark:border-slate-700 text-[#0c0a09] dark:text-white rounded-lg text-sm font-medium hover:bg-black/[0.03] dark:hover:bg-slate-700 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={formSubmitting} className="flex-1 px-4 py-2 bg-[#0c0a09] text-white rounded-lg text-sm font-medium hover:bg-[#0a8a5f] disabled:opacity-50 transition-colors">
                  {formSubmitting ? 'Creating...' : 'Create Matter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
