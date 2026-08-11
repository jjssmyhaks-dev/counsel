'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

const serif = 'font-serif';

interface Client {
  id: string;
  name: string;
  email?: string;
  pan?: string;
  gstin?: string;
  phone?: string;
  _count?: { engagements: number; filings: number };
}

export default function CAClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPan, setFormPan] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<Client[]>('/clients');
      setClients(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) return;
    setSubmitting(true);
    try {
      const client = await api.post<Client>('/clients', {
        name: formName,
        pan: formPan || undefined,
        email: formEmail || undefined,
      });
      setClients(prev => [client, ...prev]);
      setShowAdd(false);
      setFormName(''); setFormPan(''); setFormEmail('');
    } catch (err: any) {
      setError(err.message || 'Failed to add client');
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48" />
        {[1, 2, 3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`${serif} text-2xl font-bold text-[#0c0a09]`}>Clients</h1>
          <p className="text-[#717d79] text-sm mt-1">Manage your CA firm's clients</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2.5 bg-[#0c0a09] text-white rounded-xl text-sm font-medium hover:bg-[#0a8a5f] transition-colors"
        >
          + Add Client
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadClients} className="font-medium underline">Retry</button>
        </div>
      )}

      {clients.length === 0 && !error ? (
        <div className="bg-white rounded-2xl border border-black/[0.04] p-12 text-center">
          <p className="text-[#717d79] text-sm mb-4">No clients yet. Add your first client to get started.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2.5 bg-[#0c0a09] text-white rounded-xl text-sm font-medium hover:bg-[#0a8a5f] transition-colors"
          >
            + Add Client
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-black/[0.04] overflow-hidden">
          <table className="w-full">
            <thead className="bg-black/[0.02]">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#717d79] uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#717d79] uppercase tracking-wider">PAN</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#717d79] uppercase tracking-wider">Email</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#717d79] uppercase tracking-wider">Engagements</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {clients.map(client => (
                <tr key={client.id} className="hover:bg-black/[0.01]">
                  <td className="px-4 py-3 text-sm font-medium text-[#0c0a09]">{client.name}</td>
                  <td className="px-4 py-3 text-sm text-[#717d79]">{client.pan || '—'}</td>
                  <td className="px-4 py-3 text-sm text-[#717d79]">{client.email || '—'}</td>
                  <td className="px-4 py-3 text-sm text-[#717d79] text-right">{client._count?.engagements || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[#0c0a09] mb-4">Add Client</h3>
            <form onSubmit={handleAdd} className="space-y-3">
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="Client Name *"
                className="w-full px-3 py-2 border border-black/[0.08] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#15b881]/30"
                required
              />
              <input
                type="text"
                value={formPan}
                onChange={e => setFormPan(e.target.value)}
                placeholder="PAN (optional)"
                className="w-full px-3 py-2 border border-black/[0.08] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#15b881]/30"
              />
              <input
                type="email"
                value={formEmail}
                onChange={e => setFormEmail(e.target.value)}
                placeholder="Email (optional)"
                className="w-full px-3 py-2 border border-black/[0.08] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#15b881]/30"
              />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2 border border-black/[0.08] rounded-xl text-sm font-medium text-[#717d79]">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-[#0c0a09] text-white rounded-xl text-sm font-medium hover:bg-[#0a8a5f] disabled:opacity-50">
                  {submitting ? 'Adding...' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
