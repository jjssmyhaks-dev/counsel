'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { Meeting, Matter } from '@/lib/types';

const serif = 'font-serif';

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
  const map: Record<string, { bg: string; dot: string; label: string }> = {
    scheduled: { bg: 'bg-[#fef8e6] text-[#b45309]', dot: 'bg-amber-500', label: 'Scheduled' },
    processing: { bg: 'bg-[#eaf7f0] text-[#0a8a5f]', dot: 'bg-[#15b881]', label: 'Processing' },
    completed: { bg: 'bg-[#eaf7f0] text-[#0a8a5f]', dot: 'bg-[#15b881]', label: 'Completed' },
  };
  const s = map[status] || map.scheduled;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${s.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export default function MeetingsPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUpload, setShowUpload] = useState(false);

  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDate, setUploadDate] = useState(new Date().toISOString().slice(0, 16));
  const [uploadMatterId, setUploadMatterId] = useState('');
  const [uploadTranscript, setUploadTranscript] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const meetingsResp = await api.get<{ data: Meeting[] }>('/meetings');
      setMeetings(meetingsResp.data);
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
        <div>
          <h1 className={`${serif} text-[1.75rem] font-normal tracking-[-0.02em] text-[#0c0a09] dark:text-white`}>Meeting Intelligence</h1>
          <p className="text-[13px] text-[#717d79] dark:text-[#969e9b] mt-1">Upload transcripts, generate summaries, and track action items from meetings</p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0c0a09] hover:bg-[#0a8a5f] text-white text-[13px] font-medium transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Upload Transcript
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-[#fdf0ee] border border-[#f0705b]/20 text-[#c2452e] px-4 py-3 rounded-xl text-[13px] flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadData} className="text-[#0a8a5f] hover:text-[#15b881] font-medium ml-2">Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.04] dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-5 space-y-4 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-4 bg-black/[0.04] rounded w-1/3" />
                <div className="h-4 bg-black/[0.03] rounded w-24" />
                <div className="h-4 bg-black/[0.03] rounded w-16" />
                <div className="h-4 bg-black/[0.03] rounded w-12" />
                <div className="h-4 bg-black/[0.04] rounded-full w-20 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && !error && meetings.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.04] dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-black/[0.04] dark:border-slate-800 bg-[#fefdfb]/50">
                  {['Title','Date','Duration','Participants','Status','Actions'].map((h, idx) => (
                    <th key={h} className={`text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#969e9b] dark:text-[#717d79] ${idx === 1 ? 'hidden md:table-cell' : ''} ${idx === 2 ? 'hidden lg:table-cell' : ''} ${idx === 3 ? 'hidden md:table-cell' : ''} ${idx === 5 ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {meetings.map((meeting) => (
                  <tr key={meeting.id} className="border-b border-black/[0.02] dark:border-slate-800 hover:bg-black/[0.02] dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-medium text-[#0c0a09] dark:text-white">{meeting.title}</p>
                      {meeting.matterName && (
                        <p className="text-[11px] text-[#969e9b] dark:text-[#717d79] mt-0.5">{meeting.matterName}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] text-[#717d79] dark:text-[#969e9b] hidden md:table-cell">
                      <div>{formatDate(meeting.date)}</div>
                      <div className="text-[11px] text-[#969e9b]">{formatTime(meeting.date)}</div>
                    </td>
                    <td className="px-5 py-3.5 text-[13px] text-[#717d79] dark:text-[#969e9b] hidden lg:table-cell">{formatDuration(meeting.duration)}</td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] bg-black/[0.03] text-[#717d79] dark:text-[#969e9b] px-2 py-0.5 rounded-full font-medium">
                          {meeting.participants.length} participants
                        </span>
                        {meeting.actionItemsCount > 0 && (
                          <span className="text-[11px] bg-[#eaf7f0] text-[#0a8a5f] px-2 py-0.5 rounded-full font-medium">
                            {meeting.actionItemsCount} actions
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5"><StatusBadgeUI status={meeting.status} /></td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => router.push(`/dashboard/meetings/${meeting.id}`)}
                        className="px-3 py-1.5 text-[12px] font-medium rounded-xl border border-[#15b881]/40 text-[#0a8a5f] hover:bg-[#eaf7f0] transition-colors"
                      >
                        View
                      </button>
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
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.04] dark:border-slate-800 shadow-sm">
          <div className="py-16 text-center">
            <svg className="w-16 h-16 text-black/[0.06] mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className={`${serif} text-lg font-normal tracking-[-0.02em] text-[#0c0a09] dark:text-white mb-1`}>No meetings yet</h3>
            <p className="text-[13px] text-[#969e9b] dark:text-[#717d79] max-w-md mx-auto mb-6">Upload your first meeting transcript to generate summaries and action items.</p>
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0c0a09] hover:bg-[#0a8a5f] text-white text-[13px] font-medium transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Upload Transcript
            </button>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setShowUpload(false)} />
          <div className="relative bg-white rounded-2xl border border-black/[0.04] shadow-lg w-full max-w-lg p-6 space-y-4">
            <h2 className={`${serif} text-xl font-normal tracking-[-0.02em] text-[#0c0a09]`}>Upload Meeting Transcript</h2>

            <div>
              <label className="block text-[13px] font-medium text-[#717d79] mb-1.5">Meeting Title</label>
              <input
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="e.g., Quantum Merger Strategy Session"
                className="w-full px-3 py-2.5 rounded-xl border border-black/[0.08] text-[13px] text-[#0c0a09] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#717d79] mb-1.5">Date &amp; Time</label>
              <input
                type="datetime-local"
                value={uploadDate}
                onChange={(e) => setUploadDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-black/[0.08] text-[13px] text-[#0c0a09] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#717d79] mb-1.5">Related Matter (optional)</label>
              <select
                value={uploadMatterId}
                onChange={(e) => setUploadMatterId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-black/[0.08] text-[13px] text-[#0c0a09] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40"
              >
                <option value="">Select a matter...</option>
                {matters.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.clientName})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#717d79] mb-1.5">Transcript</label>
              <textarea
                value={uploadTranscript}
                onChange={(e) => setUploadTranscript(e.target.value)}
                placeholder="Paste the full meeting transcript here..."
                rows={10}
                className="w-full px-3 py-2.5 rounded-xl border border-black/[0.08] text-[13px] text-[#0c0a09] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40 resize-none font-mono"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowUpload(false)} className="px-4 py-2 rounded-xl text-[13px] font-medium bg-white border border-black/[0.08] text-[#717d79] hover:bg-[#fefdfb] transition-colors">Cancel</button>
              <button
                onClick={handleUpload}
                disabled={!uploadTitle.trim() || !uploadTranscript.trim()}
                className="px-4 py-2 rounded-xl text-[13px] font-medium bg-[#0c0a09] hover:bg-[#0a8a5f] text-white transition-colors disabled:opacity-50"
              >
                Upload &amp; Process
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
