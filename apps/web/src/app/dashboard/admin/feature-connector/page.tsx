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
  authUrl?: string;
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
  tools: number;
  category: string;
  status: 'running' | 'stopped' | 'unknown';
  icon: string;
}

const MCP_SERVERS: MCPInfo[] = [
  { name: 'Postgres DB', port: 5001, tools: 8, category: 'Data', status: 'unknown', icon: '\uD83D\uDCC4' },
  { name: 'Cloudflare AI', port: 5002, tools: 4, category: 'AI', status: 'unknown', icon: '\u2601\uFE0F' },
  { name: 'Document Intelligence', port: 5003, tools: 6, category: 'Legal AI', status: 'unknown', icon: '\uD83D\uDCC4' },
  { name: 'Email Service', port: 5004, tools: 5, category: 'Communication', status: 'unknown', icon: '\uD83D\uDCE7' },
  { name: 'Calendar', port: 5005, tools: 4, category: 'Productivity', status: 'unknown', icon: '\uD83D\uDCC5' },
  { name: 'Storage (R2)', port: 5006, tools: 4, category: 'Storage', status: 'unknown', icon: '\uD83D\uDCE6' },
  { name: 'E-Signature', port: 5007, tools: 5, category: 'E-Signature', status: 'unknown', icon: '\u270D\uFE0F' },
  { name: 'Billing', port: 5008, tools: 5, category: 'Billing', status: 'unknown', icon: '\uD83D\uDCB0' },
  { name: 'Court Records', port: 5009, tools: 4, category: 'Legal AI', status: 'unknown', icon: '\uD83C\uDFDB\uFE0F' },
  { name: 'Workflow Engine', port: 5010, tools: 5, category: 'Workflow', status: 'unknown', icon: '\u2699\uFE0F' },
  { name: 'Communication', port: 5011, tools: 5, category: 'Communication', status: 'unknown', icon: '\uD83D\uDCAC' },
  { name: 'CRM', port: 5012, tools: 5, category: 'CRM', status: 'unknown', icon: '\uD83E\uDD1D' },
  { name: 'OCR Engine', port: 5013, tools: 3, category: 'Document', status: 'unknown', icon: '\uD83D\uDC41\uFE0F' },
  { name: 'Translation', port: 5014, tools: 4, category: 'Intelligence', status: 'unknown', icon: '\uD83C\uDF10' },
  { name: 'Video Processing', port: 5015, tools: 4, category: 'Intelligence', status: 'unknown', icon: '\uD83C\uDFA5' },
  { name: 'Time Tracking', port: 5016, tools: 4, category: 'Productivity', status: 'unknown', icon: '\u23F1\uFE0F' },
  { name: 'Conflict Checker', port: 5017, tools: 3, category: 'Legal AI', status: 'unknown', icon: '\u2696\uFE0F' },
];

const CATEGORY_COLORS: Record<string, string> = {
  'Legal AI': '#7a9a6e',
  'AI': '#4a7a8e',
  'Communication': '#c46b3c',
  'Data': '#1a2236',
  'Storage': '#e0914a',
  'E-Signature': '#8b5e3c',
  'CRM': '#5c7a6e',
  'Billing': '#6e4a3c',
  'Productivity': '#4a6e5c',
  'Intelligence': '#3c5a7a',
  'Document': '#6e6e4a',
  'Workflow': '#7a4a6e',
};

export default function FeatureConnectorPage() {
  const [health, setHealth] = useState<HealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [mcpStatus, setMcpStatus] = useState<MCPInfo[]>(MCP_SERVERS);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectionMsg, setConnectionMsg] = useState('');

  const fetchHealth = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<HealthSnapshot>('/integrations/health');
      setHealth(data);

      // Check MCP ports (5001-5017 as defined in scripts/start-mcp-servers.cjs)
      const updatedMCP = await Promise.all(
        MCP_SERVERS.map(async (mcp) => {
          try {
            const resp = await fetch('http://localhost:' + mcp.port + '/health', { signal: AbortSignal.timeout(2000) });
            return { ...mcp, status: resp.ok ? ('running' as const) : ('stopped' as const) };
          } catch {
            return { ...mcp, status: 'stopped' as const };
          }
        }),
      );
      setMcpStatus(updatedMCP);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
      setChecked(true);
    }
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  async function handleConnect(provider: string) {
    setConnecting(provider);
    setConnectionMsg('');
    try {
      const data: any = await api.get('/integrations/' + provider + '/auth-url');
      if (data.url) {
        window.open(data.url, '_blank', 'width=600,height=700');
        setConnectionMsg('Authorization window opened. Complete the login there.');
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
      setConnectionMsg('Disconnected!');
      fetchHealth();
    } catch (err: any) {
      setConnectionMsg('Failed: ' + (err.message || 'Unknown error'));
    }
    setConnecting(null);
  }

  const runningMCP = mcpStatus.filter((m) => m.status === 'running').length;
  const stoppedMCP = mcpStatus.filter((m) => m.status === 'stopped').length;

  return (
    <div style={{
      maxWidth: 1200, margin: '0 auto', padding: '32px 24px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: '#faf8f5', minHeight: '100vh',
    }}>
      <div style={{ marginBottom: 32, borderBottom: '2px solid #d4c5b0', paddingBottom: 20 }}>
        <h1 style={{ fontSize: 30, fontWeight: 700, color: '#1a2236', margin: 0, letterSpacing: '-0.02em' }}>
          Feature Connector
        </h1>
        <p style={{ fontSize: 14, color: '#7a6e5e', margin: '6px 0 0' }}>
          Infrastructure map — every MCP server, integration, and API endpoint.
          {checked && <span style={{ marginLeft: 12, fontSize: 12, color: '#c46b3c' }}>Last checked: {new Date().toLocaleTimeString()}</span>}
        </p>
      </div>

      {/* Connection feedback */}
      {connectionMsg && (
        <div style={{ padding: '10px 16px', background: connectionMsg.includes('Failed') ? '#fdf0ee' : '#eaf7f0', border: '1px solid ' + (connectionMsg.includes('Failed') ? '#e8c4b8' : '#c4d4b8'), borderRadius: 10, marginBottom: 20, fontSize: 13, color: '#1a2236' }}>
          {connectionMsg}
          <button onClick={() => setConnectionMsg('')} style={{ marginLeft: 12, background: 'none', border: 'none', color: '#c46b3c', cursor: 'pointer', fontWeight: 600 }}>Dismiss</button>
        </div>
      )}

      {/* Stats */}
      {health && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10, marginBottom: 28,
        }}>
          {[
            { label: 'Integrations', value: health.total, color: '#1a2236' },
            { label: 'Connected/Configured', value: health.connected + health.configured, color: '#7a9a6e' },
            { label: 'MCP Running', value: runningMCP, color: '#c46b3c' },
            { label: 'MCP Stopped', value: stoppedMCP, color: stoppedMCP > 0 ? '#c26a4a' : '#9ca3af' },
            { label: 'Total Tools', value: mcpStatus.filter(m => m.status === 'running').reduce((s, m) => s + m.tools, 0), color: '#4a7a8e' },
          ].map((stat) => (
            <div key={stat.label} style={{
              background: '#fff', border: '1px solid #d4c5b0', borderRadius: 10,
              padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#7a6e5e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: stat.color, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#7a6e5e' }}>
          Mapping infrastructure…
        </div>
      )}

      {error && (
        <div style={{ padding: 16, background: '#fdf0ee', border: '1px solid #e8c4b8', borderRadius: 10, color: '#c26a4a', marginBottom: 20 }}>
          {error}
          <button onClick={fetchHealth} style={{ marginLeft: 12, textDecoration: 'underline', background: 'none', border: 'none', color: '#c46b3c', cursor: 'pointer', fontWeight: 600 }}>Retry</button>
        </div>
      )}

      {/* MCP Servers */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a2236', marginBottom: 16, letterSpacing: '-0.01em' }}>
          MCP Servers (Ports 5001-5017)
        </h2>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 12,
        }}>
          {mcpStatus.map((mcp) => {
            const catColor = CATEGORY_COLORS[mcp.category] || '#7a6e5e';
            return (
              <div key={mcp.port} style={{
                background: '#fff', border: '1px solid ' + (mcp.status === 'running' ? '#c4d4b8' : '#e0d8cc'),
                borderRadius: 10, padding: '14px 16px',
                boxShadow: mcp.status === 'running' ? '0 4px 16px rgba(122,154,110,0.12)' : '0 1px 4px rgba(0,0,0,0.03)',
                transition: 'box-shadow 0.2s',
                cursor: 'pointer',
              }}
                onClick={() => setExpanded(expanded === mcp.name ? null : mcp.name)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 24 }}>{mcp.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2236' }}>{mcp.name}</div>
                    <div style={{ fontSize: 11, color: '#7a6e5e' }}>:{mcp.port} · {mcp.tools} tools · <span style={{ color: catColor }}>{mcp.category}</span></div>
                  </div>
                  <span style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: mcp.status === 'running' ? '#7a9a6e' : mcp.status === 'stopped' ? '#c26a4a' : '#9ca3af',
                    boxShadow: mcp.status === 'running' ? '0 0 8px ' + catColor + '80' : 'none',
                    flexShrink: 0,
                  }} />
                </div>
                {expanded === mcp.name && (
                  <div style={{ marginTop: 10, padding: '10px 12px', background: '#f9f6f0', borderRadius: 8, fontSize: 12, color: '#5a4e3e' }}>
                    <div>Port: {mcp.port} · Status: <span style={{ fontWeight: 700, color: mcp.status === 'running' ? '#7a9a6e' : '#c26a4a' }}>{mcp.status}</span></div>
                    <div style={{ marginTop: 4 }}>Category: {mcp.category} · Tools: {mcp.tools}</div>
                    <div style={{ marginTop: 4, color: '#7a6e5e', fontSize: 10 }}>http://localhost:{mcp.port}/health</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* External Integrations */}
      {health && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a2236', marginBottom: 16, letterSpacing: '-0.01em' }}>
            External Integrations
          </h2>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 10,
          }}>
            {health.services.map((svc) => {
              const isGood = svc.status === 'connected' || svc.status === 'configured';
              const isConnectable = svc.provider && svc.status !== 'connected';
              const isDisconnectable = svc.provider && svc.status === 'connected';
              const svcName = svc.name || svc.service;

              return (
                <div key={svc.service} style={{
                  background: '#fff',
                  border: '1px solid ' + (isGood ? '#c4d4b8' : svc.status === 'disconnected' ? '#e8d0c4' : '#e0d8cc'),
                  borderRadius: 10, padding: '12px 14px',
                  boxShadow: isGood ? '0 2px 10px rgba(122,154,110,0.08)' : '0 1px 4px rgba(0,0,0,0.02)',
                  cursor: 'pointer',
                }}
                  onClick={() => setExpanded(expanded === svc.service ? null : svc.service)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2236' }}>{svcName}</div>
                      <div style={{ fontSize: 11, color: '#7a6e5e', marginTop: 2 }}>
                        {svc.status === 'connected' ? 'Connected' :
                         svc.status === 'configured' ? 'Configured (needs keys)' :
                         svc.status === 'catalog_only' ? 'Available to connect' :
                         svc.status.replace(/_/g, ' ')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {isConnectable && (
                        <button onClick={(e) => { e.stopPropagation(); handleConnect(svc.provider!); }}
                          disabled={connecting === svc.provider}
                          style={{
                            padding: '4px 10px', fontSize: 11, fontWeight: 600,
                            background: connecting === svc.provider ? '#9ca3af' : '#1a2236',
                            color: '#fff', border: 'none', borderRadius: 6,
                            cursor: connecting === svc.provider ? 'default' : 'pointer',
                          }}>
                          {connecting === svc.provider ? 'Connecting...' : 'Connect'}
                        </button>
                      )}
                      {isDisconnectable && (
                        <button onClick={(e) => { e.stopPropagation(); handleDisconnect(svc.provider!); }}
                          disabled={connecting === svc.provider}
                          style={{
                            padding: '4px 10px', fontSize: 11, fontWeight: 600,
                            background: '#fdf0ee', color: '#c26a4a', border: '1px solid #e8c4b8',
                            borderRadius: 6, cursor: connecting === svc.provider ? 'default' : 'pointer',
                          }}>
                          {connecting === svc.provider ? '...' : 'Disconnect'}
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
                      {svc.bucket && <div>Bucket: {svc.bucket}</div>}
                      {svc.scopes && svc.scopes.length > 0 && (
                        <div style={{ marginTop: 4 }}>Scopes: {svc.scopes.slice(0, 3).join(', ')}{svc.scopes.length > 3 ? '...' : ''}</div>
                      )}
                      {svc.error && <div style={{ color: '#c26a4a', marginTop: 4 }}>{svc.error}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Refresh */}
      <div style={{ textAlign: 'center', padding: '20px 0 40px' }}>
        <button onClick={fetchHealth} disabled={loading} style={{
          padding: '10px 24px', fontSize: 13, fontWeight: 600,
          background: '#1a2236', color: '#faf8f5', border: 'none', borderRadius: 8,
          cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
        }}>
          {loading ? 'Mapping...' : 'Refresh Map'}
        </button>
      </div>
    </div>
  );
}
