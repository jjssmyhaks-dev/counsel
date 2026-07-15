'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const serif = 'font-serif';
import type { KbAnswer, KbQueryRequest, KbSource } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';

interface QueryRecord {
 id: string;
 question: string;
 answer: KbAnswer;
 createdAt: string;
}

const SAMPLE_RESPONSES: QueryRecord[] = [
 {
 id: 'kb-1',
 question: 'What is our standard indemnification language for M&A?',
 answer: {
 answer:
 'Our standard indemnification language for M&A transactions includes a liability cap of 10-15% of purchase price, a 1% basket threshold (meaning claims must exceed 1% of purchase price before indemnification applies), and a 12-month survival period for general representations. For fundamental representations (e.g., organization, authority, capitalization), we recommend a longer survival period or no cap. See the playbook rule "Indemnification Cap" for detailed criteria.',
 confidence: 'high',
 sources: [
 { id: 'src-1', title: 'M&A Playbook - Indemnification', documentId: 'playbook-001', excerpt: 'Standard indemnification language with 15% cap...', pageNumber: 42 },
 { id: 'src-2', title: 'Quantum Merger Agreement v3', documentId: 'doc-001', excerpt: 'Seller agrees to indemnify...', pageNumber: 23 },
 ],
 metadata: {},
 },
 createdAt: '2026-07-12T10:30:00Z',
 },
 {
 id: 'kb-2',
 question: 'How should we handle force majeure in commercial leases?',
 answer: {
 answer:
 'For commercial lease force majeure clauses, our firm position is that the clause must explicitly address rent obligations during periods of untenantability. General force majeure language without rent-specific provisions is insufficient—New York courts have consistently required explicit language for rent abatement. We recommend adding language such as: "Rent shall abate during any period the premises are rendered untenantable due to a force majeure event that continues for more than 7 consecutive days."',
 confidence: 'high',
 sources: [
 { id: 'src-3', title: 'Real Estate Playbook - Force Majeure', documentId: 'playbook-003', excerpt: 'Force majeure and rent abatement...', pageNumber: 8 },
 { id: 'src-4', title: 'Brighton Lease Agreement 2024', documentId: 'doc-003', excerpt: 'Neither party shall be liable...', pageNumber: 5 },
 ],
 metadata: {},
 },
 createdAt: '2026-07-11T14:15:00Z',
 },
 {
 id: 'kb-3',
 question: 'What are our billing rates for 2026?',
 answer: {
 answer:
 'Our standard billing rates for 2026 range from $350/hr for junior associates to $850/hr for senior partners. We offer alternative fee arrangements (flat fee, capped fee, success fee) for certain practice areas. All engagement letters should include our standard terms and conditions as set forth in the firm-wide engagement letter template (Document ID: TEMPLATE-EL-2026).',
 confidence: 'medium',
 sources: [
 { id: 'src-5', title: 'Firm Policy Manual 2026', documentId: 'policy-001', excerpt: 'Billing rates and policies...', pageNumber: 22 },
 ],
 metadata: {},
 },
 createdAt: '2026-07-10T09:00:00Z',
 },
];

function ConfidenceBadge({ confidence }: { confidence: KbAnswer['confidence'] }) {
 const variant = confidence === 'high' ? 'success' : confidence === 'medium' ? 'warning' : 'danger';
 return <Badge variant={variant}>{confidence.charAt(0).toUpperCase() + confidence.slice(1)} Confidence</Badge>;
}

function formatDate(d: string) {
 return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function KbPage() {
 const [question, setQuestion] = useState('');
 const [searching, setSearching] = useState(false);
 const [result, setResult] = useState<KbAnswer | null>(null);
 const [history, setHistory] = useState<QueryRecord[]>(SAMPLE_RESPONSES);
 const [error, setError] = useState('');

 async function handleSearch(e: React.FormEvent) {
 e.preventDefault();
 if (!question.trim()) return;

 setSearching(true);
 setError('');
 setResult(null);

 try {
 const req: KbQueryRequest = { question: question.trim() };
 const answer = await api.post<KbAnswer>('/kb/query', req);
 setResult(answer);

 const record: QueryRecord = {
 id: `kb-${Date.now()}`,
 question: question.trim(),
 answer,
 createdAt: new Date().toISOString(),
 };
 setHistory((prev) => [record, ...prev]);
 } catch {
 setError('Failed to query the knowledge base. Please try again.');
 } finally {
 setSearching(false);
 }
 }

 function handleRecentClick(q: string) {
 setQuestion(q);
 // Trigger search automatically
 const syntheticEvent = { preventDefault: () => {} } as React.FormEvent;
 setQuestion(q);
 setTimeout(() => {
 const form = document.querySelector('form');
 if (form) form.requestSubmit();
 }, 100);
 }

 return (
 <div className="space-y-8">
 {/* Header */}
 <div className="page-header text-center !mb-0">
 <h1>Ask the Firm</h1>
 <p>Search your firm&apos;s knowledge base — documents, precedents, playbooks, and policies</p>
 </div>

 {/* Search Bar */}
 <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
 <div className="relative">
 <svg
 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#969e9b]"
 fill="none"
 viewBox="0 0 24 24"
 stroke="currentColor"
 strokeWidth={1.5}
 >
 <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
 </svg>
 <input
 type="text"
 value={question}
 onChange={(e) => setQuestion(e.target.value)}
 placeholder="Ask anything about your firm's documents, precedents, and policies..."
 className="block w-full pl-12 pr-24 py-3.5 text-base border border-black/[0.08] dark:border-slate-700 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40 placeholder:text-[#969e9b]"
 />
 <Button
 type="submit"
 loading={searching}
 disabled={!question.trim()}
 className="absolute right-2 top-1/2 -translate-y-1/2"
 size="sm"
 >
 {searching ? 'Searching' : 'Search'}
 </Button>
 </div>
 <p className="text-xs text-[#969e9b] mt-3 text-center">
 Try: &ldquo;What is our standard indemnification language?&rdquo; · &ldquo;How do we handle force majeure in leases?&rdquo; · &ldquo;What are our 2026 billing rates?&rdquo;
 </p>
 </form>

 {/* Error */}
 {error && (
 <div className="max-w-2xl mx-auto bg-[#fdf0ee] border border-red-200 text-[#c2452e] px-4 py-3 rounded-xl text-sm flex items-center justify-between">
 <span>{error}</span>
 <button onClick={() => setError('')} className="text-red-500 hover:text-[#c2452e] ml-2">
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>
 )}

 {/* Loading */}
 {searching && (
 <div className="max-w-2xl mx-auto">
 <Card className="text-center py-12">
 <Spinner size="md" label="Searching firm knowledge base..." />
 <p className="text-xs text-[#969e9b] mt-4">Scanning documents, playbooks, and precedents...</p>
 </Card>
 </div>
 )}

 {/* Results */}
 {result && !searching && (
 <div className="max-w-3xl mx-auto space-y-4">
 {/* Low confidence warning */}
 {result.confidence === 'low' && (
 <div className="bg-[#fef8e6] border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
 <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
 </svg>
 <p className="text-sm text-[#b45309]">
 No confident match found in firm documents — results may be incomplete. Try rephrasing your question or consult the relevant playbook directly.
 </p>
 </div>
 )}

 {/* Answer Card */}
 {result.answer ? (
 <Card
 className={
 result.confidence === 'high'
 ? 'border-l-4 border-l-emerald-500'
 : result.confidence === 'medium'
 ? 'border-l-4 border-l-amber-500'
 : 'border-l-4 border-l-black/[0.08]'
 }
 >
 <div className="flex items-center justify-between mb-4">
 <h3 className="font-semibold text-[#0c0a09] dark:text-white text-sm">Answer</h3>
 <ConfidenceBadge confidence={result.confidence} />
 </div>
 <p className="text-sm text-[#717d79] dark:text-black/[0.08] leading-relaxed whitespace-pre-wrap">{result.answer}</p>
 </Card>
 ) : (
 <Card className="text-center py-8 border-l-4 border-l-red-400">
 <p className="text-sm text-[#969e9b] dark:text-[#717d79]">
 {result.metadata && typeof result.metadata.message === 'string'
 ? result.metadata.message
 : 'No answer found. Try rephrasing your question.'}
 </p>
 </Card>
 )}

 {/* Sources */}
 {result.sources.length > 0 && (
 <div>
 <h3 className="text-sm font-semibold text-[#717d79] dark:text-black/[0.08] mb-3 flex items-center gap-2">
 <svg className="w-4 h-4 text-[#969e9b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
 </svg>
 Sources
 </h3>
 <div className="space-y-2">
 {result.sources.map((source) => (
 <div key={source.id} className="bg-[#fefdfb] rounded-xl px-3 py-2.5 border border-black/[0.04]">
 <p className="text-xs font-medium text-[#717d79] dark:text-black/[0.08]">{source.title}</p>
 <p className="text-xs text-[#969e9b] dark:text-[#717d79] mt-0.5">
 Page {source.pageNumber}
 </p>
 <p className="text-xs text-[#969e9b] dark:text-[#717d79] italic mt-1 line-clamp-2">
 &ldquo;{source.excerpt}&rdquo;
 </p>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 )}

 {/* Empty state (no results yet, no query running) */}
 {!result && !searching && !error && (
 <div className="max-w-2xl mx-auto">
 <Card className="text-center py-16">
 <div className="w-16 h-16 bg-[#eaf7f0] rounded-2xl flex items-center justify-center mx-auto mb-4">
 <svg className="w-8 h-8 text-[#15b881]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
 </svg>
 </div>
 <h3 className="text-lg font-semibold text-[#0c0a09] dark:text-white mb-1">Ask your firm anything</h3>
 <p className="text-sm text-[#969e9b] dark:text-[#717d79] max-w-md mx-auto">
 Search across all your firm&apos;s documents, precedent clauses, playbook rules, and firm policies using natural language.
 </p>
 </Card>
 </div>
 )}

 {/* Recent Queries */}
 {history.length > 0 && (
 <div className="max-w-3xl mx-auto">
 <h3 className="text-sm font-semibold text-[#717d79] dark:text-black/[0.08] mb-3">Recent Queries</h3>
 <div className="space-y-2">
 {history.slice(0, 5).map((item) => (
 <button
 key={item.id}
 onClick={() => { setQuestion(item.question); }}
 className="w-full text-left bg-white dark:bg-slate-900 rounded-xl border border-black/[0.04] dark:border-white/[0.06] px-4 py-3 hover:bg-[#fefdfb] transition-colors flex items-center justify-between group"
 >
 <div className="min-w-0 flex-1">
 <p className="text-sm text-[#4b5551] truncate">{item.question}</p>
 <p className="text-xs text-[#969e9b] mt-0.5">{formatDate(item.createdAt)}</p>
 </div>
 <div className="flex items-center gap-2 flex-shrink-0 ml-3">
 <ConfidenceBadge confidence={item.answer.confidence} />
 <svg className="w-4 h-4 text-black/[0.08] group-hover:text-[#15b881] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
 </svg>
 </div>
 </button>
 ))}
 </div>
 </div>
 )}
 </div>
 );
}
