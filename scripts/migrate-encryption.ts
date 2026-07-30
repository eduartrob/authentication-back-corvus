import prisma from '../src/utils/prisma';
import { encryptField } from '../src/utils/encryption.util';

async function main() {
  console.log('Starting encryption migration...');
  const users = await prisma.user.findMany({
    where: {
      full_name: {
        not: null
      }
    }
  });

  let count = 0;
  for (const user of users) {
    if (user.full_name && !user.full_name.includes('=')) { // Basic heuristic to avoid re-encrypting Base64
      const encrypted = encryptField(user.full_name);
      await prisma.user.update({
        where: { id: user.id },
        data: { full_name: encrypted }
      });
      count++;
    }
  }

  console.log(`Migration finished. Encrypted ${count} users.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
