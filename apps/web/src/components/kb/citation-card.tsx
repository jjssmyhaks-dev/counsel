import React from 'react';
import type { KbSource } from '@/lib/types';

interface CitationCardProps {
  source: KbSource;
}

export function CitationCard({ source }: CitationCardProps) {
  return (
    <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
      <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{source.title}</p>
        <p className="text-xs text-slate-500 truncate">{source.excerpt} · p.{source.pageNumber}</p>
      </div>
    </div>
  );
}
