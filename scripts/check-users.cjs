// scripts/check-users.cjs
const { PrismaClient } = require('C:/Users/Ashif/.openclaw-autoclaw/agents/counsel/workspace/counsel-platform/node_modules/@prisma/client');
const bcrypt = require('C:/Users/Ashif/.openclaw-autoclaw/agents/counsel/workspace/counsel-platform/node_modules/bcryptjs');

async function main() {
  const prisma = new PrismaClient();
  
  // Check users
  const users = await prisma.user.findMany();
  console.log(`Found ${users.length} users:`);
  users.forEach(u => console.log(`  ${u.email} (${u.role})`));

  if (users.length === 0) {
    // Create firm and admin user
    const firm = await prisma.firm.create({
      data: { name: 'Sterling & Associates', slug: 'demo-firm', plan: 'pro', seatCount: 10 }
    });
    console.log(`Created firm: ${firm.name} (${firm.id})`);

    const hash = await bcrypt.hash('password', 12);
    const admin = await prisma.user.create({
      data: { firmId: firm.id, email: 'admin@sterling.law', name: 'James Sterling', role: 'ADMIN', passwordHash: hash }
    });
    console.log(`Created admin: ${admin.email}`);
  } else {
    // Reset password for admin
    const hash = await bcrypt.hash('password', 12);
    const admin = await prisma.user.findFirst({ where: { email: 'admin@sterling.law' } });
    if (admin) {
      await prisma.user.update({ where: { id: admin.id }, data: { passwordHash: hash } });
      console.log('Password reset for admin@sterling.law');
    }
  }
  
  await prisma.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
