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

const addCollaboratorSchema = z.object({
  email: z.string().email()
});

const updateProjectSchema = z.object({
  name: z.string().min(1, 'El nombre no puede estar vacío').optional()
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
        res.status(404).json({ message: 'Usuario no encontrado' });
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

      if (['PROFESOR', 'DOCENTE', 'ADMINISTRADOR'].includes(user.role.name)) {
        const existingCollab = await prisma.projectProfessor.findFirst({
          where: { projectId: project.id, userId: userId }
        });
        if (existingCollab || project.creator_id === userId) {
           res.status(400).json({ message: 'Ya eres colaborador en este proyecto.' });
           return;
        }
        await prisma.projectProfessor.create({
          data: { projectId: project.id, userId: userId, isAccepted: true }
        });
        res.status(200).json({ message: 'Te has unido al proyecto como colaborador.', project, isProfessor: true });
      } else {
        const existingStudent = await prisma.projectStudent.findUnique({
          where: {
            projectId_userId: {
              projectId: project.id,
              userId: userId
            }
          }
        });

        if (existingStudent) {
          res.status(400).json({ message: 'Ya te has unido a esta clase.' });
          return;
        }

        await prisma.projectStudent.create({
          data: {
            projectId: project.id,
            userId: userId
          }
        });

        res.status(200).json({ message: 'Código válido. Te has unido a la clase exitosamente.', project, isProfessor: false });
      }
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
        // Find projects where the student has joined (ProjectStudent)
        const projectStudents = await prisma.projectStudent.findMany({
          where: { userId },
          include: { project: true }
        });

        // Also fetch team memberships to attach my_team if it exists
        const teamMemberships = await prisma.teamMember.findMany({
          where: { userId },
          include: { team: true }
        });

        const projects = projectStudents.map(ps => {
          const teamMembership = teamMemberships.find(tm => tm.team.projectId === ps.projectId);
          return {
            ...ps.project,
            my_team: teamMembership ? teamMembership.team : null
          };
        });

        res.status(200).json({ projects });
      } else {
        // Professor: Find projects they created or collaborate on
        const collaborations = await prisma.projectProfessor.findMany({
          where: { userId },
          include: {
            project: {
              include: {
                creator: {
                  select: {
                    full_name: true,
                  }
                }
              }
            }
          }
        });

        const activeCollaborations = collaborations.filter(c => c.isAccepted);
        const invitations = collaborations.filter(c => !c.isAccepted);

        // Include projects where the user is the creator
        const createdProjects = await prisma.project.findMany({
          where: { creator_id: userId }
        });

        // The user might be a creator, in which case we just send created projects + active collaborations
        // Wait, the original code just mapped collaborations. Let's merge them properly.
        // But if creator is not in ProjectProfessor, we should include it.
        const projectsSet = new Map();
        createdProjects.forEach(p => projectsSet.set(p.id, p));
        activeCollaborations.forEach(c => projectsSet.set(c.project.id, c.project));

        const projects = Array.from(projectsSet.values());
        const pendingInvitations = invitations
          .map(c => c.project)
          .filter(p => p.creator_id !== userId); // Prevent own projects showing as invitations

        res.status(200).json({ projects, invitations: pendingInvitations });
      }

    } catch (error) {
      logger.error('Error getting projects', { error });
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  public async getCollaborators(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profId = req.user?.id;
      const projectId = req.params.id;

      if (!profId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const hasAccess = await prisma.projectProfessor.findFirst({
        where: { projectId: projectId as string, userId: profId }
      });

      if (!hasAccess) {
        const isCreator = await prisma.project.findFirst({
          where: { id: projectId as string, creator_id: profId }
        });
        if (!isCreator) {
          res.status(403).json({ message: 'No tienes acceso a este proyecto' });
          return;
        }
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId as string },
        include: {
          creator: {
            select: {
              id: true,
              full_name: true,
              username: true,
              email: true,
              profile_picture: true
            }
          }
        }
      });

      const memberships = await prisma.projectProfessor.findMany({
        where: { projectId: projectId as string },
        include: {
          user: {
            select: {
              id: true,
              full_name: true,
              username: true,
              email: true,
              profile_picture: true
            }
          }
        }
      });

      const allCollaborators = memberships.filter(m => m.isAccepted).map(c => c.user);
      const pendingInvitations = memberships.filter(m => !m.isAccepted).map(c => c.user);

      if (project?.creator && !allCollaborators.find(c => c.id === project.creator.id)) {
        allCollaborators.unshift({ ...project.creator, isCreator: true } as any);
      }

      res.status(200).json({ collaborators: allCollaborators, pending: pendingInvitations });
    } catch (error) {
      logger.error('Error fetching collaborators', { error });
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  public async addCollaborator(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profId = req.user?.id;
      const projectId = req.params.id;

      if (!profId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const parsedData = addCollaboratorSchema.parse(req.body);

      // Verify the requester is the creator or a collaborator
      const hasAccess = await prisma.projectProfessor.findFirst({
        where: { projectId: projectId as string, userId: profId }
      });

      if (!hasAccess) {
        const isCreator = await prisma.project.findFirst({
          where: { id: projectId as string, creator_id: profId }
        });
        if (!isCreator) {
          res.status(403).json({ message: 'No tienes permisos para invitar colaboradores.' });
          return;
        }
      }

      // Find the user to invite
      const invitee = await prisma.user.findUnique({
        where: { email: parsedData.email },
        include: { role: true }
      });

      if (!invitee) {
        res.status(404).json({ message: 'Usuario no encontrado con ese correo.' });
        return;
      }

      if (!['PROFESOR', 'DOCENTE', 'ADMINISTRADOR'].includes(invitee.role.name)) {
        res.status(400).json({ message: 'Solo puedes invitar a otros profesores o docentes.' });
        return;
      }

      if (invitee.id === profId) {
        res.status(400).json({ message: 'No puedes invitarte a ti mismo al proyecto.' });
        return;
      }

      // Check if already a collaborator
      const alreadyCollaborator = await prisma.projectProfessor.findFirst({
        where: { projectId: projectId as string, userId: invitee.id }
      });

      if (alreadyCollaborator) {
        res.status(400).json({ message: 'Este profesor ya es colaborador del proyecto.' });
        return;
      }

      const newCollaborator = await prisma.projectProfessor.create({
        data: {
          projectId: projectId as string,
          userId: invitee.id,
          isAccepted: false
        }
      });

      res.status(201).json({ message: 'Invitación enviada exitosamente.', collaborator: newCollaborator });
    } catch (error) {
      logger.error('Error adding collaborator', { error });
      if (error instanceof z.ZodError) {
         res.status(400).json({ message: 'Invalid data', errors: (error as any).errors });
         return;
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  public async updateProject(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profId = req.user?.id;
      const projectId = req.params.id;

      if (!profId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const parsedData = updateProjectSchema.parse(req.body);

      // Verify the requester is the creator or a collaborator
      const hasAccess = await prisma.projectProfessor.findFirst({
        where: { projectId: projectId as string, userId: profId }
      });

      if (!hasAccess) {
        const isCreator = await prisma.project.findFirst({
          where: { id: projectId as string, creator_id: profId }
        });
        if (!isCreator) {
          res.status(403).json({ message: 'No tienes permisos para modificar este proyecto.' });
          return;
        }
      }

      const updatedProject = await prisma.project.update({
        where: { id: projectId as string },
        data: {
          name: parsedData.name
        }
      });

      res.status(200).json({ message: 'Proyecto actualizado.', project: updatedProject });
    } catch (error) {
      logger.error('Error updating project', { error });
      if (error instanceof z.ZodError) {
         res.status(400).json({ message: 'Invalid data', errors: (error as any).errors });
         return;
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  public async getProjectStudents(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profId = req.user?.id;
      const projectId = req.params.id;

      if (!profId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      // Verify access
      const hasAccess = await prisma.projectProfessor.findFirst({
        where: { projectId: projectId as string, userId: profId }
      });
      const isCreator = await prisma.project.findFirst({
        where: { id: projectId as string, creator_id: profId }
      });

      if (!hasAccess && !isCreator) {
        res.status(403).json({ message: 'No tienes permisos para ver este proyecto.' });
        return;
      }

      // Find all team members in teams belonging to this project
      const teamMembers = await prisma.teamMember.findMany({
        where: {
          team: {
            projectId: projectId as string
          }
        },
        include: {
          user: {
            select: {
              id: true,
              full_name: true,
              username: true,
              email: true,
              profile_picture: true,
              bio: true
            }
          }
        }
      });
      const students = teamMembers.map(tm => tm.user);
      res.status(200).json({ students });
    } catch (error) {
      logger.error('Error fetching project students', { error });
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  public async acceptInvitation(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profId = req.user?.id;
      const projectId = req.params.id;
      
      if (!profId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const invitation = await prisma.projectProfessor.findFirst({
        where: { projectId: projectId as string, userId: profId, isAccepted: false }
      });

      if (!invitation) {
        res.status(404).json({ message: 'No tienes una invitación pendiente para este proyecto.' });
        return;
      }

      await prisma.projectProfessor.update({
        where: { projectId_userId: { projectId: projectId as string, userId: profId } },
        data: { isAccepted: true }
      });

      res.status(200).json({ message: 'Invitación aceptada.' });
    } catch (error) {
      logger.error('Error accepting invitation', { error });
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  public async rejectInvitation(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profId = req.user?.id;
      const projectId = req.params.id;
      
      if (!profId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      await prisma.projectProfessor.delete({
        where: { projectId_userId: { projectId: projectId as string, userId: profId } }
      });

      res.status(200).json({ message: 'Invitación eliminada.' });
    } catch (error) {
      logger.error('Error rejecting invitation', { error });
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  public async removeCollaborator(req: AuthRequest, res: Response): Promise<void> {
    try {
      const requesterId = req.user?.id;
      const projectId = req.params.id;
      const targetUserId = req.body.userId;
      
      if (!requesterId || !targetUserId) {
        res.status(400).json({ message: 'Missing parameters' });
        return;
      }

      // Allow removal if requester is the creator OR if requester is removing themselves
      const isCreator = await prisma.project.findFirst({
        where: { id: projectId as string, creator_id: requesterId }
      });

      if (!isCreator && requesterId !== targetUserId) {
        res.status(403).json({ message: 'No tienes permisos para eliminar a este colaborador.' });
        return;
      }

      await prisma.projectProfessor.delete({
        where: { projectId_userId: { projectId: projectId as string, userId: targetUserId } }
      });

      res.status(200).json({ message: 'Colaborador/invitación eliminado.' });
    } catch (error) {
      logger.error('Error removing collaborator', { error });
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}
