const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost', port: 3001, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
    }, (res) => {
      let b = '';
      res.on('data', (c) => b += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
        catch { resolve({ status: res.statusCode, raw: b }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  // Test login
  console.log('=== LOGIN (password) ===');
  try {
    const r = await post('/api/v1/auth/login', { email: 'admin@sterling.law', password: 'password' });
    console.log(r.status, r.body.token ? 'TOKEN_OK' : 'NO_TOKEN', r.body);
  } catch (e) { console.log('LOGIN ERROR:', e.message); }

  // Test register
  console.log('\n=== REGISTER ===');
  try {
    const r = await post('/api/v1/auth/register', {
      email: 'test' + Date.now() + '@test.com',
      password: 'Password123!',
      name: 'Test User',
      firmName: 'Test Firm LLC'
    });
    console.log(r.status, r.body.token ? 'TOKEN_OK' : 'NO_TOKEN', r.body);
  } catch (e) { console.log('REGISTER ERROR:', e.message); }

  // Test SSO
  console.log('\n=== SSO (should fail gracefully) ===');
  try {
    const r = await post('/api/v1/auth/sso/authorize', { email: 'test@nonexistent.com' });
    console.log(r.status, r.raw || r.body);
  } catch (e) { console.log('SSO ERROR:', e.message); }
}

main();
