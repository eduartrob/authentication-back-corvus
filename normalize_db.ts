import prisma from './src/utils/prisma';
import { normalizeUniversity, normalizeCareer } from './src/utils/normalizer';

async function main() {
  console.log("Starting DB Normalization...");
  
  // Normalize Universities
  const universities = await prisma.university.findMany();
  const uniGroups: Record<string, typeof universities> = {};
  
  for (const uni of universities) {
    const norm = normalizeUniversity(uni.name);
    if (!uniGroups[norm]) uniGroups[norm] = [];
    uniGroups[norm].push(uni);
  }
  
  for (const [normName, items] of Object.entries(uniGroups)) {
    if (items.length > 1) {
      console.log(`Grouping universities into '${normName}':`, items.map(i => i.name));
      const canonical = items[0];
      
      // Update canonical name
      await prisma.university.update({
        where: { id: canonical.id },
        data: { name: normName }
      });
      
      for (let i = 1; i < items.length; i++) {
        const duplicate = items[i];
        await prisma.user.updateMany({
          where: { universityId: duplicate.id },
          data: { universityId: canonical.id }
        });
        await prisma.university.delete({
          where: { id: duplicate.id }
        });
      }
    }
  }

  // Normalize Careers
  const careers = await prisma.career.findMany();
  const careerGroups: Record<string, typeof careers> = {};
  
  for (const car of careers) {
    const norm = normalizeCareer(car.name);
    if (!careerGroups[norm]) careerGroups[norm] = [];
    careerGroups[norm].push(car);
  }
  
  for (const [normName, items] of Object.entries(careerGroups)) {
    if (items.length > 1) {
      console.log(`Grouping careers into '${normName}':`, items.map(i => i.name));
      const canonical = items[0];
      
      await prisma.career.update({
        where: { id: canonical.id },
        data: { name: normName, normalized_name: normName.toLowerCase() }
      });
      
      for (let i = 1; i < items.length; i++) {
        const duplicate = items[i];
        await prisma.user.updateMany({
          where: { careerId: duplicate.id },
          data: { careerId: canonical.id }
        });
        await prisma.career.delete({
          where: { id: duplicate.id }
        });
      }
    }
  }
  
  console.log("Normalization complete!");
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
