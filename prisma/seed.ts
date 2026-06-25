import 'dotenv/config';
import prisma from '../src/utils/prisma';
import bcrypt from 'bcrypt';

async function main() {
  console.log('🌱 Iniciando seeder de base de datos...');

  // 1. Crear el rol de ADMINISTRADOR si no existe
  let adminRole = await prisma.role.findUnique({ where: { name: 'ADMINISTRADOR' } });
  if (!adminRole) {
    adminRole = await prisma.role.create({
      data: { name: 'ADMINISTRADOR' },
    });
    console.log('✅ Rol ADMINISTRADOR creado');
  } else {
    console.log('ℹ️ Rol ADMINISTRADOR ya existe');
  }

  // 2. Crear al usuario administrador maestro
  const email = 'eduartrob@gmail.com';
  const plainPassword = 'eduart_rob09';
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (!existingUser) {
    await prisma.user.create({
      data: {
        email,
        password_hash: hashedPassword,
        roleId: adminRole.id,
        full_name: 'Eduardo Administrador',
        username: 'admin_eduart'
      },
    });
    console.log(`✅ Usuario admin creado: ${email}`);
  } else {
    // Si ya existe, actualizamos su rol y contraseña para asegurar acceso
    await prisma.user.update({
      where: { email },
      data: {
        password_hash: hashedPassword,
        roleId: adminRole.id,
      },
    });
    console.log(`🔄 Usuario admin actualizado: ${email}`);
  }

  console.log('🎉 Seeding completado con éxito.');
}

main()
  .catch((e) => {
    console.error('❌ Error en el seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
