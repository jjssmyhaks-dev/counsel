const fs = require('fs');
const https = require('https');

// Read saved HTML
const html = fs.readFileSync('C:/Users/Ashif/.openclaw-autoclaw/agents/counsel/workspace/counsel-platform/scripts/mintlify.html', 'utf8');

// 1. Structure analysis
console.log('=== PAGE STRUCTURE ===');
const sections = html.match(/<section[^>]*id="([^"]*)"[^>]*>/g) || [];
console.log('Sections found:', sections.length);
sections.forEach(s => console.log('  -', s.match(/id="([^"]*)"/)?.[1] || 'unknown'));

// Hero text
const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
if (h1) console.log('\n=== H1 ===\n', h1[1].replace(/<[^>]*>/g, '').trim().substring(0, 200));

// 2. CSS links
const cssLinks = [...new Set([...html.matchAll(/href="([^"]+\.css[^"]*)"/g)].map(m => m[1]))];
console.log('\n=== STYLESHEETS ===');
cssLinks.forEach(l => console.log(l));

// 3. Inline style content
const inlineStyles = html.match(/<style[^>]*>([\s\S]*?)<\/style>/g) || [];
const allInline = inlineStyles.join('');
const vars = [...new Set((allInline.match(/--[\w-]+:\s*[^;]+/g) || []))].sort();
console.log('\n=== CSS VARS (inline) ===');
vars.forEach(v => console.log(v.trim()));

// 4. All hex in inline styles
const hex = [...new Set((allInline.match(/#[0-9a-fA-F]{6}\b/g) || []))].sort();
console.log('\n=== HEX (inline) ===');
hex.forEach(c => console.log(c));

// 5. Nav structure
const nav = html.match(/<nav[\s\S]*?<\/nav>/);
if (nav) console.log('\n=== NAV ===\n', nav[0].substring(0, 400));
