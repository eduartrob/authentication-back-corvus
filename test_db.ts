import { PrismaClient } from '@prisma/client';
import { normalizeUniversity, normalizeCareer } from './src/utils/normalizer';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log(`Found ${users.length} users.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
