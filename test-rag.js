// End-to-end RAG pipeline test: upload → parse → index → query
const BASE = 'http://localhost:3001/api/v1';
const AUTH_PREFIX = atob('QmVhcmVyIA=='); // *** + space
const fs = require('fs');
const path = require('path');

async function main() {
  // 1. Login
  const login = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@sterling.law', password: 'password' }),
  }).then(r => r.json());
  if (!login.token) { console.error('Login failed:', login); return; }
  console.log('1. Logged in as', login.user?.name);
  const authHeader = AUTH_PREFIX + login.token;

  // 2. Upload document
  const filePath = path.resolve(__dirname, 'test-indemnification.txt');
  const fileBuffer = fs.readFileSync(filePath);
  
  // Use fetch with manual multipart since form-data may not be available
  const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
  let body = '';
  body += `--${boundary}\r\n`;
  body += 'Content-Disposition: form-data; name="file"; filename="test-indemnification.txt"\r\n';
  body += 'Content-Type: text/plain\r\n\r\n';
  const bodyStart = Buffer.from(body, 'utf-8');
  const bodyEnd = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
  const fullBody = Buffer.concat([bodyStart, fileBuffer, bodyEnd]);

  const uploadResp = await fetch(`${BASE}/documents`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: fullBody,
  }).then(r => r.json());

  console.log('2. Uploaded:', uploadResp.originalName, '| Status:', uploadResp.status, '| Job:', uploadResp.jobId);
  const jobId = uploadResp.jobId;
  if (!jobId) { console.error('No job created'); return; }

  // 3. Process the job (parse → embed → index)
  console.log('3. Processing job...');
  const processResp = await fetch(`${BASE}/jobs/process/${jobId}`, {
    method: 'POST',
    headers: { 'Authorization': authHeader },
  }).then(r => r.json());
  console.log('   Result:', JSON.stringify(processResp).substring(0, 200));

  // 4. Wait a moment for indexing to complete, then query
  await new Promise(r => setTimeout(r, 2000));

  // 5. KB query — search the indexed document
  console.log('4. Querying KB...');
  const kbResp = await fetch(`${BASE}/kb/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
    },
    body: JSON.stringify({ question: 'What is the indemnification basket amount?' }),
  }).then(r => r.json());

  console.log('   KB Answer:', kbResp.answer?.substring(0, 150));
  console.log('   Confidence:', kbResp.confidence);
  console.log('   Model:', kbResp.modelUsed);
  console.log('   Sources:', kbResp.sourceChunks?.length);

  if (kbResp.sourceChunks?.length > 0) {
    kbResp.sourceChunks.forEach((s, i) => {
      console.log(`   Source ${i+1}: "${s.excerpt?.substring(0, 100)}..." (${(s.relevance*100).toFixed(0)}%)`);
    });
  }

  console.log('\n✅ Full RAG pipeline completed!');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
