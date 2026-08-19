'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';

const serif = 'font-serif';

interface Stat { label: string; value: string; change: string; }
interface Deadline { type: string; client: string; form: string; dueDate: string; severity: string; }
interface Activity { id: string; action: string; client: string; time: string; }
interface Integration { name: string; status: string; }

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function extractList(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (res?.data?.data) return res.data.data;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}

export default function CADashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<Stat[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);

  useEffect(() => {
    if (!getUser()) { router.replace('/login'); return; }

    Promise.all([
      api.get('/compliance-calendar').catch(() => ({ data: [] })),
      api.get('/filings?limit=5').catch(() => ({ data: [] })),
      api.get('/clients?limit=5').catch(() => ({ data: [] })),
      api.get('/audit/logs?limit=5').catch(() => ({ data: [] })),
      api.get('/integrations/health').catch(() => ({ data: [] })),
    ]).then(([compRaw, filingsRaw, clientsRaw, auditRaw, integRaw]: any[]) => {
      const comps = extractList(compRaw);
      const filings = extractList(filingsRaw);
      const clients = extractList(clientsRaw);
      const auditLogs = extractList(auditRaw);
      const integHealth = extractList(integRaw);

      setStats([
        { label: 'Active Clients', value: String(clients.length), change: clients.length > 0 ? 'From database' : 'Add your first client' },
        { label: 'Upcoming Deadlines', value: String(comps.length), change: 'From compliance calendar' },
        { label: 'Pending Reviews', value: String(filings.filter((f: any) => f.status === 'pending' || f.status === 'PENDING').length), change: 'Requires partner review' },
        { label: 'Audit Entries', value: String(auditLogs.length), change: 'Recent activity' },
      ]);

      setDeadlines(comps.slice(0, 5).map((c: any) => ({
        type: c.type || 'Filing', client: c.client?.name || c.clientName || '—', form: c.title || c.form || c.type, dueDate: c.dueDate ? new Date(c.dueDate).toLocaleDateString() : '—', severity: c.severity || 'info',
      })));

      setActivities(auditLogs.slice(0, 5).map((a: any) => ({
        id: a.id || String(Math.random()),
        action: a.action?.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase()) || a.description || 'Activity recorded',
        client: a.resourceId || '—',
        time: a.createdAt ? timeAgo(a.createdAt) : '—',
      })));

      setIntegrations(integHealth.slice(0, 6).map((s: any) => ({
        name: s.name || s.service || 'Service',
        status: s.status || 'unknown',
      })));
    }).catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-gray-200 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-200 rounded-lg" />)}
        </div>
        <div className="h-64 bg-gray-200 rounded-lg" />
      </div>
    );
  }

  if (error && !deadlines.length) {
    return <div className="p-6 max-w-7xl mx-auto"><div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">{error}</div></div>;
  }

  const sevColor = (s: string) => s === 'critical' ? 'text-red-600 bg-red-50 border-red-200' : s === 'warning' ? 'text-yellow-700 bg-yellow-50 border-yellow-200' : 'text-blue-600 bg-blue-50 border-blue-200';

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className={`${serif} text-2xl font-normal tracking-[-0.02em] text-[#0c0a09]`}>Counsel for CA Firms</h1>
        <p className="text-gray-500 mt-1">Everything your CA practice needs — GST, Income Tax, Audit, ROC, and Bookkeeping</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="bg-white rounded-lg border p-4 shadow-sm">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.change}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-4 border-b flex flex-wrap justify-between items-center gap-2">
          <h2 className="font-semibold text-gray-900">Compliance Calendar</h2>
          <a href="/dashboard/ca/compliance" className="text-sm text-green-700 hover:underline">View all &rarr;</a>
        </div>
        <div className="divide-y">
          {deadlines.map((d, i) => (
            <div key={i} className="flex items-center gap-3 p-3 flex-wrap">
              <span className={`text-xs font-medium px-2 py-0.5 rounded border ${sevColor(d.severity)}`}>{d.severity === 'critical' ? 'OVERDUE' : d.severity === 'warning' ? 'DUE SOON' : 'ON TRACK'}</span>
              <span className="text-sm font-medium text-gray-700">{d.type}: {d.form}</span>
              <span className="text-sm text-gray-500">{d.client}</span>
              <span className="text-xs text-gray-400 ml-auto">{d.dueDate}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="p-4 border-b"><h2 className="font-semibold text-gray-900">Recent Activities</h2></div>
          <div className="divide-y">
            {activities.map((a) => (
              <div key={a.id} className="p-3 flex flex-col gap-0.5">
                <p className="text-sm text-gray-700">{a.action}</p>
                <p className="text-xs text-gray-400">{a.time} · {a.client}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="p-4 border-b"><h2 className="font-semibold text-gray-900">Quick Actions</h2></div>
            <div className="p-4 grid grid-cols-2 gap-2">
              {['Upload Trial Balance','Reconcile Accounts','Check GST Status','Draft ITR Data','Track Filings','New Client'].map((a,i) => (
                <button key={i} className="text-sm text-left p-2 rounded border hover:bg-gray-50 hover:border-green-300 transition-colors">
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="font-semibold text-gray-900">Integrations</h2>
              <a href="/dashboard/ca/integrations" className="text-sm text-green-700 hover:underline">Connect &rarr;</a>
            </div>
            <div className="divide-y">
              {integrations.map((ig, i) => (
                <div key={i} className="flex justify-between items-center p-3">
                  <span className="text-sm text-gray-700">{ig.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${ig.status === 'connected' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {ig.status === 'connected' ? '✓ Connected' : 'Disconnected'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
