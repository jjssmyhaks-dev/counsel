import React from 'react';
import { Card } from '../ui/card';
import type { KbAnswer } from '@/lib/types';
import { Badge } from '../ui/badge';

interface KbAnswerDisplayProps {
  answer: KbAnswer;
}

export function KbAnswerDisplay({ answer }: KbAnswerDisplayProps) {
  return (
    <Card padding="md">
      <div className="space-y-4">
        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{answer.answer}</p>
        <div className="flex items-center gap-2">
          <Badge variant="info">Confidence: {answer.confidence}</Badge>
          <span className="text-xs text-slate-500">{answer.sources.length} sources</span>
        </div>
      </div>
    </Card>
  );
}
