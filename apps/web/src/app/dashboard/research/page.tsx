'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const serif = 'font-serif';
import { api } from '@/lib/api';
import type { ResearchBrief, Matter } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Spinner } from '@/components/ui/spinner';

function formatDate(d: string) {
 return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusBadgeUI({ status }: { status: ResearchBrief['status'] }) {
 const variant = status === 'pending' ? 'warning' : status === 'researching' ? 'info' : status === 'completed' ? 'success' : 'danger';
 const label = status === 'researching' ? 'Processing' : status.charAt(0).toUpperCase() + status.slice(1);
 return <Badge variant={variant} dot>{label}</Badge>;
}

export default function ResearchPage() {
 const router = useRouter();
 const [briefs, setBriefs] = useState<ResearchBrief[]>([]);
 const [matters, setMatters] = useState<Matter[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');
 const [showNewResearch, setShowNewResearch] = useState(false);
 const [creating, setCreating] = useState(false);

 // New research form
 const [newTitle, setNewTitle] = useState('');
 const [newQuery, setNewQuery] = useState('');
 const [newMatterId, setNewMatterId] = useState('');
 const [selectedDocs, setSelectedDocs] = useState<string[]>([]);

 useEffect(() => { loadData(); }, []);

 async function loadData() {
 setLoading(true);
 setError('');
 try {
 const [researchResp, mattersResp] = await Promise.all([
 api.get<{ data: ResearchBrief[] }>('/research'),
 api.get<{ data: Matter[] }>('/matters'),
 ]);
 setBriefs(researchResp.data);
 setMatters(mattersResp.data);
 } catch {
 setError('Failed to load research briefs.');
 } finally {
 setLoading(false);
 }
 }

 async function handleCreate() {
 if (!newTitle.trim() || !newQuery.trim() || !newMatterId) return;
 setCreating(true);
 try {
 const brief = await api.post<ResearchBrief>('/research', {
 title: newTitle,
 query: newQuery,
 matterId: newMatterId,
 sources: selectedDocs,
 });
 setBriefs((prev) => [brief, ...prev]);
 setShowNewResearch(false);
 resetForm();
 } catch {
 setError('Failed to create research brief.');
 } finally {
 setCreating(false);
 }
 }

 function resetForm() {
 setNewTitle('');
 setNewQuery('');
 setNewMatterId('');
 setSelectedDocs([]);
 }

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div className="page-header !mb-0">
 <h1>Research &amp; Synthesis</h1>
 <p>AI-powered legal research briefs, precedent analysis, and memo synthesis</p>
 </div>
 <Button onClick={() => setShowNewResearch(true)}>
 <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
 </svg>
 New Research
 </Button>
 </div>

 {/* Error */}
 {error && <ErrorState message={error} onRetry={loadData} />}

 {/* Loading */}
 {loading && (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {[1, 2, 3, 4, 5, 6].map((i) => (
 <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-black/[0.04] dark:border-white/[0.06] p-6 animate-pulse">
 <div className="h-5 bg-black/[0.04] rounded w-3/4 mb-3" />
 <div className="h-3 bg-black/[0.03] rounded w-1/2 mb-2" />
 <div className="h-6 bg-black/[0.04] rounded-full w-20 mb-3" />
 <div className="h-3 bg-black/[0.03] rounded w-full mb-1" />
 <div className="h-3 bg-black/[0.03] rounded w-2/3 mb-4" />
 <div className="h-8 bg-black/[0.04] rounded w-24" />
 </div>
 ))}
 </div>
 )}

 {/* Research Grid */}
 {!loading && !error && briefs.length > 0 && (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {briefs.map((brief) => (
 <Card
 key={brief.id}
 hover
 className="flex flex-col"
 onClick={() => router.push(`/research/${brief.id}`)}
 >
 <div className="flex items-start justify-between mb-3">
 <h3 className="font-semibold text-[#0c0a09] dark:text-white text-sm leading-snug pr-2 flex-1">
 {brief.title}
 </h3>
 </div>
 <p className="text-xs text-[#969e9b] dark:text-[#717d79] mb-3">{brief.matterName}</p>
 <div className="mb-3">
 <StatusBadgeUI status={brief.status} />
 </div>
 {brief.findings ? (
 <p className="text-xs text-[#717d79] dark:text-[#969e9b] line-clamp-3 mb-3 flex-1">
 {brief.findings.substring(0, 120)}
 {brief.findings.length > 120 ? '...' : ''}
 </p>
 ) : (
 <p className="text-xs text-[#969e9b] italic mb-3 flex-1">
 {brief.status === 'researching' ? 'Research in progress...' : 'No findings yet'}
 </p>
 )}
 <div className="flex items-center justify-between mt-auto pt-3 border-t border-black/[0.04]">
 <span className="text-xs text-[#969e9b]">{formatDate(brief.createdAt)}</span>
 <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); router.push(`/research/${brief.id}`); }}>
 View
 </Button>
 </div>
 </Card>
 ))}
 </div>
 )}

 {/* Empty state */}
 {!loading && !error && briefs.length === 0 && (
 <div className="bg-white dark:bg-slate-900 rounded-xl border border-black/[0.04] dark:border-white/[0.06] shadow-sm">
 <EmptyState
 title="No research briefs yet"
 description="Start your first legal research query. Our AI will search through your firm's documents, precedent, and external sources."
 actionLabel="Start Research"
 onAction={() => setShowNewResearch(true)}
 icon={
 <svg className="w-16 h-16 text-black/[0.08] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
 </svg>
 }
 />
 </div>
 )}

 {/* New Research Modal */}
 <Modal open={showNewResearch} onClose={() => { setShowNewResearch(false); resetForm(); }} title="New Research Brief" size="lg">
 <div className="space-y-4">
 <Input
 label="Brief Title"
 placeholder="e.g., Delaware Merger Agreement Precedent Review"
 value={newTitle}
 onChange={(e) => setNewTitle(e.target.value)}
 />
 <Textarea
 label="Research Query"
 placeholder="Describe what you need researched. Be specific about jurisdiction, legal issues, key terms, and the output format you need..."
 value={newQuery}
 onChange={(e) => setNewQuery(e.target.value)}
 rows={4}
 />
 <Select
 label="Related Matter"
 options={[
 { value: '', label: 'Select a matter...' },
 ...matters.map((m) => ({ value: m.id, label: `${m.name} (${m.clientName})` })),
 ]}
 value={newMatterId}
 onChange={(e) => setNewMatterId(e.target.value)}
 />
 <div>
 <label className="block text-sm font-medium text-[#717d79] dark:text-black/[0.08] mb-1.5">
 Source Documents (optional)
 </label>
 <p className="text-xs text-[#969e9b] mb-2">Select specific documents to prioritize in research</p>
 <div className="max-h-36 overflow-y-auto border border-black/[0.04] dark:border-white/[0.06] rounded-xl">
 {['Quantum Dynamics - Merger Agreement v3.pdf', 'Evergreen - Patent Filing US2026-001234.pdf', 'Brighton - Lease Agreement 2024.docx', 'NovaTech - Data Processing Agreement.pdf', 'Thompson - Settlement Agreement Draft.pdf', 'Quantum - Regulatory Filing SEC.pdf'].map(
 (doc, i) => {
 const isSelected = selectedDocs.includes(doc);
 return (
 <label
 key={i}
 className={`flex items-center gap-2 px-3 py-2 hover:bg-[#fefdfb] cursor-pointer text-sm ${
 isSelected ? 'bg-[#eaf7f0]' : ''
 }`}
 >
 <input
 type="checkbox"
 checked={isSelected}
 onChange={() => {
 setSelectedDocs((prev) =>
 prev.includes(doc) ? prev.filter((d) => d !== doc) : [...prev, doc]
 );
 }}
 className="rounded border-black/[0.08] dark:border-slate-700"
 />
 <span className="text-[#717d79] dark:text-black/[0.08]">{doc}</span>
 </label>
 );
 }
 )}
 </div>
 </div>
 </div>
 <div className="flex justify-end gap-3 mt-6">
 <Button variant="secondary" onClick={() => { setShowNewResearch(false); resetForm(); }}>Cancel</Button>
 <Button
 onClick={handleCreate}
 loading={creating}
 disabled={!newTitle.trim() || !newQuery.trim() || !newMatterId}
 >
 Start Research
 </Button>
 </div>
 </Modal>
 </div>
 );
}
