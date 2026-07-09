import prisma from './src/utils/prisma';
async function main() {
  const univs = await prisma.university.findMany({
    where: { name: { contains: 'poli', mode: 'insensitive' } }
  });
  console.log(univs.map((u: any) => u.name));
}
main().finally(() => prisma.$disconnect());
