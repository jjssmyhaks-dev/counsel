'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getUser, getFirm } from '@/lib/auth';
import { api } from '@/lib/api';

const serif = "font-serif";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type DocStatus = 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    UPLOADED: 'bg-[#f0f0f0] text-[#717d79]',
    PROCESSING: 'bg-[#eaf7f0] text-[#0a8a5f]',
    READY: 'bg-[#eaf7f0] text-[#0a8a5f]',
    FAILED: 'bg-[#fdf0ee] text-[#c2452e]',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${map[status] || 'bg-[#f0f0f0] text-[#717d79]'}`}>
      {(status || 'unknown').charAt(0) + (status || 'unknown').slice(1).toLowerCase()}
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
    const u = getUser(); const f = getFirm();
    if (!u) { router.replace('/login'); return; }
    setUser(u); setFirm(f);
    Promise.all([
      api.get('/documents?limit=5').catch(() => ({ data: null })),
      api.get('/matters?limit=1').catch(() => ({ data: null })),
      api.get('/drafts?limit=1').catch(() => ({ data: null })),
      api.get('/meetings?limit=1').catch(() => ({ data: null })),
    ]).then(([d, m, dr, mt]: any[]) => {
      const dl = Array.isArray(d?.data?.data || d?.data) ? (d.data.data || d.data).slice(0, 5) : [];
      setDocuments(dl);
      setStats({
        documents: d?.data?.pagination?.total || dl.length,
        matters: m?.data?.pagination?.total || (m?.data?.data?.length || 0),
        drafts: dr?.data?.pagination?.total || (dr?.data?.data?.length || 0),
        meetings: mt?.data?.pagination?.total || (mt?.data?.data?.length || 0),
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-24 rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const statCards = [
    { value: stats.documents, label: 'Documents', sub: 'Total uploaded' },
    { value: stats.matters, label: 'Matters', sub: 'Active matters' },
    { value: stats.drafts, label: 'Drafts', sub: 'Generated drafts' },
    { value: stats.meetings, label: 'Meetings', sub: 'Processed' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="bg-gradient-to-br from-[#0c0a09] via-[#111c17] to-[#0a1a14] rounded-2xl p-6 text-white">
        <h1 className={`${serif} text-[1.75rem] font-normal tracking-[-0.02em]`}>Welcome back, {user?.name || 'Counselor'}</h1>
        {firm && <p className="text-[#7ce3b6]/80 text-[13px] mt-1">{firm.name}</p>}
        <p className="text-white/30 text-[12px] mt-3">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.04] dark:border-slate-800 p-5">
            <p className="text-[13px] text-[#717d79] dark:text-[#969e9b] font-medium">{s.label}</p>
            <p className={`${serif} text-[2rem] font-normal tracking-[-0.02em] text-[#0c0a09] dark:text-white mt-1 tabular-nums`}>{s.value}</p>
            <p className="text-[12px] text-[#969e9b] dark:text-[#717d79] mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { href: '/dashboard/documents', label: 'Upload Document', color: 'bg-[#eaf7f0] text-[#0a8a5f] hover:bg-[#15b881]/15' },
          { href: '/dashboard/matters', label: 'New Matter', color: 'bg-[#f0f0f0] text-[#0c0a09] hover:bg-[#f0f0f0]/80' },
          { href: '/dashboard/drafts', label: 'Create Draft', color: 'bg-[#eaf7f0] text-[#0a8a5f] hover:bg-[#15b881]/15' },
          { href: '/dashboard/research', label: 'Research', color: 'bg-[#f0f0f0] text-[#0c0a09] hover:bg-[#f0f0f0]/80' },
        ].map(a => (
          <Link key={a.href} href={a.href} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-[13px] transition-colors ${a.color}`}>
            {a.label}
          </Link>
        ))}
      </div>

      {/* Recent Documents table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.04] dark:border-slate-800">
        <div className="px-5 py-4 border-b border-black/[0.04] dark:border-slate-800 flex items-center justify-between">
          <h3 className={`${serif} text-lg font-normal tracking-[-0.02em] text-[#0c0a09] dark:text-white`}>Recent Documents</h3>
          <Link href="/dashboard/documents" className="text-[13px] text-[#0a8a5f] hover:text-[#15b881] font-medium transition-colors">View all →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-black/[0.04] dark:border-slate-800">
                {['Name','Type','Status','Date'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#969e9b] dark:text-[#717d79]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-[#969e9b] text-[13px]">No documents yet. Upload your first document to get started.</td></tr>
              ) : (
                documents.map((doc: any) => (
                  <tr key={doc.id} className="border-b border-black/[0.02] dark:border-slate-800 hover:bg-black/[0.02] dark:hover:bg-slate-800/50 cursor-pointer transition-colors" onClick={() => router.push(`/dashboard/documents/${doc.id}`)}>
                    <td className="px-5 py-3">
                      <p className="text-[13px] font-medium text-[#0c0a09] dark:text-white truncate max-w-[280px]">{doc.originalName || doc.name || 'Unnamed'}</p>
                      <p className="text-[11px] text-[#969e9b] dark:text-[#717d79]">{doc.matter?.name || '—'}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[11px] font-mono uppercase text-[#717d79] dark:text-[#969e9b] bg-[#f0f0f0] dark:bg-slate-800 px-2 py-0.5 rounded">{((doc.mimeType || doc.type || 'unknown').split('/').pop() || doc.type || 'file')}</span>
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={doc.status} /></td>
                    <td className="px-5 py-3 text-[13px] text-[#717d79] dark:text-[#969e9b]">{formatDate(doc.createdAt)}</td>
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
