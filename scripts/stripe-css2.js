const https = require('https');
const fs = require('fs');

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
  // Try all 5 CSS files
  const urls = [
    'https://b.stripecdn.com/mkt-ssr-statics/assets/_next/static/css/9d3a49263f73db6f.css',
    'https://b.stripecdn.com/mkt-ssr-statics/assets/_next/static/css/e231cbcdc8fb6856.css',
    'https://b.stripecdn.com/mkt-ssr-statics/assets/_next/static/css/33f4f5c845b0cd07.css',
    'https://b.stripecdn.com/mkt-ssr-statics/assets/_next/static/css/25383277b59e84b6.css',
    'https://b.stripecdn.com/mkt-ssr-statics/assets/_next/static/css/24116e77e2079543.css',
  ];
  
  const results = [];
  for (const url of urls) {
    const css = await fetch(url);
    results.push({ url, size: css.length, css });
    console.log('Fetched:', url.split('/').pop(), '—', css.length, 'bytes');
  }
  
  const allCss = results.map(r => r.css).join('\n');
  console.log('\nTotal CSS:', allCss.length, 'bytes');
  
  // Extract ALL hex colors
  const hex = [...new Set((allCss.match(/#[0-9a-fA-F]{3,8}\b/g) || []))].sort();
  console.log('\n=== ALL HEX ===');
  hex.forEach(c => console.log(c));
  
  // Extract all CSS vars
  const vars = allCss.match(/--[\w-]+:\s*[^;]+/g) || [];
  const uniqueVars = [...new Set(vars.map(v => v.trim()))].sort();
  console.log('\n=== ALL CSS VARS ===');
  uniqueVars.slice(0, 80).forEach(v => console.log(v));
  
  // Save combined CSS for deeper analysis
  fs.writeFileSync('C:/Users/Ashif/.openclaw-autoclaw/agents/counsel/workspace/counsel-platform/scripts/stripe-combined.css', allCss);
  console.log('\nSaved combined CSS to stripe-combined.css');
})();
