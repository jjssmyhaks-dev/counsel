'use client';

import React from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { LoadingSkeleton } from '../ui/loading-skeleton';
import type { Draft } from '@/lib/types';

interface DraftListProps {
  drafts: Draft[];
  loading?: boolean;
}

const TYPE_MAP: Record<string, { variant: 'info' | 'success' | 'warning'; label: string }> = {
  email: { variant: 'info', label: 'Email' },
  memo: { variant: 'success', label: 'Memo' },
  report: { variant: 'warning', label: 'Report' },
  brief: { variant: 'info', label: 'Brief' },
  letter: { variant: 'success', label: 'Letter' },
};

const STATUS_MAP: Record<string, { variant: 'warning' | 'info' | 'success'; label: string }> = {
  draft: { variant: 'warning', label: 'Draft' },
  generating: { variant: 'info', label: 'Generating' },
  finalized: { variant: 'success', label: 'Finalized' },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function DraftList({ drafts, loading }: DraftListProps) {
  if (loading) {
    return <LoadingSkeleton type="card" rows={4} />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {drafts.map((draft) => {
        const type = TYPE_MAP[draft.type] || TYPE_MAP.memo;
        const status = STATUS_MAP[draft.status] || STATUS_MAP.draft;
        return (
          <Card
            key={draft.id}
            hover
            padding="md"
            onClick={() => (window.location.href = `/dashboard/drafts/${draft.id}`)}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{draft.title}</h3>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Badge variant={type.variant}>{type.label}</Badge>
                  <Badge variant={status.variant} dot>{status.label}</Badge>
                </div>
              </div>
              <p className="text-sm text-slate-500 line-clamp-2">{draft.instructions}</p>
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <span className="text-xs text-slate-500">{draft.matterName}</span>
                <span className="text-xs text-slate-400">{formatDate(draft.createdAt)}</span>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
