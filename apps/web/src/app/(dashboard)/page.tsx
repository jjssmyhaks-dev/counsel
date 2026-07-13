'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getUser, getFirm } from '@/lib/auth';
import { api } from '@/lib/api';
import type { User, Firm, Document } from '@/lib/types';

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

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [firm, setFirm] = useState<Firm | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = getUser();
    const f = getFirm();
    if (!u) { router.replace('/login'); return; }
    setUser(u);
    setFirm(f);

    // Fetch real documents from API
    api.get<{ data: Document[] }>('/documents?limit=5')
      .then(res => setDocuments(res.data || []))
      .catch(err => console.warn('Failed to load documents:', err))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-24 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-28 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const stats = [
    { icon: '\uD83D\uDCC4', value: documents.length.toString(), label: 'Recent Documents', trend: 'Latest uploads', trendUp: true },
    { icon: '\uD83D\uDCCB', value: '--', label: 'Active Matters', trend: 'API connected', trendUp: true },
    { icon: '\u270F\uFE0F', value: '--', label: 'Drafts Pending', trend: 'Real data wired', trendUp: false },
    { icon: '\uD83D\uDCA1', value: '--', label: 'KB Queries', trend: 'AI-powered search', trendUp: true },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-navy-800 to-navy-900 rounded-xl p-6 text-white">
        <h1 className="text-xl font-bold">Welcome back, {user?.name || 'Counselor'}</h1>
        {firm && <p className="text-blue-200 text-sm mt-1">{firm.name}</p>}
        <p className="text-blue-300/70 text-xs mt-3">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{stat.value}</p>
              </div>
              <span className="text-2xl">{stat.icon}</span>
            </div>
            <p className={`text-xs mt-3 ${stat.trendUp ? 'text-green-600' : 'text-amber-600'}`}>
              {stat.trendUp ? '\u2191' : '\u2022'} {stat.trend}
            </p>
          </div>
        ))}
      </div>

      {/* Recent Documents */}
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
                documents.slice(0, 5).map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/documents/${doc.id}`)}
                  >
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-slate-900 truncate max-w-[280px]">{doc.name}</p>
                      <p className="text-xs text-slate-500">{(doc as any).matterName || '—'}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-mono uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {doc.type}
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
