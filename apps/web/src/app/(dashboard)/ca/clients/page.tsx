'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface Client { id: string; name: string; pan: string; gstin: string; lastEngagement: string; status: string; email: string; }

function extractList(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (res?.data?.data) return res.data.data;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}

export default function CAClientsPage() {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/clients')
      .then((res: any) => setClients(extractList(res)))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.pan.includes(search.toUpperCase()) || c.gstin.includes(search));

  if (loading) return <div className="p-6"><div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-4" /><div className="h-64 bg-gray-200 rounded-lg animate-pulse" /></div>;
  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your CA firm&apos;s clients, PAN/GST verifications, and engagements</p>
        </div>
        <button className="px-4 py-2 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800 transition-colors">+ New Client</button>
      </div>

      <input type="text" placeholder="Search by name, PAN, or GSTIN..." value={search} onChange={e => setSearch(e.target.value)}
        className="w-full max-w-md p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-200" />

      <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 text-left text-gray-600"><th className="p-3">Name</th><th className="p-3">PAN</th><th className="p-3">GSTIN</th><th className="p-3">Last Engagement</th><th className="p-3">Status</th></tr></thead>
          <tbody className="divide-y">
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 cursor-pointer">
                <td className="p-3 font-medium text-gray-900">{c.name}<br/><span className="text-xs text-gray-400">{c.email}</span></td>
                <td className="p-3 text-gray-600">{c.pan}</td>
                <td className="p-3 text-gray-600">{c.gstin}</td>
                <td className="p-3 text-gray-600">{c.lastEngagement}</td>
                <td className="p-3"><span className={`text-xs px-2 py-0.5 rounded ${c.status==='Active'?'bg-green-50 text-green-700':'bg-gray-100 text-gray-500'}`}>{c.status}</span></td>
              </tr>
            ))}
            {filtered.length===0 && <tr><td colSpan={5} className="p-8 text-center text-gray-400">No clients found. Add your first client to get started.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
