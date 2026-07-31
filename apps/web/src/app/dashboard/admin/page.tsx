'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [activity, setActivity] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState({ activeUsers: 0, totalDocuments: 0, aiJobsRun: 0, storageUsed: '—', apiCallsToday: 0 });
  const [metricsLoading, setMetricsLoading] = useState(true);

  useEffect(() => {
    // Fetch metrics
    setMetricsLoading(true);
    api.get('/admin/metrics')
      .then((res: any) => {
        if (res?.data) {
          setMetrics(prev => ({
            ...prev,
            ...(typeof res.data === 'object' ? res.data : {}),
          }));
        }
      })
      .catch(() => {})
      .finally(() => setMetricsLoading(false));

    // Fetch recent activity
    setActivityLoading(true);
    api.get('/admin/audit?limit=10')
      .then((res: any) => {
        const data = Array.isArray(res?.data?.data) ? res.data.data : (Array.isArray(res?.data) ? res.data : null);
        if (data && data.length) {
          setActivity(data.map((a: any) => ({
            id: a.id,
            user: a.userName,
            action: a.action,
            detail: a.details,
            resource: a.resource,
            time: a.createdAt,
          })));
        }
      })
      .catch(() => setActivityError('Could not load recent activity'))
      .finally(() => setActivityLoading(false));
  }, []);

  const stats = [
    { label: 'Active Users', value: metricsLoading ? '—' : String(metrics.activeUsers), icon: '👥', color: 'bg-[#eaf7f0]/40 text-[#15b881]' },
    { label: 'Total Documents', value: metricsLoading ? '—' : String(metrics.totalDocuments), icon: '📄', color: 'bg-green-50 text-green-600' },
    { label: 'Queries This Month', value: metricsLoading ? '—' : String(metrics.aiJobsRun), icon: '💡', color: 'bg-purple-50 text-purple-600' },
    { label: 'Active Matters', value: '—', icon: '📋', color: 'bg-amber-50 text-amber-600' },
  ];

  const quickActions = [
    {
      title: 'User Management',
      description: 'Invite, manage roles, and deactivate users',
      href: '/admin/users',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ),
    },
    {
      title: 'Playbook Editor',
      description: 'Configure firm-wide risk rules and review criteria',
      href: '/admin/playbook',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      title: 'Audit Log',
      description: 'Review all system activity and security events',
      href: '/admin/audit',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
  ];

  function getActionBadge(action: string) {
    if (action.includes('upload') || action.includes('Upload')) return <Badge variant="info">Upload</Badge>;
    if (action.includes('analyze') || action.includes('Analyze') || action.includes('Completed') || action.includes('Finalize') || action.includes('finalize')) return <Badge variant="success">Processed</Badge>;
    if (action.includes('Edit') || action.includes('Updated') || action.includes('Invite') || action.includes('update') || action.includes('invite')) return <Badge variant="warning">Modified</Badge>;
    if (action.includes('View') || action.includes('Ran') || action.includes('view') || action.includes('query')) return <Badge variant="neutral">Read</Badge>;
    if (action.includes('Create') || action.includes('create')) return <Badge variant="info">Created</Badge>;
    return <Badge variant="neutral">Action</Badge>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <h1>Administration</h1>
        <p>Manage users, configure playbook rules, and review system activity</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#717d79] font-medium">{stat.label}</p>
                <p className="text-2xl font-bold text-[#0c0a09] mt-1">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${stat.color}`}>
                {stat.icon}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {quickActions.map((action) => (
          <Card
            key={action.title}
            hover
            onClick={() => router.push(action.href)}
            className="cursor-pointer"
          >
            <div className="flex items-start gap-4">
              <div className="text-[#969e9b]">{action.icon}</div>
              <div>
                <h3 className="font-semibold text-[#0c0a09]">{action.title}</h3>
                <p className="text-sm text-[#717d79] mt-1">{action.description}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <div>
        <h3 className="font-semibold text-[#0c0a09] mb-3">Recent Activity</h3>
        <Card padding="none">
          {activityLoading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="w-6 h-6 text-[#15b881] animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="ml-3 text-sm text-[#717d79]">Loading activity...</span>
            </div>
          ) : activityError ? (
            <div className="py-12 text-center">
              <p className="text-sm text-red-600">{activityError}</p>
              <Button variant="ghost" size="sm" onClick={() => {
                setActivityLoading(true);
                setActivityError(null);
                api.get('/admin/audit?limit=10')
                  .then((res: any) => {
                    const data = Array.isArray(res?.data?.data) ? res.data.data : (Array.isArray(res?.data) ? res.data : null);
                    if (data) {
                      setActivity(data.map((a: any) => ({
                        id: a.id, user: a.userName, action: a.action, detail: a.details, resource: a.resource, time: a.createdAt,
                      })));
                    }
                  })
                  .catch(() => setActivityError('Could not load recent activity'))
                  .finally(() => setActivityLoading(false));
              }} className="mt-2 text-sm">
                Retry
              </Button>
            </div>
          ) : activity.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#717d79]">
              No recent activity found.
            </div>
          ) : (
            <div className="divide-y divide-black/[0.04]">
              {activity.map((entry) => (
                <div key={entry.id} className="flex items-center gap-4 px-5 py-3 hover:bg-[#fefdfb] transition-colors">
                  <div className="w-8 h-8 rounded-full bg-[#eaf7f0] text-[#0a8a5f] flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {entry.user.split(' ').map((n: string) => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#4b5551]">
                      <span className="font-medium">{entry.user}</span>{' '}
                      <span className="text-[#717d79]">{entry.action}</span>
                    </p>
                    <p className="text-xs text-[#717d79] truncate">{entry.detail}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {getActionBadge(entry.action)}
                    <span className="text-xs text-[#969e9b] whitespace-nowrap">{formatDate(entry.time)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="px-5 py-3 border-t border-black/[0.04]">
            <Button variant="ghost" size="sm" onClick={() => router.push('/admin/audit')} className="text-sm">
              View Full Audit Log →
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
