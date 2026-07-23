import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import logger from '../utils/logger';
import prisma from '../utils/prisma';

export class ProfessorController {
  public async searchProfessors(req: AuthRequest, res: Response): Promise<void> {
    try {
      const q = req.query.q as string || '';
      const currentUserId = req.user?.id;
      
      const projectId = req.query.projectId as string | undefined;

      const professors = await prisma.user.findMany({
        where: {
          role: { name: { in: ['PROFESOR', 'DOCENTE'] } },
          id: currentUserId ? { not: currentUserId } : undefined,
          project_professors: projectId ? {
            none: { projectId }
          } : undefined,
          OR: [
            { full_name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { username: { contains: q, mode: 'insensitive' } },
          ]
        },
        select: { 
          id: true, full_name: true, username: true, email: true, profile_picture: true,
          university: { select: { name: true } },
          career: { select: { name: true } }
        },
        take: 10
      });
      res.status(200).json({ results: professors });
    } catch (error) {
      logger.error('Error searching professors', { error });
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  public async getDashboardStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profId = req.user?.id;
      const projectId = req.query.projectId as string | undefined;

      if (!profId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const prof = await prisma.user.findUnique({
        where: { id: profId },
        include: { role: true }
      });

      if (!prof || !['PROFESOR', 'DOCENTE', 'ADMINISTRADOR'].includes(prof.role.name)) {
        res.status(403).json({ message: 'Only professors can view this dashboard' });
        return;
      }

      if (projectId) {
        // Validate professor has access to this project
        const projectAccess = await prisma.project.findFirst({
          where: {
            id: projectId,
            OR: [
              { creator_id: profId },
              { professors: { some: { userId: profId } } }
            ]
          }
        });
        if (!projectAccess) {
          res.status(403).json({ message: 'No tienes acceso a este proyecto' });
          return;
        }
      }

      const universityId = prof.universityId || undefined;
      const careerId = prof.careerId || undefined;

      // 1. Alumnos con equipo y sin equipo
      const studentsWithTeamCondition = projectId 
        ? { some: { team: { projectId } } } 
        : { some: {} };
        
      const studentsWithoutTeamCondition = projectId
        ? { none: { team: { projectId } } }
        : { none: {} };

      const projectStudentCondition = projectId 
        ? { some: { projectId } } 
        : undefined;

      const studentsWithTeam = await prisma.user.count({
        where: {
          role: { name: 'ALUMNO' },
          universityId,
          careerId,
          project_students: projectStudentCondition,
          team_members: studentsWithTeamCondition
        }
      });

      const studentsWithoutTeam = await prisma.user.count({
        where: {
          role: { name: 'ALUMNO' },
          universityId,
          careerId,
          project_students: projectStudentCondition,
          team_members: studentsWithoutTeamCondition
        }
      });

      // 2. Equipos formados
      const totalTeams = await prisma.team.count({
        where: {
          project: projectId ? { id: projectId } : { career_id: careerId }
        }
      });

      // 3. Propuestas listas (Total final reviews)
      // Si tenemos projectId, filtramos por project.id a través de team
      const reviewsWhere: any = {
        status: { in: ['PENDING', 'APPROVED', 'SUMMONED'] }
      };
      if (projectId) {
        reviewsWhere.team = { projectId };
      } else {
        reviewsWhere.university_id = universityId;
        reviewsWhere.career_id = careerId;
      }

      const readyProposals = await prisma.finalReview.count({
        where: reviewsWhere
      });

      // 4. Alertas (Atención Requerida)
      // Pending reviews
      const pendingWhere: any = { status: 'PENDING' };
      if (projectId) {
        pendingWhere.team = { projectId };
      } else {
        pendingWhere.university_id = universityId;
        pendingWhere.career_id = careerId;
      }

      const pendingReviews = await prisma.finalReview.findMany({
        where: pendingWhere,
        orderBy: { createdAt: 'asc' },
        take: 3
      });

      const alerts = pendingReviews.map(r => {
        const teamName = (r.proposal_data as any)?.team_info?.name || 'Equipo Desconocido';
        return {
          icon: 'info_outline',
          color: 'primary',
          text: `Nueva propuesta de ${teamName} requiere revisión.`
        };
      });

      // Rejected reviews if we need more
      if (alerts.length < 3) {
        const rejectedWhere: any = { status: 'REJECTED' };
        if (projectId) {
          rejectedWhere.team = { projectId };
        } else {
          rejectedWhere.university_id = universityId;
          rejectedWhere.career_id = careerId;
        }

        const rejectedReviews = await prisma.finalReview.findMany({
          where: rejectedWhere,
          orderBy: { updatedAt: 'desc' },
          take: 3 - alerts.length
        });

        rejectedReviews.forEach(r => {
          const teamName = (r.proposal_data as any)?.team_info?.name || 'Equipo Desconocido';
          alerts.push({
            icon: 'error_outline',
            color: 'error',
            text: `${teamName} - Propuesta rechazada, esperando correcciones.`
          });
        });
      }

      res.status(200).json({
        total_teams: totalTeams,
        ready_proposals: readyProposals,
        metrics: {
          students_with_team: studentsWithTeam,
          students_without_team: studentsWithoutTeam
        },
        alerts
      });

    } catch (error: any) {
      logger.error('Error getting professor dashboard stats', { error: error.message, stack: error.stack });
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  }

  public async getHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profId = req.user?.id;
      if (!profId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      // Only PROFESOR or DOCENTE can access
      const prof = await prisma.user.findUnique({
        where: { id: profId },
        include: { role: true }
      });

      if (!prof || !['PROFESOR', 'DOCENTE'].includes(prof.role.name)) {
        res.status(403).json({ message: 'Forbidden: Only professors can access history' });
        return;
      }

      // Fetch ActivityLog for this user
      const logs = await prisma.activityLog.findMany({
        where: { userId: profId },
        orderBy: { createdAt: 'desc' },
        take: 50 // Limit to latest 50
      });

      res.status(200).json({ history: logs });
    } catch (error) {
      logger.error('Error fetching professor history', { error });
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}
