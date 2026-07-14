import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { z } from 'zod';
import logger from '../utils/logger';
import prisma from '../utils/prisma';
import crypto from 'crypto';

const createProjectSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  team_size: z.number().int().min(1).max(10).default(4),
  career_id: z.string().uuid().optional(),
  semester: z.string().optional()
});

const joinProjectSchema = z.object({
  code: z.string().trim()
});

export class ProjectController {
  
  // Genera un código aleatorio alfanumérico (ej: X7A-9BK)
  private generateProjectCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${code.slice(0,3)}-${code.slice(3,6)}`;
  }

  public async createProject(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profId = req.user?.id;
      if (!profId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const prof = await prisma.user.findUnique({
        where: { id: profId },
        include: { role: true }
      });

      if (!prof || !['PROFESOR', 'DOCENTE', 'ADMINISTRADOR'].includes(prof.role.name)) {
        res.status(403).json({ message: 'Only professors can create projects' });
        return;
      }

      const parsedData = createProjectSchema.parse(req.body);
      const code = this.generateProjectCode();

      const newProject = await prisma.project.create({
        data: {
          name: parsedData.name,
          description: parsedData.description,
          code,
          team_size: parsedData.team_size,
          career_id: parsedData.career_id || prof.careerId,
          semester: parsedData.semester || prof.semester,
          creator_id: profId
        }
      });

      // Añadirse a sí mismo como profesor colaborador automáticamente
      await prisma.projectProfessor.create({
        data: {
          projectId: newProject.id,
          userId: profId
        }
      });

      res.status(201).json({ message: 'Project created successfully', project: newProject });
    } catch (error) {
      logger.error('Error creating project', { error });
      if (error instanceof z.ZodError) {
         res.status(400).json({ message: 'Invalid data', errors: (error as any).errors });
         return;
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  public async joinProject(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.user?.id;
      if (!studentId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const parsedData = joinProjectSchema.parse(req.body);

      const project = await prisma.project.findUnique({
        where: { code: parsedData.code }
      });

      if (!project) {
        res.status(404).json({ message: 'El código del proyecto es inválido o no existe.' });
        return;
      }

      // Check if student is already in a team for THIS project
      const existingTeamMember = await prisma.teamMember.findFirst({
        where: {
          userId: studentId,
          team: {
            projectId: project.id
          }
        }
      });

      if (existingTeamMember) {
        res.status(400).json({ message: 'Ya perteneces a un equipo en este proyecto.' });
        return;
      }

      res.status(200).json({ message: 'Código válido. Puedes unirte o crear un equipo.', project });
    } catch (error) {
      logger.error('Error joining project', { error });
      if (error instanceof z.ZodError) {
         res.status(400).json({ message: 'Invalid data', errors: (error as any).errors });
         return;
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  public async getMyProjects(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true }
      });

      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      }

      if (user.role.name === 'ALUMNO') {
        // Find projects where the student is in a team
        const teamMemberships = await prisma.teamMember.findMany({
          where: { userId },
          include: { team: { include: { project: true } } }
        });
        
        const projects = teamMemberships.map(tm => ({
          ...tm.team.project,
          my_team: tm.team
        }));
        
        res.status(200).json({ projects });
      } else {
        // Professor: Find projects they created or collaborate on
        const collaborations = await prisma.projectProfessor.findMany({
          where: { userId },
          include: { project: true }
        });

        const projects = collaborations.map(c => c.project);
        res.status(200).json({ projects });
      }

    } catch (error) {
      logger.error('Error getting projects', { error });
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}
