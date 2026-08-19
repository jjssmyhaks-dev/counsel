'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/Logo';

const serif = 'font-serif';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token found. Please check your email for the correct link.');
      return;
    }

    // Verify the token with the API
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (res.ok) {
          setStatus('success');
          setMessage('Your email has been verified! You can now access all features.');
        } else {
          const data = await res.json().catch(() => ({}));
          setStatus('error');
          setMessage(data.error || 'Verification failed. The link may have expired.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Unable to verify email. Please try again later.');
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-[#fefdfb] text-[#0c0a09] antialiased flex items-center justify-center p-6" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="max-w-md w-full text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-8">
          <Logo variant="dark" size={28} />
        </Link>

        {status === 'loading' && (
          <div className="space-y-4">
            <div className="w-12 h-12 border-3 border-[#15b881] border-t-transparent rounded-full animate-spin mx-auto" />
            <h1 className={`${serif} text-[1.5rem] font-normal tracking-[-0.02em] text-[#0c0a09]`}>
              Verifying your email...
            </h1>
            <p className="text-[14px] text-[#717d79]">Please wait while we verify your email address.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-[#eaf7f0] rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-[#0a8a5f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className={`${serif} text-[1.5rem] font-normal tracking-[-0.02em] text-[#0c0a09]`}>
              Email verified!
            </h1>
            <p className="text-[14px] text-[#717d79]">{message}</p>
            <Link href="/dashboard" className="inline-block text-[14px] font-medium text-white bg-[#0c0a09] hover:bg-[#15b881] transition-colors rounded-full px-6 py-3 mt-4">
              Go to dashboard →
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className={`${serif} text-[1.5rem] font-normal tracking-[-0.02em] text-[#0c0a09]`}>
              Verification failed
            </h1>
            <p className="text-[14px] text-[#717d79]">{message}</p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
              <Link href="/login" className="text-[14px] font-medium text-white bg-[#0c0a09] hover:bg-[#15b881] transition-colors rounded-full px-6 py-3">
                Sign in
              </Link>
              <Link href="/register" className="text-[14px] font-medium text-[#0c0a09] bg-white border border-black/[0.08] hover:border-[#15b881]/40 transition-colors rounded-full px-6 py-3">
                Create account
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
