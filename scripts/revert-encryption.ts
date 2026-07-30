import prisma from '../src/utils/prisma';
import { decryptField } from '../src/utils/encryption.util';

async function main() {
  console.log('Iniciando reversión de encriptación general...');
  
  // 1. Users
  const users = await prisma.user.findMany({ where: { full_name: { not: null } } });
  let userCount = 0;
  for (const user of users) {
    if (user.full_name) {
      const decrypted = decryptField(user.full_name);
      if (decrypted && decrypted !== user.full_name) {
        await prisma.user.update({ where: { id: user.id }, data: { full_name: decrypted } });
        userCount++;
      }
    }
  }
  console.log(`Desencriptados ${userCount} usuarios.`);

  // 2. Teams
  const teams = await prisma.team.findMany({ where: { name: { not: null } } });
  let teamCount = 0;
  for (const team of teams) {
    if (team.name) {
      const decrypted = decryptField(team.name);
      if (decrypted && decrypted !== team.name) {
        await prisma.team.update({ where: { id: team.id }, data: { name: decrypted } });
        teamCount++;
      }
    }
  }
  console.log(`Desencriptados ${teamCount} equipos.`);

  // 3. Projects
  const projects = await prisma.project.findMany();
  let projCount = 0;
  for (const proj of projects) {
    let updated = false;
    let newName = proj.name;
    let newDesc = proj.description;

    const decName = decryptField(proj.name);
    if (decName && decName !== proj.name) {
      newName = decName;
      updated = true;
    }

    if (proj.description) {
      const decDesc = decryptField(proj.description);
      if (decDesc && decDesc !== proj.description) {
        newDesc = decDesc;
        updated = true;
      }
    }

    if (updated) {
      await prisma.project.update({ where: { id: proj.id }, data: { name: newName, description: newDesc } });
      projCount++;
    }
  }
  console.log(`Desencriptados ${projCount} proyectos.`);
}

main().catch(console.error).finally(async () => { await prisma.$disconnect(); });
