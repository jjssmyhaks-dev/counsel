import React from 'react';
import { Badge } from '../ui/badge';
import type { MeetingActionItem } from '@/lib/types';

interface ActionItemsProps {
  items: MeetingActionItem[];
  loading?: boolean;
}

const STATUS_MAP: Record<string, { variant: 'warning' | 'info' | 'success' | 'danger'; label: string }> = {
  pending: { variant: 'warning', label: 'Pending' },
  in_progress: { variant: 'info', label: 'In Progress' },
  completed: { variant: 'success', label: 'Done' },
  overdue: { variant: 'danger', label: 'Overdue' },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function ActionItems({ items, loading }: ActionItemsProps) {
  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-slate-100 rounded-lg" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-slate-500">No action items yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const status = STATUS_MAP[item.status] || STATUS_MAP.pending;
        return (
          <div
            key={item.id}
            className="flex items-start gap-4 bg-white border border-slate-200 rounded-lg p-4"
          >
            <input
              type="checkbox"
              checked={item.status === 'completed'}
              readOnly
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${item.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                {item.description}
              </p>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-xs text-slate-500">{item.owner}</span>
                <span className="text-xs text-slate-400">Due {formatDate(item.dueDate)}</span>
              </div>
            </div>
            <Badge variant={status.variant} size="sm">
              {status.label}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
