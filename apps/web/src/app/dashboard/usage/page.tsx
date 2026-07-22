'use client';

import { useState } from 'react';

const serif = "font-serif";

export default function UsagePage() {
  const [billing, setBilling] = useState<'monthly' | 'annually'>('monthly');

  const usage = {
    plan: 'Starter',
    documentsUsed: 34,
    documentsLimit: 50,
    agentsUsed: 2,
    agentsLimit: 5,
    storageUsed: '1.2 GB',
    storageLimit: '5 GB',
    apiCalls: 845,
    apiCallsLimit: 1000,
    daysLeft: 9,
    trialActive: true,
  };

  const percent = (used: number, limit: number) => Math.min((used / limit) * 100, 100);

  const meters = [
    { label: 'Documents', used: usage.documentsUsed, limit: usage.documentsLimit, hint: `${usage.documentsLimit - usage.documentsUsed} remaining` },
    { label: 'AI Agents', used: usage.agentsUsed, limit: usage.agentsLimit, hint: `${usage.agentsLimit - usage.agentsUsed} available` },
    { label: 'API Calls', used: usage.apiCalls, limit: usage.apiCallsLimit, hint: `${usage.apiCallsLimit - usage.apiCalls} remaining` },
  ];

  return (
    <div className="space-y-8" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`${serif} text-[1.75rem] font-normal tracking-[-0.02em] text-[#0c0a09] dark:text-white`}>Usage & Plan</h1>
          <p className="text-[13px] text-[#717d79] dark:text-[#969e9b] mt-1">Track your usage and manage your subscription</p>
        </div>
        {usage.trialActive && (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl">
            <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-[13px] font-medium text-amber-800">Trial · {usage.daysLeft} days left</span>
          </div>
        )}
      </div>

      {/* Current Plan Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.04] dark:border-slate-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[12px] text-[#969e9b] uppercase tracking-[0.08em] font-medium">Current Plan</p>
            <h2 className={`${serif} text-2xl font-normal tracking-[-0.02em] text-[#0c0a09] dark:text-white mt-1`}>{usage.plan}</h2>
          </div>
          <button className="px-5 py-2.5 bg-[#0c0a09] text-white text-[13px] font-medium rounded-xl hover:bg-[#0a8a5f] transition-all shadow-[0_4px_12px_-4px_rgba(12,10,9,0.3)]">
            Upgrade Plan
          </button>
        </div>

        {/* Meters */}
        <div className="space-y-5">
          {meters.map(m => {
            const pct = percent(m.used, m.limit);
            const color = pct > 90 ? '#dc2626' : pct > 70 ? '#b45309' : '#15b881';
            return (
              <div key={m.label}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-medium text-[#0c0a09] dark:text-white">{m.label}</span>
                  <span className="text-[12px] text-[#969e9b]">{m.used} / {m.limit}</span>
                </div>
                <div className="h-2 bg-black/[0.04] dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
                <p className="text-[11px] text-[#969e9b] mt-1">{m.hint}</p>
              </div>
            );
          })}
        </div>

        {/* Storage */}
        <div className="mt-6 pt-6 border-t border-black/[0.04] dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-[#0c0a09] dark:text-white">Storage</span>
            <span className="text-[12px] text-[#969e9b]">{usage.storageUsed} / {usage.storageLimit}</span>
          </div>
          <div className="h-2 bg-black/[0.04] dark:bg-slate-700 rounded-full overflow-hidden mt-2">
            <div className="h-full bg-[#15b881] rounded-full" style={{ width: '24%' }} />
          </div>
        </div>
      </div>

      {/* Plan comparison — simplified */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { name: 'Starter', price: 'Free', features: ['50 docs/mo', '12 clause types', '1 user'], current: usage.plan === 'Starter' },
          { name: 'Growth', price: '$299/mo', features: ['Unlimited docs', '23 clause types', '25 users', 'SSO/SAML', 'AI drafting'], current: false, highlight: true },
          { name: 'Scale', price: '$799/mo', features: ['Everything in Growth', 'Custom AI fine-tuning', 'API access', 'Dedicated CSM', '99.9% SLA'], current: false },
        ].map(p => (
          <div key={p.name} className={`bg-white dark:bg-slate-900 rounded-2xl border-2 p-5 relative ${p.current ? 'border-[#15b881] bg-[#eaf7f0] dark:bg-[#0a3d28]/20' : p.highlight ? 'border-[#15b881]/30' : 'border-black/[0.04] dark:border-slate-800'}`}>
            {p.highlight && !p.current && <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-[#15b881] text-white text-[10px] font-semibold rounded-full uppercase">Popular</div>}
            {p.current && <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-[#0c0a09] text-white text-[10px] font-semibold rounded-full uppercase">Current</div>}
            <h3 className={`${serif} text-lg font-normal text-[#0c0a09] dark:text-white`}>{p.name}</h3>
            <p className={`${serif} text-xl font-normal tracking-[-0.02em] text-[#0a8a5f] mt-1`}>{p.price}</p>
            <ul className="mt-3 space-y-1.5">
              {p.features.map(f => (
                <li key={f} className="flex items-start gap-2 text-[12px] text-[#717d79]">
                  <svg className="w-3.5 h-3.5 text-[#15b881] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  {f}
                </li>
              ))}
            </ul>
            {!p.current && (
              <button className="w-full mt-4 py-2.5 rounded-xl text-[12px] font-semibold border-2 border-[#0c0a09] text-[#0c0a09] hover:bg-[#0c0a09] hover:text-white transition-all">
                {p.name === 'Starter' ? 'Downgrade' : 'Upgrade'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
