import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ── Monorepo: transpile local packages ──────────────────────────────────
  transpilePackages: ['@counsel/database'],

  // ── Environment (baked at build time) ──────────────────────────────────
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    NEXT_PUBLIC_ENABLE_AI: process.env.NEXT_PUBLIC_ENABLE_AI || 'true',
  },

  // ── Image optimization ──────────────────────────────────────────────────
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'api.dicebear.com' },
      { protocol: 'https', hostname: '**.counsel.ai' },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // ── Security headers ────────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
    ];
  },

  // ── Build ───────────────────────────────────────────────────────────────
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  productionBrowserSourceMaps: false,
};

// Cloudflare Pages: enable dev platform bindings (only when package exists)
if (process.env.NODE_ENV === 'development') {
  try {
    const { setupDevPlatform } = require('@cloudflare/next-on-pages/next-dev');
    setupDevPlatform().catch(() => {});
  } catch { /* @cloudflare/next-on-pages not installed — skipping */ }
}

export default nextConfig;
