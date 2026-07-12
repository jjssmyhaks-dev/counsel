'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { mockGetMeeting, mockGetActionItems, mockGetDecisions } from '@/lib/api';
import type { Meeting, MeetingActionItem, MeetingDecision } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';
import { ErrorState } from '@/components/ui/error-state';
import { Spinner } from '@/components/ui/spinner';

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} minutes`;
  if (m === 0) return `${h} hour${h > 1 ? 's' : ''}`;
  return `${h}h ${m}m`;
}

function StatusBadgeUI({ status }: { status: string }) {
  const variant = status === 'scheduled' ? 'warning' : status === 'processing' ? 'info' : status === 'completed' ? 'success' : status === 'overdue' ? 'danger' : status === 'in_progress' ? 'info' : 'neutral';
  const label = status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1);
  return <Badge variant={variant} dot>{label}</Badge>;
}

const mockTranscriptText = `[10:00 AM] Sarah Chen: Good morning everyone. Let's kick off our strategy session for the Quantum Dynamics merger. We have the risk analysis from our AI platform, and I want to walk through the key findings before we plan our negotiation approach.

[10:02 AM] Michael Torres: Thanks Sarah. I've reviewed the analysis — the indemnification clause is the biggest red flag. No cap on liability is unusual for a deal this size.

[10:04 AM] Lisa Park: Agreed. I benchmarked against 15 comparable deals from the ABA report, and the median cap is 15% of purchase price. We're currently at unlimited liability — that's a non-starter.

[10:07 AM] Sarah Chen: Let's document that as our first position: 15% cap tied to purchase price, with a 1% basket threshold. Lisa, can you draft the revised clause language?

[10:08 AM] Lisa Park: Yes, I can have that by EOD tomorrow.

[10:10 AM] Michael Torres: The change-of-control threshold at 15% is also problematic. Every routine stock purchase could trigger it. Market standard is 50%.

[10:12 AM] Sarah Chen: That's a good point, Michael. Let's push for 50% or, at minimum, a board composition trigger. I'll handle that discussion with opposing counsel.

[10:15 AM] Lisa Park: What about the non-compete? Five years is way too long. Delaware courts have been striking those down.

[10:17 AM] Michael Torres: Two to three years is the max we should accept, and it should be geographically scoped to the company's existing markets. Not worldwide.

[10:20 AM] Sarah Chen: So decisions for today: (1) Propose 15% indemnification cap with basket — Lisa drafts. (2) Push for 50% change-of-control threshold or board trigger — I'll negotiate. (3) Demand 3-year non-compete reduction with geographic scope — Michael will research case law support.

[10:25 AM] Lisa Park: Should we also address the termination fee? The $5M amount seems within range but the trigger events are vague.

[10:28 AM] Michael Torres: I agree. The fee is fine but we need clearer triggering events. Otherwise we're writing a blank check.

[10:30 AM] Sarah Chen: Good catch. Add that as action item: "Clarify termination fee trigger events." Michael, can you prepare a redline with specific scenarios?

[10:31 AM] Michael Torres: Will do. I'll have it ready for our Thursday review.

[10:33 AM] Sarah Chen: One more thing — the governing law provision is standard Delaware, so that's fine. And the IP representations look clean too, based on the diligence we've seen.

[10:35 AM] Lisa Park: I've been tracking time. We covered everything on the agenda. Anything else before we wrap?

[10:37 AM] Michael Torres: Just confirming — the client call is Thursday at 2PM? I want to make sure the term sheet comparison is ready.

[10:38 AM] Sarah Chen: Yes, Thursday 2PM. Lisa, the final redlines need to be in by Wednesday evening so we can review before the call.

[10:40 AM] Lisa Park: Got it. I'll send the package by Wednesday 6PM latest.`;

export default function MeetingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const meetingId = params.id as string;

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [actionItems, setActionItems] = useState<MeetingActionItem[]>([]);
  const [decisions, setDecisions] = useState<MeetingDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('summary');
  const [processing, setProcessing] = useState(false);

  useEffect(() => { loadData(); }, [meetingId]);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [m, ai, dec] = await Promise.all([
        mockGetMeeting(meetingId),
        mockGetActionItems(meetingId),
        mockGetDecisions(meetingId),
      ]);
      setMeeting(m);
      setActionItems(ai);
      setDecisions(dec);
    } catch {
      setError('Failed to load meeting details.');
    } finally {
      setLoading(false);
    }
  }

  function handleToggleActionItem(id: string) {
    setActionItems((prev) =>
      prev.map((ai) =>
        ai.id === id ? { ...ai, status: ai.status === 'completed' ? 'pending' : 'completed' } : ai
      )
    );
  }

  function handleProcess() {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      if (meeting) {
        setMeeting({ ...meeting, status: 'completed' });
      }
    }, 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" label="Loading meeting..." />
      </div>
    );
  }

  if (error && !meeting) {
    return <ErrorState message={error} onRetry={loadData} />;
  }

  if (!meeting) {
    return <ErrorState message="Meeting not found." onRetry={loadData} />;
  }

  const tabs = [
    { key: 'summary', label: 'Summary' },
    { key: 'action-items', label: 'Action Items', count: actionItems.length },
    { key: 'transcript', label: 'Transcript' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="page-header !mb-0">
          <h1>{meeting.title}</h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-sm text-slate-500">
              {formatDate(meeting.date)} · {formatTime(meeting.date)}
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-sm text-slate-500">{formatDuration(meeting.duration)}</span>
            <span className="text-slate-300">·</span>
            <StatusBadgeUI status={meeting.status} />
            {meeting.matterName && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-sm text-slate-500">{meeting.matterName}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => router.push('/meetings')}>
            ← Back
          </Button>
          {meeting.status !== 'completed' && (
            <Button onClick={handleProcess} loading={processing}>
              Process Meeting
            </Button>
          )}
        </div>
      </div>

      {/* Participants */}
      <div className="flex flex-wrap gap-2">
        {meeting.participants.map((p, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm">
            <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-semibold">
              {p.charAt(0)}
            </span>
            {p}
          </span>
        ))}
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          {/* Summary */}
          {meeting.summary && (
            <Card>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Meeting Summary</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{meeting.summary}</p>
            </Card>
          )}

          {!meeting.summary && (
            <Card className="text-center py-12">
              <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm text-slate-500 mb-1">No summary available</p>
              <p className="text-xs text-slate-400">Click &quot;Process Meeting&quot; to generate an AI summary</p>
            </Card>
          )}

          {/* Decisions */}
          {decisions.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Decisions Made</h3>
              <Card>
                <ol className="list-decimal list-inside space-y-3">
                  {decisions.map((dec, i) => (
                    <li key={dec.id} className="pl-1">
                      <p className="text-sm text-slate-800 inline">{dec.description}</p>
                      <div className="ml-6 mt-1 space-y-0.5">
                        {dec.rationale && (
                          <p className="text-xs text-slate-500">
                            <span className="font-medium">Rationale:</span> {dec.rationale}
                          </p>
                        )}
                        <p className="text-xs text-slate-400">
                          Decided by: {dec.decidedBy}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Card>
            </div>
          )}

          {/* Open Questions */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-3">Open Questions</h3>
            <Card>
              {meeting.summary ? (
                <ul className="space-y-2">
                  <li className="text-sm text-slate-700">• Are there any pending regulatory approvals that could delay closing?</li>
                  <li className="text-sm text-slate-700">• Should we engage a tax specialist for the cross-border restructuring component?</li>
                  <li className="text-sm text-slate-700">• What is the client's timeline expectation for closing?</li>
                </ul>
              ) : (
                <p className="text-sm text-slate-400 italic text-center py-4">Process the meeting to generate open questions</p>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Action Items Tab */}
      {activeTab === 'action-items' && (
        <div>
          {actionItems.length > 0 ? (
            <Card padding="none">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Description</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">Owner</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase hidden lg:table-cell">Due Date</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Toggle</th>
                  </tr>
                </thead>
                <tbody>
                  {actionItems.map((item) => (
                    <tr
                      key={item.id}
                      className={`border-b border-slate-100 transition-colors ${
                        item.status === 'completed' ? 'bg-green-50/30' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-5 py-3">
                        <p className={`text-sm ${item.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                          {item.description}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-600 hidden md:table-cell">{item.owner}</td>
                      <td className="px-5 py-3 text-sm text-slate-500 hidden lg:table-cell">
                        {new Date(item.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-5 py-3"><StatusBadgeUI status={item.status} /></td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleToggleActionItem(item.id)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            item.status === 'completed'
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-slate-300 hover:border-green-500'
                          }`}
                        >
                          {item.status === 'completed' && (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ) : (
            <Card>
              <div className="text-center py-12">
                <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <p className="text-sm text-slate-500 mb-1">No action items yet</p>
                <p className="text-xs text-slate-400">Process this meeting to extract action items</p>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Transcript Tab */}
      {activeTab === 'transcript' && (
        <div>
          {meeting.transcript || mockTranscriptText ? (
            <Card className="bg-slate-50">
              <div className="bg-white border border-slate-200 rounded-lg p-4 max-h-[500px] overflow-y-auto">
                <pre className="text-sm text-slate-700 font-mono whitespace-pre-wrap leading-relaxed">
                  {meeting.transcript || mockTranscriptText}
                </pre>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="text-center py-12">
                <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2.5 2.5 0 00-2.5-2.5H15" />
                </svg>
                <p className="text-sm text-slate-500 mb-1">No transcript available</p>
                <p className="text-xs text-slate-400">Upload a transcript to view it here</p>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
