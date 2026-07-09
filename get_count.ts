import prisma from './src/utils/prisma';
async function main() {
  const count = await prisma.university.count();
  console.log("Total universities:", count);
}
main().finally(() => prisma.$disconnect());
