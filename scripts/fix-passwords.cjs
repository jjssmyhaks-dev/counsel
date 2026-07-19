// scripts/fix-passwords.cjs — Reset admin password to "password"
const { PrismaClient } = require('C:/Users/Ashif/.openclaw-autoclaw/agents/counsel/workspace/counsel-platform/node_modules/@prisma/client');
const bcrypt = require('C:/Users/Ashif/.openclaw-autoclaw/agents/counsel/workspace/counsel-platform/node_modules/bcryptjs');

async function main() {
  const prisma = new PrismaClient();
  const hash = await bcrypt.hash('password', 12);
  const user = await prisma.user.update({ where: { email: 'admin@sterling.law' }, data: { passwordHash: hash } });
  console.log('Password reset for:', user.email);
  await prisma.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
