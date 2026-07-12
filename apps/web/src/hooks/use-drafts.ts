'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Draft, PaginatedResponse, CreateDraftRequest } from '@/lib/types';
import { api, mockGetDrafts, mockGetDraft, mockCreateDraft } from '@/lib/api';
import { ApiError } from '@/lib/api';

export function useDrafts() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<PaginatedResponse<Draft>>('/drafts');
      setDrafts(res.data);
    } catch {
      try {
        const res = await mockGetDrafts();
        setDrafts(res.data);
      } catch (mockErr) {
        setError(mockErr instanceof ApiError ? mockErr.message : 'Failed to load drafts');
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  return { drafts, loading, error, refetch: fetchDrafts };
}

export function useDraft(id: string) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    api.get<Draft>(`/drafts/${id}`)
      .then(setDraft)
      .catch(async () => {
        try {
          const d = await mockGetDraft(id);
          setDraft(d);
        } catch (mockErr) {
          setError(mockErr instanceof ApiError ? mockErr.message : 'Failed to load draft');
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  return { draft, loading, error };
}

export function useCreateDraft() {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (data: CreateDraftRequest) => {
    setCreating(true);
    setError(null);
    try {
      const result = await api.post<Draft>('/drafts', data);
      setCreating(false);
      return result;
    } catch {
      try {
        const result = await mockCreateDraft(data);
        setCreating(false);
        return result;
      } catch (mockErr) {
        setCreating(false);
        const message = mockErr instanceof ApiError ? mockErr.message : 'Failed to create draft';
        setError(message);
        throw mockErr;
      }
    }
  }, []);

  return { create, creating, error };
}
