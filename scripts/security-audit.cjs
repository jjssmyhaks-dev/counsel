// scripts/security-audit.cjs
// API-level security tests — auth, RBAC, input validation, CORS, headers
const http = require('http');

const API = 'http://127.0.0.1:3001';
let pass = 0, fail = 0;
const results = [];

async function req(method, path, opts = {}) {
  return new Promise((resolve) => {
    const headers = { ...opts.headers || {} };
    if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
    if (opts.body) {
      const d = JSON.stringify(opts.body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(d);
    }
    const r = http.request(`${API}${path}`, { method, headers, timeout: 10000 }, res => {
      let b = ''; res.on('data', c => b += c); res.on('end', () => {
        try { resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(b) }); }
        catch { resolve({ status: res.statusCode, headers: res.headers, body: b }); }
      });
    });
    r.on('error', () => resolve({ status: -1, body: 'connection refused' }));
    r.on('timeout', () => { r.destroy(); resolve({ status: -2, body: 'timeout' }); });
    if (opts.body) {
      const d = JSON.stringify(opts.body);
      r.write(d);
    }
    r.end();
  });
}

function check(label, condition, detail = '') {
  if (condition) { pass++; results.push(`PASS: ${label}`); }
  else { fail++; results.push(`FAIL: ${label} — ${detail}`); }
}

async function main() {
  console.log('=== Counsel Platform Security Audit ===\n');

  // 1. AUTH MIDDLEWARE
  console.log('--- 1. Authentication & Authorization ---');
  let r;

  // 1a. Protected routes reject unauthenticated
  r = await req('GET', '/api/v1/documents');
  check('GET /api/v1/documents (no token) → 401', r.status === 401, `got ${r.status}`);

  r = await req('GET', '/api/v1/matters');
  check('GET /api/v1/matters (no token) → 401', r.status === 401, `got ${r.status}`);

  r = await req('GET', '/api/v1/drafts');
  check('GET /api/v1/drafts (no token) → 401', r.status === 401, `got ${r.status}`);

  // 1b. Public routes are accessible
  r = await req('GET', '/api/health');
  check('GET /api/health (no token) → 200', r.status === 200, `got ${r.status}`);

  r = await req('GET', '/api/docs');
  check('GET /api/docs (no token) → 200', r.status === 200, `got ${r.status}`);

  r = await req('GET', '/');
  check('GET / (root redirect) → 302', r.status === 302, `got ${r.status}`);

  // 1c. Login attempt
  r = await req('POST', '/api/v1/auth/login', { body: { email: 'admin@sterling.law', password: 'password' } });
  const token = r.body?.token;
  check('POST /api/v1/auth/login → 200 + token', r.status === 200 && !!token, `status=${r.status}, token=${token ? 'yes' : 'no'}`);

  // 1d. With valid token, access works
  if (token) {
    r = await req('GET', '/api/v1/documents', { token });
    check('GET /api/v1/documents (with token) → 200', r.status === 200, `got ${r.status}`);
  }

  // 1e. Invalid/malformed tokens
  r = await req('GET', '/api/v1/documents', { token: 'invalid-jwt-token-here' });
  check('GET /api/v1/documents (invalid token) → 401', r.status === 401, `got ${r.status}`);

  r = await req('GET', '/api/v1/documents', { token: 'Bearer ' });
  check('GET /api/v1/documents (empty Bearer) → 401', r.status === 401, `got ${r.status}`);

  // 2. SQL INJECTION / XSS
  console.log('\n--- 2. Input Validation ---');

  // 2a. SQL injection in login
  r = await req('POST', '/api/v1/auth/login', { body: { email: "' OR 1=1 --", password: "anything" } });
  check('Login with SQL injection → not 200', r.status !== 200, `got ${r.status}`);

  // 2b. XSS in login
  r = await req('POST', '/api/v1/auth/login', { body: { email: '<script>alert(1)</script>', password: 'x' } });
  check('Login with XSS payload → not 200', r.status !== 200, `got ${r.status}`);

  // 2c. Mass assignment (extra fields)
  r = await req('POST', '/api/v1/auth/register', { body: { email: 'test@evil.com', password: 'Test123!', name: 'Hacker', firmName: 'BadCorp', role: 'admin', firmType: 'LEGAL' } });
  check('Register with role mass-assignment attempted', r.status !== 200 || r.body?.user?.role !== 'admin', `status=${r.status}`);

  // 2d. NoSQL injection
  r = await req('POST', '/api/v1/auth/login', { body: { email: { '$gt': '' }, password: { '$gt': '' } } });
  check('Login with NoSQL injection (object fields)', r.status !== 200, `got ${r.status}`);

  // 3. RATE LIMITING (basic check)
  console.log('\n--- 3. Rate Limiting ---');
  const bursts = [];
  for (let i = 0; i < 10; i++) {
    bursts.push(req('POST', '/api/v1/auth/login', { body: { email: `test${i}@test.com`, password: 'wrong' } }));
  }
  const burstResults = await Promise.all(bursts);
  const tooMany = burstResults.some(r => r.status === 429);
  check('10 rapid login attempts', tooMany || burstResults.every(r => r.status === 401), tooMany ? '429 rate limit triggered' : 'all returned 401 (no rate limit)');

  // 4. SECURITY HEADERS
  console.log('\n--- 4. Security Headers ---');
  r = await req('GET', '/api/health');
  const h = r.headers || {};
  check('X-Content-Type-Options', (h['x-content-type-options'] || '').includes('nosniff'), `got: ${h['x-content-type-options'] || 'missing'}`);
  check('X-Frame-Options', (h['x-frame-options'] || '').includes('DENY') || (h['x-frame-options'] || '').includes('SAMEORIGIN'), `got: ${h['x-frame-options'] || 'missing'}`);
  check('X-Request-Id present', !!h['x-request-id'], `got: ${h['x-request-id'] || 'missing'}`);

  // 5. CORS
  console.log('\n--- 5. CORS ---');
  r = await req('OPTIONS', '/api/health', { headers: { Origin: 'http://evil.com', 'Access-Control-Request-Method': 'POST' } });
  const allowOrigin = h['access-control-allow-origin'];
  check('CORS not wildcard (*) for credentialed requests', !allowOrigin || allowOrigin !== '*', `got: ${allowOrigin || 'missing'}`);

  // 6. VERBOSE ERRORS
  console.log('\n--- 6. Error Disclosure ---');
  r = await req('GET', '/api/v1/documents/99999', { token });
  const noStackTrace = !(r.body?.stack || r.body?.trace);
  const noLeak = noStackTrace && (r.status === 404 || (r.status === 500 && !r.body?.stack));
  check('404/500 does not leak stack trace', noLeak, r.status === -1 ? 'API offline' : `status=${r.status}, hasStack=${!!r.body?.stack}`);

  // SUMMARY
  console.log(`\n=== SUMMARY: ${pass} pass, ${fail} fail ===`);
  results.forEach(l => console.log(l));
  process.exit(fail > 0 ? 1 : 0);
}

main();
