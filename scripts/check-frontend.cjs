const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:3000' + path, (res) => {
      let b = '';
      res.on('data', (c) => b += c);
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    }).on('error', reject);
  });
}

async function main() {
  // Check login page renders
  const login = await get('/login');
  console.log('/login:', login.status, 'has form:', login.body.includes('Sign in'), 'tokens:', login.body.substring(0, 50));

  // Check register page renders
  const reg = await get('/register');
  console.log('/register:', reg.status, 'has form:', reg.body.includes('Create account'));

  // Check that the page includes the login function from lib/auth
  console.log('login page mentions router.push:', login.body.includes('router'));
  console.log('login page mentions /dashboard:', login.body.includes('/dashboard'));

  // Check API connection from the frontend side
  const dashboard = await get('/dashboard');
  console.log('/dashboard:', dashboard.status, 'len:', dashboard.body.length);
}

main();
