'use client';

import React from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { LoadingSkeleton } from '../ui/loading-skeleton';
import type { Matter } from '@/lib/types';

interface MatterListProps {
  matters: Matter[];
  loading?: boolean;
}

const STATUS_MAP: Record<string, { variant: 'success' | 'warning' | 'neutral'; label: string }> = {
  active: { variant: 'success', label: 'Active' },
  pending: { variant: 'warning', label: 'Pending' },
  closed: { variant: 'neutral', label: 'Closed' },
  archived: { variant: 'neutral', label: 'Archived' },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function MatterList({ matters, loading }: MatterListProps) {
  if (loading) {
    return <LoadingSkeleton type="card" rows={6} />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {matters.map((matter) => {
        const status = STATUS_MAP[matter.status] || STATUS_MAP.active;
        return (
          <Card
            key={matter.id}
            hover
            padding="md"
            onClick={() => (window.location.href = `/dashboard/matters/${matter.id}`)}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-slate-900 leading-tight pr-2">{matter.name}</h3>
                <Badge variant={status.variant} dot>{status.label}</Badge>
              </div>
              <p className="text-sm text-slate-500 line-clamp-2">{matter.description}</p>
              <div className="flex items-center gap-4 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  {matter.clientName}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {matter.documentCount} documents
                </div>
              </div>
              <div className="text-xs text-slate-400">
                Updated {formatDate(matter.updatedAt)}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
