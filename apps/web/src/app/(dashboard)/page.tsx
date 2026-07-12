'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getUser, getFirm } from '@/lib/auth';
import type { User, Firm, Document } from '@/lib/types';

const MOCK_DOCS: Document[] = [
  {
    id: 'doc-001', name: 'Quantum Dynamics - Merger Agreement v3.pdf', type: 'pdf', size: 2450000,
    status: 'ready', matterId: 'matter-001', matterName: 'In re Quantum Dynamics Merger',
    uploadedBy: 'user-001', uploaderName: 'Sarah Chen', firmId: 'firm-001', pageCount: 87,
    createdAt: '2026-07-10T09:00:00Z', updatedAt: '2026-07-10T09:15:00Z',
  },
  {
    id: 'doc-002', name: 'Evergreen - Patent Filing US2026-001234.pdf', type: 'pdf', size: 1800000,
    status: 'processing', matterId: 'matter-002', matterName: 'Evergreen IP Portfolio Defense',
    uploadedBy: 'user-001', uploaderName: 'Sarah Chen', firmId: 'firm-001', pageCount: 45,
    createdAt: '2026-07-12T08:00:00Z', updatedAt: '2026-07-12T08:02:00Z',
  },
  {
    id: 'doc-003', name: 'Brighton - Lease Agreement 2024.docx', type: 'docx', size: 950000,
    status: 'ready', matterId: 'matter-003', matterName: 'Brighton Commercial Lease Dispute',
    uploadedBy: 'user-001', uploaderName: 'Sarah Chen', firmId: 'firm-001', pageCount: 32,
    createdAt: '2026-07-05T11:00:00Z', updatedAt: '2026-07-05T11:10:00Z',
  },
  {
    id: 'doc-004', name: 'NovaTech - Data Processing Agreement.pdf', type: 'pdf', size: 3200000,
    status: 'ready', matterId: 'matter-005', matterName: 'NovaTech Data Privacy Audit',
    uploadedBy: 'user-001', uploaderName: 'Sarah Chen', firmId: 'firm-001', pageCount: 64,
    createdAt: '2026-07-08T14:00:00Z', updatedAt: '2026-07-08T14:20:00Z',
  },
  {
    id: 'doc-005', name: 'Thompson - Settlement Agreement Draft.pdf', type: 'pdf', size: 1500000,
    status: 'uploaded', matterId: 'matter-004', matterName: 'Thompson Employment Settlement',
    uploadedBy: 'user-001', uploaderName: 'Sarah Chen', firmId: 'firm-001', pageCount: 28,
    createdAt: '2026-07-12T16:00:00Z', updatedAt: '2026-07-12T16:00:00Z',
  },
];

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = getUser();
    const f = getFirm();
    if (!u) { router.replace('/login'); return; }
    setUser(u);
    setFirm(f);
    setLoading(false);
  }, [router]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-24 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-28 rounded-xl" />)}
        </div>
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  const stats = [
    { icon: '📄', value: '42', label: 'Documents Processed', trend: '+8 this week', trendUp: true },
    { icon: '📋', value: '12', label: 'Active Matters', trend: '+2 this month', trendUp: true },
    { icon: '✏️', value: '7', label: 'Drafts Pending', trend: '3 to finalize', trendUp: false },
    { icon: '💡', value: '156', label: 'KB Queries', trend: '+23 this week', trendUp: true },
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
              {stat.trendUp ? '↑' : '•'} {stat.trend}
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
              {MOCK_DOCS.slice(0, 5).map((doc) => (
                <tr
                  key={doc.id}
                  className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/documents/${doc.id}`)}
                >
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-slate-900 truncate max-w-[280px]">{doc.name}</p>
                    <p className="text-xs text-slate-500">{doc.matterName}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs font-mono uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {doc.type}
                    </span>
                  </td>
                  <td className="px-5 py-3"><StatusBadge status={doc.status} /></td>
                  <td className="px-5 py-3 text-sm text-slate-500">{formatDate(doc.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/documents"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Upload Document
        </Link>
        <Link
          href="/matters"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Matter
        </Link>
        <Link
          href="/kb"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Ask the Firm
        </Link>
      </div>
    </div>
  );
}
