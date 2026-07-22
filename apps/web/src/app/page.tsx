import Link from 'next/link';
import { Logo } from '@/components/Logo';
import Navbar from '@/components/Navbar';
import HeroPreview from '@/components/HeroPreview';
import HowItWorks from '@/components/HowItWorks';
import ScaleSection from '@/components/ScaleSection';
import CustomerStories from '@/components/CustomerStories';
import ProductShowcase from '@/components/ProductShowcase';
import Footer from '@/components/Footer';

/* ── Design tokens from Lovable build ──
   brand: #15b881 (mint green) / #0a8a5f (dark green) / #7ce3b6 (light)
   dark: #0c0a09
   bg: #fefdfb / #faf8f5
   muted: #717d79 / #969e9b
   serif headings throughout
*/

const serif = "font-serif";
const firms = [
  "O'Melveny & Myers", "Skadden Arps", "Latham & Watkins", "Kirkland & Ellis",
  "Baker McKenzie", "DLA Piper", "White & Case", "Gibson Dunn",
];

const tickerItems = [
  { n: "1.2M", l: "Documents analyzed" },
  { n: "450K", l: "Search queries" },
  { n: "89M", l: "API requests" },
  { n: "34K", l: "Drafts generated" },
  { n: "2.3M", l: "Meeting minutes" },
];

const iconPaths: Record<string, string> = {
  agent: "M12 2a5 5 0 0 0-5 5v2a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5zM5 22v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2",
  sync: "M21 12a9 9 0 1 1-3-6.7M21 4v5h-5",
  shield: "M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z",
  plug: "M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0V8zM12 18v4",
  team: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  code: "M16 18l6-6-6-6M8 6l-6 6 6 6",
};

const features = [
  { t: "Agent-native platform", d: "Purpose-built AI agents that read, write, and reason over legal documents. No retrofits, no compromises.", icon: "agent" },
  { t: "Self-updating knowledge base", d: "New case law, regulations, and client files sync in real time. Your knowledge is never stale.", icon: "sync" },
  { t: "Enterprise-grade security", d: "Row-level access control, tenant isolation, and immutable audit trails. SOC 2 Type II certified.", icon: "shield" },
  { t: "Works with your stack", d: "Gmail extension, WorkOS SSO, REST API, webhooks. Plug into your existing tools in minutes.", icon: "plug" },
  { t: "Team + AI collaboration", d: "Share matters, co-annotate analyses, assign AI tasks. Humans in the loop, AI on the clock.", icon: "team" },
  { t: "API-first architecture", d: "Custom playbooks, custom models, custom integrations. Build on our platform or alongside it.", icon: "code" },
];

const howSteps = [
  { n: "01", t: "Connect your firm", d: "SSO in one click. Import matters, templates, and playbooks from your existing DMS in minutes." },
  { n: "02", t: "Deploy your agents", d: "Pick from 40+ pre-trained legal agents or fine-tune your own on your firm's precedent library." },
  { n: "03", t: "Ship work 10× faster", d: "Review contracts in minutes, draft briefs in hours, close matters in days — not weeks." },
];

const stories = [
  { name: "Sterling & Associates", bar: "bg-[#15b881]", metric: "94%", label: "Faster turnaround", desc: "Contract review that took 3 weeks now completes in 4 hours. 200+ matters processed monthly with AI-driven clause extraction." },
  { name: "Greenfield Capital", bar: "bg-[#0a8a5f]", metric: "40K+", label: "Documents indexed", desc: "Full regulatory compliance research automated from weeks to hours with RAG-powered synthesis." },
  { name: "NovaTech Inc.", bar: "bg-[#0c0a09]", metric: "3.2×", label: "Deal throughput", desc: "AI drafting generates first-pass motions, briefs, and memos in the firm's voice." },
  { name: "Arcadian Corp", bar: "bg-[#ff5a00]", metric: "99.7%", label: "Audit compliance", desc: "Every AI action logged immutably. SOC 2 Type II and ISO 27001 ready." },
];

const startups = [
  { tag: "AI / Legal", name: "LexCheck", desc: "AI contract review startup built on Counsel's clause extraction and playbook APIs." },
  { tag: "Research", name: "CaseText", desc: "Legal research platform using Counsel's RAG pipeline for cited, verifiable answers." },
  { tag: "AI / Agent", name: "Harvey", desc: "AI-native law firm using Counsel for document analysis, drafting, and meeting intelligence." },
  { tag: "SaaS", name: "Docketwise", desc: "Immigration law platform leveraging Counsel's form recognition and clause matching." },
];

const testimonials = [
  { name: "Sarah Chen", role: "Managing Partner, Sterling & Associates", quote: "Counsel has transformed how our associates handle due diligence. What used to take weeks now takes hours, with better accuracy." },
  { name: "Marcus Webb", role: "General Counsel, NovaTech Inc.", quote: "The AI doesn't replace our lawyers — it makes them superhuman. Contract review that took 3 days now takes 20 minutes with higher precision." },
  { name: "Priya Kapoor", role: "Chief Innovation Officer, DLA Piper", quote: "We evaluated 7 platforms. Counsel was the only one that understood legal workflows, not just generic AI. The playbook engine saves us millions annually." },
];

const posts = [
  { tag: "Research", date: "Jul 9, 2026", title: "How AI Is Reshaping Legal Due Diligence in 2026" },
  { tag: "Product", date: "Jun 28, 2026", title: "Introducing Counsel Playbook Engine v2: 8× Faster Clause Matching" },
  { tag: "Guides", date: "Jun 15, 2026", title: "From Brief to Bench: AI-Assisted Legal Drafting Best Practices" },
];

function Star() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#15b881" fillOpacity="0.85">
      <path d="M12 2l2.9 6.9L22 10l-5.5 4.8L18.2 22 12 18.3 5.8 22l1.7-7.2L2 10l7.1-1.1L12 2z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15b881" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

const scaleStats = [
  { n: "500+", t: "Firms onboarded", s: "in the past year" },
  { n: "20M+", t: "Documents analyzed", s: "across all tenants" },
  { n: "99.99%", t: "Uptime", s: "across all services" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#fefdfb] text-[#0c0a09] antialiased selection:bg-[#15b881]/20" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <style>{`@keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>

      {/* ANNOUNCEMENT BAR */}
      <div className="relative z-[60] bg-gradient-to-r from-[#0c0a09] via-[#123b2b] to-[#0c0a09] text-white text-[13px]">
        <div className="max-w-7xl mx-auto px-6 py-2.5 flex items-center justify-center gap-3 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#15b881]/15 border border-[#15b881]/30 px-2.5 py-0.5 text-[11px] font-medium text-[#7ce3b6]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#15b881] animate-pulse" />
            New
          </span>
          <span className="text-white/80">
            Counsel <span className="font-medium text-white">Playbook Engine v2</span> is live — 8× faster clause matching.
          </span>
          <Link href="/product" className="hidden sm:inline-flex items-center gap-1 font-medium text-[#7ce3b6] hover:text-white transition-colors">
            Read more →
          </Link>
        </div>
      </div>

      <Navbar />

      <main>
        {/* HERO */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full blur-3xl opacity-40" style={{ background: "radial-gradient(circle, #15b881 0%, transparent 60%)" }} />
          <div aria-hidden className="pointer-events-none absolute top-20 right-0 w-[420px] h-[420px] rounded-full blur-3xl opacity-30" style={{ background: "radial-gradient(circle, #7ce3b6 0%, transparent 60%)" }} />
          <div className="max-w-7xl mx-auto px-6 pt-16 md:pt-24 pb-24 grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#15b881]/25 bg-[#eaf7f0] px-3 py-1.5 text-[12px] text-[#0a8a5f]">
                <span>Agent traffic</span>
                <span className="font-semibold tabular-nums">64.8595%</span>
                <span aria-hidden>›</span>
              </div>
              <h1 className={`${serif} mt-6 text-[3.25rem] md:text-[4.5rem] lg:text-[5.5rem] font-normal tracking-[-0.02em] leading-[1.02] text-[#0c0a09]`}>
                The AI workforce<br />your firm deserves
              </h1>
              <p className="mt-6 text-[17px] md:text-[19px] text-[#4b5551] max-w-lg leading-relaxed">
                Self-updating legal intelligence for{" "}
                <span className={`${serif} italic text-[#0c0a09]`}>boutiques</span>,{" "}
                <span className={`${serif} italic text-[#0c0a09]`}>Big Law</span>, and{" "}
                <span className={`${serif} italic text-[#0c0a09]`}>agents</span>.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/register" className="text-[14px] font-medium text-white bg-[#0c0a09] hover:bg-[#0c0a09]/90 transition-all rounded-full px-6 py-3 shadow-[0_10px_30px_-10px_rgba(12,10,9,0.5)] hover:shadow-[0_14px_40px_-10px_rgba(21,184,129,0.5)] hover:-translate-y-0.5">
                  Book a demo →
                </Link>
                <Link href="/register" className="text-[14px] font-medium text-[#0c0a09] bg-white border border-black/[0.08] hover:border-[#15b881]/40 transition-colors rounded-full px-6 py-3 inline-flex items-center gap-2">
                  Start free trial
                </Link>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-[#717d79]">
                <span className="inline-flex items-center gap-1.5"><CheckIcon />No credit card required</span>
                <span className="inline-flex items-center gap-1.5"><CheckIcon />14-day free trial</span>
                <span className="inline-flex items-center gap-1.5"><CheckIcon />SOC 2 Type II</span>
              </div>
              <div className="mt-8 flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-[#717d79]">
                  <Link href="/register" className="inline-flex items-center gap-1.5 text-[#0a8a5f] hover:text-[#15b881] font-medium transition-colors">
                    ⚖️ I'm a Legal firm →
                  </Link>
                  <span className="text-black/[0.15]">|</span>
                  <Link href="/register" className="inline-flex items-center gap-1.5 text-[#0a8a5f] hover:text-[#15b881] font-medium transition-colors">
                    📊 I'm a Consulting firm →
                  </Link>
                </div>
                <div className="flex items-center gap-4">
                  {["#15b881", "#0a8a5f", "#0c0a09", "#f2c14e", "#f0705b"].map((c) => (
                    <div key={c} className="w-8 h-8 rounded-full border-2 border-white" style={{ background: c }} />
                  ))}
                </div>
                <div className="text-[13px] text-[#4b5551]">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => <Star key={i} />)}
                    <span className="ml-1 font-semibold text-[#0c0a09]">4.9/5</span>
                  </div>
                  <div className="text-[12px] text-[#717d79]">from 500+ legal teams</div>
                </div>
              </div>
            </div>
            <div className="lg:pl-8">
              <HeroPreview />
            </div>
          </div>
        </section>

        {/* SOCIAL PROOF */}
        <section className="max-w-7xl mx-auto px-6 pb-20">
          <div className="text-center text-[15px] text-[#717d79]">
            Join <span className="font-semibold text-[#0c0a09]">500+</span> of the world's most ambitious legal teams.{" "}
            <Link href="/resources#cases" className="text-[#0a8a5f] hover:underline">Read customer stories →</Link>
          </div>
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-6">
            {firms.map((f) => (
              <div key={f} className="text-center text-[15px] font-medium text-[#0c0a09]/40 tracking-[-0.01em]">{f}</div>
            ))}
          </div>
        </section>

        {/* TICKER */}
        <div className="bg-[#0c0a09] text-white overflow-hidden">
          <div className="flex animate-[marquee_40s_linear_infinite] whitespace-nowrap py-5">
            {[...tickerItems, ...tickerItems, ...tickerItems, ...tickerItems].map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-8 shrink-0">
                <span className="text-[15px] font-semibold tabular-nums tracking-[-0.01em]">{item.n}</span>
                <span className="text-[14px] text-white/50">{item.l}</span>
                <span className="text-white/20 pl-8">•</span>
              </div>
            ))}
          </div>
        </div>

        {/* PRODUCT SHOWCASE (interactive tab-based) */}
        <ProductShowcase />

        {/* HOW IT WORKS */}
        <HowItWorks />

        {/* CUSTOMER STORIES */}
        <CustomerStories />

        <ScaleSection />

        {/* FOR STARTUPS */}
        <section className="border-t border-black/[0.04] bg-[#faf8f5]">
          <div className="max-w-7xl mx-auto px-6 py-24 md:py-32">
            <div className="text-[12px] tracking-[0.12em] uppercase text-[#0a8a5f]">For startups</div>
            <h2 className={`${serif} mt-4 text-[2.75rem] md:text-[4rem] font-normal tracking-[-0.02em] leading-[1.02] text-[#0c0a09]`}>
              Enabling the next generation<br />of legal-tech startups
            </h2>
            <div className="mt-16 grid md:grid-cols-2 gap-4">
              {startups.map((s) => (
                <div key={s.name} className="p-8 rounded-2xl border border-black/[0.04] bg-white hover:border-black/[0.08] transition-colors">
                  <span className="inline-flex items-center rounded-full bg-[#eaf7f0] border border-[#15b881]/20 text-[#0a8a5f] px-3 py-1 text-[12px] tracking-[-0.01em]">{s.tag}</span>
                  <h3 className={`${serif} mt-4 text-[28px] font-normal tracking-[-0.02em] text-[#0c0a09]`}>{s.name}</h3>
                  <p className="mt-2 text-[15px] text-[#717d79] leading-relaxed">{s.desc}</p>
                  <Link href="/resources#cases" className="mt-6 inline-block text-[14px] font-medium text-[#0c0a09] hover:text-[#0a8a5f] transition-colors">Read story →</Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="border-t border-black/[0.04]">
          <div className="max-w-7xl mx-auto px-6 py-24 md:py-32">
            <h2 className={`${serif} text-[2.75rem] md:text-[4rem] font-normal tracking-[-0.02em] leading-[1.02] text-[#0c0a09]`}>
              Trusted by teams<br />building with AI
            </h2>
            <div className="mt-16 grid md:grid-cols-3 gap-4">
              {testimonials.map((t) => (
                <div key={t.name} className="p-7 rounded-2xl border border-black/[0.04] bg-white flex flex-col">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (<Star key={i} />))}
                  </div>
                  <p className="mt-5 text-[15px] text-[#0c0a09] leading-relaxed tracking-[-0.01em] flex-1">&ldquo;{t.quote}&rdquo;</p>
                  <div className="mt-6 pt-6 border-t border-black/[0.04]">
                    <div className="text-[14px] font-medium text-[#0c0a09]">{t.name}</div>
                    <div className="text-[13px] text-[#717d79]">{t.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BLOG */}
        <section className="border-t border-black/[0.04] bg-[#faf8f5]">
          <div className="max-w-7xl mx-auto px-6 py-24 md:py-32">
            <div className="text-[12px] tracking-[0.12em] uppercase text-[#0a8a5f]">Stay informed</div>
            <div className="mt-4 flex items-end justify-between flex-wrap gap-4">
              <h2 className={`${serif} text-[2.75rem] md:text-[4rem] font-normal tracking-[-0.02em] leading-[1.02] text-[#0c0a09]`}>Latest updates</h2>
              <Link href="/resources#blog" className="text-[14px] font-medium text-[#0c0a09] hover:text-[#0a8a5f] transition-colors cursor-pointer">All posts →</Link>
            </div>
            <div className="mt-16 grid md:grid-cols-3 gap-4">
              {posts.map((p) => (
                <div key={p.title} className="group p-7 rounded-2xl border border-black/[0.04] bg-white hover:border-black/[0.08] transition-colors cursor-pointer">
                  <div className="flex items-center gap-3 text-[12px] text-[#969e9b]">
                    <span className="rounded-full bg-[#eaf7f0] text-[#0a8a5f] px-2.5 py-1">{p.tag}</span>
                    <span>·</span>
                    <span>{p.date}</span>
                  </div>
                  <h3 className="mt-6 text-[19px] font-semibold tracking-[-0.02em] text-[#0c0a09] group-hover:text-[#0a8a5f] transition-colors leading-snug">{p.title}</h3>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-black/[0.04] relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ background: "radial-gradient(60% 60% at 50% 100%, rgba(21,184,129,0.22), rgba(21,184,129,0) 70%)" }} />
          <div className="max-w-7xl mx-auto px-6 py-28 md:py-40 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#15b881]/25 bg-[#eaf7f0] px-3 py-1.5 text-[12px] text-[#0a8a5f]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#15b881] animate-pulse" />
              Start in under 2 minutes
            </div>
            <h2 className={`${serif} mt-6 text-[2.75rem] md:text-[5rem] font-normal tracking-[-0.02em] leading-[1.02] text-[#0c0a09]`}>
              The AI platform built for<br />legal &amp; consulting firms
            </h2>
            <p className="mt-8 text-[17px] md:text-[18px] text-[#717d79] max-w-2xl mx-auto leading-relaxed">
              Join 500+ firms already using Counsel to analyze contracts, synthesize research, and draft documents — faster and more accurately than ever.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/register" className="text-[14px] font-medium text-white bg-[#0c0a09] hover:bg-[#0a8a5f] transition-colors rounded-full px-8 py-3.5 shadow-[0_10px_30px_-10px_rgba(12,10,9,0.5)] hover:shadow-[0_14px_40px_-10px_rgba(21,184,129,0.5)] hover:-translate-y-0.5 transition-all">
                Book a demo →
              </Link>
              <Link href="/register" className="text-[14px] font-medium text-[#0c0a09] bg-white border border-black/[0.08] hover:border-[#15b881]/40 transition-colors rounded-full px-8 py-3.5">
                Start free trial
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12.5px] text-[#717d79]">
              <span className="inline-flex items-center gap-1.5"><CheckIcon />Free 14-day trial</span>
              <span className="inline-flex items-center gap-1.5"><CheckIcon />Cancel anytime</span>
              <span className="inline-flex items-center gap-1.5"><CheckIcon />Dedicated onboarding</span>
            </div>
            <div className="mt-14 pt-10 border-t border-black/[0.05] flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-[13px] font-medium text-[#969e9b]">
              {["SOC 2 Type II", "ISO 27001", "GDPR ready", "HIPAA compliant", "CCPA compliant"].map((b) => (<span key={b} className="tracking-[-0.01em]">{b}</span>))}
            </div>
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}
