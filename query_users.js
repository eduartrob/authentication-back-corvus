const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      full_name: true,
      careerId: true
    }
  });
  console.log("Users:", users);
}
main().catch(console.error).finally(() => prisma.$disconnect());
