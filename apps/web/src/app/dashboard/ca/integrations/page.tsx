'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

const serif = 'font-serif';

interface Integration {
  service: string;
  status: string;
  provider?: string;
  name?: string;
  error?: string;
}

interface HealthSnapshot {
  total: number;
  connected: number;
  configured: number;
  services: Integration[];
  timestamp: string;
}

export default function CAIntegrationsPage() {
  const [health, setHealth] = useState<HealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadHealth();
  }, []);

  async function loadHealth() {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<HealthSnapshot>('/integrations/health');
      setHealth(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load integrations');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className={`${serif} text-2xl font-bold text-[#0c0a09]`}>Integrations</h1>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadHealth} className="font-medium underline">Retry</button>
        </div>
      </div>
    );
  }

  const services = health?.services || [];
  const connected = services.filter(s => s.status === 'connected' || s.status === 'configured');

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`${serif} text-2xl font-bold text-[#0c0a09]`}>Integrations</h1>
        <p className="text-[#717d79] text-sm mt-1">Connect your accounting tools and services</p>
      </div>

      {services.length === 0 ? (
        <div className="bg-white rounded-2xl border border-black/[0.04] p-12 text-center">
          <p className="text-[#717d79] text-sm">No integrations configured. Visit the Connector page to set up services.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-black/[0.04] p-4">
              <p className="text-xs text-[#717d79]">Total</p>
              <p className="text-2xl font-bold text-[#0c0a09]">{health?.total || 0}</p>
            </div>
            <div className="bg-white rounded-xl border border-black/[0.04] p-4">
              <p className="text-xs text-[#717d79]">Connected</p>
              <p className="text-2xl font-bold text-[#0a8a5f]">{connected.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-black/[0.04] p-4">
              <p className="text-xs text-[#717d79]">Available</p>
              <p className="text-2xl font-bold text-[#c46b3c]">{services.filter(s => s.status === 'catalog_only').length}</p>
            </div>
            <div className="bg-white rounded-xl border border-black/[0.04] p-4">
              <p className="text-xs text-[#717d79]">Needs Setup</p>
              <p className="text-2xl font-bold text-[#c26a4a]">{services.filter(s => s.status === 'unconfigured').length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map(svc => {
              const isGood = svc.status === 'connected' || svc.status === 'configured';
              return (
                <div key={svc.service} className={`bg-white rounded-xl border p-4 ${isGood ? 'border-[#c4d4b8]' : 'border-black/[0.04]'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-[#0c0a09]">{svc.name || svc.service}</span>
                    <span className={`w-2 h-2 rounded-full ${isGood ? 'bg-[#7a9a6e]' : svc.status === 'catalog_only' ? 'bg-[#9ca3af]' : 'bg-[#c26a4a]'}`} />
                  </div>
                  <p className="text-xs text-[#717d79] capitalize">{svc.status.replace(/_/g, ' ')}</p>
                  {svc.provider && (
                    <button
                      onClick={() => window.open(`/dashboard/admin/feature-connector`, '_self')}
                      className="mt-3 text-xs font-medium text-[#0a8a5f] hover:underline"
                    >
                      {isGood ? 'Manage' : 'Connect'} →
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
