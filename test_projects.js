const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { role: { name: 'PROFESOR' } } });
  if (!user) {
    console.log("No prof"); return;
  }
  const userId = user.id;
  try {
    const collaborations = await prisma.projectProfessor.findMany({
      where: { userId },
      include: {
        project: {
          include: {
            creator: {
              select: { full_name: true }
            }
          }
        }
      }
    });

    const activeCollaborations = collaborations.filter(c => c.isAccepted);
    const invitations = collaborations.filter(c => !c.isAccepted);

    const createdProjects = await prisma.project.findMany({
      where: { creator_id: userId }
    });

    const projectsSet = new Map();
    createdProjects.forEach(p => projectsSet.set(p.id, p));
    activeCollaborations.forEach(c => projectsSet.set(c.project.id, c.project));

    const projects = Array.from(projectsSet.values());
    console.log("Success! Projects:", projects.length);
  } catch (error) {
    console.error("Error:", error);
  }
}
main();
