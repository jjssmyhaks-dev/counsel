'use client';

import { useState, useCallback } from 'react';
import type { KbQueryRequest, KbAnswer } from '@/lib/types';
import { api, mockKbQuery } from '@/lib/api';
import { ApiError } from '@/lib/api';

export function useKb() {
  const [answer, setAnswer] = useState<KbAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useCallback(async (req: KbQueryRequest) => {
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await api.post<KbAnswer>('/kb/query', req);
      setAnswer(res);
    } catch {
      try {
        const res = await mockKbQuery(req);
        setAnswer(res);
      } catch (mockErr) {
        const message = mockErr instanceof ApiError ? mockErr.message : 'Query failed';
        setError(message);
      }
    }
    setLoading(false);
  }, []);

  const clear = useCallback(() => {
    setAnswer(null);
    setError(null);
  }, []);

  return { answer, loading, error, query, clear };
}
