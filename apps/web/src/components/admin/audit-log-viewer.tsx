'use client';

import { useState, useMemo } from 'react';

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

// ─── Mock Data ───

const MOCK_AUDIT_LOGS: AuditLog[] = Array.from({ length: 35 }, (_, i) => {
  const users = [
    { id: 'u-1', name: 'Sarah Chen' },
    { id: 'u-2', name: 'James Wright' },
    { id: 'u-3', name: 'Lisa Park' },
    { id: 'u-4', name: 'David Kim' },
    { id: 'u-5', name: 'Maria Gomez' },
  ];
  const user = users[i % users.length];

  const actions: Array<{ action: string; resource: string; details: string }> = [
    { action: 'document.upload', resource: 'document', details: 'Uploaded "Merger Agreement v3.pdf" to matter "In re Quantum Dynamics"' },
    { action: 'document.analyze', resource: 'document', details: 'Requested risk analysis on "Patent Filing US2026-001234.pdf"' },
    { action: 'matter.create', resource: 'matter', details: 'Created matter "Brighton Commercial Lease Dispute"' },
    { action: 'matter.update', resource: 'matter', details: 'Updated matter status to "active" for "Evergreen IP Portfolio"' },
    { action: 'draft.create', resource: 'draft', details: 'Created draft "Demand Letter" for matter "NovaTech Data Privacy"' },
    { action: 'draft.finalize', resource: 'draft', details: 'Finalized draft "Settlement Agreement" with 3 approved clauses' },
    { action: 'kb.query', resource: 'kb', details: 'Queried: "What are the force majeure requirements in NY?"' },
    { action: 'user.invite', resource: 'user', details: 'Sent invitation to "maria.gomez@firm.com" as paralegal' },
    { action: 'user.role_change', resource: 'user', details: 'Changed role from "associate" to "partner" for James Wright' },
    { action: 'firm.settings_update', resource: 'firm', details: 'Enabled document analysis feature for the firm' },
    { action: 'meeting.record', resource: 'meeting', details: 'Recorded meeting "Evergreen Strategy Session" (45 min)' },
    { action: 'meeting.summary', resource: 'meeting', details: 'Generated meeting summary with 5 action items and 2 decisions' },
    { action: 'research.create', resource: 'research', details: 'Created research brief: "Recent precedent on data breach liability"' },
  ];
  const entry = actions[i % actions.length];

  const ips = ['192.168.1.45', '10.0.0.23', '172.16.0.8', '203.0.113.45', '198.51.100.7'];

  // Generate timestamps going back from now
  const hoursAgo = i * 3 + Math.floor(Math.random() * 2);
  const date = new Date(Date.now() - hoursAgo * 3600 * 1000);

  return {
    id: `audit-${String(i + 1).padStart(4, '0')}`,
    userId: user.id,
    userName: user.name,
    action: entry.action,
    resource: entry.resource,
    resourceId: `${entry.resource}-${String(i + 1).padStart(3, '0')}`,
    details: entry.details,
    ipAddress: ips[i % ips.length],
    createdAt: date.toISOString(),
    firmId: 'firm-001',
  };
});

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
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [userSearch, setUserSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter
  const filteredLogs = useMemo(() => {
    let logs = MOCK_AUDIT_LOGS;

    if (dateRangeStart) {
      const start = new Date(dateRangeStart).getTime();
      logs = logs.filter((l) => new Date(l.createdAt).getTime() >= start);
    }
    if (dateRangeEnd) {
      const end = new Date(dateRangeEnd).getTime() + 86400000; // include full end day
      logs = logs.filter((l) => new Date(l.createdAt).getTime() <= end);
    }
    if (resourceFilter !== 'all') {
      logs = logs.filter((l) => l.resource === resourceFilter);
    }
    if (actionFilter !== 'all') {
      logs = logs.filter((l) => l.action === actionFilter);
    }
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase();
      logs = logs.filter(
        (l) =>
          l.userName.toLowerCase().includes(q) ||
          l.userId.toLowerCase().includes(q)
      );
    }

    return logs;
  }, [dateRangeStart, dateRangeEnd, resourceFilter, actionFilter, userSearch]);

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

      {/* Empty state */}
      {filteredLogs.length === 0 ? (
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
