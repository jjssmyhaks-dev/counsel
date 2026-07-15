const https = require('https');

function fetch(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', () => resolve(''));
  });
}

(async () => {
  const base = 'https://www.mintlify.com';
  const urls = [
    `${base}/_next/static/chunks/dfad2e085faa5507.css`,
    `${base}/_next/static/chunks/301d5be39da34bff.css`,
  ];
  
  for (const url of urls) {
    const css = await fetch(url);
    console.log(`\n=== ${url.split('/').pop()} (${css.length} bytes) ===`);
    
    // Extract :root or themed variable blocks
    const rootBlocks = css.match(/(?::root|\.light|\.dark|\*\s*,?\s*:root)[^{]*\{[^}]*\}/g) || [];
    rootBlocks.slice(0, 10).forEach(b => console.log(b.substring(0, 500), '\n---'));
    
    // Extract all CSS variables with values
    const vars = css.match(/--[\w-]+:\s*[^;]+;/g) || [];
    const uniqueVars = [...new Set(vars.map(v => v.trim()))].sort();
    console.log('\n--- CSS Variables ---');
    uniqueVars.filter(v => /color|background|foreground|brand|border|text|surface|neutral/i.test(v)).slice(0, 80).forEach(v => console.log(v));
    
    // All hex colors
    const hex = [...new Set((css.match(/#[0-9a-fA-F]{6}\b/g) || []))].sort();
    console.log('\n--- HEX Colors ---');
    console.log(hex.join(' '));
  }
})();
