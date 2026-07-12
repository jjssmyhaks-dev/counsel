'use client';

import React from 'react';
import Link from 'next/link';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  return (
    <nav className={`flex items-center text-sm text-slate-500 ${className}`}>
      <Link href="/dashboard" className="hover:text-slate-700 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      </Link>
      {items.map((item, idx) => (
        <span key={idx} className="flex items-center">
          <svg className="w-4 h-4 mx-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {item.href ? (
            <Link href={item.href} className="hover:text-slate-700 transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className={idx === items.length - 1 ? 'text-slate-900 font-medium' : ''}>
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
