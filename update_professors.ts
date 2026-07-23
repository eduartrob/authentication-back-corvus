import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Encontrar la Universidad Politécnica
  const university = await prisma.university.findFirst({
    where: {
      name: {
        contains: 'Politécnica',
        mode: 'insensitive'
      }
    }
  });

  if (!university) {
    console.error('No se encontró la Universidad Politécnica.');
    return;
  }

  // 2. Encontrar la Carrera Ingeniería en Software
  const career = await prisma.career.findFirst({
    where: {
      name: {
        contains: 'Software',
        mode: 'insensitive'
      }
    }
  });

  if (!career) {
    console.error('No se encontró la carrera de Ingeniería en Software.');
    return;
  }

  // 3. Encontrar el Role PROFESOR
  const role = await prisma.role.findFirst({
    where: { name: 'PROFESOR' }
  });

  if (!role) {
    console.error('No se encontró el rol PROFESOR.');
    return;
  }

  console.log(`Universidad ID: ${university.id}`);
  console.log(`Carrera ID: ${career.id}`);
  console.log(`Rol Profesor ID: ${role.id}`);

  // 4. Actualizar todos los profesores
  const result = await prisma.user.updateMany({
    where: {
      roleId: role.id
    },
    data: {
      universityId: university.id,
      careerId: career.id,
      verification_code: '51B5I6',
      is_verified: true
    }
  });

  console.log(`Se actualizaron ${result.count} profesores correctamente.`);
}

main()
  .catch((e) => {
    console.error(e);
    
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
