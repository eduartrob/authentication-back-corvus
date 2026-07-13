import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import logger from '../utils/logger';
import prisma from '../utils/prisma';

export class ProfessorController {
  public async getDashboardStats(req: AuthRequest, res: Response): Promise<void> {
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

      if (!prof || prof.role.name !== 'PROFESOR') {
        res.status(403).json({ message: 'Only professors can view this dashboard' });
        return;
      }

      const universityId = prof.universityId || undefined;
      const careerId = prof.careerId || undefined;

      // 1. Alumnos con equipo y sin equipo
      const studentsWithTeam = await prisma.user.count({
        where: {
          role: { name: 'ALUMNO' },
          universityId,
          careerId,
          team_id: { not: null }
        }
      });

      const studentsWithoutTeam = await prisma.user.count({
        where: {
          role: { name: 'ALUMNO' },
          universityId,
          careerId,
          team_id: null
        }
      });

      // 2. Equipos formados (distinct team_id from students)
      const distinctTeams = await prisma.user.findMany({
        where: {
          role: { name: 'ALUMNO' },
          universityId,
          careerId,
          team_id: { not: null }
        },
        select: { team_id: true },
        distinct: ['team_id']
      });
      const totalTeams = distinctTeams.length;

      // 3. Propuestas listas (Total final reviews)
      const readyProposals = await prisma.finalReview.count({
        where: {
          university_id: universityId,
          career_id: careerId,
          status: { in: ['PENDING', 'APPROVED', 'SUMMONED'] }
        }
      });

      // 4. Alertas (Atención Requerida)
      // Pending reviews
      const pendingReviews = await prisma.finalReview.findMany({
        where: {
          university_id: universityId,
          career_id: careerId,
          status: 'PENDING'
        },
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
        const rejectedReviews = await prisma.finalReview.findMany({
          where: {
            university_id: universityId,
            career_id: careerId,
            status: 'REJECTED'
          },
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

    } catch (error) {
      logger.error('Error getting professor dashboard stats', { error });
      res.status(500).json({ message: 'Internal server error' });
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
