'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15b881" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firmName, setFirmName] = useState('');
  const [firmType, setFirmType] = useState<'LEGAL' | 'CONSULTING'>('LEGAL');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name || !email || !password) { setError('Please fill in all required fields.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
      const res = await fetch(`${apiUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, firmName: firmName || undefined, firmType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      if (typeof window !== 'undefined') {
        localStorage.setItem('counsel_token', data.token);
        localStorage.setItem('counsel_user', JSON.stringify(data.user));
        if (data.firm) localStorage.setItem('counsel_firm', JSON.stringify(data.firm));
      }
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex bg-[#fefdfb]" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      {/* Left: Brand */}
      <div className="hidden lg:flex w-[45%] relative overflow-hidden bg-gradient-to-br from-[#0c0a09] via-[#111c17] to-[#0c0a09] items-center justify-center">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 70% 50%, rgba(21,184,129,0.5), transparent 50%), radial-gradient(circle at 30% 30%, rgba(21,184,129,0.3), transparent 50%)" }} />
        <div className="relative max-w-md px-12">
          <div className="flex items-center gap-3 mb-12">
            <Logo />
            <span className={`${serif} text-2xl text-white tracking-[-0.02em]`}>Counsel</span>
          </div>
          <h1 className={`${serif} text-[2.5rem] leading-[1.05] tracking-[-0.02em] text-white`}>
            Start building<br />with AI today
          </h1>
          <p className="mt-5 text-[15px] text-white/50 leading-relaxed">
            Get full access to document analysis, AI drafting, and knowledge management. No credit card required.
          </p>
          <div className="mt-10 space-y-3">
            {[
              "14-day free trial with full access", "500+ legal teams trust Counsel",
              "Set up in under 5 minutes", "SOC 2 Type II certified platform"
            ].map((c) => (
              <div key={c} className="flex items-center gap-2.5 text-[14px] text-white/60"><CheckIcon /><span>{c}</span></div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-lg">
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <Logo />
            <span className={`${serif} text-xl text-[#0c0a09] tracking-[-0.02em]`}>Counsel</span>
          </div>

          <h2 className={`${serif} text-[2rem] font-normal tracking-[-0.02em] text-[#0c0a09]`}>Create your account</h2>
          <p className="mt-2 text-[14px] text-[#717d79]">Start your 14-day free trial. No credit card required.</p>

          {error && (
            <div className="mt-4 bg-[#fdf0ee] border border-[#f0705b]/20 text-[#c2452e] px-4 py-3 rounded-xl text-[13px]">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label htmlFor="name" className="block text-[13px] font-medium text-[#0c0a09] mb-1.5">Full Name *</label>
              <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full px-4 py-3 rounded-xl border border-black/[0.08] bg-white text-[14px] text-[#0c0a09] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40 transition-all" required />
            </div>
            <div>
              <label htmlFor="email" className="block text-[13px] font-medium text-[#0c0a09] mb-1.5">Email *</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@yourfirm.com"
                className="w-full px-4 py-3 rounded-xl border border-black/[0.08] bg-white text-[14px] text-[#0c0a09] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40 transition-all" required />
            </div>
            <div>
              <label htmlFor="password" className="block text-[13px] font-medium text-[#0c0a09] mb-1.5">Password * <span className="text-[#969e9b] font-normal">(min. 8 characters)</span></label>
              <div className="relative">
              <input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full px-4 py-3 pr-12 rounded-xl border border-black/[0.08] bg-white text-[14px] text-[#0c0a09] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40 transition-all" required minLength={8} />
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
            </div>
            <div>
              <label htmlFor="firmName" className="block text-[13px] font-medium text-[#0c0a09] mb-1.5">Firm Name <span className="text-[#969e9b] font-normal">(optional)</span></label>
              <input id="firmName" type="text" value={firmName} onChange={(e) => setFirmName(e.target.value)}
                placeholder="Sterling & Associates"
                className="w-full px-4 py-3 rounded-xl border border-black/[0.08] bg-white text-[14px] text-[#0c0a09] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40 transition-all" />
            </div>

            {/* Firm type selector */}
            <div>
              <label className="block text-[13px] font-medium text-[#0c0a09] mb-2">Firm Type</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'LEGAL' as const, label: '🏛️ Legal Firm', sub: 'Document analysis, drafting, case research' },
                  { value: 'CONSULTING' as const, label: '📊 Consulting Firm', sub: 'Proposals, market intel, engagement mgmt' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFirmType(opt.value)}
                    className={`text-left p-3 rounded-xl border-2 transition-all ${
                      firmType === opt.value
                        ? 'border-[#15b881] bg-[#eaf7f0]'
                        : 'border-black/[0.06] bg-white hover:border-[#15b881]/30'
                    }`}
                  >
                    <div className="text-[13px] font-semibold text-[#0c0a09]">{opt.label}</div>
                    <div className="text-[11px] text-[#969e9b] mt-0.5">{opt.sub}</div>
                    {firmType === opt.value && (
                      <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-[#0a8a5f]">
                        <CheckIcon /> Selected
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-[#0c0a09] text-white py-3 rounded-xl text-[14px] font-medium hover:bg-[#0a8a5f] transition-all disabled:opacity-50 flex items-center justify-center shadow-[0_8px_24px_-8px_rgba(12,10,9,0.4)] hover:shadow-[0_12px_32px_-8px_rgba(21,184,129,0.4)]">
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-black/[0.04]">
            <div className="text-[13px] text-[#969e9b]">
              Already have an account?{' '}
              <Link href="/login" className="text-[#0a8a5f] font-medium hover:text-[#15b881] transition-colors">Sign in</Link>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-[#969e9b]">
              {["14-day free trial", "No credit card", "Cancel anytime"].map((b) => (
                <span key={b} className="inline-flex items-center gap-1.5"><CheckIcon />{b}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
