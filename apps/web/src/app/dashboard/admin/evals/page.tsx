'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface ToolStat {
  tool: string;
  calls: number;
  successes: number;
  failures: number;
  successRate: number;
  explicitPositive: number;
  explicitNegative: number;
  satisfactionRate: number;
  avgScore: number;
}

interface EvalReport {
  period: string;
  totalEvaluations: number;
  totalFeedback: number;
  feedbackBreakdown: { positive: number; negative: number; implicit: number };
  dimensionAverages: Record<string, number>;
  toolStats: ToolStat[];
}

interface Regression {
  type: string;
  tool?: string;
  recentAvg: number;
  baselineAvg: number;
  regressionPct: number;
}

interface FeedbackEntry {
  id: string;
  messageId: string;
  toolOrCrew: string;
  feedbackType: string;
  score: number;
  createdAt: string;
  user?: { name: string; email: string };
}

const DIMENSION_LABELS: Record<string, string> = {
  relevance: 'Relevance',
  completeness: 'Completeness',
  accuracy: 'Accuracy',
  safety: 'Safety',
  usability: 'Usability',
  latency: 'Latency',
};

const DIMENSION_COLORS: Record<string, string> = {
  relevance: '#15b881',
  completeness: '#0a8a5f',
  accuracy: '#7ce3b6',
  safety: '#f59e0b',
  usability: '#3b82f6',
  latency: '#8b5cf6',
};

export default function EvalsPage() {
  const [report, setReport] = useState<EvalReport | null>(null);
  const [regressions, setRegressions] = useState<Regression[]>([]);
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7');
  const [activeTab, setActiveTab] = useState<'overview' | 'tools' | 'feedback' | 'regressions'>('overview');

  useEffect(() => {
    fetchData();
  }, [period]);

  async function fetchData() {
    setLoading(true);
    try {
      const [reportData, regressionsData, feedbackData] = await Promise.all([
        api.get<EvalReport>(`/evals/report?days=${period}`),
        api.get<{ regressions: Regression[] }>('/evals/regressions'),
        api.get<{ feedback: FeedbackEntry[] }>('/evals/feedback?limit=100'),
      ]);
      setReport(reportData);
      setRegressions(regressionsData.regressions || []);
      setFeedback(feedbackData.feedback || []);
    } catch {
      // Silent — will show empty state
    }
    setLoading(false);
  }

  function scoreColor(score: number): string {
    if (score >= 0.8) return '#15b881';
    if (score >= 0.6) return '#f59e0b';
    return '#ef4444';
  }

  function scoreBar(score: number, max: number = 1) {
    const pct = Math.round((score / max) * 100);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: scoreColor(score), borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: scoreColor(score), minWidth: 36 }}>{(score * 100).toFixed(0)}%</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: '#7a6e5e' }}>Loading eval data...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0c0a09', fontFamily: 'Georgia, serif' }}>
            AI Quality Evals
          </h1>
          <p style={{ fontSize: 13, color: '#7a6e5e', marginTop: 4 }}>
            Monitor output quality, regressions, and tool performance
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, background: '#fff' }}
          >
            <option value="1">Last 24h</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <button onClick={fetchData} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer' }}>
            Refresh
          </button>
        </div>
      </div>

      {/* Regressions Alert */}
      {regressions.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 6 }}>
            ⚠️ {regressions.length} Quality Regression{regressions.length > 1 ? 's' : ''} Detected
          </div>
          {regressions.map((r, i) => (
            <div key={i} style={{ fontSize: 12, color: '#7f1d1d', marginTop: 4 }}>
              {r.type === 'overall_quality' ? 'Overall quality' : `Tool: ${r.tool}`} dropped {r.regressionPct}% — recent avg {(r.recentAvg * 100).toFixed(0)}% vs baseline {(r.baselineAvg * 100).toFixed(0)}%
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #e5e7eb', paddingBottom: 0 }}>
        {(['overview', 'tools', 'feedback', 'regressions'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: activeTab === tab ? '#15b881' : 'transparent',
              color: activeTab === tab ? '#fff' : '#6b7280',
              borderRadius: '6px 6px 0 0',
              textTransform: 'capitalize',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && report && (
        <div>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Total Evaluations</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#0c0a09' }}>{report.totalEvaluations}</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Total Feedback</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#0c0a09' }}>{report.totalFeedback}</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Positive Feedback</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#15b881' }}>{report.feedbackBreakdown.positive}</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Negative Feedback</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#ef4444' }}>{report.feedbackBreakdown.negative}</div>
            </div>
          </div>

          {/* Dimension Averages */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#0c0a09', marginBottom: 16 }}>Quality Dimensions</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {Object.entries(report.dimensionAverages).map(([dim, score]) => (
                <div key={dim}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: DIMENSION_COLORS[dim] || '#9ca3af', marginRight: 6 }} />
                    {DIMENSION_LABELS[dim] || dim}
                  </div>
                  {scoreBar(score)}
                </div>
              ))}
            </div>
          </div>

          {/* Tool Performance Summary */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#0c0a09', marginBottom: 12 }}>Tool Performance</h3>
            {report.toolStats.length === 0 ? (
              <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: 20 }}>No tool data yet. Use the chat to generate eval data.</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {report.toolStats.slice(0, 10).map((t) => (
                  <div key={t.tool} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 100px', alignItems: 'center', padding: '8px 12px', background: '#f9fafb', borderRadius: 6, fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: '#1a2236' }}>{t.tool}</span>
                    <span style={{ color: '#6b7280' }}>{t.calls} calls</span>
                    <span style={{ color: '#15b881' }}>{(t.successRate * 100).toFixed(0)}% success</span>
                    <span style={{ color: t.satisfactionRate >= 0.7 ? '#15b881' : '#f59e0b' }}>
                      {(t.satisfactionRate * 100).toFixed(0)}% satisfied
                    </span>
                    <div>{scoreBar(t.avgScore)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tools Tab */}
      {activeTab === 'tools' && report && (
        <div style={{ display: 'grid', gap: 12 }}>
          {report.toolStats.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 40, textAlign: 'center', color: '#9ca3af' }}>
              No tool data yet. Use the chat to generate eval data.
            </div>
          ) : (
            report.toolStats.map((t) => (
              <div key={t.tool} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: '#0c0a09' }}>{t.tool}</h4>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{t.calls} total calls</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Success Rate</div>
                    {scoreBar(t.successRate)}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Satisfaction</div>
                    {scoreBar(t.satisfactionRate)}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Avg Score</div>
                    {scoreBar(t.avgScore)}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Feedback</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      <span style={{ color: '#15b881' }}>👍 {t.explicitPositive}</span>
                      <span style={{ color: '#9ca3af', margin: '0 6px' }}>|</span>
                      <span style={{ color: '#ef4444' }}>👎 {t.explicitNegative}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Feedback Tab */}
      {activeTab === 'feedback' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#0c0a09', marginBottom: 12 }}>Recent Feedback</h3>
          {feedback.length === 0 ? (
            <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: 20 }}>No feedback yet. Users can click 👍/👎 on chat responses.</div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {feedback.map((f) => (
                <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 120px 100px 140px', alignItems: 'center', padding: '8px 12px', background: '#f9fafb', borderRadius: 6, fontSize: 13 }}>
                  <span style={{ fontSize: 16 }}>{f.feedbackType === 'explicit_positive' ? '👍' : '👎'}</span>
                  <span style={{ color: '#1a2236', fontWeight: 500 }}>{f.toolOrCrew}</span>
                  <span style={{ color: '#6b7280' }}>{f.user?.name || 'Anonymous'}</span>
                  <span style={{ color: f.score > 0 ? '#15b881' : '#ef4444', fontWeight: 600 }}>
                    {f.score > 0 ? '+' : ''}{f.score.toFixed(1)}
                  </span>
                  <span style={{ color: '#9ca3af', fontSize: 12 }}>{new Date(f.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Regressions Tab */}
      {activeTab === 'regressions' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#0c0a09', marginBottom: 12 }}>Regression Detection</h3>
          {regressions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
              <div style={{ fontSize: 14, color: '#15b881', fontWeight: 600 }}>No regressions detected</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Quality is stable or improving compared to baseline</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {regressions.map((r, i) => (
                <div key={i} style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626' }}>
                    {r.type === 'overall_quality' ? 'Overall Quality Regression' : `Tool: ${r.tool}`}
                  </div>
                  <div style={{ fontSize: 12, color: '#7f1d1d', marginTop: 4 }}>
                    Recent: {(r.recentAvg * 100).toFixed(1)}% → Baseline: {(r.baselineAvg * 100).toFixed(1)}% ({r.regressionPct}% drop)
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
