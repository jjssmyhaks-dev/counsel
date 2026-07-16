const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const firm = await prisma.firm.findFirst();
  console.log('Firm:', JSON.stringify({ id: firm.id, name: firm.name, slug: firm.slug }));
  
  const docs = await prisma.document.findMany({ take: 3, select: { id: true, name: true } });
  console.log('Documents:', JSON.stringify(docs));
  
  await prisma.$disconnect();
}
main();
