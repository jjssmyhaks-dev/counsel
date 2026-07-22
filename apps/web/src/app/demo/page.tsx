'use client';

import { useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Logo } from '@/components/Logo';

const serif = "font-serif";

export default function DemoPage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', firmName: '', firmSize: '11-50', interest: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API call
    await new Promise(r => setTimeout(r, 1500));
    setLoading(false);
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#fefdfb] text-[#0c0a09]" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <Navbar />

      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 md:pt-28 md:pb-24">
        <div className="text-center mb-12">
          <div className="text-[12px] tracking-[0.12em] uppercase text-[#0a8a5f] mb-4">Book a Demo</div>
          <h1 className={`${serif} text-[2.5rem] md:text-[3.5rem] font-normal tracking-[-0.02em] leading-[1.05]`}>
            See Counsel in action
          </h1>
          <p className="mt-4 text-[16px] text-[#717d79] max-w-lg mx-auto">
            Get a personalized walkthrough with our team. We'll show you how Counsel fits your firm's workflow.
          </p>
        </div>

        {submitted ? (
          <div className="max-w-md mx-auto text-center py-16">
            <div className="w-16 h-16 bg-[#eaf7f0] rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-[#15b881]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className={`${serif} text-[1.75rem] font-normal tracking-[-0.02em]`}>Demo requested!</h2>
            <p className="mt-3 text-[14px] text-[#717d79]">
              Our team will reach out within 24 hours to schedule your personalized demo.
            </p>
            <Link href="/" className="inline-block mt-6 text-[14px] font-medium text-[#0a8a5f] hover:text-[#15b881] transition-colors">← Back to home</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="max-w-xl mx-auto space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-[13px] font-medium text-[#0c0a09] mb-1.5">Full Name *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required
                  placeholder="Jane Smith"
                  className="w-full px-4 py-3 rounded-xl border border-black/[0.08] bg-white text-[14px] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40" />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#0c0a09] mb-1.5">Work Email *</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required
                  placeholder="you@firm.com"
                  className="w-full px-4 py-3 rounded-xl border border-black/[0.08] bg-white text-[14px] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40" />
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#0c0a09] mb-1.5">Firm Name</label>
              <input value={form.firmName} onChange={e => setForm({...form, firmName: e.target.value})}
                placeholder="Your firm"
                className="w-full px-4 py-3 rounded-xl border border-black/[0.08] bg-white text-[14px] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40" />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#0c0a09] mb-1.5">Firm Size</label>
              <select value={form.firmSize} onChange={e => setForm({...form, firmSize: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-black/[0.08] bg-white text-[14px] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40">
                {[{v:'1-10',l:'1-10 people'},{v:'11-50',l:'11-50 people'},{v:'51-200',l:'51-200 people'},{v:'201+',l:'201+ people'}].map(o => (
                  <option key={o.v} value={o.v}>{o.l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#0c0a09] mb-1.5">What are you interested in?</label>
              <textarea value={form.interest} onChange={e => setForm({...form, interest: e.target.value})} rows={3}
                placeholder="e.g. Contract analysis, AI drafting, research automation..."
                className="w-full px-4 py-3 rounded-xl border border-black/[0.08] bg-white text-[14px] placeholder:text-[#969e9b] focus:outline-none focus:ring-2 focus:ring-[#15b881]/30 focus:border-[#15b881]/40 resize-none" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl bg-[#0c0a09] text-white text-[14px] font-medium hover:bg-[#0a8a5f] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_8px_24px_-8px_rgba(12,10,9,0.4)]">
              {loading ? 'Submitting...' : 'Request Demo'}
            </button>
          </form>
        )}
      </section>

      <Footer />
    </div>
  );
}
