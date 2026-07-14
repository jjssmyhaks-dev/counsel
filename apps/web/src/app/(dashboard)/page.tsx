'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getUser, getFirm } from '@/lib/auth';
import { api } from '@/lib/api';

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    UPLOADED: 'bg-blue-50 text-blue-700',
    PROCESSING: 'bg-amber-50 text-amber-700',
    READY: 'bg-emerald-50 text-emerald-700',
    FAILED: 'bg-red-50 text-red-700',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-slate-50 text-slate-600'}`}>
      {(status || 'unknown').charAt(0).toUpperCase() + (status || 'unknown').slice(1).toLowerCase()}
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [firm, setFirm] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [stats, setStats] = useState({ documents: 0, matters: 0, drafts: 0, meetings: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = getUser();
    const f = getFirm();
    if (!u) { router.replace('/login'); return; }
    setUser(u);
    setFirm(f);

    Promise.all([
      api.get('/documents?limit=5').catch(() => ({ data: null })),
      api.get('/matters?limit=1').catch(() => ({ data: null })),
      api.get('/drafts?limit=1').catch(() => ({ data: null })),
      api.get('/meetings?limit=1').catch(() => ({ data: null })),
    ])
      .then(([docsRes, mattersRes, draftsRes, meetingsRes]: any[]) => {
        const d = docsRes?.data?.data || docsRes?.data || [];
        const docList = Array.isArray(d) ? d.slice(0, 5) : [];
        setDocuments(docList);
        setStats({
          documents: docsRes?.data?.pagination?.total || docsRes?.pagination?.total || docList.length,
          matters: mattersRes?.data?.pagination?.total || mattersRes?.pagination?.total || (mattersRes?.data?.data?.length || 0),
          drafts: draftsRes?.data?.pagination?.total || draftsRes?.pagination?.total || (draftsRes?.data?.data?.length || 0),
          meetings: meetingsRes?.data?.pagination?.total || meetingsRes?.pagination?.total || (meetingsRes?.data?.data?.length || 0),
        });
      })
      .catch(err => console.warn('Dashboard fetch:', err))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse bg-slate-200 h-24 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="animate-pulse bg-slate-100 h-28 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const statCards = [
    { icon: '📄', value: stats.documents, label: 'Documents', trend: 'Total uploaded', trendUp: true },
    { icon: '📋', value: stats.matters, label: 'Matters', trend: 'All matters', trendUp: true },
    { icon: '✏️', value: stats.drafts, label: 'Drafts', trend: 'Generated drafts', trendUp: false },
    { icon: '💡', value: stats.meetings, label: 'Meetings', trend: 'Processed', trendUp: true },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 text-white">
        <h1 className="text-xl font-bold">Welcome back, {user?.name || 'Counselor'}</h1>
        {firm && <p className="text-blue-200 text-sm mt-1">{firm.name}</p>}
        <p className="text-blue-300/70 text-xs mt-3">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{stat.value}</p>
              </div>
              <span className="text-2xl">{stat.icon}</span>
            </div>
            <p className={`text-xs mt-3 ${stat.trendUp ? 'text-green-600' : 'text-amber-600'}`}>
              {stat.trendUp ? '↑' : '•'} {stat.trend}
            </p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { href: '/documents', label: 'Upload Document', icon: '📄', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
          { href: '/matters', label: 'New Matter', icon: '📋', color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
          { href: '/drafts', label: 'Create Draft', icon: '✏️', color: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
          { href: '/research', label: 'Research', icon: '🔍', color: 'bg-purple-50 text-purple-700 hover:bg-purple-100' },
        ].map(action => (
          <Link
            key={action.href}
            href={action.href}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-colors ${action.color}`}
          >
            <span className="text-lg">{action.icon}</span>
            {action.label}
          </Link>
        ))}
      </div>

      {/* Recent Documents table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Recent Documents</h3>
          <Link href="/documents" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            View all →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Type</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-slate-400 text-sm">
                    No documents yet. Upload your first document to get started.
                  </td>
                </tr>
              ) : (
                documents.map((doc: any) => (
                  <tr
                    key={doc.id}
                    className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/documents/${doc.id}`)}
                  >
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-slate-900 truncate max-w-[280px]">
                        {doc.originalName || doc.name || 'Unnamed'}
                      </p>
                      <p className="text-xs text-slate-500">{doc.matter?.name || '—'}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-mono uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {(doc.mimeType || doc.type || 'unknown').split('/').pop() || doc.type || 'file'}
                      </span>
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={doc.status} /></td>
                    <td className="px-5 py-3 text-sm text-slate-500">{formatDate(doc.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
