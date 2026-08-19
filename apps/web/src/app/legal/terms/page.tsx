'use client';

import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const serif = 'font-serif';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-[#fefdfb] text-[#0c0a09] antialiased" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        <div className="text-[12px] tracking-[0.12em] uppercase text-[#0a8a5f] mb-4">Legal</div>
        <h1 className={`${serif} text-[2.5rem] md:text-[3.5rem] font-normal tracking-[-0.02em] leading-[1.05] text-[#0c0a09]`}>
          Terms of Service
        </h1>
        <p className="mt-3 text-[13px] text-[#969e9b]">Last updated: August 19, 2026</p>

        <div className="mt-12 space-y-8 text-[15px] text-[#4b5551] leading-relaxed">
          <section>
            <h2 className={`${serif} text-[1.5rem] font-normal text-[#0c0a09] mb-3`}>Acceptance of Terms</h2>
            <p>By accessing or using Counsel (the &ldquo;Platform&rdquo;), you agree to these Terms of Service. If you do not agree, do not use the Platform.</p>
          </section>

          <section>
            <h2 className={`${serif} text-[1.5rem] font-normal text-[#0c0a09] mb-3`}>Description of Service</h2>
            <p>Counsel is an AI-powered platform for legal, consulting, and chartered accountancy firms. It provides document analysis, legal research, AI drafting, compliance management, and practice management tools.</p>
          </section>

          <section>
            <h2 className={`${serif} text-[1.5rem] font-normal text-[#0c0a09] mb-3`}>User Responsibilities</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              <li>You are responsible for all activity that occurs under your account.</li>
              <li>You must not use the Platform for any unlawful purpose.</li>
              <li>You must ensure that your use complies with applicable professional regulations (Bar Council, ICAI, etc.).</li>
            </ul>
          </section>

          <section>
            <h2 className={`${serif} text-[1.5rem] font-normal text-[#0c0a09] mb-3`}>AI Disclaimer</h2>
            <p>Counsel provides AI-generated analysis, drafts, and recommendations. These are <strong>assistive tools, not legal or professional advice</strong>. All AI outputs must be reviewed and validated by qualified professionals before reliance. Counsel does not guarantee the accuracy of AI-generated content.</p>
          </section>

          <section>
            <h2 className={`${serif} text-[1.5rem] font-normal text-[#0c0a09] mb-3`}>Filing Disclaimer (CA Vertical)</h2>
            <p>Counsel does <strong>not</strong> autonomously file any government returns, forms, or documents on your behalf. All filings to government portals (GST, Income Tax, ROC, etc.) require explicit approval from a qualified CA or authorized signatory. Counsel assists in preparation and review only.</p>
          </section>

          <section>
            <h2 className={`${serif} text-[1.5rem] font-normal text-[#0c0a09] mb-3`}>Subscription and Billing</h2>
            <p>Paid plans are billed monthly or annually as selected. You may cancel at any time. Refunds are provided within 14 days of initial purchase. Annual plans receive a 20% discount. All prices are exclusive of applicable taxes (18% GST for Indian customers).</p>
          </section>

          <section>
            <h2 className={`${serif} text-[1.5rem] font-normal text-[#0c0a09] mb-3`}>Intellectual Property</h2>
            <p>The Platform, including its AI models, software, and documentation, is owned by Counsel Technologies. You retain ownership of all documents and data you upload. We do not claim ownership over your content.</p>
          </section>

          <section>
            <h2 className={`${serif} text-[1.5rem] font-normal text-[#0c0a09] mb-3`}>Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, Counsel shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Platform. Our total liability shall not exceed the amount paid by you in the 12 months preceding the claim.</p>
          </section>

          <section>
            <h2 className={`${serif} text-[1.5rem] font-normal text-[#0c0a09] mb-3`}>Governing Law</h2>
            <p>These Terms are governed by the laws of India. Disputes shall be subject to the exclusive jurisdiction of courts in Mumbai, India.</p>
          </section>

          <section>
            <h2 className={`${serif} text-[1.5rem] font-normal text-[#0c0a09] mb-3`}>Contact</h2>
            <p>For questions about these Terms: <a href="mailto:legal@counsel.ai" className="text-[#0a8a5f] hover:underline">legal@counsel.ai</a></p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
