'use client';

import { useState } from 'react';
import Link from 'next/link';

const serif = "font-serif";

function Logo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
      <path d="M6 16C6 10 10 6 16 6c0 6-4 10-10 10z" fill="#15b881" />
      <path d="M26 16c0 6-4 10-10 10 0-6 4-10 10-10z" fill="#0a8a5f" />
      <circle cx="16" cy="16" r="2.2" fill="#0c0a09" />
    </svg>
  );
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email) { setError('Please enter your email address.'); return; }
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
      const res = await fetch(`${apiUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.resetToken) setResetToken(data.resetToken);
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fefdfb] p-8" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 justify-center mb-10">
          <Logo />
          <span className={`${serif} text-xl text-[#0c0a09] tracking-[-0.02em]`}>Counsel</span>
        </div>

        {!sent ? (
          <>
            <h1 className={`${serif} text-[1.75rem] font-normal tracking-[-0.02em] text-[#0c0a09] text-center`}>Forgot your password?</h1>
            <p className="mt-2 text-[14px] text-[#717d79] text-center">Enter your email and we'll send you a reset link.</p>

            {error && (
              <div className="mt-4 bg-[#fdf0ee] border border-[#f0705b]/20 text-[#c2452e] px-4 py-3 rounded-xl text-[13px]">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="email" className="block text-[13px] font-medium text-[#0c0a09] mb-1.5">Email address</label>
                <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@sterling.law"
                  className="w-full px-4 py-3 rounded-xl border border-black/[0.08] bg-white text-[14px] text-[#0c0a09] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40 transition-all" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-[#0c0a09] text-white py-3 rounded-xl text-[14px] font-medium hover:bg-[#0a8a5f] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_8px_24px_-8px_rgba(12,10,9,0.4)] hover:shadow-[0_12px_32px_-8px_rgba(21,184,129,0.4)]">
                {loading ? (
                  <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Sending...</>
                ) : 'Send reset link'}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-[#eaf7f0] rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-[#15b881]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className={`${serif} text-[1.75rem] font-normal tracking-[-0.02em] text-[#0c0a09] text-center`}>Check your email</h1>
            <p className="mt-2 text-[14px] text-[#717d79] text-center">
              If an account exists for <strong className="text-[#0c0a09]">{email}</strong>, you'll receive a password reset link shortly.
            </p>

            {resetToken && (
              <div className="mt-6 bg-[#fef9e7] border border-amber-200 rounded-xl p-4">
                <p className="text-[12px] text-amber-800 font-medium mb-2">🔧 Development mode — reset token:</p>
                <p className="text-[11px] text-amber-700 break-all font-mono bg-white rounded-lg p-2 border border-amber-100">{resetToken}</p>
                <a href={`/reset-password?token=${encodeURIComponent(resetToken)}`}
                  className="inline-block mt-3 text-[13px] font-medium text-[#0a8a5f] hover:text-[#15b881] transition-colors">
                  → Use this link to reset password
                </a>
              </div>
            )}

            <div className="mt-8 text-center">
              <Link href="/login" className="text-[13px] text-[#969e9b] hover:text-[#0c0a09] transition-colors">← Back to sign in</Link>
            </div>
          </>
        )}

        {!sent && (
          <div className="mt-8 text-center">
            <Link href="/login" className="text-[13px] text-[#969e9b] hover:text-[#0c0a09] transition-colors">← Back to sign in</Link>
          </div>
        )}
      </div>
    </div>
  );
}
