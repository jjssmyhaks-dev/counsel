// scripts/test-consulting-crews.cjs
// Tests all 3 consulting CrewAI crews: Proposal, Market Intel, Engagement
const http = require('http');

const AI = 'http://127.0.0.1:8000';

function post(path, body) {
  const d = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const r = http.request(`${AI}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': d.length }, timeout: 180000 }, res => {
      let b = ''; res.on('data', c => b += c); res.on('end', () => { try { resolve({ status: res.statusCode, ...JSON.parse(b) }); } catch { resolve({ status: res.statusCode, raw: b }); }});
    });
    r.on('error', reject); r.write(d); r.end();
  });
}

async function main() {
  console.log('=== Consulting CrewAI Test Suite ===\n');
  let pass = 0, fail = 0;

  // 1. Proposal Crew
  console.log('--- C5: Proposal Generation ---');
  try {
    const r = await post('/agents/proposal', {
      proposal_type: 'proposal',
      client_context: 'Fortune 500 retailer, $2B revenue, needs digital transformation',
      scope: 'Digital strategy, tech roadmap, org redesign',
      timeline: '12 weeks',
      budget_range: '$500K-$750K',
      firm_name: 'Sterling Advisory',
    });
    if (r.status === 200 && r.status__internal !== 'failed') {
      console.log(`PASS (${r.status}) — crew=${r.crew}, output=${(r.raw_output||'').length} chars`);
      pass++;
    } else {
      console.log(`FAIL (${r.status}) — ${r.error || JSON.stringify(r)}`);
      fail++;
    }
  } catch (e) { console.log('FAIL:', e.message); fail++; }

  // 2. Market Intelligence Crew
  console.log('\n--- C6: Market Intelligence ---');
  try {
    const r = await post('/agents/market-intel', {
      industry: 'Financial Services',
      company: 'Acme Bank',
      question: 'How should Acme Bank position for open banking in APAC?',
      depth: 'standard',
    });
    if (r.status === 200 && r.status__internal !== 'failed') {
      console.log(`PASS (${r.status}) — crew=${r.crew}, output=${(r.raw_output||'').length} chars`);
      pass++;
    } else {
      console.log(`FAIL (${r.status}) — ${r.error || JSON.stringify(r)}`);
      fail++;
    }
  } catch (e) { console.log('FAIL:', e.message); fail++; }

  // 3. Engagement Management Crew
  console.log('\n--- C7: Engagement Management ---');
  try {
    const r = await post('/agents/engagement', {
      project_name: 'Digital Strategy 2026',
      client_name: 'Meridian Health',
      scope: 'Digital transformation strategy, 12-week engagement',
      start_date: '2026-08-01',
      end_date: '2026-10-31',
      team_size: 5,
    });
    if (r.status === 200 && r.status__internal !== 'failed') {
      console.log(`PASS (${r.status}) — crew=${r.crew}, output=${(r.raw_output||'').length} chars`);
      pass++;
    } else {
      console.log(`FAIL (${r.status}) — ${r.error || JSON.stringify(r)}`);
      fail++;
    }
  } catch (e) { console.log('FAIL:', e.message); fail++; }

  console.log(`\n=== Results: ${pass} pass, ${fail} fail ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
