import React from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import type { RiskReport } from '@/lib/types';

interface RiskReportProps {
  report: RiskReport;
}

const RISK_BADGE_MAP: Record<string, { variant: 'success' | 'warning' | 'danger' | 'danger'; label: string }> = {
  low: { variant: 'success', label: 'Low Risk' },
  medium: { variant: 'warning', label: 'Medium Risk' },
  high: { variant: 'danger', label: 'High Risk' },
  critical: { variant: 'danger', label: 'Critical Risk' },
};

export function RiskReport({ report }: RiskReportProps) {
  const badge = RISK_BADGE_MAP[report.overallRisk] || RISK_BADGE_MAP.low;

  return (
    <Card padding="lg">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Risk Report</h3>
        <Badge variant={badge.variant} size="md">{badge.label}</Badge>
      </div>
      <p className="text-sm text-slate-600 mb-6">{report.summary}</p>
      <div className="space-y-4">
        {report.clauses.map((clause) => (
          <div key={clause.id} className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="info">{clause.type}</Badge>
              <Badge variant={RISK_BADGE_MAP[clause.riskLevel]?.variant || 'warning'} dot>
                {clause.riskLevel.toUpperCase()}
              </Badge>
            </div>
            <p className="text-sm text-slate-600 italic mb-2">&ldquo;{clause.excerpt}&rdquo;</p>
            <p className="text-xs text-slate-500">{clause.rationale}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
