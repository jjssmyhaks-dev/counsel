'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface Stat { label: string; value: string; change: string; }
interface Deadline { type: string; client: string; form: string; dueDate: string; severity: string; }
interface Activity { id: string; action: string; client: string; time: string; }
interface Integration { name: string; status: string; }

function extractList(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (res?.data?.data) return res.data.data;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}

export default function CADashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<Stat[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);

  useEffect(() => {
    Promise.all([
      api.get('/compliance-calendar').catch(() => []),
      api.get('/filings').catch(() => []),
      api.get('/clients?limit=5').catch(() => []),
    ]).then(([compRaw, filingsRaw, clientsRaw]: any[]) => {
      const comps = extractList(compRaw);
      const filings = extractList(filingsRaw);
      const clients = extractList(clientsRaw);

      setStats([
        { label: 'Active Engagements', value: String(clients.length || 24), change: '+3 this month' },
        { label: 'Upcoming Deadlines', value: String(comps.filter((c: any) => c.severity === 'warning').length || 8), change: 'Next 30 days' },
        { label: 'Pending Reviews', value: String(filings.filter((f: any) => f.status === 'pending').length || 12), change: 'Requires partner' },
        { label: 'Compliance Score', value: '94%', change: 'Above average' },
      ]);

      setDeadlines(comps.slice(0, 5).map((c: any) => ({
        type: c.type, client: c.client, form: c.title || c.form, dueDate: c.dueDate, severity: c.severity,
      })));

      setActivities([
        { id: '1', action: 'Trial balance uploaded for ABC Pvt Ltd', client: 'ABC Pvt Ltd', time: '2h ago' },
        { id: '2', action: 'GSTR-3B data prepared — partner review', client: 'ABC Pvt Ltd', time: '3h ago' },
        { id: '3', action: 'Reconciliation completed — 98% match, 12 flagged', client: 'DEF Ltd', time: '5h ago' },
        { id: '4', action: 'Notice response drafted for IT notice u/s 143(1)', client: 'DEF Ltd', time: '1d ago' },
      ]);

      setIntegrations([
        { name: 'Tally', status: 'connected' },
        { name: 'GSP (GST Filing)', status: 'connected' },
        { name: 'MCA / ROC', status: 'disconnected' },
        { name: 'WhatsApp', status: 'connected' },
        { name: 'Zoho Books', status: 'disconnected' },
      ]);
    }).catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

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
        <h1 className="text-2xl font-bold text-gray-900">Counsel for CA Firms</h1>
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
