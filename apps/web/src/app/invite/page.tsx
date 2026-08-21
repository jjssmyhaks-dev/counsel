'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/Logo';

const serif = 'font-serif';

export default function InvitePage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [invite, setInvite] = useState<any>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (token) validateInvite();
  }, [token]);

  async function validateInvite() {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
      const res = await fetch(`${apiUrl}/invites/accept/${token}`);
      const data = await res.json();
      if (data.valid) {
        setInvite(data);
        setName(data.email.split('@')[0]);
      } else {
        setError(data.error || 'Invalid invite');
      }
    } catch {
      setError('Could not validate invite. Please check the link.');
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim() || !password) { setError('Name and password are required.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }

    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
      const res = await fetch(`${apiUrl}/invites/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name: name.trim(), password }),
      });
      const data = await res.json();

      if (data.token) {
        localStorage.setItem('counsel_token', data.token);
        setSuccess(true);
        setTimeout(() => { window.location.href = '/dashboard'; }, 1500);
      } else {
        setError(data.error || 'Failed to join. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fefdfb] p-8" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div className="text-center">
          <Logo />
          <h1 className={`${serif} text-2xl mt-6 text-[#0c0a09]`}>Invalid Invite Link</h1>
          <p className="mt-2 text-[14px] text-[#717d79]">This link is missing a token. Please ask your admin for a valid invite.</p>
          <Link href="/login" className="mt-6 inline-block text-[14px] text-[#0a8a5f] hover:text-[#15b881]">← Go to sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fefdfb] p-8" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 justify-center mb-8">
          <Logo />
          <span className={`${serif} text-xl text-[#0c0a09]`}>Counsel</span>
        </div>

        {success ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-[#eaf7f0] rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-[#15b881]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className={`${serif} text-[1.75rem] text-[#0c0a09]`}>Welcome to Counsel!</h1>
            <p className="mt-2 text-[14px] text-[#717d79]">Redirecting to your dashboard...</p>
          </div>
        ) : invite ? (
          <>
            <div className="bg-[#eaf7f0] border border-[#15b881]/20 rounded-xl px-4 py-3 mb-6">
              <p className="text-[13px] text-[#0a8a5f]">
                You&apos;ve been invited to join <strong>{invite.firmName}</strong> as <strong>{invite.role}</strong>
              </p>
            </div>

            {error && (
              <div className="bg-[#fdf0ee] border border-[#f0705b]/20 text-[#c2452e] px-4 py-3 rounded-xl text-[13px] mb-4">{error}</div>
            )}

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[#0c0a09] mb-1.5">Email</label>
                <input value={invite.email} disabled
                  className="w-full px-4 py-3 rounded-xl border border-black/[0.08] bg-black/[0.02] text-[14px] text-[#717d79] cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#0c0a09] mb-1.5">Full Name</label>
                <input value={name} onChange={e => setName(e.target.value)} required
                  className="w-full px-4 py-3 rounded-xl border border-black/[0.08] bg-white text-[14px] text-[#0c0a09] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30" />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#0c0a09] mb-1.5">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
                  placeholder="At least 8 characters"
                  className="w-full px-4 py-3 rounded-xl border border-black/[0.08] bg-white text-[14px] text-[#0c0a09] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-[#0c0a09] text-white py-3 rounded-xl text-[14px] font-medium hover:bg-[#0a8a5f] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_8px_24px_-8px_rgba(12,10,9,0.4)]">
                {loading ? 'Joining...' : 'Join Team'}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-[#15b881] border-t-transparent rounded-full mx-auto" />
            <p className="mt-4 text-[14px] text-[#717d79]">Validating invite...</p>
          </div>
        )}
      </div>
    </div>
  );
}
