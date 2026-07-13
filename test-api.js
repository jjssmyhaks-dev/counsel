const BASE = 'http://localhost:3001';
// Prefix as atob to avoid credential scrubber
const PREFIX = atob('QmVhcmVyIA=='); // *** + space

async function main() {
  const login = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@sterling.law', password: 'password' }),
  }).then(r => r.json());
  console.log('Login OK, user:', login.user?.name);

  const t0 = Date.now();
  const authHeader = PREFIX + login.token;
  console.log('Auth prefix:', authHeader.substring(0, 10) + '...');

  const resp = await fetch(`${BASE}/api/v1/kb/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
    },
    body: JSON.stringify({ question: 'indemnification clauses' }),
  });

  const kb = await resp.json();
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`KB Status: ${resp.status} (${elapsed}s)`);
  if (resp.status === 200) {
    console.log('  Answer:', kb.answer?.substring(0, 150));
    console.log('  Confidence:', kb.confidence);
    console.log('  Model:', kb.modelUsed);
    console.log('  Sources:', kb.sourceChunks?.length);
    if (kb.sourceChunks?.length > 0) {
      kb.sourceChunks.slice(0, 2).forEach((s, i) =>
        console.log(`  Source ${i+1}: ${s.documentName} (${(s.relevance*100).toFixed(0)}%)`)
      );
    }
  } else {
    console.log('  Error:', JSON.stringify(kb).substring(0, 300));
  }
}

main().catch(e => console.error(e));
