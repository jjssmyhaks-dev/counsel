import React from 'react';

interface LoadingSkeletonProps {
  rows?: number;
  className?: string;
  type?: 'table' | 'card' | 'detail';
}

export function LoadingSkeleton({ rows = 5, className = '', type = 'table' }: LoadingSkeletonProps) {
  if (type === 'card') {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-3/4 mb-4" />
            <div className="h-3 bg-slate-100 rounded w-full mb-2" />
            <div className="h-3 bg-slate-100 rounded w-2/3 mb-4" />
            <div className="flex gap-2">
              <div className="h-6 bg-slate-200 rounded-full w-16" />
              <div className="h-6 bg-slate-200 rounded-full w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'detail') {
    return (
      <div className={`space-y-6 animate-pulse ${className}`}>
        <div className="h-8 bg-slate-200 rounded w-1/3" />
        <div className="h-4 bg-slate-200 rounded w-2/3" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-xl" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>
      <div className="p-6 space-y-4 animate-pulse">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 items-center">
            <div className="h-4 bg-slate-200 rounded w-1/4" />
            <div className="h-4 bg-slate-100 rounded w-1/3" />
            <div className="h-4 bg-slate-100 rounded w-1/6 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
