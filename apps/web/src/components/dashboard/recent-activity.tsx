'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface ActivityItem {
  id: string;
  type: 'document' | 'matter' | 'draft' | 'user' | 'meeting' | 'kb';
  description: string;
  timestamp: string;
  user: string;
}

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
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = () => {
    setLoading(true);
    setError(null);
    api.get('/admin/audit?limit=10')
      .then((res: any) => {
        const data = Array.isArray(res?.data?.data) ? res.data.data : (Array.isArray(res?.data) ? res.data : null);
        if (data && data.length) {
          setActivities(data.map((a: any) => ({
            id: a.id,
            type: inferType(a.resource),
            description: a.details,
            timestamp: a.createdAt,
            user: a.userName,
          })));
        }
      })
      .catch(() => setError('Failed to load activity'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-5 py-4 border-b border-slate-200">
        <h3 className="font-semibold text-slate-900">Recent Activity</h3>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <svg className="w-6 h-6 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="ml-3 text-sm text-slate-500">Loading activity...</span>
        </div>
      ) : error ? (
        <div className="p-6 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={fetchActivities} className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium">Retry</button>
        </div>
      ) : activities.length === 0 ? (
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

function inferType(resource: string): ActivityItem['type'] {
  const r = resource?.toLowerCase() || '';
  if (r === 'document') return 'document';
  if (r === 'matter') return 'matter';
  if (r === 'draft') return 'draft';
  if (r === 'user') return 'user';
  if (r === 'meeting') return 'meeting';
  if (r === 'kb' || r === 'knowledge_base') return 'kb';
  return 'document';
}
