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
  const emailProf = 'thegreatteachertester@gmail.com';
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

  // -# 6 crear usuario sujey admin
  const emailSujey = 'calderonmartinezsujey@gmail.com';
  const hashedPasswordSujey = await bcrypt.hash('chaDaTijeras5!', 10);
  const existingSujey = await prisma.user.findUnique({ where: { email: emailSujey } });

  if (!existingSujey) {
    await prisma.user.create({
      data: {
        email: emailSujey,
        password_hash: hashedPasswordSujey,
        roleId: roles['ADMINISTRADOR'].id,
        full_name: 'Sujey Administradora',
      },
    });
    console.log(`✅ Usuario admin creado: ${emailSujey}`);
  } else {
    await prisma.user.update({
      where: { email: emailSujey },
      data: {
        password_hash: hashedPasswordSujey,
        roleId: roles['ADMINISTRADOR'].id,
      },
    });
    console.log(`🔄 Usuario admin actualizado: ${emailSujey}`);
  }

  // -# 7 crear usuario reyguz admin
  const emailRey = 'reyguz421@gmail.com';
  const hashedPasswordRey = await bcrypt.hash('papaJupiter', 10);
  const existingRey = await prisma.user.findUnique({ where: { email: emailRey } });

  if (!existingRey) {
    await prisma.user.create({
      data: {
        email: emailRey,
        password_hash: hashedPasswordRey,
        roleId: roles['ADMINISTRADOR'].id,
        full_name: 'Rey Administrador',
      },
    });
    console.log(`✅ Usuario admin creado: ${emailRey}`);
  } else {
    await prisma.user.update({
      where: { email: emailRey },
      data: {
        password_hash: hashedPasswordRey,
        roleId: roles['ADMINISTRADOR'].id,
      },
    });
    console.log(`🔄 Usuario admin actualizado: ${emailRey}`);
  }

  // -# 8 crear universidades y carreras de prueba
  console.log('Creando universidades y carreras de prueba...');
  const uni = await prisma.university.upsert({
    where: { name: 'Universidad Politécnica' },
    update: {},
    create: {
      name: 'Universidad Politécnica',
      acronym: 'UP',
      registrationCode: '51B5I6',
    },
  });
  console.log(`✅ Universidad de prueba creada: ${uni.name} con código ${uni.registrationCode}`);

  const careersData = [
    { name: 'Ingeniería en Software', normalized: 'ingenieria_en_software' },
    { name: 'Ingeniería Industrial', normalized: 'ingenieria_industrial' },
    { name: 'Licenciatura en Administración', normalized: 'licenciatura_en_administracion' }
  ];

  for (const c of careersData) {
    let career = await prisma.career.upsert({
      where: { name: c.name },
      update: {},
      create: {
        name: c.name,
        normalized_name: c.normalized,
      }
    });
    
    // Relacionar carrera con la universidad si no existe
    const existsRelation = await prisma.universityCareer.findUnique({
      where: {
        universityId_careerId: {
          universityId: uni.id,
          careerId: career.id
        }
      }
    });

    if (!existsRelation) {
      await prisma.universityCareer.create({
        data: {
          universityId: uni.id,
          careerId: career.id
        }
      });
    }
  }
  console.log('✅ Carreras de prueba creadas y vinculadas.');

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
