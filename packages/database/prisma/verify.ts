import { prisma } from '../src/index';

async function main() {
  const firms = await prisma.firm.findMany({
    include: { _count: { select: { users: true, matters: true } } },
  });

  for (const f of firms) {
    console.log(`${f.name} — ${f._count.users} users, ${f._count.matters} matters`);
  }

  console.log(`Total users: ${await prisma.user.count()}`);
  console.log(`Total matters: ${await prisma.matter.count()}`);
  console.log(`Total playbook rules: ${(await prisma.playbook.findFirst())?.rules?.length || 0}`);

  await prisma.$disconnect();
}

main();
