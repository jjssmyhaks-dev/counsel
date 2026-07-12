'use client';

import { useEffect, useState } from 'react';
import { mockGetAuditLogs } from '@/lib/api';
import type { AuditLog } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';

const PAGE_SIZE = 10;

const RESOURCE_TYPES = [
  'Document',
  'Matter',
  'Draft',
  'User',
  'Research',
  'Meeting',
  'Playbook',
  'Knowledge Base',
  'Auth',
];

const ACTION_TYPES = [
  'auth.login',
  'auth.logout',
  'document.upload',
  'document.analyze',
  'document.view',
  'matter.create',
  'matter.update',
  'matter.delete',
  'draft.create',
  'draft.finalize',
  'draft.delete',
  'research.create',
  'research.complete',
  'meeting.create',
  'meeting.process',
  'kb.query',
  'playbook.update',
  'user.invite',
  'user.update',
  'user.deactivate',
];

function formatFullDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function ActionBadge({ action }: { action: string }) {
  if (action.includes('login') || action.includes('logout')) return <Badge variant="neutral">Auth</Badge>;
  if (action.includes('upload') || action.includes('create')) return <Badge variant="info">Create</Badge>;
  if (action.includes('analyze') || action.includes('process') || action.includes('complete')) return <Badge variant="info">Process</Badge>;
  if (action.includes('view') || action.includes('query')) return <Badge variant="neutral">Read</Badge>;
  if (action.includes('update') || action.includes('finalize') || action.includes('invite')) return <Badge variant="warning">Modify</Badge>;
  if (action.includes('delete') || action.includes('deactivate')) return <Badge variant="danger">Delete</Badge>;
  return <Badge variant="neutral">Action</Badge>;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);

  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);

  useEffect(() => { loadLogs(); }, []);

  useEffect(() => {
    let results = logs;

    if (dateStart) {
      results = results.filter((l) => new Date(l.createdAt) >= new Date(dateStart));
    }
    if (dateEnd) {
      const end = new Date(dateEnd);
      end.setHours(23, 59, 59, 999);
      results = results.filter((l) => new Date(l.createdAt) <= end);
    }
    if (resourceFilter) {
      results = results.filter((l) => l.resource.toLowerCase() === resourceFilter.toLowerCase());
    }
    if (userSearch) {
      results = results.filter((l) =>
        l.userName.toLowerCase().includes(userSearch.toLowerCase())
      );
    }
    if (actionFilter) {
      results = results.filter((l) => l.action === actionFilter);
    }

    setFilteredLogs(results);
    setPage(1);
  }, [logs, dateStart, dateEnd, resourceFilter, userSearch, actionFilter]);

  async function loadLogs() {
    setLoading(true);
    setError('');
    try {
      const resp = await mockGetAuditLogs();
      setLogs(resp.data);
    } catch {
      setError('Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }

  function handleClearFilters() {
    setDateStart('');
    setDateEnd('');
    setResourceFilter('');
    setUserSearch('');
    setActionFilter('');
  }

  const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE);
  const pagedLogs = filteredLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = dateStart || dateEnd || resourceFilter || userSearch || actionFilter;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <h1>Audit Log</h1>
        <p>Track all system activity, user actions, and security events across the platform</p>
      </div>

      {/* Filter Bar */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Start Date</label>
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">End Date</label>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <Select
            label="Resource Type"
            options={[
              { value: '', label: 'All Resources' },
              ...RESOURCE_TYPES.map((rt) => ({ value: rt.toLowerCase(), label: rt })),
            ]}
            value={resourceFilter}
            onChange={(e) => setResourceFilter(e.target.value)}
          />
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">User</label>
            <input
              type="text"
              placeholder="Search user..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <Select
            label="Action Type"
            options={[
              { value: '', label: 'All Actions' },
              ...ACTION_TYPES.map((at) => ({ value: at, label: at })),
            ]}
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          />
          <div className="flex items-end gap-2">
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters} className="whitespace-nowrap">
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Error */}
      {error && <ErrorState message={error} onRetry={loadLogs} />}

      {/* Loading */}
      {loading && (
        <Card padding="none">
          <div className="p-5 space-y-4 animate-pulse">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-4 bg-slate-200 rounded w-20" />
                <div className="h-4 bg-slate-100 rounded w-24" />
                <div className="h-4 bg-slate-200 rounded w-32" />
                <div className="h-4 bg-slate-100 rounded w-1/4" />
                <div className="h-4 bg-slate-100 rounded w-12" />
                <div className="h-4 bg-slate-200 rounded w-32 ml-auto" />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Table */}
      {!loading && !error && pagedLogs.length > 0 && (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Timestamp</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">User</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Action</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">Resource</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase hidden lg:table-cell">Details</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase hidden xl:table-cell">IP Address</th>
                </tr>
              </thead>
              <tbody>
                {pagedLogs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-sm text-slate-600 whitespace-nowrap font-mono">
                      {formatFullDate(log.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-slate-800">{log.userName}</p>
                      <p className="text-xs text-slate-400">{log.userId}</p>
                    </td>
                    <td className="px-5 py-3">
                      <ActionBadge action={log.action} />
                      <p className="text-xs text-slate-500 mt-0.5 font-mono">{log.action}</p>
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      <p className="text-sm text-slate-700 capitalize">{log.resource}</p>
                      <p className="text-xs text-slate-400 font-mono">{log.resourceId}</p>
                    </td>
                    <td className="px-5 py-3 hidden lg:table-cell">
                      <p className="text-sm text-slate-600 max-w-[220px] truncate" title={log.details}>
                        {log.details}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500 font-mono hidden xl:table-cell">
                      {log.ipAddress}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Empty filtered */}
      {!loading && !error && logs.length > 0 && pagedLogs.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <EmptyState
            title="No audit entries match filters"
            description="Try adjusting your date range, resource type, or other filter criteria."
            actionLabel="Clear Filters"
            onAction={handleClearFilters}
            icon={
              <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && logs.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <EmptyState
            title="No audit log entries"
            description="Audit logs will appear here as users interact with the platform."
          />
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && pagedLogs.length > 0 && totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}
