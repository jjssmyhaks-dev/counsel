'use client';

import { useState, useEffect } from 'react';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('counsel_cookie_consent');
    if (!consent) {
      // Small delay so it doesn't flash on load
      const timer = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => {
    localStorage.setItem('counsel_cookie_consent', 'accepted');
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem('counsel_cookie_consent', 'declined');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[100] p-4 sm:p-6"
      style={{ background: 'linear-gradient(to top, rgba(254,253,251,0.98), rgba(254,253,251,0.95))', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(0,0,0,0.06)' }}
    >
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Cookie icon */}
        <div className="flex-shrink-0 hidden sm:flex items-center justify-center w-10 h-10 rounded-full bg-[#15b881]/10">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#15b881" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
            <path d="M8.5 8.5v.01" /><path d="M16 15.5v.01" /><path d="M12 12v.01" /><path d="M11 17v.01" /><path d="M7 14v.01" />
          </svg>
        </div>

        <div className="flex-1">
          <p className="text-sm text-[#0c0a09] font-medium" style={{ fontFamily: 'Georgia, serif' }}>
            We use cookies to improve your experience
          </p>
          <p className="text-xs text-[#717d79] mt-1 leading-relaxed">
            Counsel uses essential cookies for authentication and session management, and optional cookies for analytics and personalization.
            By clicking &quot;Accept All&quot;, you consent to our use of cookies. You can manage your preferences at any time.
            Read our{' '}
            <a href="/privacy" className="text-[#15b881] underline hover:text-[#0a8a5f]">Privacy Policy</a>
            {' '}and{' '}
            <a href="/terms" className="text-[#15b881] underline hover:text-[#0a8a5f]">Terms of Service</a>.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={decline}
            className="px-4 py-2 text-xs font-semibold text-[#717d79] border border-black/[0.08] rounded-lg hover:bg-black/[0.03] transition-colors"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="px-5 py-2 text-xs font-semibold text-white bg-[#15b881] rounded-lg hover:bg-[#0a8a5f] transition-colors shadow-sm"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
