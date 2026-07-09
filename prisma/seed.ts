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

  // -# 8 Seeding Universidades y Carreras desde RENOES
  console.log('🏫 Iniciando seeding de universidades y carreras...');

  console.log('🧹 Limpiando universidades y carreras antiguas...');
  await prisma.user.updateMany({
    data: {
      universityId: null,
      careerId: null
    }
  });
  await prisma.universityCareer.deleteMany({});
  await prisma.university.deleteMany({});
  await prisma.career.deleteMany({});
  console.log('✅ Tablas limpiadas.');
  const fs = require('fs');
  const path = require('path');
  const renoesPath = path.join(__dirname, 'renoes_universities_careers.json');
  let renoesData = [];
  try {
    const rawData = fs.readFileSync(renoesPath, 'utf-8');
    renoesData = JSON.parse(rawData);
  } catch (err) {
    console.log('No se pudo leer renoes_universities_careers.json. Se usará vacío.', err);
  }

  // Helper to normalize strings
  const normalizeString = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  let insertedUnis = 0;
  let insertedCareers = 0;
  let insertedRelations = 0;

  for (const uniData of renoesData) {
    const uniName = uniData.name;
    const careers = uniData.careers || [];

    // Find or create University
    let university = await prisma.university.findUnique({ where: { name: uniName } });
    if (!university) {
      university = await prisma.university.create({
        data: { name: uniName },
      });
      insertedUnis++;
    }

    // Process Careers
    for (const careerName of careers) {
      const normalizedName = normalizeString(careerName);
      
      // Find or create Career
      let career = await prisma.career.findUnique({ where: { normalized_name: normalizedName } });
      if (!career) {
        career = await prisma.career.create({
          data: { 
            name: careerName,
            normalized_name: normalizedName
          },
        });
        insertedCareers++;
      }

      // Link them in UniversityCareer
      const existingRelation = await prisma.universityCareer.findUnique({
        where: {
          universityId_careerId: {
            universityId: university.id,
            careerId: career.id
          }
        }
      });

      if (!existingRelation) {
        await prisma.universityCareer.create({
          data: {
            universityId: university.id,
            careerId: career.id
          }
        });
        insertedRelations++;
      }
    }
  }

  // Agregamos a UPChiapas manualmente si no tiene Ingeniería en Desarrollo de Software
  const upChiapas = await prisma.university.findUnique({ where: { name: 'UNIVERSIDAD POLITÉCNICA DE CHIAPAS' } });
  if (upChiapas) {
      const iswName = 'INGENIERÍA EN DESARROLLO DE SOFTWARE';
      const iswNormalized = normalizeString(iswName);
      let iswCareer = await prisma.career.findUnique({ where: { normalized_name: iswNormalized } });
      if (!iswCareer) {
          iswCareer = await prisma.career.create({ data: { name: iswName, normalized_name: iswNormalized } });
      }
      const existingRel = await prisma.universityCareer.findUnique({ where: { universityId_careerId: { universityId: upChiapas.id, careerId: iswCareer.id } } });
      if (!existingRel) {
          await prisma.universityCareer.create({ data: { universityId: upChiapas.id, careerId: iswCareer.id } });
      }
  }

  console.log(`✅ ${insertedUnis} universidades agregadas o verificadas.`);
  console.log(`✅ ${insertedCareers} carreras nuevas agregadas.`);
  console.log(`✅ ${insertedRelations} relaciones universidad-carrera creadas.`);

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
