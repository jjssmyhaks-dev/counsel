'use client';

import { useMemo } from 'react';

interface ActivityItem {
  id: string;
  type: 'document' | 'matter' | 'draft' | 'user' | 'meeting' | 'kb';
  description: string;
  timestamp: string; // ISO string
  user: string;
}

const MOCK_ACTIVITIES: ActivityItem[] = [
  {
    id: 'act-001',
    type: 'document',
    description: 'Uploaded "Quantum Dynamics - Merger Agreement v3.pdf"',
    timestamp: '2026-07-13T00:15:00Z',
    user: 'Sarah Chen',
  },
  {
    id: 'act-002',
    type: 'matter',
    description: 'Opened new matter: "Brighton Commercial Lease Dispute"',
    timestamp: '2026-07-12T22:30:00Z',
    user: 'James Wright',
  },
  {
    id: 'act-003',
    type: 'draft',
    description: 'Finalized draft: "NovaTech Demand Letter"',
    timestamp: '2026-07-12T20:00:00Z',
    user: 'Sarah Chen',
  },
  {
    id: 'act-004',
    type: 'user',
    description: 'Invited paralegal "Maria Gomez" to the firm',
    timestamp: '2026-07-12T16:45:00Z',
    user: 'Admin',
  },
  {
    id: 'act-005',
    type: 'meeting',
    description: 'Meeting "Evergreen Strategy Session" completed with 5 action items',
    timestamp: '2026-07-12T14:00:00Z',
    user: 'Lisa Park',
  },
  {
    id: 'act-006',
    type: 'kb',
    description: 'Queried KB: "What are the notice requirements for force majeure in NY?"',
    timestamp: '2026-07-12T11:20:00Z',
    user: 'David Kim',
  },
];

function getRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ActivityIcon({ type }: { type: ActivityItem['type'] }) {
  const base = 'w-4 h-4';
  switch (type) {
    case 'document':
      return (
        <svg className={`${base} text-blue-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case 'matter':
      return (
        <svg className={`${base} text-purple-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      );
    case 'draft':
      return (
        <svg className={`${base} text-amber-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      );
    case 'user':
      return (
        <svg className={`${base} text-green-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    case 'meeting':
      return (
        <svg className={`${base} text-indigo-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case 'kb':
      return (
        <svg className={`${base} text-teal-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      );
  }
}

function getIconBg(type: ActivityItem['type']): string {
  const map: Record<ActivityItem['type'], string> = {
    document: 'bg-blue-50',
    matter: 'bg-purple-50',
    draft: 'bg-amber-50',
    user: 'bg-green-50',
    meeting: 'bg-indigo-50',
    kb: 'bg-teal-50',
  };
  return map[type];
}

export function RecentActivity() {
  const activities = useMemo(() => MOCK_ACTIVITIES, []);

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-5 py-4 border-b border-slate-200">
        <h3 className="font-semibold text-slate-900">Recent Activity</h3>
      </div>

      {activities.length === 0 ? (
        <div className="p-12 text-center">
          <svg className="mx-auto h-10 w-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="mt-3 text-sm text-slate-500">No recent activity</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {activities.map((item, idx) => (
            <div
              key={item.id}
              className={`flex items-start gap-3 px-5 py-3.5 ${
                idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
              } transition-colors`}
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-lg ${getIconBg(item.type)} flex items-center justify-center mt-0.5`}>
                <ActivityIcon type={item.type} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 line-clamp-1">{item.description}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  by {item.user} · {getRelativeTime(item.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
