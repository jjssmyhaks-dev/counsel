const { PrismaClient } = require('C:/Users/Ashif/.openclaw-autoclaw/agents/counsel/workspace/counsel-platform/node_modules/@prisma/client');
const bcrypt = require('C:/Users/Ashif/.openclaw-autoclaw/agents/counsel/workspace/counsel-platform/node_modules/bcryptjs');

async function main() {
  const prisma = new PrismaClient({
    datasourceUrl: 'postgresql://neondb_owner:npg_pVOyq3dWozno@ep-super-math-aolcnxm7.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
  });
  const user = await prisma.user.findFirst({ where: { email: 'admin@sterling.law' } });
  if (!user) { console.log('User not found'); await prisma.$disconnect(); return; }
  console.log('Found user:', user.email, 'role:', user.role);
  console.log('Hash prefix:', user.passwordHash.substring(0, 30) + '...');
  const match = await bcrypt.compare('password', user.passwordHash);
  console.log('Password match:', match);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
