// Reset admin password + seed if missing
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking DB...');
  
  // 1. Ensure firm exists
  let firm = await prisma.firm.findFirst({ where: { slug: 'demo-firm' } });
  if (!firm) {
    firm = await prisma.firm.create({
      data: { name: 'Sterling & Associates', slug: 'demo-firm', plan: 'pro', seatCount: 10 }
    });
    console.log(`Created firm: ${firm.name} (${firm.id})`);
  } else {
    console.log(`Firm exists: ${firm.name} (${firm.id})`);
  }

  const passwordHash = await bcrypt.hash('password', 12);

  // 2. Ensure admin exists
  const adminEmail = 'admin@sterling.law';
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    admin = await prisma.user.create({
      data: { firmId: firm.id, email: adminEmail, name: 'James Sterling', role: 'ADMIN', passwordHash }
    });
    console.log(`Created admin: ${admin.email}`);
  } else {
    await prisma.user.update({ where: { id: admin.id }, data: { passwordHash } });
    console.log(`Reset password for: ${admin.email}`);
  }

  // 3. Ensure onboarding_completed is set on firm
  if (firm && !firm.onboardingCompleted) {
    // Check if firmType exists on this Prisma version
    try {
      await prisma.firm.update({ where: { id: firm.id }, data: { onboardingCompleted: true } });
      console.log('Set onboardingCompleted=true');
    } catch (e) { console.log('onboardingCompleted update skipped (column may not exist yet)'); }
  }

  // 4. Remove spam user from security test
  const spam = await prisma.user.findUnique({ where: { email: 'test@evil.com' } });
  if (spam) {
    await prisma.user.delete({ where: { id: spam.id } });
    console.log('Cleaned up test@evil.com');
  }

  await prisma.$disconnect();
  console.log('Done.');
}

main().catch(e => { console.error(e.message); process.exit(1); });
