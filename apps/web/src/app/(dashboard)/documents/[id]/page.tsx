'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { mockGetDocument, mockGetAnalysis } from '@/lib/api';
import type { Document, Analysis, ClauseCard } from '@/lib/types';

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function RiskBadge({ level }: { level: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium risk-${level}`}>
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium status-${status}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function ClauseCardRow({ clause }: { clause: ClauseCard }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-slate-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">{clause.type}</span>
          <RiskBadge level={clause.riskLevel} />
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          {expanded ? 'Collapse' : 'View Details'}
        </button>
      </div>
      <p className="text-sm text-slate-600 mt-2 line-clamp-2 font-mono text-xs bg-slate-50 p-2 rounded">
        &ldquo;{clause.excerpt}&rdquo;
      </p>
      {expanded && (
        <div className="mt-3 space-y-3 pt-3 border-t border-slate-100">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Rationale</p>
            <p className="text-sm text-slate-700">{clause.rationale}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Suggested Edit</p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800">{clause.suggestedEdit}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [doc, setDoc] = useState<Document | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'analysis' | 'compare' | 'info'>('analysis');
  const [runningAnalysis, setRunningAnalysis] = useState(false);

  // Compare tab
  const [compareDoc, setCompareDoc] = useState('');
  const [compareResult, setCompareResult] = useState<{ similarities: string[]; differences: string[] } | null>(null);
  const [comparing, setComparing] = useState(false);

  const COMPARE_DOCS = [
    { id: 'doc-002', name: 'Evergreen - Patent Filing US2026-001234.pdf' },
    { id: 'doc-003', name: 'Brighton - Lease Agreement 2024.docx' },
    { id: 'doc-004', name: 'NovaTech - Data Processing Agreement.pdf' },
    { id: 'doc-005', name: 'Thompson - Settlement Agreement Draft.pdf' },
  ];

  useEffect(() => {
    loadDocument();
  }, [id]);

  async function loadDocument() {
    setLoading(true);
    setError('');
    try {
      const document = await mockGetDocument(id);
      setDoc(document);

      if (document.status === 'ready') {
        try {
          const a = await mockGetAnalysis(id);
          setAnalysis(a);
        } catch {
          // No analysis yet
        }
      }
    } catch {
      setError('Document not found.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRunAnalysis() {
    setRunningAnalysis(true);
    // Simulate analysis
    await new Promise((r) => setTimeout(r, 2000));
    if (doc) {
      try {
        const a = await mockGetAnalysis(doc.id);
        setAnalysis(a);
      } catch {
        // Still no analysis mock for this doc
      }
    }
    setRunningAnalysis(false);
  }

  async function handleCompare() {
    if (!compareDoc) return;
    setComparing(true);
    await new Promise((r) => setTimeout(r, 1500));
    setCompareResult({
      similarities: [
        'Both contain standard governing law provisions (Delaware/NY)',
        'Both include indemnification obligations with broad scope',
        'Both reference standard jurisdiction for dispute resolution',
      ],
      differences: [
        'Doc A has a 5-year non-compete vs Doc B has no non-compete',
        'Doc A includes a $5M termination fee; Doc B has no termination fee',
        'Doc A is a merger agreement; Doc B serves a different purpose',
        'Governance and board composition only in Doc A',
      ],
    });
    setComparing(false);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-64" />
        <div className="skeleton h-6 w-96" />
        <div className="skeleton h-12 w-full rounded-xl" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-32 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Document Not Found</h3>
        <p className="text-slate-500 text-sm mb-4">{error || 'The requested document could not be loaded.'}</p>
        <button
          onClick={() => router.push('/documents')}
          className="text-blue-600 hover:text-blue-700 font-medium text-sm"
        >
          ← Back to Documents
        </button>
      </div>
    );
  }

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: 'analysis', label: 'Analysis' },
    { key: 'compare', label: 'Compare' },
    { key: 'info', label: 'Info' },
  ];

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => router.push('/documents')}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium mb-2 inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Documents
        </button>
        <h1 className="text-2xl font-bold text-slate-900">{doc.name}</h1>
      </div>

      {/* Metadata bar */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {formatSize(doc.size)}
        </span>
        <span className="text-xs font-mono uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{doc.type}</span>
        <StatusBadge status={doc.status} />
        <span>{doc.uploaderName}</span>
        <span>{formatDate(doc.createdAt)}</span>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab: Analysis */}
      {activeTab === 'analysis' && (
        <div className="space-y-4">
          {analysis ? (
            <>
              {/* Overall risk */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">Risk Assessment</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-slate-500">Overall Risk:</span>
                      <RiskBadge level={analysis.overallRisk} />
                    </div>
                  </div>
                  <button
                    onClick={handleRunAnalysis}
                    disabled={runningAnalysis}
                    className="text-xs px-3 py-1.5 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50"
                  >
                    {runningAnalysis ? 'Running...' : 'Re-run Analysis'}
                  </button>
                </div>
                <p className="text-sm text-slate-600 mt-3 leading-relaxed">{analysis.summary}</p>
              </div>

              {/* Clause cards */}
              <div>
                <h3 className="font-semibold text-slate-900 mb-3">
                  Clauses ({analysis.clauses.length})
                </h3>
                <div className="space-y-3">
                  {analysis.clauses.map((clause) => (
                    <ClauseCardRow key={clause.id} clause={clause} />
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* No analysis yet */
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No Analysis Yet</h3>
              <p className="text-slate-500 text-sm mb-4">
                Run an analysis to identify risks, obligations, and suggested edits across all clauses.
              </p>
              <button
                onClick={handleRunAnalysis}
                disabled={runningAnalysis}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {runningAnalysis ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Analyzing...
                  </>
                ) : (
                  'Run Analysis'
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab: Compare */}
      {activeTab === 'compare' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
          <h3 className="font-semibold text-slate-900">Compare with Another Document</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs font-medium text-slate-500 mb-1">Current Document</p>
              <p className="text-sm font-semibold text-slate-900 truncate">{doc.name}</p>
            </div>
            <div className="flex items-center justify-center text-slate-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <div className="flex-1">
              <select
                value={compareDoc}
                onChange={(e) => setCompareDoc(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select document to compare...</option>
                {COMPARE_DOCS.filter((d) => d.id !== doc.id).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleCompare}
            disabled={!compareDoc || comparing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {comparing ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Comparing...
              </>
            ) : (
              'Compare'
            )}
          </button>

          {compareResult && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-200">
              <div>
                <h4 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Similarities
                </h4>
                <ul className="space-y-1.5">
                  {compareResult.similarities.map((s, i) => (
                    <li key={i} className="text-sm text-slate-600 pl-5 relative">
                      <span className="absolute left-0 top-1.5 w-1.5 h-1.5 bg-green-400 rounded-full" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-amber-700 mb-2 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Differences
                </h4>
                <ul className="space-y-1.5">
                  {compareResult.differences.map((d, i) => (
                    <li key={i} className="text-sm text-slate-600 pl-5 relative">
                      <span className="absolute left-0 top-1.5 w-1.5 h-1.5 bg-amber-400 rounded-full" />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Info */}
      {activeTab === 'info' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Document Information</h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase">Document ID</dt>
              <dd className="text-sm text-slate-900 mt-1 font-mono">{doc.id}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase">File Name</dt>
              <dd className="text-sm text-slate-900 mt-1">{doc.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase">Type</dt>
              <dd className="text-sm text-slate-900 mt-1 uppercase">{doc.type}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase">Size</dt>
              <dd className="text-sm text-slate-900 mt-1">{formatSize(doc.size)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase">Pages</dt>
              <dd className="text-sm text-slate-900 mt-1">{doc.pageCount || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase">Status</dt>
              <dd className="mt-1"><StatusBadge status={doc.status} /></dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase">Uploaded By</dt>
              <dd className="text-sm text-slate-900 mt-1">{doc.uploaderName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase">Matter</dt>
              <dd className="text-sm text-slate-900 mt-1">{doc.matterName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase">Created</dt>
              <dd className="text-sm text-slate-900 mt-1">{formatDate(doc.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase">Updated</dt>
              <dd className="text-sm text-slate-900 mt-1">{formatDate(doc.updatedAt)}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
