'use client';

import { useState } from 'react';

const serif = "font-serif";

const stories = [
  { name: "Sterling & Associates", bar: "bg-[#15b881]", metric: "94%", label: "Faster turnaround", desc: "Contract review that took 3 weeks now completes in 4 hours. 200+ matters processed monthly with AI-driven clause extraction.",
    details: ["200+ matters/month processed", "4-hour contract review turnaround", "94% reduction in review time", "Adopted by all 45 associates"] },
  { name: "Greenfield Capital", bar: "bg-[#0a8a5f]", metric: "40K+", label: "Documents indexed", desc: "Full regulatory compliance research automated from weeks to hours with RAG-powered synthesis.",
    details: ["40,000+ documents in knowledge base", "RAG-powered regulatory research", "Weeks→hours turnaround", "100% citation accuracy"] },
  { name: "NovaTech Inc.", bar: "bg-[#0c0a09]", metric: "3.2×", label: "Deal throughput", desc: "AI drafting generates first-pass motions, briefs, and memos in the firm's voice.",
    details: ["3.2× increase in deal throughput", "First-pass drafting under 30s", "Firm-specific voice & style", "15 attorney hours saved/week"] },
  { name: "Arcadian Corp", bar: "bg-[#ff5a00]", metric: "99.7%", label: "Audit compliance", desc: "Every AI action logged immutably. SOC 2 Type II and ISO 27001 ready.",
    details: ["99.7% audit compliance score", "SOC 2 Type II certified", "ISO 27001 compliant", "Zero findings in last audit"] },
];

export default function CustomerStories() {
  const [expanded, setExpanded] = useState<number | null>(null);
  return (
    <section className="border-t border-black/[0.04] bg-[#faf8f5]">
      <div className="max-w-7xl mx-auto px-6 py-24 md:py-32">
        <div className="text-[12px] tracking-[0.12em] uppercase text-[#0a8a5f] mb-4">For law firms</div>
        <h2 className={`${serif} text-[2.75rem] md:text-[4rem] font-normal tracking-[-0.02em] leading-[1.02] text-[#0c0a09] mb-16`}>
          Powering firms<br />of all sizes
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {stories.map((s, i) => (
            <div key={s.name} onClick={() => setExpanded(expanded === i ? null : i)}
              className={`rounded-2xl border bg-white overflow-hidden transition-all duration-500 cursor-pointer ${
                expanded === i ? 'border-[#15b881]/40 shadow-[0_20px_60px_-20px_rgba(21,184,129,0.3)] scale-[1.01]' : 'border-black/[0.04] hover:border-black/[0.08]'
              }`}>
              <div className={`h-1 ${s.bar} transition-all duration-500 ${expanded === i ? 'h-1.5' : ''}`} />
              <div className="p-8 flex-1">
                <div className="text-[13px] text-[#717d79]">{s.name}</div>
                <div className={`${serif} mt-3 text-[4.5rem] md:text-[5.5rem] font-normal tracking-[-0.02em] leading-none text-[#0c0a09] tabular-nums`}>{s.metric}</div>
                <div className="mt-2 text-[12px] tracking-[0.12em] uppercase text-[#969e9b]">{s.label}</div>
                <p className="mt-4 text-[15px] text-[#717d79] leading-relaxed">{s.desc}</p>
                <div className={`mt-4 space-y-2 overflow-hidden transition-all duration-500 ${expanded === i ? 'max-h-60 opacity-100 pt-2' : 'max-h-0 opacity-0'}`}>
                  {s.details.map((d, j) => (
                    <div key={j} className="flex items-center gap-2.5 text-[13px] text-[#0c0a09]" style={{ animation: `fadeIn 0.3s ease ${j * 80}ms both` }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#15b881" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                      {d}
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex items-center gap-1.5 text-[14px] font-medium text-[#0c0a09] hover:text-[#0a8a5f] transition-colors">
                  {expanded === i ? 'Show less ↑' : 'Read the story →'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </section>
  );
}
