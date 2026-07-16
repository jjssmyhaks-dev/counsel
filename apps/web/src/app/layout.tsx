import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  metadataBase: new URL('https://counsel.ai'),
  title: {
    default: 'Counsel — AI-Powered Legal Platform',
    template: '%s | Counsel',
  },
  description: 'Document analysis, AI drafting, legal research, and matter management for modern law firms. Join 500+ firms.',
  keywords: ['legal AI', 'contract analysis', 'AI drafting', 'legal research', 'law firm software', 'document automation', 'legal tech'],
  authors: [{ name: 'Counsel Technologies' }],
  creator: 'Counsel Technologies',
  publisher: 'Counsel Technologies',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://counsel.ai',
    siteName: 'Counsel',
    title: 'Counsel — AI-Powered Legal Platform',
    description: 'Document analysis, AI drafting, legal research, and matter management for modern law firms.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Counsel AI Legal Platform' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Counsel — AI-Powered Legal Platform',
    description: 'Document analysis, AI drafting, legal research, and matter management for modern law firms.',
    images: ['/og-image.png'],
    creator: '@counsel_ai',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans`}>{children}</body>
    </html>
  );
}
