import Navbar from '@/components/Navbar';

const serif = "font-serif";

function CheckIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15b881" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>;
}

const byFirmSize = [
  {
    id: "solo",
    label: "Solo Practitioners",
    heading: "Start free. Scale when you're ready.",
    desc: "Everything a solo practitioner needs — document analysis, basic playbooks, and email support. Upgrade as your practice grows.",
    checks: ["50 documents/month free", "Standard playbook templates", "Email support in 2 hours", "Gmail extension included", "No long-term commitment"],
    href: "/register",
  },
  {
    id: "boutique",
    label: "Boutique Firms (10–50)",
    heading: "Compete with Big Law. Win on speed.",
    desc: "Give your associates AI superpowers. Handle more matters without hiring more people — contract review, research, and drafting all accelerated.",
    checks: ["Unlimited documents", "Custom playbooks", "Priority Slack support", "SSO + SAML", "Team collaboration tools"],
    href: "/register",
  },
  {
    id: "midsize",
    label: "Mid-Size Firms (50–200)",
    heading: "Enterprise AI at mid-market pricing.",
    desc: "Full platform access with dedicated onboarding. Integrate Counsel into your existing DMS, billing, and practice management systems.",
    checks: ["Everything in Boutique", "Dedicated customer success manager", "Custom AI model fine-tuning", "API access + webhooks", "On-premise deployment option"],
    href: "/register",
  },
  {
    id: "biglaw",
    label: "Big Law (200+)",
    heading: "Enterprise-grade AI. Zero compromise.",
    desc: "Dedicated infrastructure, custom SLAs, and white-glove migration. Counsel runs on your terms — cloud, hybrid, or fully on-premise.",
    checks: ["Everything in Mid-Size", "Dedicated infrastructure (VPC)", "Custom SLA (99.99%+ uptime)", "White-glove data migration", "24/7 dedicated support team", "Custom compliance certifications"],
    href: "/login",
  },
];

const byPractice = [
  {
    id: "corporate",
    label: "Corporate / M&A",
    heading: "Due diligence in hours, not weeks.",
    desc: "Upload data room documents. Get clause extraction, risk scoring, and exception reports before your first coffee.",
    features: ["Bulk document analysis", "M&A playbook templates", "Disclosure schedule generation", "Side-by-side redline comparison"],
  },
  {
    id: "litigation",
    label: "Litigation",
    heading: "From complaint to verdict. Faster.",
    desc: "Generate first-pass motions, analyze deposition transcripts, and organize discovery — all within Counsel.",
    features: ["Motion drafting (MTD, MSJ, discovery)", "Deposition transcript analysis", "E-discovery document review", "Case law research + citations"],
  },
  {
    id: "regulatory",
    label: "Regulatory & Compliance",
    heading: "Stay compliant. Stay ahead.",
    desc: "Monitor regulatory changes, assess impact on your clients, and generate compliance reports — automatically.",
    features: ["Regulatory change monitoring", "Compliance gap analysis", "Automated reporting", "Multi-jurisdiction support"],
  },
  {
    id: "ip",
    label: "IP & Patent",
    heading: "Protect innovation at speed.",
    desc: "Prior art search, patent drafting assistance, and IP portfolio management — all powered by AI.",
    features: ["Prior art search + analysis", "Patent drafting assistance", "Trademark monitoring", "IP portfolio dashboard"],
  },
];

const testimonials = [
  { q: "Counsel helped us close a $200M M&A deal in record time. Due diligence that would've taken 3 weeks finished in 2 days.", n: "James Sterling", r: "Partner", c: "Sterling & Associates" },
  { q: "Our associates now handle 3× more matters. The AI drafting alone saves 15 hours per attorney per week.", n: "Lisa Park", r: "Managing Partner", c: "Park Legal Group" },
  { q: "We evaluated every legal AI platform. Counsel was the only one our IT security team approved on the first review.", n: "David Kim", r: "CTO", c: "Meridian Law LLP" },
];

export default function SolutionsPage() {
  return (
    <div className="min-h-screen bg-[#fefdfb] text-[#0c0a09] antialiased selection:bg-[#15b881]/20" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <Navbar />

      {/* Hero */}
      <section className="border-b border-black/[0.04]">
        <div className="max-w-7xl mx-auto px-6 pt-20 pb-16 md:pt-28 md:pb-24">
          <div className="text-[12px] tracking-[0.12em] uppercase text-[#0a8a5f] mb-4">Solutions</div>
          <h1 className={`${serif} text-[3.25rem] md:text-[5rem] font-normal tracking-[-0.02em] leading-[1.02] text-[#0c0a09] max-w-3xl`}>
            Built for every legal team,<br />every practice area
          </h1>
          <p className="mt-6 text-[17px] text-[#4b5551] max-w-xl leading-relaxed">
            Whether you&apos;re a solo practitioner or a global firm, Counsel adapts to your workflows — not the other way around.
          </p>
        </div>
      </section>

      {/* By Firm Size */}
      <section className="border-b border-black/[0.04] bg-[#faf8f5]">
        <div className="max-w-7xl mx-auto px-6 py-20 md:py-28">
          <div className="text-[12px] tracking-[0.12em] uppercase text-[#0a8a5f] mb-4">By firm size</div>
          <h2 className={`${serif} text-[2.75rem] md:text-[4rem] font-normal tracking-[-0.02em] leading-[1.02] text-[#0c0a09] mb-16`}>
            Right-sized for every stage
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {byFirmSize.map((f) => (
              <div key={f.id} id={f.id} className="rounded-2xl border border-black/[0.04] bg-white p-8 hover:border-[#15b881]/30 transition-colors flex flex-col">
                <div className="text-[12px] tracking-[0.12em] uppercase text-[#0a8a5f] mb-3">{f.label}</div>
                <h3 className={`${serif} text-[28px] font-normal tracking-[-0.02em] text-[#0c0a09]`}>{f.heading}</h3>
                <p className="mt-3 text-[15px] text-[#4b5551] leading-relaxed flex-1">{f.desc}</p>
                <ul className="mt-6 space-y-2.5 mb-8">
                  {f.checks.map(c => (
                    <li key={c} className="flex items-start gap-2.5 text-[13px] text-[#0c0a09]"><CheckIcon /><span>{c}</span></li>
                  ))}
                </ul>
                <a href={f.href} className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#0a8a5f] hover:text-[#15b881] transition-colors">
                  {f.label === "Big Law (200+)" ? "Contact sales" : "Get started"} <span aria-hidden>→</span>
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* By Practice Area */}
      <section className="border-b border-black/[0.04]">
        <div className="max-w-7xl mx-auto px-6 py-20 md:py-28">
          <div className="text-[12px] tracking-[0.12em] uppercase text-[#0a8a5f] mb-4">By practice area</div>
          <h2 className={`${serif} text-[2.75rem] md:text-[4rem] font-normal tracking-[-0.02em] leading-[1.02] text-[#0c0a09] mb-16`}>
            Purpose-built for your practice
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {byPractice.map((p) => (
              <div key={p.id} id={p.id} className="rounded-2xl border border-black/[0.04] bg-white p-8 hover:border-[#15b881]/30 transition-colors">
                <div className="text-[12px] tracking-[0.12em] uppercase text-[#0a8a5f] mb-3">{p.label}</div>
                <h3 className={`${serif} text-[28px] font-normal tracking-[-0.02em] text-[#0c0a09]`}>{p.heading}</h3>
                <p className="mt-3 text-[15px] text-[#4b5551] leading-relaxed">{p.desc}</p>
                <ul className="mt-6 space-y-2.5">
                  {p.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-[13px] text-[#0c0a09]"><CheckIcon /><span>{f}</span></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-b border-black/[0.04] bg-[#faf8f5]">
        <div className="max-w-7xl mx-auto px-6 py-20 md:py-28">
          <h2 className={`${serif} text-[2.75rem] md:text-[4rem] font-normal tracking-[-0.02em] leading-[1.02] text-[#0c0a09] text-center mb-16`}>
            Trusted across the industry
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {testimonials.map(t => (
              <div key={t.n} className="p-7 rounded-2xl border border-black/[0.04] bg-white flex flex-col">
                <p className="text-[15px] text-[#0c0a09] leading-relaxed flex-1">&ldquo;{t.q}&rdquo;</p>
                <div className="mt-6 pt-6 border-t border-black/[0.04]">
                  <div className="text-[14px] font-medium text-[#0c0a09]">{t.n}</div>
                  <div className="text-[13px] text-[#717d79]">{t.r}, {t.c}</div>
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
          <h2 className={`${serif} text-[2.5rem] md:text-[3.5rem] font-normal tracking-[-0.02em] leading-[1.02] text-[#0c0a09]`}>Find the right plan for your firm</h2>
          <p className="mt-4 text-[16px] text-[#717d79]">From free solo plans to enterprise deployments — we have you covered.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="/pricing" className="text-[14px] font-medium text-white bg-[#0c0a09] hover:bg-[#0c0a09]/90 transition-colors rounded-full px-8 py-3.5 shadow-[0_10px_30px_-10px_rgba(12,10,9,0.5)]">View pricing →</a>
            <a href="/register" className="text-[14px] font-medium text-[#0c0a09] bg-white border border-black/[0.08] hover:border-[#15b881]/40 transition-colors rounded-full px-8 py-3.5">Start free trial</a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/[0.04] bg-[#faf8f5]">
        <div className="max-w-7xl mx-auto px-6 py-12 text-center text-[13px] text-[#717d79]">
          &copy; 2026 Counsel Technologies, Inc. <span className="mx-2">·</span>
          <a href="#" className="hover:text-[#0c0a09] transition-colors">Privacy</a> <span className="mx-2">·</span>
          <a href="#" className="hover:text-[#0c0a09] transition-colors">Terms</a> <span className="mx-2">·</span>
          <a href="#" className="hover:text-[#0c0a09] transition-colors">Security</a>
        </div>
      </footer>
    </div>
  );
}
