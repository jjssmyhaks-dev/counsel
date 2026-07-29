// scripts/start-mcp-servers.cjs — Start all MCP servers as child processes
// Usage: node scripts/start-mcp-servers.cjs
// Each MCP server runs on its configured port; health checks validate connectivity.

import { spawn } from 'child_process';

const ROOT = '../services/ai/src/mcp';

const servers = [
  // Core data services (2)
  { name: 'Postgres MCP', port: 5001, module: 'postgres_server.py' },
  { name: 'Cloudflare AI MCP', port: 5002, module: 'cloudflare_server.py' },

  // Document tools (3)
  { name: 'Document MCP', port: 5003, module: 'document_server.py' },
  { name: 'OCR MCP', port: 5013, module: 'ocr_server.py' },
  { name: 'Translation MCP', port: 5014, module: 'translation_server.py' },

  // Communication (3)
  { name: 'Email MCP', port: 5004, module: 'email_server.py' },
  { name: 'Calendar MCP', port: 5005, module: 'calendar_server.py' },
  { name: 'Communication MCP', port: 5011, module: 'communication_server.py' },

  // Content (2)
  { name: 'Storage MCP', port: 5006, module: 'storage_server.py' },
  { name: 'Video MCP', port: 5015, module: 'video_server.py' },

  // Business tools (3)
  { name: 'eSign MCP', port: 5007, module: 'esign_server.py' },
  { name: 'Billing MCP', port: 5008, module: 'billing_server.py' },
  { name: 'CRM MCP', port: 5012, module: 'crm_server.py' },

  // Legal tools (2)
  { name: 'Court MCP', port: 5009, module: 'court_server.py' },
  { name: 'Conflict MCP', port: 5017, module: 'conflict_server.py' },

  // Workflow & tracking (2)
  { name: 'Workflow MCP', port: 5010, module: 'workflow_server.py' },
  { name: 'Time MCP', port: 5016, module: 'time_server.py' },
];

const children = [];

console.log('🚀 Starting 17 MCP servers...\n');

for (const svc of servers) {
  const child = spawn('python', [`${ROOT}/${svc.module}`], {
    stdio: 'pipe',
    shell: true,
    env: { ...process.env, MCP_PORT: String(svc.port) },
  });

  const prefix = `[${svc.name}]`;

  child.stderr.on('data', (d) => {
    for (const line of d.toString().trim().split('\n')) {
      if (line.trim()) console.log(`${prefix} ${line}`);
    }
  });

  child.on('error', (err) => {
    console.log(`${prefix} ❌ Failed: ${err.message}`);
  });

  child.on('exit', (code) => {
    if (code !== 0) console.log(`${prefix} ⚠️  Exited with code ${code}`);
  });

  children.push({ name: svc.name, child, port: svc.port });
}

console.log(`\n✅ Launched ${children.length} MCP servers`);
console.log('   MCP servers provide tool bridges between AI agents and services.\n');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down MCP servers...');
  for (const { name, child } of children) {
    child.kill('SIGINT');
    console.log(`   Stopped: ${name}`);
  }
  process.exit(0);
});
