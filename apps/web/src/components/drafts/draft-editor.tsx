'use client';

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Select } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import type { Draft, Matter } from '@/lib/types';
import { Spinner } from '../ui/spinner';

interface DraftEditorProps {
  draft: Draft | null;
  matters: Matter[];
  loading: boolean;
  onGenerate: (content: string) => Promise<void>;
  onFinalize: () => Promise<void>;
}

const TYPE_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'memo', label: 'Memo' },
  { value: 'report', label: 'Report' },
  { value: 'brief', label: 'Brief' },
  { value: 'letter', label: 'Letter' },
];

export function DraftEditor({ draft, matters, loading, onGenerate, onFinalize }: DraftEditorProps) {
  const [content, setContent] = useState(draft?.content || '');
  const [generating, setGenerating] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const matterOptions = [
    { value: '', label: 'Select matter...' },
    ...matters.map((m) => ({ value: m.id, label: m.name })),
  ];

  if (loading) {
    return (
      <div className="py-12">
        <Spinner label="Loading draft..." />
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="py-12 text-center">
        <p className="text-slate-500">Draft not found.</p>
      </div>
    );
  }

  const handleGenerate = async () => {
    setGenerating(true);
    await onGenerate(content || 'Generating draft content based on instructions...');
    setGenerating(false);
  };

  const handleFinalize = async () => {
    setFinalizing(true);
    await onFinalize();
    setFinalizing(false);
  };

  return (
    <div className="space-y-6">
      {/* Header with metadata */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="Title" value={draft.title} readOnly disabled />
          <Select label="Type" options={TYPE_OPTIONS} value={draft.type} disabled />
          <Select label="Matter" options={matterOptions} value={draft.matterId} disabled />
        </div>
        <div className="mt-4">
          <Textarea
            label="Instructions"
            value={draft.instructions}
            readOnly
            disabled
            rows={2}
          />
        </div>
      </div>

      {/* Generated Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Generated Content</h3>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleGenerate} loading={generating}>
              Regenerate
            </Button>
            <Button variant="primary" onClick={handleFinalize} loading={finalizing}>
              Finalize
            </Button>
          </div>
        </div>
        <textarea
          className="w-full min-h-[400px] rounded-lg border border-slate-300 p-4 text-sm font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Generated content will appear here..."
        />
      </div>
    </div>
  );
}
