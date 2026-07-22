'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, getUser, getFirm, logout } from '@/lib/auth';

const serif = "font-serif";

export default function TrialBanner() {
  const [show, setShow] = useState(false);
  const [daysLeft, setDaysLeft] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) return;
    const firm = getFirm();
    if (firm?.plan === 'free' || firm?.plan === 'starter') {
      // Simulate: assume trial ends 14 days from account creation
      const created = firm.createdAt ? new Date(firm.createdAt) : new Date();
      const trialEnd = new Date(created.getTime() + 14 * 24 * 60 * 60 * 1000);
      const remaining = Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (remaining <= 7 && remaining >= 0) {
        setShow(true);
        setDaysLeft(remaining);
      }
    }
  }, []);

  if (!show) return null;

  return (
    <div className={`fixed bottom-0 inset-x-0 z-50 p-4 animate-[slideUp_0.3s_ease] ${daysLeft <= 3 ? 'bg-red-50 border-t-2 border-red-200' : 'bg-amber-50 border-t-2 border-amber-200'}`}>
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <svg className={`w-5 h-5 flex-shrink-0 ${daysLeft <= 3 ? 'text-red-500' : 'text-amber-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className={`text-[13px] font-medium ${daysLeft <= 3 ? 'text-red-800' : 'text-amber-800'}`}>
              {daysLeft === 0 ? 'Your trial ends today!' : `${daysLeft} day${daysLeft > 1 ? 's' : ''} left in your trial`}
            </p>
            <p className={`text-[12px] ${daysLeft <= 3 ? 'text-red-600' : 'text-amber-600'}`}>
              Add a payment method to keep full access to all features.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/dashboard/usage')}
            className="px-4 py-2 bg-[#0c0a09] text-white text-[12px] font-semibold rounded-xl hover:bg-[#0a8a5f] transition-colors whitespace-nowrap">
            Add payment method
          </button>
          <button onClick={() => {
            logout();
            router.push('/login');
          }} className="px-4 py-2 text-[12px] font-medium text-[#969e9b] hover:text-[#717d79] transition-colors">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

// Keyframes injected via global CSS: add to globals.css
// @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
