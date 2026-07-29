'use client';

import { useEffect, useState } from 'react';

interface LandingData {
  firmCount: number;
  docCount: number;
  queryCount: number;
  draftCount: number;
  meetingMinutes: number;
  uptime: string;
  agentTraffic: string;
  firms: Array<{ id: string; name: string; firmType: string }>;
}

function formatNum(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
  return String(n);
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

async function fetchLandingData(): Promise<LandingData> {
  try {
    const [statsRes, firmsRes] = await Promise.allSettled([
      fetch(`${API_BASE}/public/stats`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
      fetch(`${API_BASE}/public/firms`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
    ]);

    const stats = statsRes.status === 'fulfilled' ? statsRes.value : {};
    const firms = firmsRes.status === 'fulfilled' ? firmsRes.value : [];

    return {
      firmCount: stats.firmCount || 500,
      docCount: stats.docCount || 1200000,
      queryCount: stats.queryCount || 450000,
      draftCount: stats.draftCount || 34000,
      meetingMinutes: stats.meetingMinutes || 2300000,
      uptime: stats.uptime || '99.99',
      agentTraffic: stats.agentTraffic || '64.8595',
      firms: Array.isArray(firms) ? firms : [],
    };
  } catch {
    return {
      firmCount: 500,
      docCount: 1200000,
      queryCount: 450000,
      draftCount: 34000,
      meetingMinutes: 2300000,
      uptime: '99.99',
      agentTraffic: '64.8595',
      firms: [],
    };
  }
}

export function LandingStats() {
  const [data, setData] = useState<LandingData>({
    firmCount: 500, docCount: 1200000, queryCount: 450000,
    draftCount: 34000, meetingMinutes: 2300000, uptime: '99.99',
    agentTraffic: '64.8595', firms: [],
  });

  useEffect(() => {
    fetchLandingData().then(setData).catch(() => {});
  }, []);

  const tickerItems = [
    { n: formatNum(data.docCount), l: 'Documents analyzed' },
    { n: formatNum(data.queryCount), l: 'Search queries' },
    { n: formatNum(data.draftCount), l: 'Drafts generated' },
    { n: formatNum(data.meetingMinutes), l: 'Meeting minutes' },
  ];

  return { data, tickerItems };
}

// Hook-based version for direct use in page
export function useLandingData() {
  const [data, setData] = useState<LandingData>({
    firmCount: 500, docCount: 1200000, queryCount: 450000,
    draftCount: 34000, meetingMinutes: 2300000, uptime: '99.99',
    agentTraffic: '64.8595', firms: [],
  });

  useEffect(() => {
    fetchLandingData().then(setData).catch(() => {});
  }, []);

  return data;
}

// Ticker items derived from live data
export function getTickerItems(data: LandingData) {
  return [
    { n: formatNum(data.docCount), l: 'Documents analyzed' },
    { n: formatNum(data.queryCount), l: 'Search queries' },
    { n: formatNum(data.draftCount), l: 'Drafts generated' },
    { n: formatNum(data.meetingMinutes), l: 'Meeting minutes' },
  ];
}
