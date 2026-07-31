'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Meeting, MeetingActionItem, MeetingDecision, PaginatedResponse } from '@/lib/types';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api';

export function useMeetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<PaginatedResponse<Meeting>>('/meetings');
      setMeetings(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load meetings');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  return { meetings, loading, error, refetch: fetchMeetings };
}

export function useMeeting(id: string) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    api.get<Meeting>(`/meetings/${id}`)
      .then(setMeeting)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Failed to load meeting');
      })
      .finally(() => setLoading(false));
  }, [id]);

  return { meeting, loading, error };
}

export function useMeetingActions(meetingId: string) {
  const [actionItems, setActionItems] = useState<MeetingActionItem[]>([]);
  const [decisions, setDecisions] = useState<MeetingDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!meetingId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<MeetingActionItem[]>(`/meetings/${meetingId}/action-items`),
      api.get<MeetingDecision[]>(`/meetings/${meetingId}/decisions`),
    ])
      .then(([items, decs]) => {
        setActionItems(Array.isArray(items) ? items : []);
        setDecisions(Array.isArray(decs) ? decs : []);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Failed to load meeting items');
      })
      .finally(() => setLoading(false));
  }, [meetingId]);

  return { actionItems, decisions, loading, error };
}
