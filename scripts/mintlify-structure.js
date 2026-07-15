const fs = require('fs');
const html = fs.readFileSync('C:/Users/Ashif/.openclaw-autoclaw/agents/counsel/workspace/counsel-platform/scripts/mintlify.html', 'utf8');

// Extract all sections with content
const sections = html.match(/<section[\s\S]*?<\/section>/g) || [];
console.log('Total sections:', sections.length);
sections.forEach((s, i) => {
  // Get id and key text
  const id = s.match(/id="([^"]*)"/)?.[1] || 'no-id';
  // Get first h2 or h3
  const heading = s.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/);
  const headingText = heading ? heading[1].replace(/<[^>]*>/g, '').trim().substring(0, 80) : 'no-heading';
  // Get paragraph
  const para = s.match(/<p[^>]*>([\s\S]*?)<\/p>/);
  const paraText = para ? para[1].replace(/<[^>]*>/g, '').trim().substring(0, 100) : '';
  console.log(`\n[${i}] id="${id}"`);
  console.log(`    H: "${headingText}"`);
  if (paraText) console.log(`    P: "${paraText}"`);
  console.log(`    Size: ${s.length} chars`);
});

// Main content region
const main = html.match(/<main[\s\S]*?<\/main>/);
if (main) {
  const mainSections = main[0].match(/<section[\s\S]*?<\/section>/g) || [];
  console.log(`\n=== MAIN has ${mainSections.length} sections ===`);
}

// Features / cards
const featureCards = html.match(/<div[^>]*feature[^>]*>[\s\S]{0,200}/gi) || [];
console.log('\n=== FEATURE PATTERNS ===');
featureCards.slice(0, 5).forEach(f => console.log(f.substring(0, 200)));

// Navigation items
const navLinks = [...new Set([...html.matchAll(/<a[^>]*href="\/(?!\/)[^"]*"[^>]*>([^<]+)<\/a>/g)].map(m => m[1].trim()))];
console.log('\n=== NAV LINKS ===');
navLinks.slice(0, 15).forEach(l => console.log(' -', l));
