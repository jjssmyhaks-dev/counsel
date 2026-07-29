// seed.cjs — Seed the Counsel PostgreSQL database (CommonJS)
// Reads DATABASE_URL from apps/api/.env (production: set env directly)
// Usage: node scripts/seed.cjs

const { execSync } = require('child_process');
const { existsSync, readFileSync } = require('fs');
const { resolve } = require('path');

const ROOT = resolve(__dirname, '..');

// ── Find DATABASE_URL ───────────────────────────────────────────────────────
let dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  const envFile = resolve(ROOT, 'apps', 'api', '.env');
  if (existsSync(envFile)) {
    const contents = readFileSync(envFile, 'utf8');
    const match = contents.match(/^DATABASE_URL=(.+)$/m);
    if (match) dbUrl = match[1].trim();
  }
}

if (!dbUrl) {
  console.error('DATABASE_URL not found. Set env var or create apps/api/.env');
  process.exit(1);
}

// Strip channel_binding param if present (not supported by Prisma direct URL)
dbUrl = dbUrl.replace(/&channel_binding=require/gi, '');

console.log('Seeding Counsel database...');
console.log('   DB: ' + dbUrl.replace(/\/\/.*@/, '//***@'));

try {
  execSync('npx prisma db seed', {
    cwd: resolve(ROOT, 'packages', 'database'),
    env: Object.assign({}, process.env, { DATABASE_URL: dbUrl }),
    stdio: 'inherit',
    timeout: 60000,
  });
  console.log('Seed completed successfully!');
} catch (err) {
  console.error('Seed failed: ' + err.message);
  process.exit(1);
}
