const fs = require('fs');
const bp = 'C:/Users/Ashif/.openclaw-autoclaw/agents/counsel/workspace/counsel-platform/apps/web/src/app/dashboard';
const dirs = ['documents','matters','drafts','meetings','research','kb','admin','settings'];

dirs.forEach(function(d) {
  const fp = bp + '/' + d + '/page.tsx';
  if (fs.existsSync(fp)) {
    const c = fs.readFileSync(fp, 'utf8');
    const lines = c.split('\n');
    let bads = 0;
    lines.forEach(function(l, i) {
      // href or router.push without /dashboard prefix (but not http/https)
      const m = l.match(/(?:href|push)\s*[=(]\s*["'`]\/([a-z][^"'\s]*)/);
      if (m && !m[1].startsWith('dashboard/') && !m[1].startsWith('/login') && !m[1].startsWith('/register') && !m[1].startsWith('/api')) {
        console.log(d, i+1, m[0]);
        bads++;
      }
    });
    if (bads === 0) console.log(d, ': CLEAN');
  }
});
