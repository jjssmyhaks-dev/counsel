import 'dotenv/config';
import { spawn } from 'child_process';
import { resolve } from 'path';

console.log('Starting Counsel API server...');
const apiPath = resolve('C:/Users/Ashif/.openclaw-autoclaw/agents/counsel/workspace/counsel-platform/apps/api');
const child = spawn('npx', ['tsx', 'src/index.ts'], {
  cwd: apiPath,
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => {
  console.log(`API server exited with code ${code}`);
});

// Keep process alive
process.stdin.resume();
