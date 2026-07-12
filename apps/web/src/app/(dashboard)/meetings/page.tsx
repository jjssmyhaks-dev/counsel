'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { mockGetMeetings, mockGetMatters } from '@/lib/api';
import type { Meeting, Matter } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function StatusBadgeUI({ status }: { status: Meeting['status'] }) {
  const variant = status === 'scheduled' ? 'warning' : status === 'processing' ? 'info' : 'success';
  return <Badge variant={variant} dot>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
}

export default function MeetingsPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUpload, setShowUpload] = useState(false);

  // Upload form
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDate, setUploadDate] = useState(new Date().toISOString().slice(0, 16));
  const [uploadMatterId, setUploadMatterId] = useState('');
  const [uploadTranscript, setUploadTranscript] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [meetingsResp, mattersResp] = await Promise.all([mockGetMeetings(), mockGetMatters()]);
      setMeetings(meetingsResp.data);
      setMatters(mattersResp.data);
    } catch {
      setError('Failed to load meetings.');
    } finally {
      setLoading(false);
    }
  }

  function handleUpload() {
    if (!uploadTitle.trim() || !uploadTranscript.trim()) return;
    const meeting: Meeting = {
      id: `meeting-${Date.now()}`,
      title: uploadTitle,
      date: new Date(uploadDate).toISOString(),
      duration: 0,
      participants: ['Sarah Chen'],
      status: 'processing',
      actionItemsCount: 0,
      decisionsCount: 0,
      matterId: uploadMatterId || undefined,
      matterName: matters.find((m) => m.id === uploadMatterId)?.name,
      transcript: uploadTranscript,
      createdAt: new Date().toISOString(),
    };
    setMeetings((prev) => [meeting, ...prev]);
    setShowUpload(false);
    setUploadTitle('');
    setUploadDate(new Date().toISOString().slice(0, 16));
    setUploadMatterId('');
    setUploadTranscript('');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="page-header !mb-0">
          <h1>Meeting Intelligence</h1>
          <p>Upload transcripts, generate summaries, and track action items from meetings</p>
        </div>
        <Button onClick={() => setShowUpload(true)}>
          <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Upload Transcript
        </Button>
      </div>

      {/* Error */}
      {error && <ErrorState message={error} onRetry={loadData} />}

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 space-y-4 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-4 bg-slate-200 rounded w-1/3" />
                <div className="h-4 bg-slate-100 rounded w-24" />
                <div className="h-4 bg-slate-100 rounded w-16" />
                <div className="h-4 bg-slate-100 rounded w-12" />
                <div className="h-4 bg-slate-200 rounded-full w-20 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && !error && meetings.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Title</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase hidden lg:table-cell">Duration</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">Participants</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">View</th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((meeting) => (
                  <tr key={meeting.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-slate-900">{meeting.title}</p>
                      {meeting.matterName && (
                        <p className="text-xs text-slate-500 mt-0.5">{meeting.matterName}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-600 hidden md:table-cell">
                      <div>{formatDate(meeting.date)}</div>
                      <div className="text-xs text-slate-400">{formatTime(meeting.date)}</div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-600 hidden lg:table-cell">
                      {formatDuration(meeting.duration)}
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                          {meeting.participants.length} participants
                        </span>
                        {meeting.actionItemsCount > 0 && (
                          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                            {meeting.actionItemsCount} actions
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadgeUI status={meeting.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Button size="sm" variant="outline" onClick={() => router.push(`/meetings/${meeting.id}`)}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && meetings.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <EmptyState
            title="No meetings yet"
            description="Upload your first meeting transcript to generate summaries and action items."
            actionLabel="Upload Transcript"
            onAction={() => setShowUpload(true)}
            icon={
              <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
          />
        </div>
      )}

      {/* Upload Modal */}
      <Modal open={showUpload} onClose={() => setShowUpload(false)} title="Upload Meeting Transcript" size="lg">
        <div className="space-y-4">
          <Input
            label="Meeting Title"
            placeholder="e.g., Quantum Merger Strategy Session"
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Date &amp; Time</label>
            <input
              type="datetime-local"
              value={uploadDate}
              onChange={(e) => setUploadDate(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <Select
            label="Related Matter (optional)"
            options={[
              { value: '', label: 'Select a matter...' },
              ...matters.map((m) => ({ value: m.id, label: `${m.name} (${m.clientName})` })),
            ]}
            value={uploadMatterId}
            onChange={(e) => setUploadMatterId(e.target.value)}
          />
          <Textarea
            label="Transcript"
            placeholder="Paste the full meeting transcript here..."
            value={uploadTranscript}
            onChange={(e) => setUploadTranscript(e.target.value)}
            rows={10}
          />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setShowUpload(false)}>Cancel</Button>
          <Button onClick={handleUpload} disabled={!uploadTitle.trim() || !uploadTranscript.trim()}>
            Upload &amp; Process
          </Button>
        </div>
      </Modal>
    </div>
  );
}
