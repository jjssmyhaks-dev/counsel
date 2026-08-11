'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

const serif = 'font-serif';

interface ComplianceItem {
  id: string;
  type: string;
  dueDate: string;
  status: string;
  client?: { name: string };
}

interface ComplianceResponse {
  items: ComplianceItem[];
  summary: {
    total: number;
    overdue: number;
    dueThisWeek: number;
    completed: number;
  };
}

export default function CACompliancePage() {
  const [data, setData] = useState<ComplianceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCompliance();
  }, []);

  async function loadCompliance() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<ComplianceResponse>('/compliance-calendar');
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load compliance data');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className={`${serif} text-2xl font-bold text-[#0c0a09]`}>Compliance Calendar</h1>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadCompliance} className="font-medium underline">Retry</button>
        </div>
      </div>
    );
  }

  const items = data?.items || [];
  const summary = data?.summary || { total: 0, overdue: 0, dueThisWeek: 0, completed: 0 };

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`${serif} text-2xl font-bold text-[#0c0a09]`}>Compliance Calendar</h1>
        <p className="text-[#717d79] text-sm mt-1">Track GST, ITR, TDS, ROC filings and deadlines</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-black/[0.04] p-4">
          <p className="text-xs text-[#717d79]">Total</p>
          <p className="text-2xl font-bold text-[#0c0a09]">{summary.total}</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <p className="text-xs text-[#c26a4a]">Overdue</p>
          <p className="text-2xl font-bold text-[#c26a4a]">{summary.overdue}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4">
          <p className="text-xs text-[#c4a33c]">Due This Week</p>
          <p className="text-2xl font-bold text-[#c4a33c]">{summary.dueThisWeek}</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4">
          <p className="text-xs text-[#0a8a5f]">Completed</p>
          <p className="text-2xl font-bold text-[#0a8a5f]">{summary.completed}</p>
        </div>
      </div>

      {/* Items list */}
      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-black/[0.04] p-12 text-center">
          <p className="text-[#717d79] text-sm">No compliance items. Add filings through Chat to see them here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-black/[0.04] overflow-hidden">
          <div className="divide-y divide-black/[0.04]">
            {items.map(item => {
              const due = new Date(item.dueDate);
              const now = new Date();
              const diff = (due.getTime() - now.getTime()) / 86400000;
              const isOverdue = diff < 0 && item.status !== 'COMPLETED';
              const isDueSoon = diff >= 0 && diff <= 7 && item.status !== 'COMPLETED';
              const isDone = item.status === 'COMPLETED';

              return (
                <div key={item.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${isDone ? 'bg-[#7a9a6e]' : isOverdue ? 'bg-[#c26a4a]' : isDueSoon ? 'bg-[#c4a33c]' : 'bg-[#9ca3af]'}`} />
                    <div>
                      <p className="text-sm font-medium text-[#0c0a09]">{item.type}</p>
                      <p className="text-xs text-[#717d79]">{item.client?.name || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#717d79]">{due.toLocaleDateString()}</p>
                    <p className={`text-xs font-medium ${isDone ? 'text-[#0a8a5f]' : isOverdue ? 'text-[#c26a4a]' : isDueSoon ? 'text-[#c4a33c]' : 'text-[#969e9b]'}`}>
                      {isDone ? 'Done' : isOverdue ? 'Overdue' : isDueSoon ? 'Due soon' : 'Upcoming'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
