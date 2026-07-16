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
  console.log('=== Testing Crew 1: Document Intelligence ===');
  const r = await post('/agents/analyze/contract', {
    document_text: 'This Master Services Agreement is between Provider Inc. and Customer LLC.\n\n1. SERVICES. Provider delivers SaaS with 99.9% uptime SLA.\n\n2. INDEMNIFICATION. Provider indemnifies Customer for negligence. Liability capped at 12 months fees.\n\n3. LIMITATION OF LIABILITY. No indirect or consequential damages.\n\n4. TERMINATION. 90 days notice.\n\n5. GOVERNING LAW. Delaware law.\n',
    firm_id: 'ce7b93db-dc73-4407-a91c-450c128fa26f',
    user_id: 'test-user',
  });
  console.log('Status:', r.status, '| Crew:', r.body.crew, '| Status:', r.body.status);
  if (r.body.error) console.log('ERROR:', r.body.error.substring(0, 500));
  else console.log('Output:', (r.body.raw_output || '').substring(0, 500));
}
main().catch(e => console.error('FAIL:', e.message));
