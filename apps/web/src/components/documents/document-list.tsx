'use client';

import React from 'react';
import Link from 'next/link';
import { Badge } from '../ui/badge';
import { Table } from '../ui/table';
import type { Document } from '@/lib/types';

interface DocumentListProps {
  documents: Document[];
  loading?: boolean;
}

const STATUS_MAP: Record<string, { variant: 'default' | 'info' | 'success' | 'danger' | 'neutral' | 'warning'; label: string }> = {
  uploaded: { variant: 'neutral', label: 'Uploaded' },
  processing: { variant: 'info', label: 'Processing' },
  ready: { variant: 'success', label: 'Ready' },
  failed: { variant: 'danger', label: 'Failed' },
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function DocumentList({ documents, loading }: DocumentListProps) {
  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (doc: Document) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="font-medium text-slate-900 truncate max-w-[250px]">{doc.name}</span>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (doc: Document) => (
        <span className="text-xs uppercase font-mono text-slate-500">{doc.type}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (doc: Document) => {
        const status = STATUS_MAP[doc.status] || STATUS_MAP.uploaded;
        return <Badge variant={status.variant} dot>{status.label}</Badge>;
      },
    },
    {
      key: 'matterName',
      header: 'Matter',
      render: (doc: Document) => (
        <span className="text-slate-600 truncate max-w-[200px] block">{doc.matterName}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Uploaded',
      render: (doc: Document) => <span className="text-slate-500">{formatDate(doc.createdAt)}</span>,
    },
    {
      key: 'size',
      header: 'Size',
      render: (doc: Document) => <span className="text-slate-500 font-mono text-xs">{formatSize(doc.size)}</span>,
    },
  ];

  return (
    <Table
      columns={columns}
      data={documents}
      keyField="id"
      loading={loading}
      onRowClick={(doc) => {
        window.location.href = `/dashboard/documents/${doc.id}`;
      }}
      emptyMessage="No documents yet — upload your first one"
    />
  );
}
