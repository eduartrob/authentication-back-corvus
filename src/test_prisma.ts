import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function test() {
  const user = await prisma.user.findUnique({ where: { email: 'eduartrob@gmail.com' } });
  console.log('USER:', user);
}
test().catch(console.error);
