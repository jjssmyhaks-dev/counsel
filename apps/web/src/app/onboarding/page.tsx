'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { api } from '@/lib/api';

const serif = 'font-serif';

const COMPANY_SIZES = [
  { value: 'SOLO', label: 'Solo Practitioner', desc: 'Just me', icon: '👤', seats: '1 user', plan: 'Starter — ₹999/mo' },
  { value: 'SMALL', label: 'Small Firm', desc: '2–10 people', icon: '👥', seats: 'Up to 10 users', plan: 'Professional — ₹4,999/mo' },
  { value: 'MEDIUM', label: 'Mid-Size Firm', desc: '11–30 people', icon: '🏢', seats: 'Up to 30 users', plan: 'Professional — ₹9,999/mo' },
  { value: 'LARGE', label: 'Large Firm', desc: '31–100 people', icon: '🏛️', seats: 'Up to 100 users', plan: 'Business — ₹24,999/mo' },
  { value: 'ENTERPRISE', label: 'Enterprise', desc: '100+ people', icon: '🌐', seats: 'Unlimited', plan: 'Enterprise — Custom pricing' },
];

const FIRM_TYPES = [
  { value: 'LEGAL', label: 'Law Firm', icon: '⚖️' },
  { value: 'CA', label: 'CA / Accounting Firm', icon: '📊' },
  { value: 'CONSULTING', label: 'Consulting Firm', icon: '💼' },
  { value: 'HYBRID', label: 'Multi-Practice', icon: '🔄' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [companySize, setCompanySize] = useState('');
  const [firmType, setFirmType] = useState('');
  const [firmName, setFirmName] = useState('');
  const [invites, setInvites] = useState<{ email: string; role: string }[]>([{ email: '', role: 'ASSOCIATE' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recommendation, setRecommendation] = useState<any>(null);

  async function handleSetup() {
    setError('');
    if (!companySize || !firmType) { setError('Please select company size and firm type.'); return; }
    setLoading(true);
    try {
      const res: any = await api.post('/onboarding/setup', { companySize, firmType, firmName: firmName || undefined });
      setRecommendation(res.recommendation);
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleInviteTeam() {
    setLoading(true);
    try {
      const validInvites = invites.filter(i => i.email.includes('@'));
      if (validInvites.length > 0) {
        await api.post('/onboarding/invite-team', { invites: validInvites });
      }
      setStep(3);
    } catch (err: any) {
      setError(err.message || 'Failed to send invites.');
    } finally {
      setLoading(false);
    }
  }

  function addInvite() {
    setInvites([...invites, { email: '', role: 'ASSOCIATE' }]);
  }

  function updateInvite(index: number, field: string, value: string) {
    const updated = [...invites];
    (updated[index] as any)[field] = value;
    setInvites(updated);
  }

  function removeInvite(index: number) {
    setInvites(invites.filter((_, i) => i !== index));
  }

  return (
    <div className="min-h-screen bg-[#fefdfb] flex flex-col" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-black/[0.04] flex items-center gap-3">
        <Logo />
        <span className={`${serif} text-lg text-[#0c0a09]`}>Counsel</span>
        <span className="text-[11px] text-[#969e9b] ml-2">Setup</span>
      </div>

      {/* Progress */}
      <div className="px-6 py-4">
        <div className="flex gap-2 max-w-2xl mx-auto">
          {['Firm Type', 'Company Size', 'Invite Team', 'Done'].map((label, i) => (
            <div key={i} className="flex-1">
              <div className={`h-1.5 rounded-full ${i <= step ? 'bg-[#15b881]' : 'bg-black/[0.06]'}`} />
              <p className={`text-[11px] mt-1 ${i <= step ? 'text-[#0a8a5f] font-medium' : 'text-[#969e9b]'}`}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          {error && (
            <div className="bg-[#fdf0ee] border border-[#f0705b]/20 text-[#c2452e] px-4 py-3 rounded-xl text-[13px] mb-6">{error}</div>
          )}

          {/* Step 0: Firm Type */}
          {step === 0 && (
            <div>
              <h1 className={`${serif} text-[2rem] text-[#0c0a09] mb-2`}>What type of firm are you?</h1>
              <p className="text-[14px] text-[#717d79] mb-8">This helps us tailor Counsel to your practice.</p>
              <div className="grid grid-cols-2 gap-4">
                {FIRM_TYPES.map(ft => (
                  <button key={ft.value} onClick={() => { setFirmType(ft.value); setStep(1); }}
                    className={`p-6 rounded-2xl border-2 text-left transition-all hover:shadow-lg ${
                      firmType === ft.value
                        ? 'border-[#15b881] bg-[#eaf7f0]'
                        : 'border-black/[0.06] bg-white hover:border-[#15b881]/30'
                    }`}>
                    <span className="text-3xl">{ft.icon}</span>
                    <p className="mt-3 font-semibold text-[#0c0a09]">{ft.label}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Company Size */}
          {step === 1 && (
            <div>
              <button onClick={() => setStep(0)} className="text-[13px] text-[#969e9b] hover:text-[#0c0a09] mb-4">← Back</button>
              <h1 className={`${serif} text-[2rem] text-[#0c0a09] mb-2`}>How big is your team?</h1>
              <p className="text-[14px] text-[#717d79] mb-8">We&apos;ll recommend the best plan for your size.</p>

              <div className="mb-6">
                <label className="block text-[13px] font-medium text-[#0c0a09] mb-1.5">Firm Name (optional)</label>
                <input value={firmName} onChange={e => setFirmName(e.target.value)} placeholder="e.g. Sterling & Associates"
                  className="w-full px-4 py-3 rounded-xl border border-black/[0.08] bg-white text-[14px] text-[#0c0a09] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30" />
              </div>

              <div className="space-y-3">
                {COMPANY_SIZES.map(size => (
                  <button key={size.value} onClick={() => setCompanySize(size.value)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4 ${
                      companySize === size.value
                        ? 'border-[#15b881] bg-[#eaf7f0]'
                        : 'border-black/[0.06] bg-white hover:border-[#15b881]/30'
                    }`}>
                    <span className="text-2xl">{size.icon}</span>
                    <div className="flex-1">
                      <p className="font-semibold text-[#0c0a09]">{size.label} <span className="font-normal text-[#717d79]">— {size.desc}</span></p>
                      <p className="text-[12px] text-[#717d79]">{size.seats} · {size.plan}</p>
                    </div>
                    {companySize === size.value && (
                      <svg className="w-5 h-5 text-[#15b881]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>

              {companySize && (
                <button onClick={handleSetup} disabled={loading}
                  className="mt-6 w-full bg-[#0c0a09] text-white py-3 rounded-xl text-[14px] font-medium hover:bg-[#0a8a5f] transition-all disabled:opacity-50">
                  {loading ? 'Setting up...' : 'Continue'}
                </button>
              )}
            </div>
          )}

          {/* Step 2: Invite Team */}
          {step === 2 && (
            <div>
              <button onClick={() => setStep(1)} className="text-[13px] text-[#969e9b] hover:text-[#0c0a09] mb-4">← Back</button>
              <h1 className={`${serif} text-[2rem] text-[#0c0a09] mb-2`}>Invite your team</h1>
              <p className="text-[14px] text-[#717d79] mb-2">Add teammates by email. They&apos;ll get an invite link to join.</p>

              {recommendation && (
                <div className="bg-[#eaf7f0] border border-[#15b881]/20 rounded-xl px-4 py-3 mb-6">
                  <p className="text-[13px] text-[#0a8a5f] font-medium">
                    💡 Recommended plan: {recommendation.plan} ({recommendation.seats} seats, {recommendation.price})
                  </p>
                </div>
              )}

              <div className="space-y-3 mb-4">
                {invites.map((invite, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={invite.email} onChange={e => updateInvite(i, 'email', e.target.value)}
                      placeholder="colleague@firm.com" type="email"
                      className="flex-1 px-4 py-2.5 rounded-xl border border-black/[0.08] bg-white text-[13px] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30" />
                    <select value={invite.role} onChange={e => updateInvite(i, 'role', e.target.value)}
                      className="px-3 py-2.5 rounded-xl border border-black/[0.08] bg-white text-[13px] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30">
                      <option value="ASSOCIATE">Associate</option>
                      <option value="PARTNER">Partner</option>
                      <option value="ADMIN">Admin</option>
                      <option value="ANALYST">Analyst</option>
                      <option value="READONLY">Viewer</option>
                    </select>
                    {invites.length > 1 && (
                      <button onClick={() => removeInvite(i)} className="px-3 py-2 text-[#969e9b] hover:text-[#c2452e] transition-colors">×</button>
                    )}
                  </div>
                ))}
              </div>

              <button onClick={addInvite} className="text-[13px] text-[#0a8a5f] hover:text-[#15b881] mb-6 flex items-center gap-1">
                + Add another
              </button>

              <div className="flex gap-3">
                <button onClick={() => setStep(3)} className="px-6 py-3 rounded-xl text-[14px] text-[#717d79] hover:bg-black/[0.03] transition-colors">
                  Skip for now
                </button>
                <button onClick={handleInviteTeam} disabled={loading}
                  className="flex-1 bg-[#0c0a09] text-white py-3 rounded-xl text-[14px] font-medium hover:bg-[#0a8a5f] transition-all disabled:opacity-50">
                  {loading ? 'Sending...' : 'Send Invites'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Done */}
          {step === 3 && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-[#eaf7f0] rounded-2xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-[#15b881]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className={`${serif} text-[2rem] text-[#0c0a09] mb-2`}>You&apos;re all set!</h1>
              <p className="text-[14px] text-[#717d79] mb-8 max-w-md mx-auto">
                Counsel is ready for your firm. Start by uploading documents, creating matters, or chatting with your AI assistant.
              </p>
              <button onClick={() => router.push('/dashboard')}
                className="bg-[#0c0a09] text-white px-8 py-3 rounded-xl text-[14px] font-medium hover:bg-[#0a8a5f] transition-all shadow-[0_8px_24px_-8px_rgba(12,10,9,0.4)]">
                Go to Dashboard →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
