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
    name: "Free",
    monthlyINR: 0,
    annualINR: 0,
    monthlyUSD: 0,
    annualUSD: 0,
    desc: "For solo practitioners exploring AI-powered legal tech.",
    cta: "Start free",
    href: "/register",
    highlight: false,
    badge: "",
    features: [
      "20 documents/month",
      "Standard playbook templates",
      "Basic clause extraction (12 types)",
      "Community support",
      "1 user",
      "Chat AI — 50 queries/day",
    ],
    excluded: [
      "Custom playbooks",
      "AI drafting",
      "SSO / SAML",
      "API access",
    ],
  },
  {
    name: "Starter",
    monthlyINR: 999,
    annualINR: 799,
    monthlyUSD: 12,
    annualUSD: 10,
    desc: "For individual CAs and small legal practices.",
    cta: "Start 14-day trial",
    href: "/register",
    highlight: false,
    badge: "",
    features: [
      "200 documents/month",
      "3 custom playbook rules",
      "Full clause extraction (23 types)",
      "AI drafting — 100 drafts/month",
      "Email support (24h response)",
      "Chat AI — 200 queries/day",
      "Up to 3 users",
      "GST filing assistance",
    ],
    excluded: [
      "SSO / SAML",
      "API access",
      "Custom AI models",
    ],
  },
  {
    name: "Professional",
    monthlyINR: 4999,
    annualINR: 3999,
    monthlyUSD: 60,
    annualUSD: 48,
    desc: "For growing CA firms and mid-size legal practices.",
    cta: "Start 14-day trial",
    href: "/register",
    highlight: true,
    badge: "Most popular",
    features: [
      "Unlimited documents",
      "Unlimited playbook rules",
      "Full clause extraction (23 types)",
      "AI drafting + all templates",
      "Priority support (2h response)",
      "SSO + SAML",
      "Up to 15 users",
      "All CA verticals (GST, ITR, Audit, ROC)",
      "Unlimited chat AI queries",
      "RAG Knowledge Base",
      "Meeting intelligence",
    ],
    excluded: [
      "API access",
      "Custom AI models",
    ],
  },
  {
    name: "Business",
    monthlyINR: 14999,
    annualINR: 11999,
    monthlyUSD: 180,
    annualUSD: 144,
    desc: "For multi-partner firms with complex compliance needs.",
    cta: "Start 14-day trial",
    href: "/register",
    highlight: false,
    badge: "",
    features: [
      "Everything in Professional",
      "Unlimited users",
      "API access + webhooks",
      "Custom AI model fine-tuning",
      "Advanced analytics dashboard",
      "Dedicated customer success manager",
      "99.9% SLA",
      "DocuSign e-Sign integration",
      "CRM integration (Salesforce, Clio, HubSpot)",
      "Accounting integration (QuickBooks, Xero)",
      "Multi-firm / branch support",
    ],
    excluded: [],
  },
  {
    name: "Enterprise",
    monthlyINR: 0,
    annualINR: 0,
    monthlyUSD: 0,
    annualUSD: 0,
    desc: "For large firms and firms needing dedicated infrastructure.",
    cta: "Contact sales",
    href: "mailto:sales@counsel.ai",
    highlight: false,
    badge: "",
    features: [
      "Everything in Business",
      "Dedicated infrastructure (VPC)",
      "Custom SLA (99.99%+)",
      "White-glove data migration",
      "24/7 dedicated support",
      "On-premise deployment option",
      "Custom compliance certifications",
      "Custom integrations & workflows",
      "Dedicated AI model training",
    ],
    excluded: [],
  },
];

const faqs = [
  { q: "Do you accept UPI and Indian payment methods?", a: "Yes! We accept UPI (Google Pay, PhonePe, Paytm), net banking, credit/debit cards, and NEFT/RTGS for annual plans. All invoices include 18% GST as applicable." },
  { q: "Can I switch plans at any time?", a: "Yes. You can upgrade or downgrade your plan at any time. If you upgrade, you get immediate access. If you downgrade, changes take effect at the next billing cycle." },
  { q: "Is there a free trial?", a: "Yes. All paid plans come with a 14-day free trial. No credit card or UPI mandate required. Cancel anytime during the trial." },
  { q: "What counts as a document?", a: "Any uploaded file — PDF, DOCX, TXT, or image — counts as one document toward your plan limit. Professional and above have unlimited documents." },
  { q: "How does billing work for Indian customers?", a: "We bill monthly or annually (save 20%). You can add or remove users at any time. All plans are priced in INR (and USD for international firms). GST invoice provided." },
  { q: "Is my data secure?", a: "Absolutely. Counsel is SOC 2 Type II certified with ISO 27001 compliance. All data is encrypted at rest and in transit. We follow ICSI and ICAI data governance guidelines." },
  { q: "Do you offer special pricing for ICAI members?", a: "Yes! ICAI members get 20% off the first year on any paid plan. Contact us with your ICAI membership number to avail the discount." },
  { q: "Can I pay annually?", a: "Yes. Annual plans save you 20% compared to monthly billing. We accept bank transfer (NEFT/RTGS) for annual plans above ₹50,000." },
];

const comparisonFeatures = [
  { name: "Documents/month", starter: "200", pro: "Unlimited", business: "Unlimited", enterprise: "Unlimited" },
  { name: "Chat AI queries/day", starter: "200", pro: "Unlimited", business: "Unlimited", enterprise: "Unlimited" },
  { name: "Clause types", starter: "23", pro: "23", business: "23", enterprise: "23" },
  { name: "Custom playbooks", starter: "3 rules", pro: "Unlimited", business: "Unlimited", enterprise: "Unlimited" },
  { name: "AI drafting", starter: "100/month", pro: "Unlimited", business: "Unlimited", enterprise: "Unlimited" },
  { name: "GST filing assist", starter: "✓", pro: "✓", business: "✓", enterprise: "✓" },
  { name: "Income Tax (ITR)", starter: "—", pro: "✓", business: "✓", enterprise: "✓" },
  { name: "Audit automation", starter: "—", pro: "✓", business: "✓", enterprise: "✓" },
  { name: "ROC compliance", starter: "—", pro: "✓", business: "✓", enterprise: "✓" },
  { name: "RAG Knowledge Base", starter: "—", pro: "✓", business: "✓", enterprise: "✓" },
  { name: "API access", starter: "—", pro: "—", business: "✓", enterprise: "✓" },
  { name: "SSO / SAML", starter: "—", pro: "✓", business: "✓", enterprise: "✓" },
  { name: "Custom AI models", starter: "—", pro: "—", business: "✓", enterprise: "✓" },
  { name: "Users", starter: "Up to 3", pro: "Up to 15", business: "Unlimited", enterprise: "Unlimited" },
  { name: "Support", starter: "Email (24h)", pro: "Priority (2h)", business: "Dedicated CSM", enterprise: "24/7 dedicated" },
  { name: "SLA", starter: "—", pro: "—", business: "99.9%", enterprise: "99.99%+" },
];

function formatINR(price: number) {
  if (price === 0) return 'Free';
  return `₹${price.toLocaleString('en-IN')}`;
}

function formatUSD(price: number) {
  if (price === 0) return '';
  return `$${price}`;
}

export default function PricingPage() {
  const [billing, setBilling] = useState<'monthly' | 'annually'>('monthly');
  const [currency, setCurrency] = useState<'inr' | 'usd'>('inr');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#fefdfb] text-[#0c0a09] antialiased selection:bg-[#15b881]/20" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <Navbar />

      {/* Hero */}
      <section className="border-b border-black/[0.04]">
        <div className="max-w-7xl mx-auto px-6 pt-20 pb-16 md:pt-28 md:pb-24 text-center">
          <div className="text-[12px] tracking-[0.12em] uppercase text-[#0a8a5f] mb-4">Pricing for India &amp; Global</div>
          <h1 className={`${serif} text-[3.25rem] md:text-[5rem] font-normal tracking-[-0.02em] leading-[1.02] text-[#0c0a09]`}>
            Simple, transparent pricing
          </h1>
          <p className="mt-6 text-[17px] text-[#4b5551] max-w-xl mx-auto leading-relaxed">
            Start free, upgrade when you need more. Pay in ₹ via UPI, cards, or net banking. No hidden fees, no surprises.
          </p>

          {/* Currency toggle */}
          <div className="mt-8 inline-flex items-center gap-2 bg-[#f7f7f7] rounded-full p-1 border border-black/[0.04]">
            <button
              onClick={() => setCurrency('inr')}
              className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-all duration-300 ${currency === 'inr' ? 'bg-white text-[#0c0a09] shadow-sm' : 'text-[#717d79] hover:text-[#0c0a09]'}`}
            >
              🇮🇳 ₹ INR
            </button>
            <button
              onClick={() => setCurrency('usd')}
              className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-all duration-300 ${currency === 'usd' ? 'bg-white text-[#0c0a09] shadow-sm' : 'text-[#717d79] hover:text-[#0c0a09]'}`}
            >
              🇺🇸 $ USD
            </button>
          </div>

          {/* Billing toggle */}
          <div className="mt-4 inline-flex items-center gap-3 bg-[#f7f7f7] rounded-full p-1 border border-black/[0.04]">
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

          {/* GST note */}
          {currency === 'inr' && (
            <p className="mt-4 text-[13px] text-[#969e9b]">All prices exclusive of 18% GST · UPI, Cards, Net Banking accepted</p>
          )}
        </div>
      </section>

      {/* Plans */}
      <section className="border-b border-black/[0.04]">
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
          <div className="grid md:grid-cols-5 gap-3 items-start">
            {plans.map((p, i) => {
              const price = currency === 'inr'
                ? (billing === 'monthly' ? p.monthlyINR : p.annualINR)
                : (billing === 'monthly' ? p.monthlyUSD : p.annualUSD);
              const usdAlt = currency === 'inr'
                ? (billing === 'monthly' ? p.monthlyUSD : p.annualUSD)
                : 0;

              return (
                <div key={p.name} className={`rounded-2xl border p-6 flex flex-col relative transition-all duration-500 animate-[fadeIn_0.3s_ease] overflow-visible`} style={{ animationDelay: `${i * 75}ms` }}>
                  {p.highlight && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#15b881] text-white text-[11px] font-semibold rounded-full uppercase tracking-wider whitespace-nowrap z-20 shadow-[0_4px_12px_rgba(21,184,129,0.4)]">{p.badge}</div>
                  )}
                  {p.highlight
                    ? <div className="rounded-2xl border-[#15b881] ring-1 ring-[#15b881]/20 shadow-[0_20px_60px_-20px_rgba(21,184,129,0.3)] bg-white" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
                    : <div className="rounded-2xl border-black/[0.04] bg-white" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
                  }
                  <div className="relative z-10 flex flex-col h-full">
                    <div className="text-[14px] font-medium text-[#0c0a09] mb-1">{p.name}</div>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className={`${serif} text-[2.5rem] font-normal tracking-[-0.02em] text-[#0c0a09] transition-all duration-300`}>
                        {p.name === 'Enterprise' ? 'Custom' : currency === 'inr' ? formatINR(price) : formatUSD(price)}
                      </span>
                      {p.name !== 'Enterprise' && price > 0 && (
                        <span className="text-[14px] text-[#969e9b]">/month</span>
                      )}
                    </div>
                    {billing === 'annually' && price > 0 && (
                      <div className="text-[12px] text-[#0a8a5f] mt-1 font-medium">Billed {currency === 'inr' ? 'yearly' : 'annually'}</div>
                    )}
                    {currency === 'inr' && usdAlt > 0 && (
                      <div className="text-[11px] text-[#969e9b] mt-0.5">≈ {formatUSD(usdAlt)}/mo</div>
                    )}
                    <p className="text-[13px] text-[#717d79] mt-2 mb-4">{p.desc}</p>
                    <a href={p.href} className={`w-full py-2.5 rounded-full text-center text-[13px] font-semibold transition-colors mb-4 ${p.highlight ? 'bg-[#0c0a09] text-white hover:bg-[#15b881]' : 'bg-[#f7f7f7] text-[#0c0a09] hover:bg-[#eaf7f0]'}`}>
                      {p.cta}
                    </a>
                    <ul className="space-y-2 flex-1">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-[12px] text-[#0c0a09]"><CheckIcon /><span>{f}</span></li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Feature Comparison */}
      <section className="border-b border-black/[0.04] bg-[#faf8f5]">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <h2 className={`${serif} text-[2.5rem] md:text-[3.5rem] font-normal tracking-[-0.02em] leading-[1.02] text-[#0c0a09] text-center mb-4`}>Full feature comparison</h2>
          <p className="text-center text-[15px] text-[#717d79] mb-12">Compare plans side-by-side to find the right fit for your firm.</p>
          <div className="rounded-2xl border border-black/[0.04] bg-white overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead>
                <tr className="border-b border-black/[0.04]">
                  <th className="px-5 py-4 text-[12px] tracking-[0.12em] uppercase text-[#969e9b] font-medium">Feature</th>
                  <th className="px-5 py-4 text-[12px] tracking-[0.12em] uppercase text-[#969e9b] font-medium text-center">Starter</th>
                  <th className="px-5 py-4 text-[12px] tracking-[0.12em] uppercase text-[#0a8a5f] font-medium text-center">Professional</th>
                  <th className="px-5 py-4 text-[12px] tracking-[0.12em] uppercase text-[#969e9b] font-medium text-center">Business</th>
                  <th className="px-5 py-4 text-[12px] tracking-[0.12em] uppercase text-[#969e9b] font-medium text-center">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((f, i) => (
                  <tr key={f.name} className={`border-b border-black/[0.04] transition-colors hover:bg-[#fdfcf9] ${i % 2 === 0 ? 'bg-white' : 'bg-[#fdfcf9]'}`}>
                    <td className="px-5 py-3 text-[13px] text-[#0c0a09] font-medium">{f.name}</td>
                    <td className="px-5 py-3 text-[12px] text-[#717d79] text-center">{f.starter}</td>
                    <td className="px-5 py-3 text-[12px] font-medium text-[#0c0a09] text-center">{f.pro}</td>
                    <td className="px-5 py-3 text-[12px] text-[#0c0a09] text-center">{f.business}</td>
                    <td className="px-5 py-3 text-[12px] text-[#0c0a09] text-center">{f.enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Indian Payment Methods */}
      <section className="border-b border-black/[0.04]">
        <div className="max-w-5xl mx-auto px-6 py-16 md:py-20 text-center">
          <h2 className={`${serif} text-[2rem] md:text-[2.5rem] font-normal tracking-[-0.02em] leading-[1.02] text-[#0c0a09] mb-8`}>Pay your way</h2>
          <div className="flex flex-wrap items-center justify-center gap-6">
            {[
              { label: 'UPI', icon: '📱', desc: 'Google Pay, PhonePe, Paytm' },
              { label: 'Cards', icon: '💳', desc: 'Visa, Mastercard, RuPay' },
              { label: 'Net Banking', icon: '🏦', desc: 'All major banks' },
              { label: 'NEFT/RTGS', icon: '💸', desc: 'For annual plans above ₹50K' },
            ].map(m => (
              <div key={m.label} className="flex items-center gap-3 bg-white border border-black/[0.06] rounded-xl px-5 py-3">
                <span className="text-2xl">{m.icon}</span>
                <div className="text-left">
                  <div className="text-[13px] font-semibold text-[#0c0a09]">{m.label}</div>
                  <div className="text-[11px] text-[#717d79]">{m.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-[13px] text-[#969e9b]">All plans include 18% GST · GST-compliant invoices provided · ICAI member discounts available</p>
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
                  <svg className={`w-4 h-4 text-[#717d79] transition-transform duration-300 shrink-0 ml-4 ${openFaq === i ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
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
          <p className="mt-4 text-[16px] text-[#717d79]">Start your 14-day free trial. No credit card or UPI mandate required.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="/register" className="text-[14px] font-medium text-white bg-[#0c0a09] hover:bg-[#0c0a09]/90 transition-colors rounded-full px-8 py-3.5 shadow-[0_10px_30px_-10px_rgba(12,10,9,0.5)]">Start free trial →</a>
            <a href="mailto:sales@counsel.ai" className="text-[14px] font-medium text-[#0c0a09] bg-white border border-black/[0.08] hover:border-[#15b881]/40 transition-colors rounded-full px-8 py-3.5">Talk to sales</a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
