'use client';

import { useState, useMemo, useEffect } from 'react';
import { api } from '@/lib/api';

// ─── Types ───

interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId: string;
  details: string;
  ipAddress: string;
  createdAt: string;
  firmId: string;
}

// ─── Static filter options ───

const RESOURCE_TYPES = ['all', 'document', 'matter', 'draft', 'kb', 'user', 'firm', 'meeting', 'research'];
const ACTION_TYPES = [
  'all',
  'document.upload',
  'document.analyze',
  'matter.create',
  'matter.update',
  'draft.create',
  'draft.finalize',
  'kb.query',
  'user.invite',
  'user.role_change',
  'firm.settings_update',
  'meeting.record',
  'meeting.summary',
  'research.create',
];

const PAGE_SIZE = 10;

// ─── Helpers ───

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Component ───

export function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [userSearch, setUserSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch audit logs from API
  const fetchLogs = () => {
    setLoading(true);
    setError(null);
    api.get('/admin/audit')
      .then((r: any) => {
        setLogs(Array.isArray(r?.data) ? r.data : []);
      })
      .catch(() => setError('Failed to load audit logs'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Filter
  const filteredLogs = useMemo(() => {
    let filtered = logs;

    if (dateRangeStart) {
      const start = new Date(dateRangeStart).getTime();
      filtered = filtered.filter((l) => new Date(l.createdAt).getTime() >= start);
    }
    if (dateRangeEnd) {
      const end = new Date(dateRangeEnd).getTime() + 86400000; // include full end day
      filtered = filtered.filter((l) => new Date(l.createdAt).getTime() <= end);
    }
    if (resourceFilter !== 'all') {
      filtered = filtered.filter((l) => l.resource === resourceFilter);
    }
    if (actionFilter !== 'all') {
      filtered = filtered.filter((l) => l.action === actionFilter);
    }
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.userName.toLowerCase().includes(q) ||
          l.userId.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [logs, dateRangeStart, dateRangeEnd, resourceFilter, actionFilter, userSearch]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedLogs = filteredLogs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset page when filters change
  function handleFilterChange(fn: () => void) {
    fn();
    setPage(1);
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function getActionBadgeClass(action: string): string {
    if (action.startsWith('document')) return 'bg-blue-100 text-blue-700';
    if (action.startsWith('matter')) return 'bg-purple-100 text-purple-700';
    if (action.startsWith('draft')) return 'bg-amber-100 text-amber-700';
    if (action.startsWith('kb')) return 'bg-teal-100 text-teal-700';
    if (action.startsWith('user')) return 'bg-green-100 text-green-700';
    if (action.startsWith('firm')) return 'bg-slate-100 text-slate-700';
    if (action.startsWith('meeting')) return 'bg-indigo-100 text-indigo-700';
    if (action.startsWith('research')) return 'bg-rose-100 text-rose-700';
    return 'bg-slate-100 text-slate-700';
  }

  function clearFilters() {
    setDateRangeStart('');
    setDateRangeEnd('');
    setResourceFilter('all');
    setActionFilter('all');
    setUserSearch('');
    setPage(1);
  }

  const hasActiveFilters =
    dateRangeStart || dateRangeEnd || resourceFilter !== 'all' || actionFilter !== 'all' || userSearch.trim();

  return (
    <div className="space-y-4">
      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
          <button onClick={fetchLogs} className="ml-3 underline font-medium">
            Retry
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* Date range */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">From</label>
            <input
              type="date"
              value={dateRangeStart}
              onChange={(e) => handleFilterChange(() => setDateRangeStart(e.target.value))}
              className="rounded-lg border border-slate-300 text-sm px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">To</label>
            <input
              type="date"
              value={dateRangeEnd}
              onChange={(e) => handleFilterChange(() => setDateRangeEnd(e.target.value))}
              className="rounded-lg border border-slate-300 text-sm px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Resource type */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Resource</label>
            <select
              value={resourceFilter}
              onChange={(e) => handleFilterChange(() => setResourceFilter(e.target.value))}
              className="rounded-lg border border-slate-300 text-sm px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              {RESOURCE_TYPES.map((r) => (
                <option key={r} value={r}>
                  {r === 'all' ? 'All Resources' : r.charAt(0).toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Action type */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</label>
            <select
              value={actionFilter}
              onChange={(e) => handleFilterChange(() => setActionFilter(e.target.value))}
              className="rounded-lg border border-slate-300 text-sm px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              {ACTION_TYPES.map((a) => (
                <option key={a} value={a}>
                  {a === 'all' ? 'All Actions' : a}
                </option>
              ))}
            </select>
          </div>

          {/* User search */}
          <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">User</label>
            <input
              type="text"
              value={userSearch}
              onChange={(e) => handleFilterChange(() => setUserSearch(e.target.value))}
              placeholder="Search by name..."
              className="rounded-lg border border-slate-300 text-sm px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-slate-500 hover:text-slate-700 font-medium underline px-2 py-2 mb-0.5"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-slate-500">
        <p>
          {filteredLogs.length} log{filteredLogs.length !== 1 ? 's' : ''} found
          {hasActiveFilters ? ' (filtered)' : ''}
        </p>
        {filteredLogs.length > PAGE_SIZE && (
          <p>
            Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredLogs.length)}
          </p>
        )}
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <svg className="mx-auto h-10 w-10 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="mt-3 text-sm text-slate-500">Loading audit logs...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        /* Empty state */
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <svg className="mx-auto h-10 w-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="mt-3 text-sm text-slate-500">No audit logs match your filters.</p>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Resource
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Resource ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      IP
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedLogs.map((log, idx) => (
                    <>
                      <tr
                        key={log.id}
                        onClick={() => toggleExpand(log.id)}
                        className={`cursor-pointer transition-colors ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                        } ${expandedId === log.id ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}
                      >
                        <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900 whitespace-nowrap">
                          {log.userName}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getActionBadgeClass(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 capitalize whitespace-nowrap">
                          {log.resource}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500 font-mono whitespace-nowrap">
                          {log.resourceId}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500 font-mono whitespace-nowrap">
                          {log.ipAddress}
                        </td>
                      </tr>
                      {/* Expanded details row */}
                      {expandedId === log.id && (
                        <tr>
                          <td colSpan={6} className="px-4 py-4 bg-blue-50/30">
                            <div className="text-sm text-slate-700">
                              <p className="font-semibold mb-1">Details:</p>
                              <p className="text-slate-600">{log.details}</p>
                              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-slate-500">
                                <div>
                                  <span className="font-semibold">User ID:</span> {log.userId}
                                </div>
                                <div>
                                  <span className="font-semibold">Firm ID:</span> {log.firmId}
                                </div>
                                <div>
                                  <span className="font-semibold">IP:</span> {log.ipAddress}
                                </div>
                                <div>
                                  <span className="font-semibold">Date:</span> {formatDate(log.createdAt)}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
            <p className="text-sm text-slate-500">
              Page {safePage} of {totalPages}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
