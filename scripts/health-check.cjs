#!/usr/bin/env node
/**
 * Counsel Health Check Script
 * Pings all services, checks integration health, and logs results.
 *
 * Usage: node scripts/health-check.cjs
 *
 * Exit codes: 0 = all healthy, 1 = degraded, 2 = critical failure
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LOGS_DIR = path.join(ROOT, 'logs');

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

const TIMEOUT_MS = 5000;

// ── Helpers ─────────────────────────────────────────────────────────────────

function fetch(url, opts = {}) {
  return new Promise((resolve) => {
    const start = Date.now();
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: TIMEOUT_MS, ...opts }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        const latency = Date.now() - start;
        try {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode, body: JSON.parse(data), latency });
        } catch {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode, body: data, latency });
        }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, body: 'TIMEOUT', latency: TIMEOUT_MS }); });
    req.on('error', (err) => { resolve({ ok: false, status: 0, body: err.message, latency: Date.now() - start }); });
  });
}

function post(url, body) {
  return new Promise((resolve) => {
    const start = Date.now();
    const data = JSON.stringify(body);
    const client = url.startsWith('https') ? https : http;
    const opts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: TIMEOUT_MS,
    };
    const req = client.request(url, opts, (res) => {
      let d = '';
      res.on('data', (chunk) => (d += chunk));
      res.on('end', () => {
        const latency = Date.now() - start;
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode, body: d, latency });
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, body: 'TIMEOUT', latency: TIMEOUT_MS }); });
    req.on('error', (err) => { resolve({ ok: false, status: 0, body: err.message, latency: Date.now() - start }); });
    req.write(data);
    req.end();
  });
}

// ── Health Checks ───────────────────────────────────────────────────────────

const checks = {
  core: [
    { name: 'API Server (Express)', url: 'http://localhost:3001/api/health' },
    { name: 'AI Service (FastAPI)', url: 'http://localhost:8000/health' },
    { name: 'Web App (Next.js)', url: 'http://localhost:3000' },
  ],
  auth: [
    { name: 'POST /auth/login', type: 'post', url: 'http://localhost:3001/api/v1/auth/login', body: { email: 'admin@counsel.ai', password: '***' } },
    { name: 'POST /auth/register', type: 'post', url: 'http://localhost:3001/api/v1/auth/register', body: { email: 'test@counsel.ai', password: '***', name: 'Test', firmName: 'Test Firm' } },
  ],
  integration: [
    { name: 'Integration Health', url: 'http://localhost:3001/api/v1/integrations/health' },
  ],
  public: [
    { name: 'GET /public/stats', url: 'http://localhost:3001/api/v1/public/stats' },
    { name: 'GET /public/firms', url: 'http://localhost:3001/api/v1/public/firms' },
  ],
};

async function runChecks() {
  const results = [];
  const allPassed = { passed: 0, failed: 0, skipped: 0 };

  // Core services
  for (const check of checks.core) {
    const res = await fetch(check.url);
    results.push({ ...check, ...res, passed: res.ok });
    res.ok ? allPassed.passed++ : allPassed.failed++;
  }

  // Public endpoints
  for (const check of checks.public) {
    const res = await fetch(check.url);
    results.push({ ...check, ...res, passed: res.ok });
    res.ok ? allPassed.passed++ : allPassed.failed++;
  }

  // Auth endpoints
  for (const check of checks.auth) {
    const res = await post(check.url, check.body);
    results.push({ ...check, ...res, passed: res.status >= 200 && res.status < 500 });
    res.ok ? allPassed.passed++ : (res.status >= 500 ? allPassed.failed++ : allPassed.skipped++);
  }

  // Integration health
  for (const check of checks.integration) {
    const res = await fetch(check.url);
    results.push({ ...check, ...res, passed: res.ok });
    res.ok ? allPassed.passed++ : allPassed.failed++;
  }

  return { results, summary: allPassed };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔍 Counsel Health Check — ' + new Date().toISOString() + '\n');
  console.log('─'.repeat(70));

  const { results, summary } = await runChecks();

  // Print results table
  for (const r of results) {
    const icon = r.passed ? '✅' : '❌';
    const lat = r.latency ? ` ${r.latency}ms` : '';
    console.log(`  ${icon}  ${r.name}  →  ${r.status}${lat}`);
  }

  console.log('─'.repeat(70));
  console.log(`\n  Passed: ${summary.passed}  |  Failed: ${summary.failed}  |  Skipped: ${summary.skipped}\n`);

  // Write log
  const today = new Date().toISOString().slice(0, 10);
  const logPath = path.join(LOGS_DIR, `health-${today}.json`);

  let existing = [];
  try { existing = JSON.parse(fs.readFileSync(logPath, 'utf-8')); } catch {}

  const entry = {
    timestamp: new Date().toISOString(),
    summary,
    results: results.map((r) => ({ name: r.name, status: r.status, latency: r.latency, passed: r.passed })),
  };
  existing.push(entry);
  fs.writeFileSync(logPath, JSON.stringify(existing, null, 2));
  console.log(`  📋 Logged to ${logPath}\n`);

  // Exit code
  if (summary.failed === 0) {
    console.log('  ✅ All services healthy\n');
    process.exit(0);
  } else if (summary.passed > 0) {
    console.log('  ⚠️  Some services degraded\n');
    process.exit(1);
  } else {
    console.log('  🚨 Critical: all services down\n');
    process.exit(2);
  }
}

main().catch((err) => {
  console.error('Health check crashed:', err.message);
  process.exit(2);
});
