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
  // 1. Contract Analysis (standalone)
  try {
    const r1 = await post('/analyze/contract', {
      document_id: 'test-doc-1',
      chunks: [
        { index: 0, text: 'Section 5.2 Indemnification: Client shall indemnify Provider from all claims arising from breach of this Agreement.', section_title: 'Indemnification', page_number: 5 },
        { index: 1, text: 'Section 11.1 Limitation of Liability: Provider total liability shall not exceed fees paid in prior 12 months.', section_title: 'Limitation', page_number: 11 },
        { index: 2, text: 'Section 14.3 Termination: Either party may terminate with 30 days written notice.', section_title: 'Termination', page_number: 14 }
      ]
    });
    console.log('CONTRACT_ANALYSIS:', r1.status, 'clauses:', r1.data.clauses?.length, 'summary:', r1.data.summary?.substring(0, 100));
  } catch (e) { console.log('CONTRACT_ANALYSIS ERR:', e.message); }

  // 2. Draft generation (standalone)
  try {
    const r2 = await post('/draft', {
      type: 'email',
      instructions: 'Draft a professional email to opposing counsel requesting a 2-week extension for the discovery deadline in the Wilson v. State matter',
      matter_id: 'matter-001'
    });
    console.log('DRAFT:', r2.status, 'id:', r2.data.draft_id, 'content:', r2.data.content?.substring(0, 150));
  } catch (e) { console.log('DRAFT ERR:', e.message); }

  // 3. Meeting processing
  try {
    const r3 = await post('/process/meeting', {
      meeting_id: 'meeting-001',
      transcript: 'James Sterling: We need to focus on the indemnification cap. Sarah Chen: The 15 percent cap is below our standard. Mike Torres: Risk team flagged three issues with the liability limits. Lisa Park: Governing law should be Delaware.'
    });
    console.log('MEETING:', r3.status, 'decisions:', r3.data.decisions?.length, 'actions:', r3.data.action_items?.length, 'open:', r3.data.open_questions?.length);
  } catch (e) { console.log('MEETING ERR:', e.message); }

  // 4. Research synthesis
  try {
    const r4 = await post('/synthesize/research', {
      matter_id: 'matter-001',
      query: 'Standard indemnification caps in mid-market M&A deals',
      source_document_ids: ['doc-001']
    });
    console.log('RESEARCH:', r4.status, 'findings:', r4.data.findings?.length, 'title:', r4.data.title);
  } catch (e) { console.log('RESEARCH ERR:', e.message); }

  // 5. RAG Search (needs DB)
  try {
    const r5 = await post('/search', { query: 'indemnification clause', firm_id: '00000000-0000-0000-0000-000000000001', top_k: 3 });
    console.log('SEARCH:', r5.status, 'results:', r5.data.results?.length, 'total:', r5.data.total);
  } catch (e) { console.log('SEARCH ERR:', e.message); }

  // 6. Pipeline orchestrator
  try {
    const r6 = await post('/orchestrator/route', { prompt: 'Summarize the key risks in this contract' });
    console.log('ORCHESTRATOR:', r6.status, 'intent:', r6.data.intent, 'confidence:', r6.data.confidence);
  } catch (e) { console.log('ORCHESTRATOR ERR:', e.message); }
})();
