'use client';

import { useState } from 'react';
import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';

const serif = "font-serif";

function CheckIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15b881" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>;
}

const plans = [
  {
    name: "Starter",
    monthly: 0,
    annually: 0,
    desc: "For solo practitioners getting started with AI.",
    cta: "Start free",
    href: "/register",
    highlight: false,
    features: [
      "50 documents/month",
      "Standard playbook templates",
      "Basic clause extraction (12 types)",
      "Email support (48h response)",
      "1 user",
    ],
  },
  {
    name: "Professional",
    monthly: 299,
    annually: 239,
    desc: "For growing firms that need more power.",
    cta: "Start trial",
    href: "/register",
    highlight: true,
    features: [
      "Unlimited documents",
      "Custom playbook rules",
      "Full clause extraction (23 types)",
      "AI drafting + templates",
      "Priority support (2h response)",
      "SSO + SAML",
      "Up to 25 users",
    ],
  },
  {
    name: "Business",
    monthly: 799,
    annually: 639,
    desc: "For mid-size firms with complex workflows.",
    cta: "Start trial",
    href: "/register",
    highlight: false,
    features: [
      "Everything in Professional",
      "Custom AI model fine-tuning",
      "API access + webhooks",
      "Dedicated customer success manager",
      "Advanced analytics dashboard",
      "Unlimited users",
      "99.9% SLA",
    ],
  },
  {
    name: "Enterprise",
    monthly: 0,
    annually: 0,
    desc: "For large firms needing dedicated infrastructure.",
    cta: "Contact sales",
    href: "/login",
    highlight: false,
    features: [
      "Everything in Business",
      "Dedicated infrastructure (VPC)",
      "Custom SLA (99.99%+)",
      "White-glove data migration",
      "24/7 dedicated support",
      "On-premise deployment",
      "Custom compliance certifications",
    ],
  },
];

const faqs = [
  { q: "Can I switch plans at any time?", a: "Yes. You can upgrade or downgrade your plan at any time. If you upgrade, you'll get immediate access to the new features. If you downgrade, changes take effect at the next billing cycle." },
  { q: "Is there a free trial?", a: "Yes. Professional and Business plans come with a 14-day free trial. No credit card required. You can cancel anytime during the trial." },
  { q: "What counts as a document?", a: "Any uploaded file — PDF, DOCX, TXT, or image — counts as one document toward your Starter plan limit. Professional and above have unlimited documents." },
  { q: "How does billing work?", a: "We bill monthly or annually (save 20%). You can add or remove users at any time. Enterprise plans are invoiced annually with custom payment terms." },
  { q: "Is my data secure?", a: "Absolutely. Counsel is SOC 2 Type II certified with ISO 27001 compliance. All data is encrypted at rest and in transit." },
];

const comparisonFeatures = [
  { name: "Documents/month", starter: "50", pro: "Unlimited", business: "Unlimited", enterprise: "Unlimited" },
  { name: "Clause types", starter: "12", pro: "23", business: "23", enterprise: "23" },
  { name: "Custom playbooks", starter: "—", pro: "✓", business: "✓", enterprise: "✓" },
  { name: "AI drafting", starter: "—", pro: "✓", business: "✓", enterprise: "✓" },
  { name: "API access", starter: "—", pro: "—", business: "✓", enterprise: "✓" },
  { name: "SSO / SAML", starter: "—", pro: "✓", business: "✓", enterprise: "✓" },
  { name: "Custom AI models", starter: "—", pro: "—", business: "✓", enterprise: "✓" },
  { name: "Users", starter: "1", pro: "Up to 25", business: "Unlimited", enterprise: "Unlimited" },
  { name: "Support", starter: "Email (48h)", pro: "Priority (2h)", business: "Dedicated CSM", enterprise: "24/7 dedicated" },
  { name: "SLA", starter: "—", pro: "—", business: "99.9%", enterprise: "99.99%+" },
  { name: "On-premise", starter: "—", pro: "—", business: "—", enterprise: "✓" },
];

function formatPrice(price: number) {
  if (price === 0) return 'Free';
  return `$${price}`;
}

export default function PricingPage() {
  const [billing, setBilling] = useState<'monthly' | 'annually'>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#fefdfb] text-[#0c0a09] antialiased selection:bg-[#15b881]/20" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <Navbar />

      {/* Hero */}
      <section className="border-b border-black/[0.04]">
        <div className="max-w-7xl mx-auto px-6 pt-20 pb-16 md:pt-28 md:pb-24 text-center">
          <div className="text-[12px] tracking-[0.12em] uppercase text-[#0a8a5f] mb-4">Pricing</div>
          <h1 className={`${serif} text-[3.25rem] md:text-[5rem] font-normal tracking-[-0.02em] leading-[1.02] text-[#0c0a09]`}>
            Simple, transparent pricing
          </h1>
          <p className="mt-6 text-[17px] text-[#4b5551] max-w-xl mx-auto leading-relaxed">
            Start free, upgrade when you need more. No hidden fees, no surprises. All paid plans include a 14-day free trial.
          </p>

          {/* Billing toggle */}
          <div className="mt-10 inline-flex items-center gap-3 bg-[#f7f7f7] rounded-full p-1 border border-black/[0.04]">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-5 py-2 rounded-full text-[14px] font-medium transition-all duration-300 ${billing === 'monthly' ? 'bg-white text-[#0c0a09] shadow-sm' : 'text-[#717d79] hover:text-[#0c0a09]'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('annually')}
              className={`px-5 py-2 rounded-full text-[14px] font-medium transition-all duration-300 inline-flex items-center gap-2 ${billing === 'annually' ? 'bg-white text-[#0c0a09] shadow-sm' : 'text-[#717d79] hover:text-[#0c0a09]'}`}
            >
              Annually
              <span className="text-[11px] text-[#0a8a5f] bg-[#eaf7f0] px-2 py-0.5 rounded-full font-semibold">Save 20%</span>
            </button>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="border-b border-black/[0.04]">
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
          <div className="grid md:grid-cols-4 gap-4 items-start">
            {plans.map((p, i) => (
              <div key={p.name} className={`rounded-2xl border p-8 flex flex-col relative transition-all duration-500 animate-[fadeIn_0.3s_ease] overflow-visible`} style={{ animationDelay: `${i * 75}ms` }}>
                {p.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#15b881] text-white text-[11px] font-semibold rounded-full uppercase tracking-wider whitespace-nowrap z-20 shadow-[0_4px_12px_rgba(21,184,129,0.4)]">Most popular</div>
                )}
                {p.highlight
                  ? <div className="rounded-2xl border-[#15b881] ring-1 ring-[#15b881]/20 shadow-[0_20px_60px_-20px_rgba(21,184,129,0.3)] bg-white" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
                  : <div className="rounded-2xl border-black/[0.04] bg-white" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
                }
                <div className="relative z-10 flex flex-col h-full">
                  <div className="text-[14px] font-medium text-[#0c0a09] mb-1">{p.name}</div>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className={`${serif} text-[3rem] font-normal tracking-[-0.02em] text-[#0c0a09] transition-all duration-300`}>
                      {p.name === 'Enterprise' ? 'Custom' : formatPrice(billing === 'monthly' ? p.monthly : p.annually)}
                    </span>
                    {p.name !== 'Enterprise' && p.monthly > 0 && (
                      <span className="text-[14px] text-[#969e9b]">/month</span>
                    )}
                  </div>
                  {billing === 'annually' && p.monthly > 0 && (
                    <div className="text-[12px] text-[#0a8a5f] mt-1 font-medium">Billed annually</div>
                  )}
                  <p className="text-[13px] text-[#717d79] mt-2 mb-6">{p.desc}</p>
                  <a href={p.href} className={`w-full py-3 rounded-full text-center text-[14px] font-semibold transition-colors mb-6 ${p.highlight ? 'bg-[#0c0a09] text-white hover:bg-[#15b881]' : 'bg-[#f7f7f7] text-[#0c0a09] hover:bg-[#eaf7f0]'}`}>
                    {p.cta}
                  </a>
                  <ul className="space-y-2.5 flex-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-[13px] text-[#0c0a09]"><CheckIcon /><span>{f}</span></li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison */}
      <section className="border-b border-black/[0.04] bg-[#faf8f5]">
        <div className="max-w-5xl mx-auto px-6 py-20 md:py-28">
          <h2 className={`${serif} text-[2.5rem] md:text-[3.5rem] font-normal tracking-[-0.02em] leading-[1.02] text-[#0c0a09] text-center mb-12`}>Full feature comparison</h2>
          <div className="rounded-2xl border border-black/[0.04] bg-white overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-black/[0.04]">
                  <th className="px-6 py-4 text-[12px] tracking-[0.12em] uppercase text-[#969e9b] font-medium">Feature</th>
                  <th className="px-6 py-4 text-[12px] tracking-[0.12em] uppercase text-[#969e9b] font-medium">Starter</th>
                  <th className="px-6 py-4 text-[12px] tracking-[0.12em] uppercase text-[#0a8a5f] font-medium">Professional</th>
                  <th className="px-6 py-4 text-[12px] tracking-[0.12em] uppercase text-[#969e9b] font-medium">Business</th>
                  <th className="px-6 py-4 text-[12px] tracking-[0.12em] uppercase text-[#969e9b] font-medium">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((f, i) => (
                  <tr key={f.name} className={`border-b border-black/[0.04] transition-colors hover:bg-[#fdfcf9] ${i % 2 === 0 ? 'bg-white' : 'bg-[#fdfcf9]'}`}>
                    <td className="px-6 py-3.5 text-[14px] text-[#0c0a09] font-medium">{f.name}</td>
                    <td className="px-6 py-3.5 text-[13px] text-[#717d79]">{f.starter}</td>
                    <td className="px-6 py-3.5 text-[13px] font-medium text-[#0c0a09]">{f.pro}</td>
                    <td className="px-6 py-3.5 text-[13px] text-[#0c0a09]">{f.business}</td>
                    <td className="px-6 py-3.5 text-[13px] text-[#0c0a09]">{f.enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ with accordion */}
      <section className="border-b border-black/[0.04]">
        <div className="max-w-3xl mx-auto px-6 py-20 md:py-28">
          <h2 className={`${serif} text-[2.5rem] md:text-[3.5rem] font-normal tracking-[-0.02em] leading-[1.02] text-[#0c0a09] text-center mb-12`}>Frequently asked questions</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-2xl border border-black/[0.04] bg-white overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-6 py-5 text-left text-[15px] font-medium text-[#0c0a09] flex items-center justify-between hover:bg-[#fdfcf9] transition-colors"
                >
                  {faq.q}
                  <svg className={`w-4 h-4 text-[#717d79] transition-transform duration-300 ${openFaq === i ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                </button>
                <div className={`px-6 overflow-hidden transition-all duration-300 ${openFaq === i ? 'pb-5 max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <p className="text-[14px] text-[#4b5551] leading-relaxed">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ background: "radial-gradient(60% 60% at 50% 100%, rgba(21,184,129,0.22), rgba(21,184,129,0) 70%)" }} />
        <div className="max-w-3xl mx-auto px-6 py-24 md:py-32 text-center">
          <h2 className={`${serif} text-[2.5rem] md:text-[3.5rem] font-normal tracking-[-0.02em] leading-[1.02] text-[#0c0a09]`}>Ready to get started?</h2>
          <p className="mt-4 text-[16px] text-[#717d79]">Start your 14-day free trial. No credit card required.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="/register" className="text-[14px] font-medium text-white bg-[#0c0a09] hover:bg-[#0c0a09]/90 transition-colors rounded-full px-8 py-3.5 shadow-[0_10px_30px_-10px_rgba(12,10,9,0.5)]">Start free trial →</a>
            <a href="/login" className="text-[14px] font-medium text-[#0c0a09] bg-white border border-black/[0.08] hover:border-[#15b881]/40 transition-colors rounded-full px-8 py-3.5">Contact sales</a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
