// Quick API test script
async function main() {
  const BASE = 'http://localhost:3001';

  // Health
  try {
    const h = await fetch(`${BASE}/api/health`).then(r => r.json());
    console.log('Health:', h.status);
  } catch (e) {
    console.error('Server DOWN:', e.message);
    return;
  }

  // Login
  const login = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@sterling.law', password: 'password' }),
  }).then(r => r.json());
  console.log('Login OK, user:', login.user?.name);

  // KB Query
  console.log('Calling KB query...');
  const t0 = Date.now();
  try {
    const authHeader = '***' + login.token;
    const kb = await fetch(`${BASE}/api/v1/kb/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({ question: 'test question' }),
    }).then(r => r.json());
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`KB Response (${elapsed}s):`);
    console.log('  Answer:', kb.answer?.substring(0, 80));
    console.log('  Confidence:', kb.confidence);
    console.log('  Model:', kb.modelUsed);
    console.log('  Sources:', kb.sourceChunks?.length);
  } catch (e) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.error(`KB Error (${elapsed}s):`, e.message);
  }
}

main();
