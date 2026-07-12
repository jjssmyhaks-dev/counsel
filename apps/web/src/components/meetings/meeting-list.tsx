'use client';

import React from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { LoadingSkeleton } from '../ui/loading-skeleton';
import type { Meeting } from '@/lib/types';

interface MeetingListProps {
  meetings: Meeting[];
  loading?: boolean;
}

const STATUS_MAP: Record<string, { variant: 'success' | 'info' | 'warning'; label: string }> = {
  scheduled: { variant: 'info', label: 'Scheduled' },
  processing: { variant: 'warning', label: 'Processing' },
  completed: { variant: 'success', label: 'Completed' },
};

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function MeetingList({ meetings, loading }: MeetingListProps) {
  if (loading) {
    return <LoadingSkeleton type="card" rows={4} />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {meetings.map((meeting) => {
        const status = STATUS_MAP[meeting.status] || STATUS_MAP.scheduled;
        return (
          <Card
            key={meeting.id}
            hover
            padding="md"
            onClick={() => (window.location.href = `/dashboard/meetings/${meeting.id}`)}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-900 leading-tight">{meeting.title}</h3>
                <Badge variant={status.variant} dot>{status.label}</Badge>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-sm text-slate-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {formatDateTime(meeting.date)}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-slate-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {meeting.duration} min
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span>{meeting.actionItemsCount} action items</span>
                <span>{meeting.decisionsCount} decisions</span>
              </div>
              {meeting.matterName && (
                <p className="text-xs text-slate-400 pt-2 border-t border-slate-100">{meeting.matterName}</p>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
