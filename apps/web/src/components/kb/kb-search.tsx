'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Spinner } from '../ui/spinner';
import { Badge } from '../ui/badge';
import type { KbAnswer } from '@/lib/types';

interface KbSearchProps {
  onQuery: (question: string) => Promise<void>;
  answer: KbAnswer | null;
  loading: boolean;
}

export function KbSearch({ onQuery, answer, loading }: KbSearchProps) {
  const [question, setQuestion] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!question.trim() || loading) return;
    await onQuery(question.trim());
  };

  const CONFIG_EXAMPLES = [
    'What is our standard indemnification language for M&A?',
    'What is the firm policy on non-compete duration?',
    'Our force majeure position for commercial leases',
    'Billing rates and engagement letter requirements',
  ];

  return (
    <div>
      {/* Search Bar */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="relative">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask anything about firm policies, precedents, or playbook rules..."
            className="w-full pl-12 pr-24 py-4 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={!question.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2"
          >
            Search
          </Button>
        </div>
      </form>

      {/* Example queries (shown when no answer yet) */}
      {!answer && !loading && (
        <div className="mb-8">
          <p className="text-sm text-slate-500 mb-3">Try asking about:</p>
          <div className="flex flex-wrap gap-2">
            {CONFIG_EXAMPLES.map((example, idx) => (
              <button
                key={idx}
                onClick={() => { setQuestion(example); setTimeout(() => handleSubmit(), 100); }}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="py-16">
          <Spinner label="Searching knowledge base..." />
        </div>
      )}

      {/* Answer */}
      {answer && !loading && (
        <div>
          {answer.confidence === 'low' ? (
            <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-8 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-amber-50 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No confident match found</h3>
              <p className="text-sm text-slate-500 mb-4">
                The knowledge base does not contain a confident answer to your question.
              </p>
              <p className="text-sm text-slate-500">
                {answer.metadata?.message as string || 'Try rephrasing your question or consult the relevant playbook.'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Answer Card */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Badge
                    variant={answer.confidence === 'high' ? 'success' : 'warning'}
                    size="md"
                    dot
                  >
                    {answer.confidence === 'high' ? 'High Confidence' : 'Medium Confidence'}
                  </Badge>
                </div>
                <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {answer.answer}
                </div>
              </div>

              {/* Sources */}
              {answer.sources.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Sources ({answer.sources.length})
                  </h3>
                  <div className="space-y-2">
                    {answer.sources.map((source) => (
                      <div
                        key={source.id}
                        className="flex items-center gap-3 bg-white rounded-lg border border-slate-200 p-4"
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 truncate">{source.title}</p>
                          <p className="text-xs text-slate-500 truncate">&ldquo;{source.excerpt}&rdquo; (p. {source.pageNumber})</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
