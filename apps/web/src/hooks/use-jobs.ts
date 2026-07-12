'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Job } from '@/lib/types';
import { ApiError } from '@/lib/api';

export function useJobs(resourceType: string, resourceId?: string) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // In mock mode, return empty jobs. Real API would filter by resource.
      setJobs([]);
    } catch {
      setError('Failed to load jobs');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  return { jobs, loading, error, refetch: fetchJobs };
}
