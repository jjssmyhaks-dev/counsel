'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Job } from '@/lib/types';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api';

export function useJobs(resourceType: string, resourceId?: string) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (resourceType) params.set('resourceType', resourceType);
      if (resourceId) params.set('resourceId', resourceId);
      const res = await api.get<Job[]>('/jobs?' + params.toString());
      setJobs(Array.isArray(res) ? res : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load jobs');
    }
    setLoading(false);
  }, [resourceType, resourceId]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  return { jobs, loading, error, refetch: fetchJobs };
}
