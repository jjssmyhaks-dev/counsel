const h = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const d = JSON.stringify(body);
    const o = { hostname: '127.0.0.1', port: 8000, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d) } };
    const rq = h.request(o, (r) => {
      let buf = '';
      r.on('data', (c) => buf += c);
      r.on('end', () => resolve({ status: r.statusCode, data: JSON.parse(buf) }));
    });
    rq.on('error', (e) => reject(e));
    rq.write(d);
    rq.end();
  });
}

(async () => {
  console.log('=== CrewAI Multi-Agent Tests ===\n');

  // Crew 1: Document Intelligence
  try {
    const r = await post('/agents/analyze/contract', {
      document_text: 'This Master Services Agreement is between Acme Corp (Provider) and Northwind Inc (Client). Section 5.2 Indemnification: Client shall indemnify Provider from all claims arising from breach. Section 11.1 Limitation of Liability: Provider total liability shall not exceed fees paid in prior 12 months. Section 3.1 Payment: Client shall pay Provider USD 50,000 monthly within 30 days of invoice.',
      firm_id: 'firm-001', user_id: 'user-001'
    });
    console.log('CREW 1 (Document Intelligence):', r.status, 'status:', r.data.status);
    if (r.data.error) console.log('  ERROR:', r.data.error.substring(0, 200));
  } catch (e) { console.log('CREW 1 ERR:', e.message); }

  // Crew 2: Drafting
  try {
    const r = await post('/agents/draft', {
      draft_type: 'email',
      instructions: 'Draft a professional email to opposing counsel requesting extension for discovery deadline',
      matter_context: 'Employment discrimination case'
    });
    console.log('\nCREW 2 (Drafting):', r.status, 'status:', r.data.status);
    if (r.data.error) console.log('  ERROR:', r.data.error.substring(0, 200));
  } catch (e) { console.log('CREW 2 ERR:', e.message); }

  // Crew 3: Research (needs indexed docs)
  try {
    const r = await post('/agents/research', {
      query: 'What are the standard indemnification caps for mid-market M&A deals?',
      firm_id: '00000000-0000-0000-0000-000000000001', top_k: 5
    });
    console.log('\nCREW 3 (Research):', r.status, 'status:', r.data.status);
    if (r.data.error) console.log('  ERROR:', r.data.error.substring(0, 200));
    if (r.data.detail) console.log('  DETAIL:', r.data.detail.substring(0, 200));
  } catch (e) { console.log('CREW 3 ERR:', e.message); }

  // Crew 4: Compliance
  try {
    const r = await post('/agents/compliance', {
      output_text: 'Based on our analysis, the indemnification clause exposes the client to unlimited liability. We recommend a 15% cap with 12-month survival.',
      output_type: 'contract_analysis',
      firm_id: 'firm-001', user_id: 'user-001'
    });
    console.log('\nCREW 4 (Compliance):', r.status, 'status:', r.data.status);
    if (r.data.error) console.log('  ERROR:', r.data.error.substring(0, 200));
  } catch (e) { console.log('CREW 4 ERR:', e.message); }

  // Full Pipeline
  try {
    const r = await post('/agents/pipeline/full', {
      document_text: 'Section 5.2: Indemnification with no cap. Section 11.1: Liability limited to fees. Section 14.3: 30-day termination.',
      firm_id: 'firm-001', user_id: 'user-001'
    });
    console.log('\nFULL PIPELINE:', r.status, 'status:', r.data.status);
    if (r.data.error) console.log('  ERROR:', r.data.error.substring(0, 200));
  } catch (e) { console.log('FULL PIPELINE ERR:', e.message); }

  console.log('\n=== Done ===');
})();
