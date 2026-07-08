import prisma from './src/utils/prisma';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log("Starting DB Seeding...");
  
  const dataPath = path.join(__dirname, 'seed_data.json');
  const rawData = fs.readFileSync(dataPath, 'utf8');
  const catalog = JSON.parse(rawData);
  
  for (const uniData of catalog) {
    // 1. Upsert University
    let uni = await prisma.university.findUnique({
      where: { name: uniData.name }
    });
    
    if (!uni) {
      uni = await prisma.university.create({
        data: {
          name: uniData.name,
          acronym: uniData.acronym,
        }
      });
      console.log(`Created University: ${uni.name}`);
    }

    // 2. Add Careers and link them
    for (const careerName of uniData.careers) {
      let career = await prisma.career.findUnique({
        where: { name: careerName }
      });
      
      if (!career) {
        career = await prisma.career.create({
          data: {
            name: careerName,
            normalized_name: careerName.toLowerCase()
          }
        });
        console.log(`Created Career: ${career.name}`);
      }

      // Link them in UniversityCareer table
      const linkExists = await prisma.universityCareer.findUnique({
        where: {
          universityId_careerId: {
            universityId: uni.id,
            careerId: career.id
          }
        }
      });

      if (!linkExists) {
        await prisma.universityCareer.create({
          data: {
            universityId: uni.id,
            careerId: career.id
          }
        });
        console.log(`Linked ${career.name} to ${uni.name}`);
      }
    }
  }

  console.log("Seeding complete!");
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
