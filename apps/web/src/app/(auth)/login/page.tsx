'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login } from '@/lib/auth';
import { Logo } from '@/components/Logo';

const serif = "font-serif";

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
  const [showPassword, setShowPassword] = useState(false);

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
              <div className="relative"><label htmlFor="password" className="block text-[13px] font-medium text-[#0c0a09] mb-1.5">Password</label></div>
                <div className="relative">
                <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full px-4 py-3 pr-12 rounded-xl border border-black/[0.08] bg-white text-[14px] text-[#0c0a09] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40 transition-all" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[#969e9b] hover:text-[#0c0a09] hover:bg-black/[0.04] transition-all"
                  tabIndex={-1} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  )}
                </button>
                </div>
              <button type="submit" disabled={loading} className="w-full bg-[#0c0a09] text-white py-3 rounded-xl text-[14px] font-medium hover:bg-[#0a8a5f] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_8px_24px_-8px_rgba(12,10,9,0.4)] hover:shadow-[0_12px_32px_-8px_rgba(21,184,129,0.4)]">
                {loading ? <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Signing in...</> : 'Sign in'}
              </button>
              <div className="text-right">
                <Link href="/forgot-password" className="text-[12px] text-[#969e9b] hover:text-[#0a8a5f] transition-colors">Forgot password?</Link>
              </div>
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
