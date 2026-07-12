'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { mockGetResearchBrief } from '@/lib/api';
import type { ResearchBrief } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Spinner } from '@/components/ui/spinner';

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StatusBadgeUI({ status }: { status: ResearchBrief['status'] }) {
  const variant = status === 'pending' ? 'warning' : status === 'researching' ? 'info' : status === 'completed' ? 'success' : 'danger';
  const label = status === 'researching' ? 'Processing' : status.charAt(0).toUpperCase() + status.slice(1);
  return <Badge variant={variant} dot>{label}</Badge>;
}

interface Finding {
  statement: string;
  confidence: number;
  citations: { documentTitle: string; section: string; excerpt: string }[];
}

interface DetailedBrief extends ResearchBrief {
  findingsList?: Finding[];
  openQuestions?: string[];
  sourceDocuments?: { id: string; title: string; type: string }[];
}

function getMockDetailedBrief(id: string): DetailedBrief {
  return {
    id,
    title: 'Delaware Merger Agreement Precedent Review',
    query: 'Recent Delaware case law on indemnification caps in merger agreements and enforceability of non-compete provisions exceeding 3 years',
    status: 'completed',
    matterId: 'matter-001',
    matterName: 'In re Quantum Dynamics Merger',
    sources: ['Del. Ch. C.A. No. 2025-0923', 'ABA M&A Committee Report 2026', 'Practical Law — Indemnification Caps Survey'],
    findings: 'Research identified 12 relevant Delaware Chancery Court decisions from 2024-2026. The prevailing trend supports enforceability of indemnification caps tied to a percentage of purchase price, with courts generally upholding caps in the range of 10-20%. Non-compete provisions exceeding 3 years face increased judicial scrutiny.',
    requestedBy: 'user-001',
    createdAt: '2026-07-10T16:00:00Z',
    updatedAt: '2026-07-10T16:45:00Z',
    findingsList: [
      {
        statement:
          'Delaware courts consistently enforce indemnification caps that are tied to a percentage of purchase price (typically 10-20%) when the cap is negotiated between sophisticated parties at arms\' length.',
        confidence: 92,
        citations: [
          {
            documentTitle: 'ABA M&A Committee Report 2026',
            section: '§ 4.3 — Indemnification Limitations',
            excerpt:
              'Survey of 175 M&A transactions in 2025 found that 89% included indemnification caps ranging from 10-20% of purchase price, with a median of 15%.',
          },
          {
            documentTitle: 'Practical Law — Indemnification Caps Survey',
            section: 'Delaware Trends',
            excerpt:
              'Delaware Court of Chancery has upheld indemnification caps as low as 10% in at least seven published opinions since 2024.',
          },
        ],
      },
      {
        statement:
          'Basket/deductible thresholds are now market standard, with 1% of purchase price being the most common threshold for general representations.',
        confidence: 88,
        citations: [
          {
            documentTitle: 'ABA M&A Committee Report 2026',
            section: '§ 4.4 — Basket Thresholds',
            excerpt:
              '72% of transactions surveyed included a deductible basket threshold, with 1% being the most common level.',
          },
        ],
      },
      {
        statement:
          'Non-compete provisions exceeding 3 years in duration face increased judicial scrutiny in Delaware, particularly when the restricted party is an individual rather than an entity.',
        confidence: 85,
        citations: [
          {
            documentTitle: 'Del. Ch. C.A. No. 2025-0923',
            section: 'Opinion at 14-18',
            excerpt:
              'The Court found that a 5-year non-compete imposed on individual selling shareholders was unreasonable in duration, noting that "Delaware courts have consistently viewed non-competes of more than three years with disfavor."',
          },
          {
            documentTitle: 'Practical Law — Indemnification Caps Survey',
            section: 'Restrictive Covenants in M&A',
            excerpt:
              'Post-2024, Delaware courts have applied heightened scrutiny to non-competes exceeding 3 years, particularly where the selling shareholder is a natural person.',
          },
        ],
      },
      {
        statement:
          'Survival periods for general representations typically range from 12-18 months. Courts have enforced shorter survival periods where clearly negotiated, but a minimum of 12 months is market standard.',
        confidence: 79,
        citations: [
          {
            documentTitle: 'ABA M&A Committee Report 2026',
            section: '§ 4.2 — Survival Periods',
            excerpt:
              'The median survival period for general representations was 12 months. Only 8% of transactions had survival periods shorter than 12 months.',
          },
          {
            documentTitle: 'Del. Ch. C.A. No. 2025-0923',
            section: 'Opinion at 9-10',
            excerpt:
              'The Court noted that while parties are free to negotiate shorter survival periods, the standard expectation in M&A practice is a 12-month survival period.',
          },
        ],
      },
      {
        statement:
          '"Sandbagging" provisions (allowing buyer to seek indemnification for breaches known at closing) remain a point of active negotiation, with approximately equal split between pro-sandbagging and anti-sandbagging provisions.',
        confidence: 73,
        citations: [
          {
            documentTitle: 'ABA M&A Committee Report 2026',
            section: '§ 4.7 — Sandbagging Provisions',
            excerpt:
              'The 2025 survey showed a near-even split: 52% pro-sandbagging, 48% anti-sandbagging. Delaware law defaults to anti-sandbagging unless the agreement expressly provides otherwise.',
          },
        ],
      },
      {
        statement:
          'Fraud carve-outs from indemnification caps are now nearly universal and Delaware courts will enforce them, emphasizing that public policy prevents contractual limitations on fraud liability.',
        confidence: 95,
        citations: [
          {
            documentTitle: 'Practical Law — Indemnification Caps Survey',
            section: 'Fraud Carve-outs',
            excerpt:
              '100% of surveyed transactions with indemnification caps included a fraud carve-out. Delaware courts have consistently held that fraud cannot be disclaimed by contract as a matter of public policy.',
          },
        ],
      },
    ],
    openQuestions: [
      'Whether the proposed 15% cap would be enforceable in the context of this specific transaction given the seller is a private equity fund with limited ongoing operations.',
      'How the "bringing-down" of representations at closing interacts with the survival period analysis under Delaware law.',
      'Whether a "double materiality" scrape is needed to avoid circularity in the bring-down condition.',
      'Interaction between R&W insurance and the need for a survival period in the acquisition agreement.',
      'Whether a separate indemnification scheme for tax matters is advisable given the cross-border nature of the transaction.',
    ],
    sourceDocuments: [
      { id: 'doc-101', title: 'Del. Ch. C.A. No. 2025-0923 — Opinion', type: 'Legal Opinion' },
      { id: 'doc-102', title: 'ABA M&A Committee Report 2026', type: 'Industry Report' },
      { id: 'doc-103', title: 'Practical Law — Indemnification Caps Survey', type: 'Legal Research' },
      { id: 'doc-104', title: 'Del. Ch. C.A. No. 2024-0781 — Bench Ruling', type: 'Legal Opinion' },
      { id: 'doc-105', title: 'ABA Deal Points Study 2025', type: 'Industry Study' },
      { id: 'doc-106', title: 'Restatement (Third) of Torts § 12 — Fraud Carve-outs', type: 'Legal Authority' },
    ],
  };
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-emerald-500' : value >= 60 ? 'bg-amber-500' : value >= 40 ? 'bg-orange-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-500 w-8 text-right">{value}%</span>
    </div>
  );
}

export default function ResearchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const briefId = params.id as string;

  const [brief, setBrief] = useState<DetailedBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { loadBrief(); }, [briefId]);

  async function loadBrief() {
    setLoading(true);
    setError('');
    try {
      // Try API first, then use mock data
      const data = mockGetResearchBrief(briefId);
      const detailed = getMockDetailedBrief(briefId);
      setBrief(detailed);
    } catch {
      // Fallback to mock detail
      setBrief(getMockDetailedBrief(briefId));
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" label="Loading research brief..." />
      </div>
    );
  }

  if (error && !brief) {
    return <ErrorState message={error} onRetry={loadBrief} />;
  }

  if (!brief) {
    return <ErrorState message="Research brief not found." onRetry={loadBrief} />;
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <button onClick={() => router.push('/research')} className="hover:text-blue-600 transition-colors">
          Research
        </button>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-slate-700 font-medium truncate">{brief.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="page-header !mb-0">
          <h1>{brief.title}</h1>
          <div className="flex items-center gap-3 mt-2">
            <p className="text-sm text-slate-500">{brief.matterName}</p>
            <span className="text-slate-300">·</span>
            <StatusBadgeUI status={brief.status} />
            <span className="text-slate-300">·</span>
            <span className="text-xs text-slate-400">{formatDate(brief.createdAt)}</span>
          </div>
        </div>
        <Button variant="secondary" onClick={() => router.push('/research')}>
          ← Back to Research
        </Button>
      </div>

      {/* Research Query Card */}
      <Card className="bg-blue-50/50 border-blue-200">
        <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">Research Query</h3>
        <p className="text-sm text-slate-800">{brief.query}</p>
      </Card>

      {/* Findings */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Findings</h2>
        {brief.findingsList && brief.findingsList.length > 0 ? (
          <div className="space-y-4">
            {brief.findingsList.map((finding, i) => (
              <Card key={i}>
                <div className="space-y-3">
                  {/* Statement */}
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </span>
                    <div className="flex-1 space-y-2">
                      <p className="text-sm text-slate-800 leading-relaxed">{finding.statement}</p>
                      <ConfidenceBar value={finding.confidence} />
                    </div>
                  </div>

                  {/* Citations */}
                  {finding.citations.length > 0 && (
                    <div className="ml-10 space-y-2 mt-2">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sources</h4>
                      {finding.citations.map((cite, j) => (
                        <div key={j} className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                          <p className="text-xs font-medium text-slate-700">{cite.documentTitle}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{cite.section}</p>
                          <p className="text-xs text-slate-500 italic mt-1 line-clamp-2">&ldquo;{cite.excerpt}&rdquo;</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <p className="text-sm text-slate-500">No findings available yet. Research may still be in progress.</p>
          </Card>
        )}
      </div>

      {/* Open Questions */}
      {brief.openQuestions && brief.openQuestions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Open Questions</h2>
          <Card>
            <ol className="list-decimal list-inside space-y-2">
              {brief.openQuestions.map((q, i) => (
                <li key={i} className="text-sm text-slate-700 leading-relaxed pl-2">{q}</li>
              ))}
            </ol>
          </Card>
        </div>
      )}

      {/* Source Documents */}
      {brief.sourceDocuments && brief.sourceDocuments.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Source Documents</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {brief.sourceDocuments.map((doc, i) => (
              <div key={i} className="flex items-center gap-3 bg-white rounded-lg border border-slate-200 p-3">
                <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{doc.title}</p>
                  <p className="text-xs text-slate-500">{doc.type}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No findings empty state */}
      {!brief.findingsList && !brief.findings && (
        <Card className="text-center py-16">
          <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">
            {brief.status === 'researching' ? 'Research in Progress' : 'No Findings Yet'}
          </h3>
          <p className="text-sm text-slate-500">
            {brief.status === 'researching'
              ? 'The AI is currently analyzing your query and searching through firm documents.'
              : brief.status === 'failed'
              ? 'This research query failed to complete. Try re-running the research.'
              : 'This research brief is pending review.'}
          </p>
        </Card>
      )}
    </div>
  );
}
