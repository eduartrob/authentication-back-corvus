const { PrismaClient } = require('./dist/utils/prisma');
const prisma = require('./dist/utils/prisma').default;

async function main() {
  const users = await prisma.user.findMany({ select: { careerId: true } });
  console.log(users);
}
main();
