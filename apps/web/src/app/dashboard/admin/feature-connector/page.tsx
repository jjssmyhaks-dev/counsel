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

interface MCPInfo {
  name: string;
  port: number;
  category: string;
  status: 'running' | 'stopped' | 'checking';
}

const MCP_DEFS: { name: string; port: number; category: string }[] = [
  { name: 'Postgres DB', port: 5001, category: 'Data' },
  { name: 'Cloudflare AI', port: 5002, category: 'AI' },
  { name: 'Document Intelligence', port: 5003, category: 'Documents' },
  { name: 'Email Service', port: 5004, category: 'Communication' },
  { name: 'Calendar', port: 5005, category: 'Productivity' },
  { name: 'Storage (R2)', port: 5006, category: 'Storage' },
  { name: 'E-Signature', port: 5007, category: 'E-Signature' },
  { name: 'Billing', port: 5008, category: 'Billing' },
  { name: 'Court Records', port: 5009, category: 'Legal' },
  { name: 'Workflow Engine', port: 5010, category: 'Workflow' },
  { name: 'Communication', port: 5011, category: 'Communication' },
  { name: 'CRM', port: 5012, category: 'CRM' },
  { name: 'OCR Engine', port: 5013, category: 'Documents' },
  { name: 'Translation', port: 5014, category: 'AI' },
  { name: 'Video Processing', port: 5015, category: 'AI' },
  { name: 'Time Tracking', port: 5016, category: 'Productivity' },
  { name: 'Conflict Checker', port: 5017, category: 'Legal' },
];

const CAT_COLORS: Record<string, string> = {
  Legal: '#7a9a6e', AI: '#4a7a8e', Communication: '#c46b3c',
  Data: '#1a2236', Storage: '#e0914a', 'E-Signature': '#8b5e3c',
  CRM: '#5c7a6e', Billing: '#6e4a3c', Productivity: '#4a6e5c',
  Documents: '#6e6e4a', Workflow: '#7a4a6e',
};

export default function FeatureConnectorPage() {
  const [health, setHealth] = useState<HealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [mcpStatus, setMcpStatus] = useState<MCPInfo[]>(() =>
    MCP_DEFS.map(d => ({ ...d, status: 'checking' as const }))
  );
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectionMsg, setConnectionMsg] = useState('');

  const fetchHealth = useCallback(async () => {
    try {
      setLoading(true);
      // Real integration health from API
      const data = await api.get<HealthSnapshot>('/integrations/health');
      setHealth(data);

      // Real MCP port checks (5001-5017 from scripts/start-mcp-servers.cjs)
      const updatedMCP = await Promise.all(
        MCP_DEFS.map(async (d) => {
          try {
            const resp = await fetch('http://localhost:' + d.port + '/health', {
              signal: AbortSignal.timeout(2000),
            });
            const s: 'running' | 'stopped' = resp.ok ? 'running' : 'stopped';
            return { name: d.name, port: d.port, category: d.category, status: s };
          } catch {
            const s2: 'running' | 'stopped' = 'stopped';
            return { name: d.name, port: d.port, category: d.category, status: s2 };
          }
        }),
      );
      setMcpStatus(updatedMCP);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load integrations');
    } finally {
      setLoading(false);
      setChecked(true);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  async function handleConnect(provider: string) {
    setConnecting(provider);
    setConnectionMsg('');
    try {
      const data: any = await api.get('/integrations/' + provider + '/auth-url');
      if (data.url) {
        window.open(data.url, '_blank', 'width=600,height=700');
        setConnectionMsg('Authorization window opened. Complete login there then refresh.');
      }
    } catch (err: any) {
      setConnectionMsg('Failed: ' + (err.message || 'Unknown error'));
    }
    setConnecting(null);
  }

  async function handleDisconnect(provider: string) {
    setConnecting(provider);
    try {
      await api.post('/integrations/' + provider + '/disconnect', {});
      setConnectionMsg('Disconnected. Refresh to see updated status.');
      fetchHealth();
    } catch (err: any) {
      setConnectionMsg('Failed: ' + (err.message || 'Unknown error'));
    }
    setConnecting(null);
  }

  const runningMCP = mcpStatus.filter(m => m.status === 'running').length;
  const stoppedMCP = mcpStatus.filter(m => m.status === 'stopped').length;

  return (
    <div style={{
      maxWidth: 1200, margin: '0 auto', padding: '32px 24px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: '#faf8f5', minHeight: '100vh',
    }}>
      <div style={{ marginBottom: 32, borderBottom: '2px solid #d4c5b0', paddingBottom: 20 }}>
        <h1 style={{ fontSize: 30, fontWeight: 700, color: '#1a2236', margin: 0, letterSpacing: '-0.02em' }}>
          Connector
        </h1>
        <p style={{ fontSize: 14, color: '#7a6e5e', margin: '6px 0 0' }}>
          Real-time infrastructure map — live port checks + API-driven integration status.
          {checked && <span style={{ marginLeft: 12, fontSize: 12, color: '#c46b3c' }}>Last checked: {new Date().toLocaleTimeString()}</span>}
        </p>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#7a6e5e' }}>Checking live ports and integrations...</div>
      )}

      {connectionMsg && (
        <div style={{
          padding: '10px 16px', marginBottom: 20, borderRadius: 10, fontSize: 13,
          background: connectionMsg.includes('Failed') ? '#fdf0ee' : '#eaf7f0',
          border: '1px solid ' + (connectionMsg.includes('Failed') ? '#e8c4b8' : '#c4d4b8'),
          color: '#1a2236',
        }}>
          {connectionMsg}
          <button onClick={() => setConnectionMsg('')} style={{ marginLeft: 12, background: 'none', border: 'none', color: '#c46b3c', cursor: 'pointer', fontWeight: 600 }}>Dismiss</button>
        </div>
      )}

      {error && (
        <div style={{ padding: 16, background: '#fdf0ee', border: '1px solid #e8c4b8', borderRadius: 10, color: '#c26a4a', marginBottom: 20 }}>
          {error}
          <button onClick={fetchHealth} style={{ marginLeft: 12, textDecoration: 'underline', background: 'none', border: 'none', color: '#c46b3c', cursor: 'pointer', fontWeight: 600 }}>Retry</button>
        </div>
      )}

      {/* Stats bar */}
      {health && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10, marginBottom: 28,
        }}>
          {[
            { label: 'Integrations', value: health.total, color: '#1a2236' },
            { label: 'Connected', value: health.connected + health.configured, color: '#7a9a6e' },
            { label: 'MCP Running', value: runningMCP, color: '#c46b3c' },
            { label: 'MCP Stopped', value: stoppedMCP, color: stoppedMCP > 0 ? '#c26a4a' : '#9ca3af' },
          ].map(stat => (
            <div key={stat.label} style={{
              background: '#fff', border: '1px solid #d4c5b0', borderRadius: 10,
              padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#7a6e5e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: stat.color, marginTop: 2 }}>{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* MCP Servers — real port checks */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a2236', marginBottom: 16 }}>
          MCP Servers — Real Port Checks (5001–5017)
        </h2>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 10,
        }}>
          {mcpStatus.map(mcp => {
            const catColor = CAT_COLORS[mcp.category] || '#7a6e5e';
            const isUp = mcp.status === 'running';
            const isChecking = mcp.status === 'checking';
            return (
              <div key={mcp.port} style={{
                background: '#fff',
                border: '1px solid ' + (isUp ? '#c4d4b8' : isChecking ? '#e0d8cc' : '#e8d0c4'),
                borderRadius: 10, padding: '12px 14px',
                boxShadow: isUp ? '0 4px 16px rgba(122,154,110,0.12)' : '0 1px 4px rgba(0,0,0,0.02)',
                cursor: 'pointer',
              }} onClick={() => setExpanded(expanded === mcp.name ? null : mcp.name)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2236' }}>{mcp.name}</div>
                    <div style={{ fontSize: 11, color: '#7a6e5e' }}>
                      localhost:{mcp.port} · <span style={{ color: catColor }}>{mcp.category}</span>
                    </div>
                  </div>
                  <span style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: isUp ? '#7a9a6e' : isChecking ? '#9ca3af' : '#c26a4a',
                    boxShadow: isUp ? '0 0 8px ' + catColor + '80' : 'none',
                    flexShrink: 0, transition: 'background 0.3s',
                  }}>
                    {isChecking && <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#9ca3af', animation: 'pulse 1s infinite' }} />}
                  </span>
                </div>
                {expanded === mcp.name && (
                  <div style={{ marginTop: 8, padding: '8px 10px', background: '#f9f6f0', borderRadius: 8, fontSize: 11, color: '#5a4e3e' }}>
                    <div>Status: <strong style={{ color: isUp ? '#7a9a6e' : isChecking ? '#9ca3af' : '#c26a4a' }}>{mcp.status}</strong></div>
                    <div style={{ marginTop: 2 }}>Endpoint: http://localhost:{mcp.port}/health</div>
                    {isUp && <div style={{ color: '#7a9a6e', marginTop: 2 }}>Responded to health check</div>}
                    {!isUp && !isChecking && <div style={{ color: '#c26a4a', marginTop: 2 }}>Not responding — run: node scripts/start-mcp-servers.cjs</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* External Integrations — real API data */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a2236', marginBottom: 16 }}>
          External Integrations — Live Status
        </h2>
        {health && health.services.length > 0 ? (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 10,
          }}>
            {health.services.map(svc => {
              const isGood = svc.status === 'connected' || svc.status === 'configured';
              const isConnectable = svc.provider && svc.status !== 'connected';
              const isDisconnectable = svc.provider && svc.status === 'connected';
              const svcName = svc.name || svc.service;

              return (
                <div key={svc.service} style={{
                  background: '#fff',
                  border: '1px solid ' + (isGood ? '#c4d4b8' : '#e0d8cc'),
                  borderRadius: 10, padding: '12px 14px',
                  boxShadow: isGood ? '0 2px 10px rgba(122,154,110,0.08)' : '0 1px 4px rgba(0,0,0,0.02)',
                  cursor: 'pointer',
                }} onClick={() => setExpanded(expanded === svc.service ? null : svc.service)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2236' }}>{svcName}</div>
                      <div style={{ fontSize: 11, color: '#7a6e5e', marginTop: 2 }}>
                        {svc.status === 'connected' ? 'Connected' :
                         svc.status === 'configured' ? 'Configured (API key set)' :
                         svc.status === 'catalog_only' ? 'Available' :
                         svc.status.replace(/_/g, ' ')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {isConnectable && (
                        <button onClick={e => { e.stopPropagation(); handleConnect(svc.provider!); }}
                          disabled={connecting === svc.provider}
                          style={{
                            padding: '4px 12px', fontSize: 11, fontWeight: 600,
                            background: connecting === svc.provider ? '#9ca3af' : '#1a2236',
                            color: '#fff', border: 'none', borderRadius: 6,
                            cursor: connecting === svc.provider ? 'default' : 'pointer',
                          }}>
                          {connecting === svc.provider ? '...' : 'Connect'}
                        </button>
                      )}
                      {isDisconnectable && (
                        <button onClick={e => { e.stopPropagation(); handleDisconnect(svc.provider!); }}
                          disabled={connecting === svc.provider}
                          style={{
                            padding: '4px 12px', fontSize: 11, fontWeight: 600,
                            background: '#fdf0ee', color: '#c26a4a', border: '1px solid #e8c4b8',
                            borderRadius: 6, cursor: connecting === svc.provider ? 'default' : 'pointer',
                          }}>
                          Disconnect
                        </button>
                      )}
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: svc.status === 'connected' ? '#7a9a6e' : svc.status === 'configured' ? '#4a7a8e' : svc.status === 'disconnected' ? '#c26a4a' : '#9ca3af',
                        flexShrink: 0,
                      }} />
                    </div>
                  </div>
                  {expanded === svc.service && (
                    <div style={{ marginTop: 8, padding: '8px 10px', background: '#f9f6f0', borderRadius: 8, fontSize: 11, color: '#5a4e3e' }}>
                      {svc.provider && <div>Provider: {svc.provider}</div>}
                      {svc.scopes && svc.scopes.length > 0 && <div style={{ marginTop: 2 }}>Scopes: {svc.scopes.slice(0, 4).join(', ')}{svc.scopes.length > 4 ? '...' : ''}</div>}
                      {svc.error && <div style={{ color: '#c26a4a', marginTop: 2 }}>{svc.error}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: '#7a6e5e' }}>
            No integration data received. Check your API connection and refresh.
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', padding: '20px 0 40px' }}>
        <button onClick={fetchHealth} disabled={loading} style={{
          padding: '10px 24px', fontSize: 13, fontWeight: 600,
          background: '#1a2236', color: '#faf8f5', border: 'none', borderRadius: 8,
          cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
        }}>
          {loading ? 'Checking...' : 'Refresh'}
        </button>
      </div>
    </div>
  );
}
