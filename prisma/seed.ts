import 'dotenv/config';
import prisma from '../src/utils/prisma';
import bcrypt from 'bcrypt';

async function main() {
  console.log('🌱 Iniciando seeder de base de datos...');

  // -# 1 crear los roles principales si no existen
  const roleNames = ['ADMINISTRADOR', 'PROFESOR', 'ALUMNO'];
  const roles: Record<string, any> = {};

  for (const name of roleNames) {
    let role = await prisma.role.findUnique({ where: { name } });
    if (!role) {
      role = await prisma.role.create({ data: { name } });
      console.log(`✅ Rol ${name} creado`);
    } else {
      console.log(`ℹ️ Rol ${name} ya existe`);
    }
    roles[name] = role;
  }

  // -# 2 crear al usuario administrador maestro
  const emailAdmin = 'eduartrob@gmail.com';
  const hashedPasswordAdmin = await bcrypt.hash('eduart_rob09', 10);

  const existingAdmin = await prisma.user.findUnique({ where: { email: emailAdmin } });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email: emailAdmin,
        password_hash: hashedPasswordAdmin,
        roleId: roles['ADMINISTRADOR'].id,
        full_name: 'Eduardo Administrador',
        username: 'admin_eduart'
      },
    });
    console.log(`✅ Usuario admin creado: ${emailAdmin}`);
  } else {
    await prisma.user.update({
      where: { email: emailAdmin },
      data: {
        password_hash: hashedPasswordAdmin,
        roleId: roles['ADMINISTRADOR'].id,
      },
    });
    console.log(`🔄 Usuario admin actualizado: ${emailAdmin}`);
  }

  // -# 3 crear usuario tester profesor
  const emailProf = 'testerprofesores713@gmail.com';
  const hashedPasswordProf = await bcrypt.hash('pomKinGu!', 10);
  const existingProf = await prisma.user.findUnique({ where: { email: emailProf } });

  if (!existingProf) {
    await prisma.user.create({
      data: {
        email: emailProf,
        password_hash: hashedPasswordProf,
        roleId: roles['PROFESOR'].id,
        full_name: 'Profesor Tester Corvus',
      },
    });
    console.log(`✅ Usuario profesor tester creado: ${emailProf}`);
  } else {
    await prisma.user.update({
      where: { email: emailProf },
      data: {
        password_hash: hashedPasswordProf,
        roleId: roles['PROFESOR'].id,
      },
    });
    console.log(`🔄 Usuario profesor tester actualizado: ${emailProf}`);
  }

  // -# 4 crear usuario tester alumno
  const emailStudent = 'testeralumnos@gmail.com';
  const hashedPasswordStudent = await bcrypt.hash('eduSujeTester55.', 10);
  const existingStudent = await prisma.user.findUnique({ where: { email: emailStudent } });

  if (!existingStudent) {
    await prisma.user.create({
      data: {
        email: emailStudent,
        password_hash: hashedPasswordStudent,
        roleId: roles['ALUMNO'].id,
        full_name: 'Alumno Tester Corvus',
      },
    });
    console.log(`✅ Usuario alumno tester creado: ${emailStudent}`);
  } else {
    await prisma.user.update({
      where: { email: emailStudent },
      data: {
        password_hash: hashedPasswordStudent,
        roleId: roles['ALUMNO'].id,
      },
    });
    console.log(`🔄 Usuario alumno tester actualizado: ${emailStudent}`);
  }

  // -# 5 crear usuario eduartrob2gmailcom profesor
  const emailEduartProf = 'eduartrob2@gmail.com';
  const hashedPasswordEduartProf = await bcrypt.hash('profesor123.', 10);
  const existingEduartProf = await prisma.user.findUnique({ where: { email: emailEduartProf } });

  if (!existingEduartProf) {
    await prisma.user.create({
      data: {
        email: emailEduartProf,
        password_hash: hashedPasswordEduartProf,
        roleId: roles['PROFESOR'].id,
        full_name: 'Eduardo Profesor Tester',
      },
    });
    console.log(`✅ Usuario profesor creado: ${emailEduartProf}`);
  } else {
    await prisma.user.update({
      where: { email: emailEduartProf },
      data: {
        password_hash: hashedPasswordEduartProf,
        roleId: roles['PROFESOR'].id,
      },
    });
    console.log(`🔄 Usuario profesor actualizado: ${emailEduartProf}`);
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
