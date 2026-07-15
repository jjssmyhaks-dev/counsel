const https = require('https');

function fetch(url) {
  return new Promise((resolve) => {
    https.get(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Encoding': 'identity',
      },
      rejectUnauthorized: false,
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    });
    req.setTimeout(15000, () => { req.destroy(); resolve(''); });
  });
}

(async () => {
  // Fetch Stripe's main CSS
  const css = await fetch('https://b.stripecdn.com/mkt-ssr-statics/assets/_next/static/css/9d3a49263f73db6f.css');
  console.log('CSS1 size:', css.length);
  
  // Extract all CSS variables
  const varVals = css.match(/--[\w-]+:\s*[^;]+/g) || [];
  console.log('\n=== CSS VARIABLES ===');
  [...new Set(varVals)].sort().slice(0, 100).forEach(v => console.log(v.trim()));
  
  // Extract hex colors
  const hex = [...new Set((css.match(/#[0-9a-fA-F]{3,8}/g) || []))].sort();
  console.log('\n=== HEX COLORS ===');
  hex.slice(0, 40).forEach(c => console.log(c));
  
  // Also get CSS2
  const css2 = await fetch('https://b.stripecdn.com/mkt-ssr-statics/assets/_next/static/css/e231cbcdc8fb6856.css');
  console.log('\nCSS2 size:', css2.length);
  const hex2 = [...new Set((css2.match(/#[0-9a-fA-F]{3,8}/g) || []))].sort();
  console.log('HEX in CSS2:', hex2.slice(0, 30));
})();
