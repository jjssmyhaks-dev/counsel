'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getFirm, isOnboardingCompleted } from '@/lib/auth';
import { api } from '@/lib/api';

const serif = 'font-serif';

const STEPS = [
  {
    id: 'welcome',
    title: "Welcome to Counsel",
    subtitle: "Let's get your firm set up in under 2 minutes",
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
  },
  {
    id: 'upload',
    title: 'Upload Your First Contract',
    subtitle: 'Drop a contract or legal document to kick off analysis',
    icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12',
  },
  {
    id: 'playbook',
    title: 'Set Up Your Playbook',
    subtitle: 'Configure clause rules that match your firm\'s standards',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  {
    id: 'connect',
    title: 'Connect Your Inbox',
    subtitle: 'Install the Counsel Chrome Extension for Gmail drafting',
    icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  },
  {
    id: 'done',
    title: 'You\'re All Set',
    subtitle: 'Start analyzing documents, drafting, and researching',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
];

export default function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [playbookRules, setPlaybookRules] = useState(3);
  const [completed, setCompleted] = useState(false);

  const firm = getFirm();

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      // Try to upload — falls back to mock
      await api.upload('/documents', form);
    } catch {
      // Onboarding continues even if upload fails
    }
    setUploading(false);
    setStep(2);
  }, []);

  const handleComplete = useCallback(() => {
    setCompleted(true);
    // Mark onboarding as done (update local state)
    const firm = getFirm();
    if (firm) {
      firm.onboardingCompleted = true;
      localStorage.setItem('counsel_firm', JSON.stringify(firm));
    }
    router.push('/dashboard');
  }, [router]);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fefdfb] p-6" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <div className="w-full max-w-lg">
        {/* Progress bar */}
        <div className="mb-10">
          <div className="flex gap-1.5">
            {STEPS.map((s, i) => (
              <div
                key={s.id}
                className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                  i <= step ? 'bg-[#15b881]' : 'bg-[#f0f0f0]'
                }`}
              />
            ))}
          </div>
          <p className="text-[12px] text-[#969e9b] mt-2 text-right">
            Step {step + 1} of {STEPS.length}
          </p>
        </div>

        {/* Step content */}
        <div className="text-center mb-10">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-[#15b881]/10 to-[#0a8a5f]/10 rounded-2xl flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-[#15b881]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={current.icon} />
            </svg>
          </div>
          <h1 className={`${serif} text-[1.75rem] font-normal tracking-[-0.02em] text-[#0c0a09]`}>
            {current.title}
          </h1>
          {firm && (
            <p className="text-[13px] text-[#7ce3b6]/80 mt-1">{firm.name}</p>
          )}
          <p className="text-[14px] text-[#717d79] mt-3">{current.subtitle}</p>
        </div>

        {/* Step-specific UI */}
        <div className="space-y-4">
          {step === 0 && (
            <div className="bg-white rounded-2xl border border-black/[0.04] p-5 space-y-3">
              {[
                { label: 'Firm Type', value: firm?.firmType === 'CONSULTING' ? 'Consulting' : 'Legal' },
                { label: 'Firm Name', value: firm?.name || 'Your Firm' },
                { label: 'What you\'ll do', value: 'Document analysis · AI drafting · Research · Meeting processing' },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-center py-2 border-b border-black/[0.02] last:border-0">
                  <span className="text-[13px] text-[#717d79]">{row.label}</span>
                  <span className="text-[13px] font-medium text-[#0c0a09]">{row.value}</span>
                </div>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="bg-white rounded-2xl border-2 border-dashed border-[#15b881]/30 p-8 text-center">
              <label className="cursor-pointer block">
                <input
                  type="file"
                  accept=".pdf,.docx,.doc,.txt"
                  onChange={handleUpload}
                  className="hidden"
                />
                <div className="space-y-3">
                  <svg className="mx-auto w-10 h-10 text-[#15b881]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-[14px] font-medium text-[#0c0a09]">
                    {uploading ? 'Uploading...' : 'Drop a file or click to browse'}
                  </p>
                  <p className="text-[12px] text-[#969e9b]">PDF, DOCX, or TXT (max 50MB)</p>
                </div>
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-[13px] text-[#717d79] text-center mb-2">
                How many clause rules should we set up?
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 3, label: 'Basic', desc: '3 essential rules' },
                  { value: 8, label: 'Standard', desc: '8 common rules' },
                  { value: 15, label: 'Comprehensive', desc: '15+ default rules' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPlaybookRules(opt.value)}
                    className={`text-center p-4 rounded-xl border-2 transition-all ${
                      playbookRules === opt.value
                        ? 'border-[#15b881] bg-[#eaf7f0]'
                        : 'border-black/[0.06] bg-white hover:border-[#15b881]/30'
                    }`}
                  >
                    <div className="text-[14px] font-semibold text-[#0c0a09]">{opt.label}</div>
                    <div className="text-[11px] text-[#969e9b] mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[#969e9b] text-center mt-3">
                You can customize individual rules later from Admin → Playbook.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="bg-white rounded-2xl border border-black/[0.04] p-6 text-center space-y-4">
              <div className="mx-auto w-14 h-14 bg-gradient-to-br from-[#15b881]/15 to-[#0a8a5f]/15 rounded-xl flex items-center justify-center">
                <svg className="w-7 h-7 text-[#15b881]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </div>
              <div>
                <p className="text-[14px] font-medium text-[#0c0a09]">Install the Counsel Chrome Extension</p>
                <p className="text-[13px] text-[#717d79] mt-1">
                  Get AI drafting right inside Gmail. Compose with Counsel in one click.
                </p>
              </div>
              <button
                onClick={() => setStep(4)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0c0a09] text-white rounded-xl text-[13px] font-medium hover:bg-[#0a8a5f] transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.372 0 0 5.373 0 12s5.372 12 12 12 12-5.373 12-12S18.628 0 12 0zm5.564 10.2L8.97 18.795l-1.414-1.414 8.594-8.595-1.414-1.414L6.152 15.96 4.738 14.546 13.332 5.952l1.414 1.414 1.414-1.414 1.414 1.414-2.01 2.844z" />
                </svg>
                Open Chrome Web Store
              </button>
              <p className="text-[12px] text-[#969e9b]">You can skip this and install later.</p>
            </div>
          )}

          {step === 4 && (
            <div className="bg-white rounded-2xl border border-black/[0.04] p-6 space-y-4">
              {[
                { icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', text: 'Contract analysis is ready — upload documents anytime' },
                { icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', text: 'AI drafting with your playbook preferences' },
                { icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', text: 'Ask the Firm — search your entire knowledge base' },
                { icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', text: 'Meeting transcription and action item extraction' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-[#15b881] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  <span className="text-[13px] text-[#0c0a09]">{item.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3 mt-10">
          {step > 0 && !isLast && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 px-4 py-3 rounded-xl border border-black/[0.08] text-[14px] font-medium text-[#0c0a09] hover:bg-black/[0.02] transition-colors"
            >
              Back
            </button>
          )}
          {isLast ? (
            <button
              onClick={handleComplete}
              className="flex-1 px-4 py-3 rounded-xl bg-[#0c0a09] text-white text-[14px] font-medium hover:bg-[#0a8a5f] transition-all shadow-[0_8px_24px_-8px_rgba(12,10,9,0.4)]"
            >
              Go to Dashboard
            </button>
          ) : step === 0 ? (
            <button
              onClick={() => setStep(1)}
              className="flex-1 px-4 py-3 rounded-xl bg-[#0c0a09] text-white text-[14px] font-medium hover:bg-[#0a8a5f] transition-all shadow-[0_8px_24px_-8px_rgba(12,10,9,0.4)]"
            >
              Get Started
            </button>
          ) : step === 2 || step === 3 ? (
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setStep(step - 1)}
                className="flex-1 px-4 py-3 rounded-xl border border-black/[0.08] text-[14px] font-medium text-[#0c0a09] hover:bg-black/[0.02] transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(step + 1)}
                className="flex-1 px-4 py-3 rounded-xl bg-[#0c0a09] text-white text-[14px] font-medium hover:bg-[#0a8a5f] transition-all"
              >
                Continue
              </button>
            </div>
          ) : (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && uploading}
              className="flex-1 px-4 py-3 rounded-xl bg-[#0c0a09] text-white text-[14px] font-medium hover:bg-[#0a8a5f] transition-all shadow-[0_8px_24px_-8px_rgba(12,10,9,0.4)] disabled:opacity-50"
            >
              {step === 1 && uploading ? 'Uploading...' : 'Continue'}
            </button>
          )}
        </div>

        {/* Skip */}
        {!isLast && (
          <button
            onClick={handleComplete}
            className="w-full mt-4 text-[13px] text-[#969e9b] hover:text-[#717d79] transition-colors text-center"
          >
            Skip onboarding — go straight to dashboard
          </button>
        )}
      </div>
    </div>
  );
}
