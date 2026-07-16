/** Fast test: Crews 2, 3, 4 + full pipeline. Assumes Crew 1 already verified. */
const http = require('http');
const BASE = 'http://127.0.0.1:8000';

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(BASE + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
      timeout: 300000,
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch { resolve({ status: res.statusCode, body: buf }); }
      });
    });
    req.on('error', err => reject(err));
    req.write(data); req.end();
  });
}

async function main() {
  const results = {};

  // Crew 2: Drafting
  console.log('=== C2: Drafting ===');
  try {
    const r = await post('/agents/draft', {
      draft_type: 'memo',
      instructions: 'Draft internal memo on key risk areas in standard SaaS MSA and recommended negotiation positions.',
    });
    results.c2 = r;
    console.log(r.status, r.body.crew, '→', r.body.status);
    if (!r.body.error) console.log('  Output:', (r.body.raw_output || '').substring(0, 200));
    else console.log('  ERROR:', r.body.error.substring(0, 200));
  } catch(e) { console.log('FAIL:', e.message); results.c2 = {error: e.message}; }

  // Crew 3: Research
  console.log('\n=== C3: Research ===');
  try {
    const r = await post('/agents/research', {
      query: 'Enforceability of limitation of liability clauses in SaaS contracts under Delaware law',
      firm_id: 'ce7b93db-dc73-4407-a91c-450c128fa26f',
      jurisdiction: 'Delaware',
    });
    results.c3 = r;
    console.log(r.status, r.body.crew, '→', r.body.status);
    if (!r.body.error) console.log('  Output:', (r.body.raw_output || '').substring(0, 200));
    else console.log('  ERROR:', r.body.error.substring(0, 200));
  } catch(e) { console.log('FAIL:', e.message); results.c3 = {error: e.message}; }

  // Crew 4: Compliance (stub input)
  console.log('\n=== C4: Compliance ===');
  try {
    const r = await post('/agents/compliance', {
      output_text: 'Test output for compliance checking — contract analysis result placeholder.',
      output_type: 'contract_analysis',
      firm_id: 'ce7b93db-dc73-4407-a91c-450c128fa26f',
      user_id: 'test-user',
    });
    results.c4 = r;
    console.log(r.status, r.body.crew, '→', r.body.status);
    if (!r.body.error) console.log('  Output:', (r.body.raw_output || '').substring(0, 200));
    else console.log('  ERROR:', r.body.error.substring(0, 200));
  } catch(e) { console.log('FAIL:', e.message); results.c4 = {error: e.message}; }

  // Full Pipeline
  console.log('\n=== FULL PIPELINE ===');
  try {
    const r = await post('/agents/pipeline/full', {
      document_text: 'This MSA is between Provider Inc. and Customer LLC.\n\n1. SERVICES. SaaS platform, 99.9% uptime.\n2. INDEMNIFICATION. Provider indemnifies for negligence. Cap: 12 months fees.\n3. LIMITATION OF LIABILITY. No indirect damages.\n4. TERMINATION. 90 days notice.\n5. GOVERNING LAW. Delaware.',
      firm_id: 'ce7b93db-dc73-4407-a91c-450c128fa26f',
      user_id: 'test-user',
    });
    results.pipeline = r;
    console.log(r.status, r.body.crew, '→', r.body.status);
    if (!r.body.error) console.log('  Output length:', (r.body.raw_output || '').length);
    else console.log('  ERROR:', r.body.error.substring(0, 200));
  } catch(e) { console.log('FAIL:', e.message); results.pipeline = {error: e.message}; }

  console.log('\n=== SUMMARY ===');
  for (const [k,v] of Object.entries(results)) {
    const status = v.body ? v.body.status : v.error ? 'FAILED' : '?';
    console.log('  ' + k + ': ' + (v.status || 'ERR') + ' ' + (v.body?.crew || '') + ' → ' + status);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
