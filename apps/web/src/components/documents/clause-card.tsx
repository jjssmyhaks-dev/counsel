import React from 'react';
import { Badge } from '../ui/badge';
import type { ClauseCard } from '@/lib/types';

interface ClauseCardDisplayProps {
  clause: ClauseCard;
}

const RISK_MAP: Record<string, { variant: 'success' | 'warning' | 'danger'; label: string }> = {
  low: { variant: 'success', label: 'Low' },
  medium: { variant: 'warning', label: 'Medium' },
  high: { variant: 'danger', label: 'High' },
  critical: { variant: 'danger', label: 'Critical' },
};

export function ClauseCardDisplay({ clause }: ClauseCardDisplayProps) {
  const risk = RISK_MAP[clause.riskLevel] || RISK_MAP.medium;

  return (
    <div className="border border-slate-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="info">{clause.type}</Badge>
        <Badge variant={risk.variant} dot>
          {risk.label} Risk
        </Badge>
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Excerpt</p>
        <p className="text-sm text-slate-700 italic bg-slate-50 p-2 rounded">&ldquo;{clause.excerpt}&rdquo;</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Rationale</p>
          <p className="text-sm text-slate-600">{clause.rationale}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Suggested Edit</p>
          <p className="text-sm text-slate-600">{clause.suggestedEdit}</p>
        </div>
      </div>
    </div>
  );
}
