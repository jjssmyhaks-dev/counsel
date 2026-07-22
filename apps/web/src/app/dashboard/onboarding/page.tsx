'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getFirm } from '@/lib/auth';
import { api } from '@/lib/api';

const serif = 'font-serif';

type PlanTier = 'starter' | 'growth' | 'scale';
type TrustLevel = 'propose_only' | 'auto_execute_low_risk' | 'fully_autonomous';

interface AgentTrust {
  id: string;
  name: string;
  icon: string;
  trust: TrustLevel;
}

const AGENTS: Omit<AgentTrust, 'trust'>[] = [
  { id: 'clause-extractor', name: 'Clause Extractor', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { id: 'risk-analyzer', name: 'Risk Analyzer', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z' },
  { id: 'legal-drafter', name: 'Legal Drafter', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  { id: 'researcher', name: 'Research Agent', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
];

const STEPS = [
  { id: 'welcome', title: 'Welcome to Counsel', subtitle: "Let's get your firm set up in under 2 minutes", icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { id: 'plan', title: 'Choose Your Plan', subtitle: 'Pick the plan that fits your firm — no card required', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'upload', title: 'Upload Your First Contract', subtitle: 'Drop a contract or legal document to kick off analysis', icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' },
  { id: 'integrations', title: 'Connect Your Tools', subtitle: 'Import data and connect the services you already use', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { id: 'trust', title: 'Configure Agent Trust', subtitle: 'Control how much autonomy each agent has', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  { id: 'connect', title: 'Connect Your Inbox', subtitle: 'Install the Counsel Chrome Extension for Gmail drafting', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { id: 'done', title: "You're All Set", subtitle: 'Start analyzing documents, drafting, and researching', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
];

const PLAN_DATA: { id: PlanTier; name: string; price: string; features: string[]; highlight: boolean }[] = [
  { id: 'starter', name: 'Starter', price: 'Free', features: ['50 documents/month', 'Standard playbook', '12 clause types', '1 user'], highlight: false },
  { id: 'growth', name: 'Growth', price: '$299/mo', features: ['Unlimited documents', 'Custom playbooks', '23 clause types', 'AI drafting', 'Up to 25 users', 'SSO/SAML'], highlight: true },
  { id: 'scale', name: 'Scale', price: '$799/mo', features: ['Everything in Growth', 'Custom AI fine-tuning', 'API access', 'Dedicated CSM', 'Unlimited users', '99.9% SLA'], highlight: false },
];

const INTEGRATIONS = [
  { id: 'csv', name: 'CSV / Sheets Import', desc: 'Upload spreadsheets with client or matter data', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { id: 'whatsapp', name: 'WhatsApp Business API', desc: 'Connect your WhatsApp Business account for client messaging', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { id: 'webhook', name: 'ERP / TMS / Webhook', desc: 'Connect your existing tools via webhook or API', icon: 'M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5' },
];

const TRUST_LEVELS: { id: TrustLevel; label: string; desc: string; color: string }[] = [
  { id: 'propose_only', label: 'Propose Only', desc: 'Agent suggests, you approve every action', color: '#717d79' },
  { id: 'auto_execute_low_risk', label: 'Auto Low-Risk', desc: 'Auto-execute safe actions, ask for risky ones', color: '#b45309' },
  { id: 'fully_autonomous', label: 'Fully Autonomous', desc: 'Agent acts independently with audit trail', color: '#0a8a5f' },
];

export default function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [plan, setPlan] = useState<PlanTier>('starter');
  const [integrations, setIntegrations] = useState<Set<string>>(new Set());
  const [agentTrusts, setAgentTrusts] = useState<AgentTrust[]>(
    AGENTS.map(a => ({ ...a, trust: 'propose_only' as TrustLevel }))
  );

  const firm = getFirm();

  const toggleIntegration = (id: string) => {
    const next = new Set(integrations);
    if (next.has(id)) next.delete(id); else next.add(id);
    setIntegrations(next);
  };

  const setTrust = (agentId: string, level: TrustLevel) => {
    setAgentTrusts(prev => prev.map(a => a.id === agentId ? { ...a, trust: level } : a));
  };

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { const form = new FormData(); form.append('file', file); await api.upload('/documents', form); } catch {}
    setUploading(false);
    setStep(3);
  }, []);

  const handleComplete = useCallback(() => {
    const firm = getFirm();
    if (firm) { firm.onboardingCompleted = true; localStorage.setItem('counsel_firm', JSON.stringify(firm)); }
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
              <div key={s.id} className={`h-1 flex-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-[#15b881]' : 'bg-[#f0f0f0]'}`} />
            ))}
          </div>
          <p className="text-[12px] text-[#969e9b] mt-2 text-right">Step {step + 1} of {STEPS.length}</p>
        </div>

        {/* Step header */}
        <div className="text-center mb-10">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-[#15b881]/10 to-[#0a8a5f]/10 rounded-2xl flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-[#15b881]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={current.icon} />
            </svg>
          </div>
          <h1 className={`${serif} text-[1.75rem] font-normal tracking-[-0.02em] text-[#0c0a09]`}>{current.title}</h1>
          {firm && <p className="text-[13px] text-[#969e9b] mt-1">{firm.name}</p>}
          <p className="text-[14px] text-[#717d79] mt-3">{current.subtitle}</p>
        </div>

        {/* Step content */}
        <div className="space-y-4">
          {step === 0 && (
            <div className="bg-white rounded-2xl border border-black/[0.04] p-5 space-y-3">
              {[
                { label: 'Firm Type', value: firm?.firmType === 'CONSULTING' ? 'Consulting' : 'Legal' },
                { label: 'Firm Name', value: firm?.name || 'Your Firm' },
                { label: "What you'll do", value: 'Document analysis · AI drafting · Research · Meeting processing' },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center py-2 border-b border-black/[0.02] last:border-0">
                  <span className="text-[13px] text-[#717d79]">{row.label}</span>
                  <span className="text-[13px] font-medium text-[#0c0a09]">{row.value}</span>
                </div>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              {PLAN_DATA.map(p => (
                <button key={p.id} onClick={() => setPlan(p.id)}
                  className={`w-full text-left p-5 rounded-xl border-2 transition-all ${plan === p.id ? 'border-[#15b881] bg-[#eaf7f0]' : 'border-black/[0.06] bg-white hover:border-[#15b881]/30'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-semibold text-[#0c0a09]">{p.name}</span>
                        {p.highlight && <span className="text-[10px] font-semibold bg-[#15b881] text-white px-2 py-0.5 rounded-full">Popular</span>}
                      </div>
                      <span className={`${serif} text-xl font-normal tracking-[-0.02em] text-[#0a8a5f]`}>{p.price}</span>
                    </div>
                    {plan === p.id && <svg className="w-5 h-5 text-[#15b881]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {p.features.map(f => (<span key={f} className="text-[11px] text-[#717d79] bg-black/[0.02] px-2 py-1 rounded-lg">{f}</span>))}
                  </div>
                </button>
              ))}
              <p className="text-[11px] text-[#969e9b] text-center mt-2">No credit card required · 14-day free trial on Growth & Scale</p>
            </div>
          )}

          {step === 2 && (
            <div className="bg-white rounded-2xl border-2 border-dashed border-[#15b881]/30 p-8 text-center">
              <label className="cursor-pointer block">
                <input type="file" accept=".pdf,.docx,.doc,.txt" onChange={handleUpload} className="hidden" />
                <div className="space-y-3">
                  <svg className="mx-auto w-10 h-10 text-[#15b881]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-[14px] font-medium text-[#0c0a09]">{uploading ? 'Uploading...' : 'Drop a file or click to browse'}</p>
                  <p className="text-[12px] text-[#969e9b]">PDF, DOCX, or TXT (max 50MB)</p>
                </div>
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              {INTEGRATIONS.map(int => {
                const selected = integrations.has(int.id);
                return (
                  <button key={int.id} onClick={() => toggleIntegration(int.id)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${selected ? 'border-[#15b881] bg-[#eaf7f0]' : 'border-black/[0.06] bg-white hover:border-[#15b881]/30'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selected ? 'bg-[#15b881]/10' : 'bg-black/[0.02]'}`}>
                        <svg className={`w-5 h-5 ${selected ? 'text-[#15b881]' : 'text-[#969e9b]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={int.icon} />
                        </svg>
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-[#0c0a09]">{int.name}</p>
                        <p className="text-[11px] text-[#969e9b]">{int.desc}</p>
                      </div>
                      {selected && <svg className="w-5 h-5 text-[#15b881] ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <p className="text-[13px] text-[#717d79] text-center mb-2">Set the autonomy level for each AI agent</p>
              {agentTrusts.map(agent => (
                <div key={agent.id} className="bg-white rounded-xl border border-black/[0.06] p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <svg className="w-5 h-5 text-[#0c0a09]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={agent.icon} />
                    </svg>
                    <span className="text-[13px] font-medium text-[#0c0a09]">{agent.name}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {TRUST_LEVELS.map(tl => (
                      <button key={tl.id} onClick={() => setTrust(agent.id, tl.id)}
                        className={`text-center p-2 rounded-lg border text-[11px] font-medium transition-all ${
                          agent.trust === tl.id
                            ? 'border-[#15b881] bg-[#eaf7f0] text-[#0a8a5f]'
                            : 'border-black/[0.04] text-[#969e9b] hover:border-[#15b881]/20'
                        }`}>
                        {tl.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 5 && (
            <div className="bg-white rounded-2xl border border-black/[0.04] p-6 text-center space-y-4">
              <div className="mx-auto w-14 h-14 bg-gradient-to-br from-[#15b881]/15 to-[#0a8a5f]/15 rounded-xl flex items-center justify-center">
                <svg className="w-7 h-7 text-[#15b881]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </div>
              <p className="text-[14px] font-medium text-[#0c0a09]">Install the Counsel Chrome Extension</p>
              <p className="text-[13px] text-[#717d79]">Get AI drafting right inside Gmail. Compose with Counsel in one click.</p>
              <button onClick={() => setStep(6)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0c0a09] text-white rounded-xl text-[13px] font-medium hover:bg-[#0a8a5f] transition-colors">
                Open Chrome Web Store
              </button>
            </div>
          )}

          {step === 6 && (
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
            <button onClick={() => setStep(step - 1)}
              className="flex-1 px-4 py-3 rounded-xl border border-black/[0.08] text-[14px] font-medium text-[#0c0a09] hover:bg-black/[0.02] transition-colors">Back</button>
          )}
          {isLast ? (
            <button onClick={handleComplete}
              className="flex-1 px-4 py-3 rounded-xl bg-[#0c0a09] text-white text-[14px] font-medium hover:bg-[#0a8a5f] transition-all shadow-[0_8px_24px_-8px_rgba(12,10,9,0.4)]">Go to Dashboard</button>
          ) : step === 2 ? (
            <div className="flex gap-3 w-full">
              <button onClick={() => setStep(1)} className="flex-1 px-4 py-3 rounded-xl border border-black/[0.08] text-[14px] font-medium text-[#0c0a09] hover:bg-black/[0.02] transition-colors">Back</button>
              <button onClick={() => setStep(3)} disabled={uploading}
                className="flex-1 px-4 py-3 rounded-xl bg-[#0c0a09] text-white text-[14px] font-medium hover:bg-[#0a8a5f] transition-all disabled:opacity-50">{uploading ? 'Uploading...' : 'Continue'}</button>
            </div>
          ) : step === 3 || step === 4 || step === 5 ? (
            <div className="flex gap-3 w-full">
              <button onClick={() => setStep(step - 1)} className="flex-1 px-4 py-3 rounded-xl border border-black/[0.08] text-[14px] font-medium text-[#0c0a09] hover:bg-black/[0.02] transition-colors">Back</button>
              <button onClick={() => setStep(step + 1)} className="flex-1 px-4 py-3 rounded-xl bg-[#0c0a09] text-white text-[14px] font-medium hover:bg-[#0a8a5f] transition-all">Continue</button>
            </div>
          ) : (
            <button onClick={() => setStep(step + 1)}
              className="flex-1 px-4 py-3 rounded-xl bg-[#0c0a09] text-white text-[14px] font-medium hover:bg-[#0a8a5f] transition-all shadow-[0_8px_24px_-8px_rgba(12,10,9,0.4)]">
              {step === 0 ? 'Get Started' : 'Continue'}
            </button>
          )}
        </div>

        {/* Skip */}
        {!isLast && (
          <button onClick={handleComplete}
            className="w-full mt-4 text-[13px] text-[#969e9b] hover:text-[#717d79] transition-colors text-center">
            Skip onboarding — go straight to dashboard
          </button>
        )}
      </div>
    </div>
  );
}
