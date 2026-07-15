'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login } from '@/lib/auth';

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

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15b881" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSso, setShowSso] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please enter both email and password.'); return; }
    setLoading(true);
    try {
      await login({ email, password });
      router.push('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setError(message);
    } finally { setLoading(false); }
  };

  const handleSso = async () => {
    if (!email) { setError('Enter your work email for SSO'); return; }
    setLoading(true); setError('');
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
      const res = await fetch(`${apiUrl}/auth/sso/authorize`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || 'SSO requires WorkOS configuration. Use password login instead.');
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch (err: unknown) {
      setError('SSO service unavailable. Please use password login instead.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#fefdfb]" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <div className="hidden lg:flex w-[45%] relative overflow-hidden bg-gradient-to-br from-[#0c0a09] via-[#111c17] to-[#0c0a09] items-center justify-center">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 30% 30%, rgba(21,184,129,0.5), transparent 50%), radial-gradient(circle at 70% 70%, rgba(21,184,129,0.3), transparent 50%)" }} />
        <div className="relative max-w-md px-12">
          <div className="flex items-center gap-3 mb-12"><Logo /><span className={`${serif} text-2xl text-white tracking-[-0.02em]`}>Counsel</span></div>
          <h1 className={`${serif} text-[2.5rem] leading-[1.05] tracking-[-0.02em] text-white`}>The AI workforce<br />your firm deserves</h1>
          <p className="mt-5 text-[15px] text-white/50 leading-relaxed">Document analysis, legal research, AI drafting, and knowledge management — all in one platform.</p>
          <div className="mt-10 space-y-3">
            {["23 clause types auto-detected","RAG-powered legal research with citations","AI drafting in your firm's voice","SOC 2 Type II · ISO 27001 · GDPR ready"].map((c) => (
              <div key={c} className="flex items-center gap-2.5 text-[14px] text-white/60"><CheckIcon /><span>{c}</span></div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-lg">
          <div className="lg:hidden flex items-center gap-2 mb-10"><Logo /><span className={`${serif} text-xl text-[#0c0a09] tracking-[-0.02em]`}>Counsel</span></div>
          <h2 className={`${serif} text-[2rem] font-normal tracking-[-0.02em] text-[#0c0a09]`}>Welcome back</h2>
          <p className="mt-2 text-[14px] text-[#717d79]">Sign in to your account to continue.</p>
          <div className="mt-8 flex gap-1 p-1 rounded-xl bg-[#f0f0f0] w-fit">
            {[{ label: 'Password', value: false },{ label: 'SSO / SAML', value: true }].map((t) => (
              <button key={t.label} onClick={() => setShowSso(t.value)} className={`text-[13px] font-medium px-5 py-2 rounded-lg transition-all ${showSso === t.value ? 'bg-white text-[#0c0a09] shadow-sm' : 'text-[#717d79] hover:text-[#0c0a09]'}`}>{t.label}</button>
            ))}
          </div>
          {error && <div className="mt-4 bg-[#fdf0ee] border border-[#f0705b]/20 text-[#c2452e] px-4 py-3 rounded-xl text-[13px]">{error}</div>}
          {!showSso ? (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div><label htmlFor="email" className="block text-[13px] font-medium text-[#0c0a09] mb-1.5">Email address</label>
                <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@sterling.law" className="w-full px-4 py-3 rounded-xl border border-black/[0.08] bg-white text-[14px] text-[#0c0a09] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40 transition-all" /></div>
              <div><label htmlFor="password" className="block text-[13px] font-medium text-[#0c0a09] mb-1.5">Password</label>
                <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full px-4 py-3 rounded-xl border border-black/[0.08] bg-white text-[14px] text-[#0c0a09] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40 transition-all" /></div>
              <button type="submit" disabled={loading} className="w-full bg-[#0c0a09] text-white py-3 rounded-xl text-[14px] font-medium hover:bg-[#0a8a5f] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_8px_24px_-8px_rgba(12,10,9,0.4)] hover:shadow-[0_12px_32px_-8px_rgba(21,184,129,0.4)]">
                {loading ? <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Signing in...</> : 'Sign in'}
              </button>
            </form>
          ) : (
            <div className="mt-6 space-y-4">
              <div><label htmlFor="sso-email" className="block text-[13px] font-medium text-[#0c0a09] mb-1.5">Work email</label>
                <input id="sso-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourfirm.com" className="w-full px-4 py-3 rounded-xl border border-black/[0.08] bg-white text-[14px] text-[#0c0a09] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40 transition-all" /></div>
              <button onClick={handleSso} disabled={loading} className="w-full bg-[#0c0a09] text-white py-3 rounded-xl text-[14px] font-medium hover:bg-[#0a8a5f] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Redirecting...</> : 'Continue with SSO'}
              </button>
              <p className="text-[11px] text-[#969e9b] text-center">Powered by WorkOS — Okta, Azure AD, Google Workspace</p>
            </div>
          )}
          <div className="mt-8 pt-8 border-t border-black/[0.04]">
            <div className="text-[13px] text-[#969e9b]">Don&apos;t have an account? <Link href="/register" className="text-[#0a8a5f] font-medium hover:text-[#15b881] transition-colors">Create account</Link></div>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-[#969e9b]">
              {["Free 14-day trial","No credit card","SOC 2 Type II"].map((b) => (<span key={b} className="inline-flex items-center gap-1.5"><CheckIcon />{b}</span>))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
