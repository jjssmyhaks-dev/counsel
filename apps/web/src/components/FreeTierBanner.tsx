'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface UsageInfo {
  plan: string;
  usage: {
    chatMessages: { current: number; limit: number; remaining: number; isFree: boolean };
    documentUploads: { current: number; limit: number; remaining: number; isFree: boolean };
    kbQueries: { current: number; limit: number; remaining: number; isFree: boolean };
    drafts: { current: number; limit: number; remaining: number; isFree: boolean };
  };
}

export default function FreeTierBanner() {
  const [usage, setUsage] = useState<UsageInfo | null>(null);

  useEffect(() => {
    fetch('/api/v1/usage')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setUsage(data); })
      .catch(() => {});
  }, []);

  if (!usage || !usage.usage.chatMessages.isFree) return null;

  const chat = usage.usage.chatMessages;
  const pct = chat.limit > 0 ? (chat.current / chat.limit) * 100 : 0;
  const isNearLimit = chat.remaining <= 2 && chat.remaining > 0;
  const isExhausted = chat.remaining === 0;

  return (
    <div className={`mx-4 mb-3 rounded-xl border px-4 py-3 text-sm ${
      isExhausted
        ? 'bg-red-50 border-red-200 text-red-800'
        : isNearLimit
        ? 'bg-amber-50 border-amber-200 text-amber-800'
        : 'bg-[#f0faf5] border-[#15b881]/20 text-[#0c0a09]'
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold" style={{ fontFamily: 'Georgia, serif' }}>
              Free Plan
            </span>
            {isExhausted && (
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-700 rounded-full">
                Limit Reached
              </span>
            )}
            {isNearLimit && !isExhausted && (
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 rounded-full">
                Almost Full
              </span>
            )}
          </div>

          {!isExhausted && (
            <div className="mt-2">
              <div className="flex justify-between text-[11px] text-[#717d79] mb-1">
                <span>{chat.current} of {chat.limit} messages used today</span>
                <span>{chat.remaining} remaining</span>
              </div>
              <div className="w-full h-1.5 bg-black/[0.06] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    pct > 80 ? 'bg-red-400' : pct > 60 ? 'bg-amber-400' : 'bg-[#15b881]'
                  }`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </div>
          )}

          {isExhausted && (
            <p className="text-xs text-red-600 mt-1">
              You&apos;ve used all {chat.limit} free AI messages for today. Upgrade to continue using Counsel AI.
            </p>
          )}
        </div>

        <Link
          href="/dashboard/billing"
          className={`flex-shrink-0 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            isExhausted
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-[#0c0a09] text-white hover:bg-[#0a8a5f]'
          }`}
        >
          {isExhausted ? 'Upgrade Now' : 'Get More'}
        </Link>
      </div>
    </div>
  );
}
