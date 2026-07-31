/**
 * Integration Health Dashboard — Admin page showing real-time connectivity
 * for all 30+ services with color-coded indicators, error counts, and
 * fallback flags.
 *
 * Design: 04 Fathom Information Design — scientific journal aesthetic
 * (grays, navy, one highlight color: #15b881 brand green)
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface HealthEntry {
  service: string;
  status: string;
  provider?: string;
  name?: string;
  scopes?: string[];
  error?: string;
  bucket?: string;
}

interface HealthSnapshot {
  total: number;
  connected: number;
  configured: number;
  catalogOnly: number;
  unconfigured: number;
  services: HealthEntry[];
  timestamp: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  connected:    { label: 'Connected',    color: '#15b881', bg: '#e6f7f1', border: '#15b881' },
  configured:   { label: 'Configured',   color: '#2563eb', bg: '#e8f0fe', border: '#2563eb' },
  unconfigured: { label: 'Not Set',      color: '#9ca3af', bg: '#f3f4f6', border: '#d1d5db' },
  catalog_only: { label: 'Catalog',      color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  disconnected: { label: 'Disconnected', color: '#dc2626', bg: '#fef2f2', border: '#dc2626' },
};

const CATEGORY_MAP: Record<string, string> = {
  gmail: 'Email', outlook: 'Email',
  'google-calendar': 'Calendar', 'outlook-calendar': 'Calendar',
  'google-drive': 'Storage', onedrive: 'Storage', sharepoint: 'Storage',
  'Cloudflare R2': 'Storage',
  docusign: 'E-Signature', hellosign: 'E-Signature',
  salesforce: 'CRM', clio: 'CRM', hubspot: 'CRM',
  slack: 'Comms', teams: 'Comms',
  zoom: 'Video',
  quickbooks: 'Accounting', xero: 'Accounting', 'zoho-books': 'Accounting',
  imanage: 'DMS', netdocuments: 'DMS',
  harvest: 'Time', toggl: 'Time',
  zapier: 'Workflow', make: 'Workflow', n8n: 'Workflow',
  'Google Workspace': 'Email', 'Microsoft 365': 'Email',
  'DocuSign eSignature': 'E-Signature',
  'Salesforce CRM': 'CRM',
  'QuickBooks Online': 'Accounting',
  Slack: 'Comms',
  Zoom: 'Video',
  'Stripe': 'Billing',
  'Resend Email': 'Email',
  'WorkOS SSO': 'Auth',
  'Cloudflare Workers AI': 'AI',
};

export default function IntegrationsHealthDashboard() {
  const [health, setHealth] = useState<HealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<HealthSnapshot>('/integrations/health');
      setHealth(data);
      setLastRefreshed(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to load health data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  const categories = health
    ? Array.from(new Set(health.services.map((s) => CATEGORY_MAP[s.service] || s.service)))
    : [];

  const filteredServices = health?.services.filter((s) => {
    if (filter === 'all') return true;
    if (filter === 'connected') return s.status === 'connected' || s.status === 'configured';
    if (filter === 'unconfigured') return s.status === 'unconfigured' || s.status === 'catalog_only';
    if (filter === 'error') return s.status === 'disconnected';
    const cat = CATEGORY_MAP[s.service] || s.service;
    return cat === filter;
  }) || [];

  const statusCounts = health
    ? {
        connected: health.services.filter((s) => s.status === 'connected').length,
        configured: health.services.filter((s) => s.status === 'configured').length,
        catalogOnly: health.services.filter((s) => s.status === 'catalog_only').length,
        unconfigured: health.services.filter((s) => s.status === 'unconfigured').length,
        disconnected: health.services.filter((s) => s.status === 'disconnected').length,
      }
    : { connected: 0, configured: 0, catalogOnly: 0, unconfigured: 0, disconnected: 0 };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: 32, borderBottom: '1px solid #e5e7eb', paddingBottom: 20 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: '#1a2236', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
          Integration Health
        </h1>
        <p style={{ fontSize: 15, color: '#6b7280', margin: 0 }}>
          Real-time connectivity status for {health?.total || 0} services across 10 categories
          {lastRefreshed && (
            <span style={{ marginLeft: 12, fontSize: 13, color: '#9ca3af' }}>
              Updated {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
        </p>
      </div>

      {/* Summary bar */}
      {health && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12, marginBottom: 28,
        }}>
          {[
            { label: 'Connected', value: statusCounts.connected + statusCounts.configured, color: '#15b881' },
            { label: 'Not Configured', value: statusCounts.unconfigured, color: '#9ca3af' },
            { label: 'Catalog Only', value: statusCounts.catalogOnly, color: '#6b7280' },
            { label: 'Disconnected', value: statusCounts.disconnected, color: '#dc2626' },
            { label: 'Total', value: health.total, color: '#1a2236' },
          ].map((stat) => (
            <div key={stat.label} style={{
              background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
              padding: '16px 20px',
            }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                {stat.label}
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, color: stat.color, fontVariantNumeric: 'tabular-nums' }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24, alignItems: 'center' }}>
        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>All</FilterButton>
        <FilterButton active={filter === 'connected'} onClick={() => setFilter('connected')}>Connected</FilterButton>
        <FilterButton active={filter === 'unconfigured'} onClick={() => setFilter('unconfigured')}>Not Set</FilterButton>
        <FilterButton active={filter === 'error'} onClick={() => setFilter('error')}>Errors</FilterButton>
        {categories.map((cat) => (
          <FilterButton key={cat} active={filter === cat} onClick={() => setFilter(cat)}>
            {cat}
          </FilterButton>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={fetchHealth}
          disabled={loading}
          style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 500,
            background: '#1a2236', color: '#fff', border: 'none', borderRadius: 6,
            cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Loading */}
      {loading && !health && (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
          Loading health data…
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: 16, background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 8, color: '#dc2626', marginBottom: 20, fontSize: 14,
        }}>
          {error}
          <button onClick={fetchHealth} style={{ marginLeft: 12, textDecoration: 'underline', background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      )}

      {/* Service grid */}
      {health && filteredServices.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 12,
        }}>
          {filteredServices.map((svc) => {
            const cfg = STATUS_CONFIG[svc.status] || STATUS_CONFIG.unconfigured;
            const category = CATEGORY_MAP[svc.service] || svc.service;
            return (
              <div key={svc.service} style={{
                background: '#fff', border: `1px solid ${cfg.border}`,
                borderRadius: 8, padding: '16px 20px',
                transition: 'box-shadow 0.15s',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2236', marginBottom: 2 }}>
                      {svc.name || svc.service}
                    </div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>
                      {category}
                      {svc.bucket && <span> · {svc.bucket}</span>}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 10px',
                    borderRadius: 100, color: cfg.color, background: cfg.bg,
                    border: `1px solid ${cfg.border}`,
                  }}>
                    {cfg.label}
                  </span>
                </div>
                {svc.scopes && svc.scopes.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', marginBottom: 4 }}>Scopes</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {svc.scopes.map((s) => (
                        <code key={s} style={{
                          fontSize: 10, padding: '2px 6px', background: '#f3f4f6',
                          borderRadius: 4, color: '#4b5563', fontFamily: 'SF Mono, Menlo, monospace',
                          maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {s}
                        </code>
                      ))}
                    </div>
                  </div>
                )}
                {svc.error && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#dc2626', background: '#fef2f2', padding: '4px 8px', borderRadius: 4 }}>
                    {svc.error}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {health && filteredServices.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af', fontSize: 15 }}>
          No services match the selected filter.
        </div>
      )}
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px', fontSize: 13, fontWeight: 500,
        background: active ? '#1a2236' : '#fff',
        color: active ? '#fff' : '#4b5563',
        border: `1px solid ${active ? '#1a2236' : '#d1d5db'}`,
        borderRadius: 6, cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}