'use client';

import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const serif = 'font-serif';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#fefdfb] text-[#0c0a09] antialiased" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-24 md:py-32 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#15b881]/25 bg-[#eaf7f0] px-3 py-1.5 text-[12px] text-[#0a8a5f] mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[#15b881]" />
          Page not found
        </div>
        <h1 className={`${serif} text-[6rem] md:text-[8rem] font-normal tracking-[-0.02em] leading-[1] text-[#0c0a09]/10`}>
          404
        </h1>
        <h2 className={`${serif} text-[2rem] md:text-[2.5rem] font-normal tracking-[-0.02em] text-[#0c0a09] mt-[-2rem]`}>
          This page doesn&apos;t exist
        </h2>
        <p className="mt-4 text-[16px] text-[#717d79] max-w-md mx-auto leading-relaxed">
          The page you&apos;re looking for may have been moved, deleted, or never existed. Let&apos;s get you back on track.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className="text-[14px] font-medium text-white bg-[#0c0a09] hover:bg-[#15b881] transition-colors rounded-full px-6 py-3">
            Go to homepage
          </Link>
          <Link href="/dashboard" className="text-[14px] font-medium text-[#0c0a09] bg-white border border-black/[0.08] hover:border-[#15b881]/40 transition-colors rounded-full px-6 py-3">
            Open dashboard
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
