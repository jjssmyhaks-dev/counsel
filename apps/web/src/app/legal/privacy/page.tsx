'use client';

import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const serif = 'font-serif';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#fefdfb] text-[#0c0a09] antialiased" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        <div className="text-[12px] tracking-[0.12em] uppercase text-[#0a8a5f] mb-4">Legal</div>
        <h1 className={`${serif} text-[2.5rem] md:text-[3.5rem] font-normal tracking-[-0.02em] leading-[1.05] text-[#0c0a09]`}>
          Privacy Policy
        </h1>
        <p className="mt-3 text-[13px] text-[#969e9b]">Last updated: August 19, 2026</p>

        <div className="mt-12 space-y-8 text-[15px] text-[#4b5551] leading-relaxed">
          <section>
            <h2 className={`${serif} text-[1.5rem] font-normal text-[#0c0a09] mb-3`}>Introduction</h2>
            <p>Counsel Technologies Pvt. Ltd. (&ldquo;Counsel,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered legal platform.</p>
          </section>

          <section>
            <h2 className={`${serif} text-[1.5rem] font-normal text-[#0c0a09] mb-3`}>Information We Collect</h2>
            <p><strong>Account Information:</strong> Name, email address, firm name, and role when you register.</p>
            <p><strong>Document Data:</strong> Legal documents you upload for analysis, including contracts, briefs, and correspondence.</p>
            <p><strong>Usage Data:</strong> How you interact with the platform — features used, queries made, and actions taken.</p>
            <p><strong>Integration Data:</strong> When you connect third-party services (email, CRM, calendar), we store OAuth tokens securely encrypted.</p>
          </section>

          <section>
            <h2 className={`${serif} text-[1.5rem] font-normal text-[#0c0a09] mb-3`}>How We Use Your Data</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>To provide and improve our AI legal platform services.</li>
              <li>To process document analysis, drafting, and research requests.</li>
              <li>To maintain audit trails as required by legal and CA professional standards.</li>
              <li>To send transactional emails (account verification, notifications).</li>
              <li>To ensure platform security and prevent unauthorized access.</li>
            </ul>
          </section>

          <section>
            <h2 className={`${serif} text-[1.5rem] font-normal text-[#0c0a09] mb-3`}>Data Security</h2>
            <p>We implement industry-standard security measures including:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>AES-256 encryption at rest for all documents and sensitive data.</li>
              <li>TLS 1.3 encryption for all data in transit.</li>
              <li>Multi-tenant isolation via PostgreSQL Row-Level Security (RLS).</li>
              <li>SOC 2 Type II and ISO 27001 compliance.</li>
              <li>Envelope encryption with per-firm data keys for document storage.</li>
            </ul>
          </section>

          <section>
            <h2 className={`${serif} text-[1.5rem] font-normal text-[#0c0a09] mb-3`}>AI and Your Data</h2>
            <p>Your documents and data are <strong>never used to train our AI models</strong>. All AI processing is done in real-time for your specific requests. AI prompts are logged for quality assurance but scrubbed of sensitive information before being sent to upstream providers (Cloudflare Workers AI).</p>
          </section>

          <section>
            <h2 className={`${serif} text-[1.5rem] font-normal text-[#0c0a09] mb-3`}>Data Retention</h2>
            <p>We retain your data for as long as your account is active. Upon account deletion, we remove your personal data within 30 days. Audit logs may be retained for up to 7 years as required by regulatory compliance.</p>
          </section>

          <section>
            <h2 className={`${serif} text-[1.5rem] font-normal text-[#0c0a09] mb-3`}>Your Rights</h2>
            <p>You have the right to access, correct, export, and delete your personal data. Contact us at <a href="mailto:privacy@counsel.ai" className="text-[#0a8a5f] hover:underline">privacy@counsel.ai</a> to exercise these rights.</p>
          </section>

          <section>
            <h2 className={`${serif} text-[1.5rem] font-normal text-[#0c0a09] mb-3`}>Contact</h2>
            <p>For privacy-related inquiries: <a href="mailto:privacy@counsel.ai" className="text-[#0a8a5f] hover:underline">privacy@counsel.ai</a></p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
