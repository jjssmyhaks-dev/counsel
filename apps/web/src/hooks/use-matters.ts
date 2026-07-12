'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Matter, PaginatedResponse, CreateMatterRequest } from '@/lib/types';
import { api, mockGetMatters, mockGetMatter, mockCreateMatter } from '@/lib/api';
import { ApiError } from '@/lib/api';

export function useMatters() {
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<PaginatedResponse<Matter>>('/matters');
      setMatters(res.data);
    } catch {
      try {
        const res = await mockGetMatters();
        setMatters(res.data);
      } catch (mockErr) {
        setError(mockErr instanceof ApiError ? mockErr.message : 'Failed to load matters');
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMatters();
  }, [fetchMatters]);

  return { matters, loading, error, refetch: fetchMatters };
}

export function useMatter(id: string) {
  const [matter, setMatter] = useState<Matter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    api.get<Matter>(`/matters/${id}`)
      .then(setMatter)
      .catch(async () => {
        try {
          const m = await mockGetMatter(id);
          setMatter(m);
        } catch (mockErr) {
          setError(mockErr instanceof ApiError ? mockErr.message : 'Failed to load matter');
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  return { matter, loading, error };
}

export function useCreateMatter() {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (data: CreateMatterRequest) => {
    setCreating(true);
    setError(null);
    try {
      const result = await api.post<Matter>('/matters', data);
      setCreating(false);
      return result;
    } catch {
      try {
        const result = await mockCreateMatter(data);
        setCreating(false);
        return result;
      } catch (mockErr) {
        setCreating(false);
        const message = mockErr instanceof ApiError ? mockErr.message : 'Failed to create matter';
        setError(message);
        throw mockErr;
      }
    }
  }, []);

  return { create, creating, error };
}
