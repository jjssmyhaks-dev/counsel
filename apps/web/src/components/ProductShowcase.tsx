'use client';

import { useState } from 'react';

const serif = "font-serif";

const products = [
  {
    id: "documents",
    label: "Document Analysis",
    heading: "Upload any legal document. Get answers in seconds.",
    desc: "Drop contracts, briefs, deposition transcripts, or discovery files. Our AI extracts clauses, scores risks, and generates summaries in under 5 seconds.",
    checks: ["23 clause types auto-detected", "Playbook-based risk scoring", "Redline comparison", "100+ docs bulk processing", "PDF, DOCX, TXT, images"],
    visual: (
      <div className="rounded-2xl border border-black/[0.06] bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.15)] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-black/[0.04] bg-[#fafaf7]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f0705b]" /><span className="w-2.5 h-2.5 rounded-full bg-[#f2c14e]" /><span className="w-2.5 h-2.5 rounded-full bg-[#15b881]" />
          <span className="ml-3 text-[11px] text-[#969e9b] font-mono">counsel.ai / contracts / review</span>
        </div>
        <div className="p-4 space-y-2.5">
          <div className="grid grid-cols-3 gap-2.5">
            {[{ l: "Clauses matched", v: "247" }, { l: "Risk flags", v: "12" }, { l: "Deviations", v: "3" }].map(s => (
              <div key={s.l} className="rounded-lg border border-black/[0.05] p-2.5 hover:border-[#15b881]/40 hover:bg-[#eaf7f0]/50 transition-all cursor-default">
                <div className="text-[9px] uppercase tracking-[0.12em] text-[#969e9b]">{s.l}</div>
                <div className="text-[17px] font-semibold text-[#0c0a09] tabular-nums">{s.v}</div>
              </div>
            ))}
          </div>
          {["Indemnification — Aligned", "Limitation of Liability — ⚠ Cap below floor", "Termination — Aligned"].map((r, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-black/[0.05] px-3 py-1.5 text-[11px] hover:border-[#15b881]/30 transition-all">
              <span className="text-[#0c0a09] font-medium">{r}</span>
              <span className={i === 1 ? "text-[#c2452e]" : "text-[#0a8a5f]"}>{i === 1 ? "Negotiate" : "✓ Pass"}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "research",
    label: "Legal Research",
    heading: "Search your firm's knowledge base. Get cited answers.",
    desc: "Query your documents, case law, and internal memos with natural language. Every answer comes with citations to source documents.",
    checks: ["Natural language queries", "RAG-powered with citations", "Real-time indexing", "Jurisdiction-aware filtering", "Custom playbook integration"],
    visual: (
      <div className="rounded-2xl border border-black/[0.06] bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.15)] overflow-hidden">
        <div className="p-3 border-b border-black/[0.04]">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#f7f7f7] text-[12px] text-[#717d79]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z" /></svg>
            indemnification obligations in M&A agreements
          </div>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-[13px] text-[#0c0a09] leading-relaxed">In a standard M&A agreement, the seller indemnifies the buyer against losses from breaches of representations and warranties. The cap is commonly 10–15% of purchase price.</p>
          <div className="flex flex-wrap gap-1.5">
            {["Merger Agreement §8.2", "Delaware Code §251", "Stark v. Retail (2025)", "SEC Rule 10b-5"].map(c => (
              <span key={c} className="px-2 py-0.5 rounded-full bg-[#eaf7f0] text-[11px] text-[#0a8a5f] font-medium hover:bg-[#15b881] hover:text-white transition-colors cursor-default">{c}</span>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "drafting",
    label: "AI Drafting",
    heading: "First drafts in seconds, not days.",
    desc: "Generate motions, briefs, memos, and client correspondence in your firm's voice. AI handles the first 80% — you review, polish, and send.",
    checks: ["Firm-specific tone adaptation", "200+ templates", "Tracked changes editing", "One-click export", "Gmail extension"],
    visual: (
      <div className="rounded-2xl border border-black/[0.06] bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.15)] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-black/[0.04] bg-[#fafaf7]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f0705b]" /><span className="w-2.5 h-2.5 rounded-full bg-[#f2c14e]" /><span className="w-2.5 h-2.5 rounded-full bg-[#15b881]" />
          <span className="ml-3 text-[11px] text-[#969e9b] font-mono">counsel.ai / drafts / motion-to-dismiss</span>
        </div>
        <div className="p-4 space-y-2 text-[12px] font-mono">
          <div className="text-[#0c0a09]">// Generating draft from firm precedent</div>
          <div className="text-[#0c0a09]">// Style: Sterling & Associates (litigation)</div>
          <div className="mt-3 p-2.5 rounded-lg bg-[#fafaf7] border border-black/[0.04] text-[#0c0a09] leading-relaxed">
            <span className="text-[#15b881]">IN THE UNITED STATES DISTRICT COURT</span><br />
            <span className="text-[#969e9b]">FOR THE DISTRICT OF DELAWARE</span><br /><br />
            <span className="font-semibold">MOTION TO DISMISS</span><br /><br />
            Defendant respectfully moves this Court to dismiss...
          </div>
          <div className="flex gap-1.5 mt-2">
            <span className="px-2 py-0.5 rounded-full bg-[#eaf7f0] text-[11px] text-[#0a8a5f] font-medium">2,847 words</span>
            <span className="px-2 py-0.5 rounded-full bg-[#eaf7f0] text-[11px] text-[#0a8a5f] font-medium">4 citations</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "clauses",
    label: "Clause Extraction",
    heading: "23 clause types. One click.",
    desc: "Automatically identify and classify clauses across any document — indemnification, governing law, and everything in between.",
    checks: ["23 predefined categories", "Custom clause definitions", "Missing clause detection", "Risk scoring per clause", "Side-by-side comparison"],
    visual: (
      <div className="rounded-2xl border border-black/[0.06] bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.15)] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-black/[0.04] bg-[#fafaf7]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f0705b]" /><span className="w-2.5 h-2.5 rounded-full bg-[#f2c14e]" /><span className="w-2.5 h-2.5 rounded-full bg-[#15b881]" />
          <span className="ml-3 text-[10px] text-[#969e9b] font-mono">counsel.ai / msa / clause-extract</span>
        </div>
        <div className="p-3 space-y-1.5">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[12px] font-semibold text-[#0c0a09]">MSA — 23/23 clauses</div>
            <span className="text-[10px] text-[#15b881] font-medium">100%</span>
          </div>
          {[
            { clause: "Indemnification", risk: "low", pct: 92, page: "§4.2" },
            { clause: "Limitation of Liability", risk: "high", pct: 45, page: "§6.1" },
            { clause: "Confidentiality", risk: "low", pct: 88, page: "§8.3" },
            { clause: "Force Majeure", risk: "low", pct: 95, page: "§11.0" },
            { clause: "Governing Law", risk: "medium", pct: 70, page: "§14.2" },
          ].map((c, i) => (
            <div key={i} className="flex items-center gap-2 p-1.5 rounded-md hover:bg-[#fafaf7] transition-colors cursor-default group">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.risk === 'high' ? 'bg-[#c2452e]' : c.risk === 'medium' ? 'bg-[#f2c14e]' : 'bg-[#15b881]'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-[#0c0a09]">{c.clause}</span>
                  <span className="text-[10px] text-[#969e9b]">{c.page}</span>
                </div>
                <div className="mt-0.5 h-1 rounded-full bg-[#f0f0f0] overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 group-hover:shadow-[0_0_6px_rgba(21,184,129,0.5)] ${c.risk === 'high' ? 'bg-[#c2452e]' : c.risk === 'medium' ? 'bg-[#f2c14e]' : 'bg-[#15b881]'}`} style={{ width: c.pct + '%' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "playbook",
    label: "Playbook Engine",
    heading: "Your firm's playbook. Enforced automatically.",
    desc: "Define negotiation positions — acceptable ranges, must-haves, dealbreakers — and let AI check every contract against your standards.",
    checks: ["Custom rules per practice area", "Auto-deviation flagging", "Negotiation guidance", "Version history", "Bulk portfolio analysis"],
    visual: (
      <div className="rounded-2xl border border-black/[0.06] bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.15)] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-black/[0.04] bg-[#fafaf7]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f0705b]" /><span className="w-2.5 h-2.5 rounded-full bg-[#f2c14e]" /><span className="w-2.5 h-2.5 rounded-full bg-[#15b881]" />
          <span className="ml-3 text-[10px] text-[#969e9b] font-mono">counsel.ai / playbooks / sterling-m-a-v3</span>
        </div>
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[12px] font-semibold text-[#0c0a09]">Sterling M&A Playbook v3</div>
            <span className="text-[9px] uppercase tracking-[0.12em] text-[#969e9b] px-1.5 py-0.5 rounded-full bg-[#f0f0f0]">8 rules</span>
          </div>
          {[
            { rule: "Indemnification Cap", required: "12–15% of price", actual: "18%", status: "violation" },
            { rule: "Non-Compete Duration", required: "24 months max", actual: "24 months", status: "pass" },
            { rule: "Dispute Resolution", required: "Arbitration (AAA)", actual: "Litigation", status: "violation" },
            { rule: "Data Privacy Addendum", required: "Must include DPA", actual: "Missing", status: "missing" },
          ].map((r, i) => (
            <div key={i} className="flex items-center justify-between p-1.5 rounded-lg border border-black/[0.04] hover:border-[#15b881]/30 transition-all cursor-default group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-[#0c0a09]">{r.rule}</span>
                  {r.status === 'violation' && <span className="text-[8px] font-semibold text-[#c2452e] uppercase bg-[#fdf0ee] px-1 py-0.5 rounded">⚠</span>}
                  {r.status === 'missing' && <span className="text-[8px] font-semibold text-[#f2c14e] uppercase bg-[#fef8e6] px-1 py-0.5 rounded">Missing</span>}
                  {r.status === 'pass' && <span className="text-[8px] font-semibold text-[#0a8a5f] uppercase bg-[#eaf7f0] px-1 py-0.5 rounded">✓</span>}
                </div>
                <div className="flex gap-3 mt-0.5 text-[10px]">
                  <span className="text-[#969e9b]">Req: <span className="text-[#0c0a09] font-medium">{r.required}</span></span>
                  <span className="text-[#969e9b]">Actual: <span className={`font-medium ${r.status === 'pass' ? 'text-[#0a8a5f]' : 'text-[#c2452e]'}`}>{r.actual}</span></span>
                </div>
              </div>
            </div>
          ))}
          <div className="pt-1 flex items-center justify-between text-[11px]">
            <span className="text-[#969e9b]">3 of 5 rules passed</span>
            <span className="text-[#15b881] font-medium">60% compliance</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "audit",
    label: "Audit & Compliance",
    heading: "Every action. Immutably logged.",
    desc: "SOC 2 Type II certified. Every AI analysis, draft, and search — logged, timestamped, and verifiable with SHA-256 hashes.",
    checks: ["SOC 2 Type II certified", "ISO 27001 compliant", "GDPR & CCPA ready", "Row-level access control", "90-day retention"],
    visual: (
      <div className="rounded-2xl border border-black/[0.06] bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.15)] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-black/[0.04] bg-[#fafaf7]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f0705b]" /><span className="w-2.5 h-2.5 rounded-full bg-[#f2c14e]" /><span className="w-2.5 h-2.5 rounded-full bg-[#15b881]" />
          <span className="ml-3 text-[10px] text-[#969e9b] font-mono">counsel.ai / admin / audit-log</span>
        </div>
        <div className="p-3 space-y-1">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[12px] font-semibold text-[#0c0a09]">Audit Trail — Last 24h</div>
            <span className="text-[9px] uppercase tracking-[0.12em] text-[#969e9b] px-1.5 py-0.5 rounded-full bg-[#f0f0f0]">1,247 events</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[9px] uppercase tracking-[0.08em] text-[#969e9b] border-b border-black/[0.04] pb-1">
            <span>Timestamp</span><span>Event</span><span>User</span>
          </div>
          {[
            { ts: "15:42:18 UTC", event: "document.view", user: "james@sterling.law" },
            { ts: "15:38:05 UTC", event: "clause.extract", user: "maria@sterling.law" },
            { ts: "15:29:41 UTC", event: "research.query", user: "ayesha@sterling.law" },
            { ts: "15:15:22 UTC", event: "draft.create", user: "james@sterling.law" },
            { ts: "15:03:09 UTC", event: "playbook.check", user: "maria@sterling.law" },
          ].map((e, i) => (
            <div key={i} className="grid grid-cols-3 gap-2 text-[11px] py-1 px-1.5 rounded hover:bg-[#fafaf7] transition-colors cursor-default">
              <span className="text-[#969e9b] font-mono text-[10px]">{e.ts}</span>
              <span className="text-[#0c0a09] font-medium text-[10px]">{e.event}</span>
              <span className="text-[#717d79] text-[10px] truncate">{e.user}</span>
            </div>
          ))}
          <div className="text-center text-[10px] text-[#969e9b] pt-1.5 border-t border-black/[0.04] mt-1">
            Immutable · SHA-256 hashed · 90-day retention
          </div>
        </div>
      </div>
    ),
  },
];

export default function ProductShowcase() {
  const [active, setActive] = useState(0);

  return (
    <section className="border-t border-black/[0.04]" id="product-showcase">
      <div className="max-w-7xl mx-auto px-6 py-24 md:py-32">
        <div className="text-[12px] tracking-[0.12em] uppercase text-[#0a8a5f] mb-4">Product</div>
        <h2 className={`${serif} text-[2.75rem] md:text-[4rem] font-normal tracking-[-0.02em] leading-[1.02] text-[#0c0a09] max-w-3xl mb-4`}>
          One platform for your<br />entire legal stack
        </h2>
        <p className="text-[16px] text-[#4b5551] max-w-xl leading-relaxed">
          From document intake to final deliverable — every feature is live and ready.
        </p>

        {/* Feature tabs */}
        <div className="mt-12 flex flex-wrap gap-2">
          {products.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setActive(i)}
              onMouseEnter={() => setActive(i)}
              className={`text-[13px] font-medium px-4 py-2 rounded-full transition-all duration-300 ${
                active === i
                  ? 'bg-[#0c0a09] text-white shadow-[0_8px_24px_-8px_rgba(12,10,9,0.4)]'
                  : 'bg-white border border-black/[0.06] text-[#717d79] hover:text-[#0c0a09] hover:border-[#15b881]/30'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Active product preview */}
        <div className="mt-10 grid lg:grid-cols-2 gap-10 items-center">
          <div key={products[active].id} className="animate-[fadeIn_0.4s_ease]">
            <h3 className={`${serif} text-[2rem] md:text-[2.5rem] font-normal tracking-[-0.02em] leading-[1.05] text-[#0c0a09]`}>
              {products[active].heading}
            </h3>
            <p className="mt-4 text-[15px] text-[#4b5551] leading-relaxed">{products[active].desc}</p>
            <ul className="mt-6 space-y-2.5">
              {products[active].checks.map(c => (
                <li key={c} className="flex items-start gap-2.5 text-[14px] text-[#0c0a09]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15b881" strokeWidth="2.5" strokeLinecap="round" className="mt-0.5 flex-shrink-0">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:pl-4">{products[active].visual}</div>
        </div>
      </div>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </section>
  );
}
