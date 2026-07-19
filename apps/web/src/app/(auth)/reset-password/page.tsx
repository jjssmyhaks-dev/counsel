'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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

function EyeIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tokenFromUrl = searchParams.get('token') || '';
  const [token, setToken] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!newPassword || newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (!token) { setError('Reset token is required.'); return; }
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
      const res = await fetch(`${apiUrl}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  if (success) {
    return (
      <>
        <div className="w-16 h-16 bg-[#eaf7f0] rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-[#15b881]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className={`${serif} text-[1.75rem] font-normal tracking-[-0.02em] text-[#0c0a09] text-center`}>Password reset!</h1>
        <p className="mt-2 text-[14px] text-[#717d79] text-center">Your password has been changed. Sign in with your new password.</p>
        <div className="mt-8 text-center">
          <Link href="/login" className="inline-flex items-center justify-center w-full max-w-xs bg-[#0c0a09] text-white py-3 rounded-xl text-[14px] font-medium hover:bg-[#0a8a5f] transition-all shadow-[0_8px_24px_-8px_rgba(12,10,9,0.4)]">Sign in</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className={`${serif} text-[1.75rem] font-normal tracking-[-0.02em] text-[#0c0a09] text-center`}>Reset your password</h1>
      <p className="mt-2 text-[14px] text-[#717d79] text-center">Choose a new password for your account.</p>

      {error && (
        <div className="mt-4 bg-[#fdf0ee] border border-[#f0705b]/20 text-[#c2452e] px-4 py-3 rounded-xl text-[13px]">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {!tokenFromUrl && (
          <div>
            <label htmlFor="token" className="block text-[13px] font-medium text-[#0c0a09] mb-1.5">Reset Token</label>
            <input id="token" type="text" value={token} onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your reset token here"
              className="w-full px-4 py-3 rounded-xl border border-black/[0.08] bg-white text-[14px] text-[#0c0a09] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40 transition-all" />
          </div>
        )}
        <div>
          <label htmlFor="password" className="block text-[13px] font-medium text-[#0c0a09] mb-1.5">New Password <span className="text-[#969e9b] font-normal">(min. 8 characters)</span></label>
          <div className="relative">
            <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 8 characters"
              className="w-full px-4 py-3 pr-12 rounded-xl border border-black/[0.08] bg-white text-[14px] text-[#0c0a09] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40 transition-all" />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[#969e9b] hover:text-[#0c0a09] hover:bg-black/[0.04] transition-all"
              tabIndex={-1} aria-label={showPassword ? 'Hide password' : 'Show password'}>
              <EyeIcon visible={showPassword} />
            </button>
          </div>
        </div>
        <button type="submit" disabled={loading}
          className="w-full bg-[#0c0a09] text-white py-3 rounded-xl text-[14px] font-medium hover:bg-[#0a8a5f] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_8px_24px_-8px_rgba(12,10,9,0.4)] hover:shadow-[0_12px_32px_-8px_rgba(21,184,129,0.4)]">
          {loading ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>

      <div className="mt-8 text-center">
        <Link href="/login" className="text-[13px] text-[#969e9b] hover:text-[#0c0a09] transition-colors">← Back to sign in</Link>
      </div>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fefdfb] p-8" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 justify-center mb-10">
          <Logo />
          <span className={`${serif} text-xl text-[#0c0a09] tracking-[-0.02em]`}>Counsel</span>
        </div>
        <Suspense fallback={<div className="text-[14px] text-[#969e9b] text-center">Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
