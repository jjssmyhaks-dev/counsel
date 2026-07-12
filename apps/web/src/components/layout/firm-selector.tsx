'use client';

import React from 'react';

const FIRMS = [
  { id: 'firm-001', name: 'Sterling & Associates LLP' },
  { id: 'firm-002', name: 'Demo Firm (Add your firm)' },
];

interface FirmSelectorProps {
  firmId: string;
}

export function FirmSelector({ firmId }: FirmSelectorProps) {
  const currentFirm = FIRMS.find((f) => f.id === firmId) || FIRMS[0];

  return (
    <div className="px-3 py-2">
      <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-800 bg-slate-800/50 text-slate-300 text-sm hover:bg-slate-800 transition-colors">
        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
        <span className="flex-1 text-left truncate">{currentFirm.name}</span>
        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
        </svg>
      </button>
    </div>
  );
}
