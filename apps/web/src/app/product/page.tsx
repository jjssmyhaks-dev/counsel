import Navbar from '@/components/Navbar';

const serif = "font-serif";

function CheckIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15b881" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>;
}

const sections = [
  {
    id: "documents",
    label: "Document Analysis",
    heading: "Upload any legal document. Get answers in seconds.",
    desc: "Drop contracts, briefs, deposition transcripts, or discovery files. Our AI extracts clauses, scores risks, flags missing provisions, and generates executive summaries — all in under 5 seconds.",
    checks: ["23 clause types detected automatically", "Playbook-based risk scoring", "Redline comparison across versions", "Bulk processing — 100+ documents at once", "PDF, DOCX, TXT, and image support"],
    visual: (
      <div className="rounded-2xl border border-black/[0.06] bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.15)] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-black/[0.04] bg-[#fafaf7]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f0705b]" /><span className="w-2.5 h-2.5 rounded-full bg-[#f2c14e]" /><span className="w-2.5 h-2.5 rounded-full bg-[#15b881]" />
          <span className="ml-3 text-[11px] text-[#969e9b] font-mono">counsel.app / contracts / review</span>
        </div>
        <div className="p-6 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {[{ l: "Clauses matched", v: "247" }, { l: "Risk flags", v: "12" }, { l: "Deviations", v: "3" }].map(s => (
              <div key={s.l} className="rounded-lg border border-black/[0.05] p-3 hover:border-[#15b881]/40 hover:bg-[#eaf7f0]/50 transition-all duration-300 cursor-default">
                <div className="text-[10px] uppercase tracking-[0.12em] text-[#969e9b]">{s.l}</div>
                <div className="text-[19px] font-semibold text-[#0c0a09] tabular-nums">{s.v}</div>
              </div>
            ))}
          </div>
          {["Indemnification — Aligned", "Limitation of Liability — ⚠ Cap below floor", "Termination — Aligned"].map((r, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-black/[0.05] px-3 py-2 text-[12px] hover:border-[#15b881]/30 transition-all duration-300">
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
    heading: "Search your entire knowledge base. Get cited answers.",
    desc: "Query your firm's documents, case law, and internal memos with natural language. Every answer comes with citations to source documents — fully traceable and auditable.",
    checks: ["Natural language queries across all documents", "RAG-powered synthesis with source citations", "Real-time indexing as new documents arrive", "Jurisdiction-aware search filtering", "Custom playbook integration for automated checks"],
    visual: (
      <div className="rounded-2xl border border-black/[0.06] bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.15)] overflow-hidden">
        <div className="p-4 border-b border-black/[0.04]">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#f7f7f7] text-[13px] text-[#717d79]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z" /></svg>
            indemnification obligations in M&A standard agreement
          </div>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-[14px] text-[#0c0a09] leading-relaxed">In a standard M&A agreement, the seller typically indemnifies the buyer against losses arising from breaches of representations, warranties, and covenants. The indemnification cap is commonly set at 10–15% of the purchase price.</p>
          <div className="flex flex-wrap gap-2">
            {["Merger Agreement §8.2", "Delaware Code §251", "Stark v. Retail (2025)", "SEC Rule 10b-5"].map(c => (
              <span key={c} className="px-2.5 py-1 rounded-full bg-[#eaf7f0] text-[12px] text-[#0a8a5f] font-medium hover:bg-[#15b881] hover:text-white transition-colors cursor-default">{c}</span>
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
    desc: "Generate motions, briefs, memos, and client correspondence in your firm's voice. The AI handles the first 80% — you review, polish, and send.",
    checks: ["Firm-specific tone and style adaptation", "200+ document templates", "Collaborative editing with tracked changes", "One-click export to Word, PDF, or email", "Gmail extension for in-place drafting"],
    visual: (
      <div className="rounded-2xl border border-black/[0.06] bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.15)] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-black/[0.04] bg-[#fafaf7]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f0705b]" /><span className="w-2.5 h-2.5 rounded-full bg-[#f2c14e]" /><span className="w-2.5 h-2.5 rounded-full bg-[#15b881]" />
          <span className="ml-3 text-[11px] text-[#969e9b] font-mono">counsel.app / drafts / motion-to-dismiss</span>
        </div>
        <div className="p-6 space-y-3 text-[13px] font-mono">
          <div className="text-[#0c0a09]">// Generating draft based on firm precedent</div>
          <div className="text-[#0c0a09]">// Style: Sterling & Associates (litigation)</div>
          <div className="text-[#0c0a09]">// Template: Motion to Dismiss (FRCP 12(b)(6))</div>
          <div className="mt-4 p-3 rounded-lg bg-[#fafaf7] border border-black/[0.04] text-[#0c0a09] leading-relaxed">
            <span className="text-[#15b881]">IN THE UNITED STATES DISTRICT COURT</span><br />
            <span className="text-[#969e9b]">FOR THE DISTRICT OF DELAWARE</span><br /><br />
            <span className="font-semibold">MOTION TO DISMISS</span><br /><br />
            Defendant respectfully moves this Court to dismiss...
          </div>
          <div className="flex gap-2 mt-3">
            <span className="px-3 py-1 rounded-full bg-[#eaf7f0] text-[12px] text-[#0a8a5f] font-medium">2,847 words</span>
            <span className="px-3 py-1 rounded-full bg-[#eaf7f0] text-[12px] text-[#0a8a5f] font-medium">4 citations</span>
            <span className="px-3 py-1 rounded-full bg-[#eaf7f0] text-[12px] text-[#0a8a5f] font-medium">92% confidence</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "clauses",
    label: "Clause Extraction",
    heading: "23 clause types. One click.",
    desc: "Automatically identify and classify clauses across any legal document. From indemnification to governing law, our AI knows what to look for.",
    checks: ["23 predefined clause categories", "Custom clause definitions for firm playbooks", "Missing clause detection", "Clause-by-clause risk scoring", "Side-by-side comparison view"],
    visual: (
      <div className="rounded-2xl border border-black/[0.06] bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.15)] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-black/[0.04] bg-[#fafaf7]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f0705b]" /><span className="w-2.5 h-2.5 rounded-full bg-[#f2c14e]" /><span className="w-2.5 h-2.5 rounded-full bg-[#15b881]" />
          <span className="ml-3 text-[11px] text-[#969e9b] font-mono">counsel.app / msa-contract / clause-extraction</span>
        </div>
        <div className="p-4 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[13px] font-semibold text-[#0c0a09]">Master Services Agreement — 23/23 clauses</div>
            <span className="text-[11px] text-[#15b881] font-medium">100% extracted</span>
          </div>
          {[
            { clause: "Indemnification", risk: "low", pct: 92, page: "§4.2" },
            { clause: "Limitation of Liability", risk: "high", pct: 45, page: "§6.1" },
            { clause: "Confidentiality", risk: "low", pct: 88, page: "§8.3" },
            { clause: "Force Majeure", risk: "low", pct: 95, page: "§11.0" },
            { clause: "Governing Law", risk: "medium", pct: 70, page: "§14.2" },
            { clause: "Termination", risk: "low", pct: 90, page: "§9.1" },
          ].map((c, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#fafaf7] transition-colors cursor-default group">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.risk === 'high' ? 'bg-[#c2452e]' : c.risk === 'medium' ? 'bg-[#f2c14e]' : 'bg-[#15b881]'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-[#0c0a09]">{c.clause}</span>
                  <span className="text-[11px] text-[#969e9b]">{c.page}</span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-[#f0f0f0] overflow-hidden">
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
    desc: "Define your firm's negotiation positions — acceptable ranges, must-haves, and dealbreakers — and let Counsel check every contract against your standards.",
    checks: ["Custom playbook rules per practice area", "Automated flagging of deviations", "Negotiation guidance for each clause", "Version history for playbook changes", "Bulk analysis across matter portfolios"],
    visual: (
      <div className="rounded-2xl border border-black/[0.06] bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.15)] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-black/[0.04] bg-[#fafaf7]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f0705b]" /><span className="w-2.5 h-2.5 rounded-full bg-[#f2c14e]" /><span className="w-2.5 h-2.5 rounded-full bg-[#15b881]" />
          <span className="ml-3 text-[11px] text-[#969e9b] font-mono">counsel.app / playbooks / sterling-m-a-v3</span>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-semibold text-[#0c0a09]">Sterling M&A Playbook v3</div>
            <span className="text-[10px] uppercase tracking-[0.12em] text-[#969e9b] px-2 py-0.5 rounded-full bg-[#f0f0f0]">8 rules</span>
          </div>
          {[
            { rule: "Indemnification Cap", required: "12–15% of purchase price", actual: "18%", status: "violation" },
            { rule: "Non-Compete Duration", required: "24 months max", actual: "24 months", status: "pass" },
            { rule: "Governing Law", required: "Delaware", actual: "Delaware", status: "pass" },
            { rule: "Dispute Resolution", required: "Arbitration (AAA)", actual: "Litigation", status: "violation" },
            { rule: "Data Privacy Addendum", required: "Must include DPA", actual: "Missing", status: "missing" },
          ].map((r, i) => (
            <div key={i} className="flex items-center justify-between p-2.5 rounded-lg border border-black/[0.04] hover:border-[#15b881]/30 transition-all duration-300 cursor-default group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-[#0c0a09]">{r.rule}</span>
                  {r.status === 'violation' && <span className="text-[10px] font-semibold text-[#c2452e] uppercase bg-[#fdf0ee] px-1.5 py-0.5 rounded">⚠ Violation</span>}
                  {r.status === 'missing' && <span className="text-[10px] font-semibold text-[#f2c14e] uppercase bg-[#fef8e6] px-1.5 py-0.5 rounded">Missing</span>}
                  {r.status === 'pass' && <span className="text-[10px] font-semibold text-[#0a8a5f] uppercase bg-[#eaf7f0] px-1.5 py-0.5 rounded">✓ Pass</span>}
                </div>
                <div className="flex gap-4 mt-1 text-[11px]">
                  <span className="text-[#969e9b]">Required: <span className="text-[#0c0a09] font-medium">{r.required}</span></span>
                  <span className="text-[#969e9b]">Actual: <span className={`font-medium ${r.status === 'pass' ? 'text-[#0a8a5f]' : 'text-[#c2452e]'}`}>{r.actual}</span></span>
                </div>
              </div>
              <div className={`ml-2 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${r.status === 'pass' ? 'bg-[#eaf7f0]' : r.status === 'missing' ? 'bg-[#fef8e6]' : 'bg-[#fdf0ee]'}`}>
                {r.status === 'pass' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a8a5f" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={r.status === 'missing' ? '#f2c14e' : '#c2452e'} strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                )}
              </div>
            </div>
          ))}
          <div className="pt-2 flex items-center justify-between text-[12px]">
            <span className="text-[#969e9b]">3 of 5 rules passed</span>
            <span className="text-[#15b881] font-medium">60% compliance</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "meetings",
    label: "Meeting Intelligence",
    heading: "Every meeting captured. Nothing missed.",
    desc: "Join your Zoom, Teams, or Google Meet calls. Counsel transcribes, summarizes, extracts action items, and syncs everything to the relevant matter.",
    checks: ["Auto-join Zoom, Teams, Google Meet", "Real-time transcription (80+ languages)", "AI-generated meeting summaries", "Action item extraction and assignment", "Auto-sync to matter timelines"],
    visual: (
      <div className="rounded-2xl border border-black/[0.06] bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.15)] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-black/[0.04] bg-[#fafaf7]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f0705b]" /><span className="w-2.5 h-2.5 rounded-full bg-[#f2c14e]" /><span className="w-2.5 h-2.5 rounded-full bg-[#15b881]" />
          <span className="ml-3 text-[11px] text-[#969e9b] font-mono">counsel.app / meetings / client-strategy-session</span>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3 pb-3 border-b border-black/[0.04]">
            <div className="w-8 h-8 rounded-full bg-[#15b881]/10 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#15b881" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3" /></svg>
            </div>
            <div>
              <div className="text-[13px] font-semibold text-[#0c0a09]">Client Strategy Session</div>
              <div className="text-[11px] text-[#969e9b]">45:22 recorded · 8 participants</div>
            </div>
            <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-[#15b881] font-semibold px-2 py-1 rounded-full bg-[#eaf7f0]">Live</span>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-[#969e9b] mb-2">AI Summary</div>
            <p className="text-[12px] text-[#0c0a09] leading-relaxed">Client discussed M&A due diligence timeline. Agreed on 45-day exclusivity period with 3-week due diligence window. Requested draft LOI by Friday. Patent portfolio valuation flagged for external counsel review.</p>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-[#969e9b] mb-2">Action Items (4)</div>
            {[
              { item: "Draft Letter of Intent", assignee: "James S.", due: "Jul 18", done: false },
              { item: "Patent portfolio valuation", assignee: "Maria K.", due: "Jul 22", done: false },
              { item: "Send NDA to counterparty", assignee: "Ayesha P.", due: "Jul 16", done: true },
              { item: "Schedule follow-up call", assignee: "James S.", due: "Jul 25", done: false },
            ].map((a, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 hover:bg-[#fafaf7] rounded px-2 transition-colors cursor-default group">
                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${a.done ? 'bg-[#15b881] border-[#15b881]' : 'border-[#d0d0d0]'}`}>
                  {a.done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>}
                </div>
                <span className={`text-[12px] flex-1 ${a.done ? 'text-[#969e9b] line-through' : 'text-[#0c0a09]'}`}>{a.item}</span>
                <span className="text-[11px] text-[#969e9b]">{a.assignee}</span>
                <span className="text-[11px] text-[#969e9b] w-14 text-right">{a.due}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "audit",
    label: "Audit & Compliance",
    heading: "Every action. Immutably logged.",
    desc: "SOC 2 Type II certified with complete audit trails. Every AI analysis, every draft, every search — logged, timestamped, and immutable.",
    checks: ["SOC 2 Type II certified", "ISO 27001 compliant", "GDPR & CCPA ready", "Row-level access control", "Custom retention policies"],
    visual: (
      <div className="rounded-2xl border border-black/[0.06] bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.15)] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-black/[0.04] bg-[#fafaf7]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f0705b]" /><span className="w-2.5 h-2.5 rounded-full bg-[#f2c14e]" /><span className="w-2.5 h-2.5 rounded-full bg-[#15b881]" />
          <span className="ml-3 text-[11px] text-[#969e9b] font-mono">counsel.app / admin / audit-log</span>
        </div>
        <div className="p-4 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[13px] font-semibold text-[#0c0a09]">Audit Trail — Last 24 hours</div>
            <span className="text-[10px] uppercase tracking-[0.12em] text-[#969e9b] px-2 py-0.5 rounded-full bg-[#f0f0f0]">1,247 events</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.08em] text-[#969e9b] border-b border-black/[0.04] pb-2">
            <span>Timestamp</span><span>Event</span><span>User</span>
          </div>
          {[
            { ts: "15:42:18 UTC", event: "document.view", user: "james@sterling.law" },
            { ts: "15:38:05 UTC", event: "clause.extract", user: "maria@sterling.law" },
            { ts: "15:29:41 UTC", event: "research.query", user: "ayesha@sterling.law" },
            { ts: "15:15:22 UTC", event: "draft.create", user: "james@sterling.law" },
            { ts: "15:03:09 UTC", event: "playbook.check", user: "maria@sterling.law" },
            { ts: "14:51:37 UTC", event: "meeting.transcribe", user: "system@counsel.ai" },
            { ts: "14:44:10 UTC", event: "document.upload", user: "ayesha@sterling.law" },
          ].map((e, i) => (
            <div key={i} className="grid grid-cols-3 gap-2 text-[12px] py-1.5 px-2 rounded hover:bg-[#fafaf7] transition-colors cursor-default">
              <span className="text-[#969e9b] font-mono text-[11px]">{e.ts}</span>
              <span className="text-[#0c0a09] font-medium text-[11px]">{e.event}</span>
              <span className="text-[#717d79] text-[11px] truncate">{e.user}</span>
            </div>
          ))}
          <div className="text-center text-[12px] text-[#969e9b] pt-2 border-t border-black/[0.04] mt-1">
            All events immutable · SHA-256 hashed · 90-day retention
          </div>
        </div>
      </div>
    ),
  },
];

export default function ProductPage() {
  return (
    <div className="min-h-screen bg-[#fefdfb] text-[#0c0a09] antialiased selection:bg-[#15b881]/20" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <Navbar />

      {/* Hero */}
      <section className="border-b border-black/[0.04]">
        <div className="max-w-7xl mx-auto px-6 pt-20 pb-16 md:pt-28 md:pb-24">
          <div className="text-[12px] tracking-[0.12em] uppercase text-[#0a8a5f] mb-4">Product</div>
          <h1 className={`${serif} text-[3.25rem] md:text-[5rem] font-normal tracking-[-0.02em] leading-[1.02] text-[#0c0a09] max-w-3xl`}>
            Everything you need to run a modern legal practice
          </h1>
          <p className="mt-6 text-[17px] text-[#4b5551] max-w-xl leading-relaxed">
            From document intake to final deliverable — Counsel handles the heavy lifting so your team can focus on strategy and client relationships.
          </p>
        </div>
      </section>

      {/* Feature sections */}
      {sections.map((section, idx) => (
        <section key={section.id} id={section.id} className={`${idx % 2 === 0 ? '' : 'bg-[#faf8f5]'} border-b border-black/[0.04]`}>
          <div className="max-w-7xl mx-auto px-6 py-20 md:py-28">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <div className="text-[12px] tracking-[0.12em] uppercase text-[#0a8a5f] mb-4">{section.label}</div>
                <h2 className={`${serif} text-[2.5rem] md:text-[3.5rem] font-normal tracking-[-0.02em] leading-[1.02] text-[#0c0a09]`}>{section.heading}</h2>
                <p className="mt-5 text-[15px] text-[#4b5551] leading-relaxed">{section.desc}</p>
                <ul className="mt-8 space-y-3">
                  {section.checks.map(c => (
                    <li key={c} className="flex items-start gap-3 text-[14px] text-[#0c0a09]">
                      <CheckIcon /><span>{c}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <a href="/register" className="inline-flex items-center gap-2 text-[14px] font-medium text-[#0a8a5f] hover:text-[#15b881] transition-colors">
                    Start free trial <span aria-hidden>→</span>
                  </a>
                </div>
              </div>
              <div>{section.visual}</div>
            </div>
          </div>
        </section>
      ))}

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ background: "radial-gradient(60% 60% at 50% 100%, rgba(21,184,129,0.22), rgba(21,184,129,0) 70%)" }} />
        <div className="max-w-3xl mx-auto px-6 py-24 md:py-32 text-center">
          <h2 className={`${serif} text-[2.5rem] md:text-[3.5rem] font-normal tracking-[-0.02em] leading-[1.02] text-[#0c0a09]`}>
            Ready to see it in action?
          </h2>
          <p className="mt-4 text-[16px] text-[#717d79]">Start your 14-day free trial. No credit card required.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="/register" className="text-[14px] font-medium text-white bg-[#0c0a09] hover:bg-[#0c0a09]/90 transition-colors rounded-full px-8 py-3.5 shadow-[0_10px_30px_-10px_rgba(12,10,9,0.5)]">Get started →</a>
            <a href="/register" className="text-[14px] font-medium text-[#0c0a09] bg-white border border-black/[0.08] hover:border-[#15b881]/40 transition-colors rounded-full px-8 py-3.5">Book a demo</a>
          </div>
        </div>
      </section>

      {/* Footer (simple) */}
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
