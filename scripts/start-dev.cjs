// start-dev.cjs — Start all Counsel services concurrently
// Usage: node scripts/start-dev.cjs

import { spawn } from 'child_process';

const ROOT = 'C:/Users/Ashif/.openclaw-autoclaw/agents/counsel/workspace/counsel-platform';

const services = [
  {
    name: 'API (Express)',
    cwd: `${ROOT}/apps/api`,
    command: 'npx',
    args: ['tsx', 'src/index.ts'],
    port: 3001,
    color: '\x1b[36m', // cyan
  },
  {
    name: 'AI (FastAPI)',
    cwd: `${ROOT}/services/ai`,
    command: 'python',
    args: ['-m', 'uvicorn', 'src.main:app', '--host', '127.0.0.1', '--port', '8000'],
    port: 8000,
    color: '\x1b[35m', // magenta
    env: { ...process.env },
  },
  {
    name: 'Web (Next.js)',
    cwd: `${ROOT}/apps/web`,
    command: 'npx',
    args: ['next', 'dev', '-p', '3000'],
    port: 3000,
    color: '\x1b[32m', // green
  },
];

const children = [];

for (const svc of services) {
  console.log(`${svc.color}[${svc.name}]\x1b[0m Starting on port ${svc.port}...`);

  const child = spawn(svc.command, svc.args, {
    cwd: svc.cwd,
    stdio: 'pipe',
    shell: true,
    env: svc.env || process.env,
  });

  const prefix = `${svc.color}[${svc.name}]\x1b[0m`;

  child.stdout.on('data', (data) => {
    for (const line of data.toString().split('\n')) {
      if (line.trim()) console.log(`${prefix} ${line}`);
    }
  });

  child.stderr.on('data', (data) => {
    for (const line of data.toString().split('\n')) {
      if (line.trim()) console.log(`${prefix} ${line}`);
    }
  });

  child.on('exit', (code) => {
    console.log(`${prefix} exited with code ${code}`);
  });

  child.on('error', (err) => {
    console.log(`${prefix} Failed to start: ${err.message}`);
  });

  children.push(child);
}

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n\x1b[33mShutting down all services...\x1b[0m');
  for (const child of children) {
    child.kill('SIGINT');
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  for (const child of children) {
    child.kill('SIGTERM');
  }
  process.exit(0);
});

console.log('\x1b[33mAll services starting. Press Ctrl+C to stop.\x1b[0m');
console.log('  Web:   http://localhost:3000');
console.log('  API:   http://localhost:3001/api/health');
console.log('  AI:    http://localhost:8000/health');
console.log('  Docs:  http://localhost:3001/api/docs\n');
