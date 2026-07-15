'use client';

import { useState } from 'react';

const serif = "font-serif";

const steps = [
  { n: "01", t: "Connect your firm", d: "SSO in one click. Import matters, templates, and playbooks from your existing DMS in minutes.",
    details: ["WorkOS SSO (Okta, Azure AD, Google)", "Auto-import from iManage, NetDocuments", "Bulk migration of precedent libraries", "Goes live same day"] },
  { n: "02", t: "Deploy your agents", d: "Pick from 40+ pre-trained legal agents or fine-tune your own on your firm's precedent library.",
    details: ["40+ pre-trained legal AI agents", "Custom fine-tuning on your documents", "Playbook engine for your negotiation rules", "Clause extraction across 23 categories"] },
  { n: "03", t: "Ship work 10× faster", d: "Review contracts in minutes, draft briefs in hours, close matters in days — not weeks.",
    details: ["4.2s median contract analysis", "First-pass drafting in under 30 seconds", "Cited legal research in real time", "Meeting summaries in under 2 minutes"] },
];

export default function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);
  return (
    <section className="border-t border-black/[0.04] bg-gradient-to-b from-[#0c0a09] to-[#111c17] text-white relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, rgba(21,184,129,0.35), transparent 50%), radial-gradient(circle at 80% 80%, rgba(21,184,129,0.2), transparent 50%)" }} />
      <div className="relative max-w-7xl mx-auto px-6 py-24 md:py-32">
        <div className="text-[12px] tracking-[0.12em] uppercase text-[#7ce3b6] mb-4">How it works</div>
        <h2 className={`${serif} text-[2.75rem] md:text-[4rem] font-normal tracking-[-0.02em] leading-[1.02] text-white max-w-3xl mb-16`}>
          From onboarding to production in <span className="italic text-[#7ce3b6]">one afternoon</span>
        </h2>
        <div className="grid md:grid-cols-3 gap-3">
          {steps.map((s, i) => (
            <div key={s.n} onMouseEnter={() => setActiveStep(i)} onClick={() => setActiveStep(i)}
              className={`relative rounded-2xl p-6 cursor-pointer transition-all duration-500 ${
                activeStep === i ? 'bg-white/10 border border-[#15b881]/40 scale-[1.02] shadow-[0_0_30px_rgba(21,184,129,0.2)]' : 'border border-transparent hover:bg-white/5'
              }`}>
              <div className={`${serif} text-[3.5rem] leading-none transition-colors duration-500 ${activeStep === i ? 'text-[#7ce3b6]' : 'text-[#7ce3b6]/40'}`}>{s.n}</div>
              <h3 className="mt-4 text-[20px] font-semibold text-white tracking-[-0.01em]">{s.t}</h3>
              <p className="mt-2 text-[14.5px] text-white/60 leading-relaxed">{s.d}</p>
              <div className={`mt-4 space-y-2 overflow-hidden transition-all duration-500 ${activeStep === i ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'}`}>
                {s.details.map((d, j) => (
                  <div key={j} className="flex items-center gap-2.5 text-[13px] text-white/70" style={{ animation: `fadeIn 0.3s ease ${j * 80}ms both` }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#15b881" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                    {d}
                  </div>
                ))}
              </div>
              {i < steps.length - 1 && <div aria-hidden className="hidden md:block absolute top-8 -right-5 text-[#7ce3b6]/40 text-xl">→</div>}
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </section>
  );
}
