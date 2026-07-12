import React from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Spinner } from '../ui/spinner';
import { ErrorState } from '../ui/error-state';
import type { Analysis, ClauseCard } from '@/lib/types';

interface DocumentAnalysisProps {
  analysis: Analysis | null;
  loading: boolean;
  error: string | null;
}

const RISK_BADGE_MAP: Record<string, { variant: 'success' | 'warning' | 'danger' | 'danger' }> = {
  low: { variant: 'success' },
  medium: { variant: 'warning' },
  high: { variant: 'danger' },
  critical: { variant: 'danger' },
};

function RiskSummary({ analysis }: { analysis: Analysis }) {
  const counts = { low: 0, medium: 0, high: 0, critical: 0 };
  analysis.clauses.forEach((c) => { counts[c.riskLevel]++; });

  return (
    <div className="mb-6">
      <Card padding="md">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Risk Analysis Summary</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{analysis.summary}</p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <Badge
              variant={analysis.overallRisk === 'low' ? 'success' : analysis.overallRisk === 'medium' ? 'warning' : 'danger'}
              size="md"
            >
              {analysis.overallRisk.toUpperCase()} Risk
            </Badge>
          </div>
        </div>
        <div className="flex gap-4 mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-sm text-slate-600">{counts.critical + counts.high} High/Critical</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-sm text-slate-600">{counts.medium} Medium</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-sm text-slate-600">{counts.low} Low</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">{analysis.clauses.length} total clauses</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ClauseCardItem({ clause }: { clause: ClauseCard }) {
  const badge = RISK_BADGE_MAP[clause.riskLevel] || RISK_BADGE_MAP.medium;

  return (
    <Card padding="md" className="mb-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <Badge variant="info">{clause.type}</Badge>
          <Badge variant={badge.variant} dot>{clause.riskLevel.toUpperCase()}</Badge>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Excerpt</p>
          <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 italic border border-slate-100">
            &ldquo;{clause.excerpt}&rdquo;
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Rationale</p>
            <p className="text-sm text-slate-600">{clause.rationale}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Suggested Edit</p>
            <p className="text-sm text-slate-600">{clause.suggestedEdit}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function DocumentAnalysis({ analysis, loading, error }: DocumentAnalysisProps) {
  if (loading) {
    return (
      <div className="py-12">
        <Spinner label="Analyzing document..." />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!analysis) {
    return (
      <div className="py-12 text-center">
        <p className="text-slate-500">No analysis available. Request an analysis to get started.</p>
      </div>
    );
  }

  return (
    <div>
      <RiskSummary analysis={analysis} />
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Clause-by-Clause Analysis</h3>
      {analysis.clauses.map((clause) => (
        <ClauseCardItem key={clause.id} clause={clause} />
      ))}
    </div>
  );
}

export { ClauseCardItem as ClauseCard };
