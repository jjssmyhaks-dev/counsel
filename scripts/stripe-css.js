const https = require('https');

function fetch(url) {
  return new Promise((resolve) => {
    https.get(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Encoding': 'identity' },
      rejectUnauthorized: false,
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', () => resolve(''));
  });
}

(async () => {
  const css = await fetch('https://b.stripecdn.com/mkt-ssr-statics/assets/_next/static/css/9d3a49263f73db6f.css');
  console.log('CSS size:', css.length);
  
  // All CSS variables with values
  const vars = css.match(/--[\w-]+:\s*[^;]+/g) || [];
  const unique = [...new Set(vars)].sort();
  console.log('\n=== ALL CSS VARS ===');
  unique.forEach(v => console.log(v.trim()));
  
  // All hex colors
  const hex = [...new Set((css.match(/#[0-9a-fA-F]{6}\b/g) || []))].sort();
  console.log('\n=== HEX ===');
  console.log(hex.join('\n'));
})();
