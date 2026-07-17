const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    await p.$executeRawUnsafe(`ALTER TABLE firms ADD COLUMN IF NOT EXISTS firm_type TEXT DEFAULT 'LEGAL'`);
    await p.$executeRawUnsafe(`ALTER TABLE firms ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false`);
    console.log('Columns added successfully');
  } catch (e) {
    console.error(e.message);
  }
  await p.$disconnect();
})();
