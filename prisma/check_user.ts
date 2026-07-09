import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { role: { name: 'ALUMNO' } },
    include: { university: true, career: true },
    orderBy: { createdAt: 'desc' }
  });
  console.log('User found:', user?.email, user?.full_name);
  console.log('University:', user?.university?.name);
  console.log('Career:', user?.career?.name);
  console.log('University ID:', user?.universityId);
  console.log('Career ID:', user?.careerId);
}

main().catch(console.error).finally(() => prisma.$disconnect());
