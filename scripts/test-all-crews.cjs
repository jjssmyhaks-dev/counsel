/** Comprehensive CrewAI multi-agent test runner.
 * Tests all 4 crews + full pipeline via the AI service HTTP API.
 */
const http = require('http');

const BASE = 'http://127.0.0.1:8000';

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
      timeout: 120000,
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch { resolve({ status: res.statusCode, body: buf }); }
      });
    });
    req.on('error', err => reject(err));
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

const SAMPLE_CONTRACT = `
This Master Services Agreement ("Agreement") is entered into as of the Effective Date by and between:
PROVIDER: TechVendor Inc., a Delaware corporation with offices at 100 Innovation Drive, Wilmington, DE 19801
CUSTOMER: Sterling & Associates, a professional legal corporation

1. SERVICES. Provider shall deliver legal document management software with 99.9% uptime SLA.

2. FEES. Customer shall pay $5,000 per month. Late payments accrue 1.5% monthly interest.

3. INDEMNIFICATION. Provider shall indemnify Customer against all third-party claims arising from Provider's negligence or willful misconduct. Provider's total liability shall not exceed fees paid in the preceding 12 months.

4. LIMITATION OF LIABILITY. NEITHER PARTY SHALL BE LIABLE FOR INDIRECT, SPECIAL, OR CONSEQUENTIAL DAMAGES, INCLUDING LOST PROFITS.

5. TERMINATION. Either party may terminate on 90 days written notice. Either party may terminate immediately for material breach that remains uncured 30 days after notice.

6. CONFIDENTIALITY. Receiving party shall protect confidential information with reasonable care and not disclose to third parties.

7. INTELLECTUAL PROPERTY. Provider retains all IP in the Service. Customer retains all IP in Customer Data.

8. GOVERNING LAW. This Agreement shall be governed by the laws of the State of Delaware. Disputes resolved by AAA arbitration in Wilmington, DE.

9. FORCE MAJEURE. Neither party shall be liable for delays caused by acts of God, war, terrorism, or natural disasters.

10. ENTIRE AGREEMENT. This Agreement supersedes all prior agreements and understandings.
`;

async function main() {
  console.log('=== CrewAI Multi-Agent End-to-End Tests ===\n');
  const results = {};

  // ──────── Crew 1: Document Intelligence ────────
  console.log('--- CREW 1: Document Intelligence ---');
  try {
    const r = await post('/agents/analyze/contract', {
      document_text: SAMPLE_CONTRACT,
      firm_id: 'ce7b93db-dc73-4407-a91c-450c128fa26f',
      user_id: 'test-user',
    });
    results.c1 = r;
    console.log(`  Status: ${r.status} | Crew: ${r.body.crew} | ${r.body.status}`);
    if (r.body.error) console.log(`  ERROR: ${r.body.error.substring(0, 200)}`);
    else console.log(`  Output length: ${(r.body.raw_output || '').length} chars`);
  } catch (e) { console.log(`  FAIL: ${e.message}`); results.c1 = { error: e.message }; }

  // ──────── Crew 2: Drafting ────────
  console.log('\n--- CREW 2: Drafting ---');
  try {
    const r = await post('/agents/draft', {
      draft_type: 'memo',
      instructions: 'Draft an internal memo summarizing the key risk areas in our standard SaaS MSA template and recommending negotiation positions for each.',
      matter_context: 'Client: TechVendor Inc. — SaaS MSA renewal with expanded liability terms requested.',
    });
    results.c2 = r;
    console.log(`  Status: ${r.status} | Crew: ${r.body.crew} | ${r.body.status}`);
    if (r.body.error) console.log(`  ERROR: ${r.body.error.substring(0, 200)}`);
    else console.log(`  Output length: ${(r.body.raw_output || '').length} chars`);
  } catch (e) { console.log(`  FAIL: ${e.message}`); results.c2 = { error: e.message }; }

  // ──────── Crew 3: Research ────────
  console.log('\n--- CREW 3: Research ---');
  try {
    const r = await post('/agents/research', {
      query: 'What are the enforceability standards for limitation of liability clauses in SaaS contracts under Delaware law?',
      firm_id: 'ce7b93db-dc73-4407-a91c-450c128fa26f',
      jurisdiction: 'Delaware',
    });
    results.c3 = r;
    console.log(`  Status: ${r.status} | Crew: ${r.body.crew} | ${r.body.status}`);
    if (r.body.error) console.log(`  ERROR: ${r.body.error.substring(0, 200)}`);
    else console.log(`  Output length: ${(r.body.raw_output || '').length} chars`);
  } catch (e) { console.log(`  FAIL: ${e.message}`); results.c3 = { error: e.message }; }

  // ──────── Crew 4: Compliance ────────
  console.log('\n--- CREW 4: Compliance ---');
  try {
    // Use the dummy output from Crew 1 if available, else a stub
    const prevOutput = (results.c1 && results.c1.body && results.c1.body.raw_output) || 'STUB: No prior output available.';
    const r = await post('/agents/compliance', {
      output_text: prevOutput,
      output_type: 'contract_analysis',
      firm_id: 'ce7b93db-dc73-4407-a91c-450c128fa26f',
      user_id: 'test-user',
    });
    results.c4 = r;
    console.log(`  Status: ${r.status} | Crew: ${r.body.crew} | ${r.body.status}`);
    if (r.body.error) console.log(`  ERROR: ${r.body.error.substring(0, 200)}`);
    else console.log(`  Output length: ${(r.body.raw_output || '').length} chars`);
  } catch (e) { console.log(`  FAIL: ${e.message}`); results.c4 = { error: e.message }; }

  // ──────── Full Pipeline ────────
  console.log('\n--- FULL PIPELINE ---');
  try {
    const r = await post('/agents/pipeline/full', {
      document_text: SAMPLE_CONTRACT,
      firm_id: 'ce7b93db-dc73-4407-a91c-450c128fa26f',
      user_id: 'test-user',
    });
    results.pipeline = r;
    console.log(`  Status: ${r.status} | Crew: ${r.body.crew} | ${r.body.status}`);
    if (r.body.error) console.log(`  ERROR: ${r.body.error.substring(0, 200)}`);
    else console.log(`  Output length: ${(r.body.raw_output || '').length} chars`);
  } catch (e) { console.log(`  FAIL: ${e.message}`); results.pipeline = { error: e.message }; }

  // ──────── Audit Trail Check ────────
  console.log('\n--- AUDIT TRAIL ---');
  try {
    const ar = await post('/orchestrator/audit/query', { limit: 10 });
    results.audit = ar;
    console.log(`  Status: ${ar.status} | Entries: ${ar.body.total || 0}`);
  } catch (e) { console.log(`  FAIL: ${e.message}`); results.audit = { error: e.message }; }

  console.log('\n=== SUMMARY ===');
  for (const [k, v] of Object.entries(results)) {
    const status = v.body ? v.body.status : v.error ? 'FAILED' : '?';
    const crew = v.body ? v.body.crew : '';
    console.log(`  ${k}: ${v.status || 'ERR'} ${crew} → ${status}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
