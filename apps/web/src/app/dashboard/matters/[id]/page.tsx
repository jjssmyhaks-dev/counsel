'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { Matter, Document, ResearchBrief, Draft } from '@/lib/types';

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

function DraftTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    email: 'bg-purple-100 text-purple-700',
    memo: 'bg-[#eaf7f0] text-[#0a8a5f]',
    report: 'bg-teal-100 text-teal-700',
    brief: 'bg-amber-100 text-amber-700',
    letter: 'bg-rose-100 text-rose-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[type] || 'bg-black/[0.04] text-[#4b5551]'}`}>
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </span>
  );
}

export default function MatterDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [matter, setMatter] = useState<Matter | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [research, setResearch] = useState<ResearchBrief[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'documents' | 'research' | 'drafts'>('documents');

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [m, docsRes, researchRes, draftsRes] = await Promise.all([
        api.get<Matter>(`/matters/${id}`),
        api.get<{ data: Document[] }>('/documents'),
        api.get<{ data: ResearchBrief[] }>('/research'),
        api.get<{ data: Draft[] }>('/drafts'),
      ]);
      setMatter(m);
      setDocuments(docsRes.data.filter((d) => d.matterId === id));
      setResearch(researchRes.data.filter((r) => r.matterId === id));
      setDrafts(draftsRes.data.filter((d) => d.matterId === id));
    } catch {
      setError('Matter not found.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-64" />
        <div className="skeleton h-6 w-96" />
        <div className="skeleton h-12 w-full rounded-xl" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  if (error || !matter) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-black/[0.06] p-12 text-center">
        <h3 className="text-lg font-semibold text-[#0c0a09] mb-2">Matter Not Found</h3>
        <p className="text-[#717d79] text-sm mb-4">{error || 'The requested matter could not be loaded.'}</p>
        <button onClick={() => router.push('/matters')} className="text-[#15b881] hover:text-[#0a8a5f] font-medium text-sm">
          ← Back to Matters
        </button>
      </div>
    );
  }

  const tabs = [
    { key: 'documents' as const, label: 'Documents', count: documents.length },
    { key: 'research' as const, label: 'Research', count: research.length },
    { key: 'drafts' as const, label: 'Drafts', count: drafts.length },
  ];

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => router.push('/matters')}
          className="text-sm text-[#15b881] hover:text-[#0a8a5f] font-medium mb-2 inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Matters
        </button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0c0a09]">{matter.name}</h1>
            <p className="text-[#717d79] text-sm mt-1">{matter.clientName}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={matter.status} />
            <span className="text-xs text-[#717d79] bg-black/[0.04] px-2.5 py-1 rounded">{matter.practiceArea}</span>
          </div>
        </div>
      </div>

      {/* Info bar */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-[#717d79]">
        <span>Responsible: <strong>{matter.responsibleUserName}</strong></span>
        <span>•</span>
        <span>{matter.documentCount} documents</span>
        <span>•</span>
        <span>Updated {formatDate(matter.updatedAt)}</span>
      </div>

      {matter.description && (
        <p className="text-sm text-[#717d79] bg-[#fefdfb] rounded-xl p-4 border border-black/[0.06]">{matter.description}</p>
      )}

      {/* Tabs */}
      <div className="border-b border-black/[0.06]">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-[#15b881]'
                  : 'border-transparent text-[#717d79] hover:text-[#4b5551]'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </nav>
      </div>

      {/* Documents tab */}
      {activeTab === 'documents' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[#0c0a09]">Attached Documents</h3>
            <button
              onClick={() => router.push('/documents')}
              className="text-xs px-3 py-1.5 border border-[#15b881]/20 text-[#0a8a5f] rounded-xl hover:bg-[#eaf7f0]/40"
            >
              Attach Document
            </button>
          </div>
          {documents.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-black/[0.06] p-8 text-center">
              <p className="text-[#717d79] text-sm">No documents attached to this matter yet.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-black/[0.06] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-black/[0.06] bg-[#fefdfb]/50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[#717d79] uppercase">Name</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[#717d79] uppercase">Type</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[#717d79] uppercase">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[#717d79] uppercase">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr
                      key={doc.id}
                      onClick={() => router.push(`/documents/${doc.id}`)}
                      className="border-b border-black/[0.04] hover:bg-[#fefdfb] cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium text-[#0c0a09]">{doc.name}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-mono uppercase text-[#717d79] bg-black/[0.04] px-2 py-0.5 rounded">{doc.type}</span>
                      </td>
                      <td className="px-5 py-3"><StatusBadge status={doc.status} /></td>
                      <td className="px-5 py-3 text-sm text-[#717d79]">{formatDate(doc.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Research tab */}
      {activeTab === 'research' && (
        <div>
          <h3 className="font-semibold text-[#0c0a09] mb-3">Research Briefs</h3>
          {research.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-black/[0.06] p-8 text-center">
              <p className="text-[#717d79] text-sm">No research briefs for this matter yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {research.map((r) => (
                <div
                  key={r.id}
                  onClick={() => router.push(`/research/${r.id}`)}
                  className="bg-white rounded-xl shadow-sm border border-black/[0.06] p-4 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-[#0c0a09]">{r.title}</h4>
                      <p className="text-xs text-[#717d79] mt-1 line-clamp-2">{r.query}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-xs text-[#969e9b] mt-2">{formatDate(r.createdAt)} · {r.sources.length} sources</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Drafts tab */}
      {activeTab === 'drafts' && (
        <div>
          <h3 className="font-semibold text-[#0c0a09] mb-3">Drafts</h3>
          {drafts.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-black/[0.06] p-8 text-center">
              <p className="text-[#717d79] text-sm">No drafts for this matter yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {drafts.map((d) => (
                <div
                  key={d.id}
                  onClick={() => router.push(`/drafts/${d.id}`)}
                  className="bg-white rounded-xl shadow-sm border border-black/[0.06] p-4 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-[#0c0a09]">{d.title}</span>
                      <DraftTypeBadge type={d.type} />
                    </div>
                    <StatusBadge status={d.status} />
                  </div>
                  <p className="text-xs text-[#969e9b] mt-2">{formatDate(d.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
