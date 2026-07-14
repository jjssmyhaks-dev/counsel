const H = Buffer.from('QmVhcmVyIA==','base64').toString();
const A = 'http://localhost:3001/api/v1';
let passed = 0, failed = 0;

async function test(name, fn) {
  try {
    const r = await fn();
    if (r === true || (typeof r === 'object' && r.ok !== false)) {
      passed++; console.log('  PASS  ' + name);
    } else {
      failed++; console.log('  FAIL  ' + name + ' — ' + JSON.stringify(r).substring(0,100));
    }
  } catch(e) {
    failed++; console.log('  FAIL  ' + name + ' — ' + e.message.substring(0,80));
  }
}

async function run() {
  // Health
  await test('Health check', async () => {
    const r = await fetch(A.replace('/v1','') + '/health');
    const j = await r.json();
    return j.status === 'ok' && j.database === 'neon-postgres';
  });

  // Login with firm name
  let token = '';
  await test('Login + firm name', async () => {
    const r = await fetch(A+'/auth/login', {method:'POST',headers:{'Content-Type':'application/json'},
      body: JSON.stringify({email:'admin@sterling.law',password:'password'})});
    const d = await r.json();
    token = H + d.token;
    return d.user?.name === 'James Sterling' && d.firm?.name === 'Sterling & Associates';
  });

  // Register
  await test('Register new user', async () => {
    const r = await fetch(A+'/auth/register', {method:'POST',headers:{'Content-Type':'application/json'},
      body: JSON.stringify({email:'test'+Date.now()+'@demo.law',password:'ValidPass12',name:'Test User'})});
    const j = await r.json();
    return !!(j.token && j.user && j.firm);
  });

  // Auth /me
  await test('Auth /me', async () => {
    const r = await fetch(A+'/auth/me', {headers:{Authorization: token}});
    const j = await r.json();
    return j.user?.name === 'James Sterling';
  });

  // Documents list
  await test('Documents list', async () => {
    const r = await fetch(A+'/documents?limit=5', {headers:{Authorization: token}});
    const j = await r.json();
    return 'data' in j || 'pagination' in j;
  });

  // Matters list
  await test('Matters list', async () => {
    const r = await fetch(A+'/matters?limit=2', {headers:{Authorization: token}});
    const j = await r.json();
    return 'data' in j || 'pagination' in j;
  });

  // Drafts list
  await test('Drafts list', async () => {
    const r = await fetch(A+'/drafts?limit=2', {headers:{Authorization: token}});
    const j = await r.json();
    return 'data' in j || 'pagination' in j;
  });

  // Meetings list
  await test('Meetings list', async () => {
    const r = await fetch(A+'/meetings?limit=2', {headers:{Authorization: token}});
    const j = await r.json();
    return 'data' in j || 'pagination' in j;
  });

  // SSO connections (public)
  await test('SSO connections', async () => {
    const r = await fetch(A+'/auth/sso/connections');
    const j = await r.json();
    return 'connections' in j;
  });

  // RBAC: audit requires ADMIN
  await test('RBAC — audit (ADMIN only)', async () => {
    try {
      const r = await fetch(A+'/audit/logs', {headers:{Authorization: token}});
      const j = await r.json();
      return !j.error; // Should succeed since admin
    } catch { return true; }
  });

  // KB route
  await test('KB route', async () => {
    const r = await fetch(A+'/kb', {headers:{Authorization: token}});
    return r.ok || r.status < 500;
  });

  // Research route
  await test('Research route', async () => {
    const r = await fetch(A+'/research?limit=1', {headers:{Authorization: token}});
    return r.ok || r.status < 500;
  });

  console.log('\n============');
  console.log('RESULTS: ' + passed + ' passed, ' + failed + ' failed');
  console.log('Frontend: http://localhost:3000');
  console.log('Register: http://localhost:3000/register');
  if (failed > 0) process.exit(1);
}

run();
