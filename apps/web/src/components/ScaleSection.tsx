'use client';

import { useState, useEffect, useRef } from 'react';

const serif = "font-serif";

const stats = [
  { n: 500, suffix: "+", t: "Firms onboarded", s: "in the past year" },
  { n: 20, suffix: "M+", t: "Documents analyzed", s: "across all tenants" },
  { n: 99.99, suffix: "%", t: "Uptime", s: "across all services" },
];

function AnimatedStat({ value, suffix, start }: { value: number; suffix: string; start: boolean }) {
  const [count, setCount] = useState(0);
  const raf = useRef<number>(0);
  const started = useRef(false);

  useEffect(() => {
    if (!start || started.current) return;
    started.current = true;
    const duration = 2000;
    const step = value / (duration / 16);
    let current = 0;
    const animate = () => {
      current = Math.min(current + step, value);
      setCount(current);
      if (current < value) raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf.current);
  }, [start, value]);

  const display = value >= 100 ? Math.round(count) : count.toFixed(2);
  return <span className="tabular-nums">{display}{suffix}</span>;
}

function CountUpStat({ value, suffix, label, sub }: { value: number; suffix: string; label: string; sub: string }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className={`${serif} text-[4rem] md:text-[6rem] font-normal tracking-[-0.02em] leading-none`}>
        <span className="bg-gradient-to-r from-[#15b881] via-[#0a8a5f] to-[#15b881] bg-clip-text text-transparent">
          <AnimatedStat value={value} suffix={suffix} start={visible} />
        </span>
      </div>
      <div className="mt-4 text-[15px] font-medium text-[#0c0a09]">{label}</div>
      <div className="text-[14px] text-[#717d79]">{sub}</div>
    </div>
  );
}

const trustItems = [
  { v: "SOC 2 Type II", l: "Certified" },
  { v: "ISO 27001", l: "Compliant" },
  { v: "GDPR + CCPA", l: "Ready" },
  { v: "99.99% SLA", l: "Guaranteed" },
];

export default function ScaleSection() {
  return (
    <section className="border-t border-black/[0.04]">
      <div className="max-w-7xl mx-auto px-6 py-24 md:py-32 text-center">
        <div className="text-[12px] tracking-[0.12em] uppercase text-[#0a8a5f] mb-4">Built for scale</div>
        <h2 className={`${serif} text-[2.75rem] md:text-[4rem] font-normal tracking-[-0.02em] leading-[1.02] text-[#0c0a09] mb-20`}>
          Enterprise-grade reliability<br />and performance
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          {stats.map((s, i) => (
            <CountUpStat key={s.t} value={s.n} suffix={s.suffix} label={s.t} sub={s.s} />
          ))}
        </div>

        <div className="mt-20 pt-12 border-t border-black/[0.04] grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {trustItems.map((item) => (
            <div key={item.v} className="group cursor-default">
              <div className="text-[14px] font-semibold text-[#0c0a09] tracking-[-0.01em] group-hover:text-[#0a8a5f] transition-colors">{item.v}</div>
              <div className="text-[12px] text-[#969e9b] mt-1">{item.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
