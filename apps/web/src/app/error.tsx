'use client';

import { useEffect } from 'react';

const serif = 'font-serif';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Counsel runtime error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#fefdfb] text-[#0c0a09] antialiased flex items-center justify-center p-6" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="max-w-lg w-full text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] text-red-600 mb-6">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          Something went wrong
        </div>
        <h1 className={`${serif} text-[2rem] font-normal tracking-[-0.02em] text-[#0c0a09]`}>
          Unexpected error
        </h1>
        <p className="mt-3 text-[15px] text-[#717d79] leading-relaxed">
          An unexpected error occurred. Our team has been notified. You can try again or return to the dashboard.
        </p>
        {error.digest && (
          <p className="mt-2 text-[12px] font-mono text-[#969e9b]">Error ID: {error.digest}</p>
        )}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={reset}
            className="text-[14px] font-medium text-white bg-[#0c0a09] hover:bg-[#15b881] transition-colors rounded-full px-6 py-3"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="text-[14px] font-medium text-[#0c0a09] bg-white border border-black/[0.08] hover:border-[#15b881]/40 transition-colors rounded-full px-6 py-3"
          >
            Go to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
