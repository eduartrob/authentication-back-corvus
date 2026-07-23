import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { z } from 'zod';
import logger from '../utils/logger';
import prisma from '../utils/prisma';
import { rabbitmqService } from '../services/rabbitmq.service';
import axios from 'axios';

const createReviewSchema = z.object({
  team_id: z.string().uuid(),
  proposal_data: z.any()
});

const updateReviewStatusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'SUMMONED']),
  appointment_date: z.string().optional(),
  location_link: z.string().optional(),
  reason: z.string().optional()
});

const evaluateIndividualSchema = z.object({
  is_approved: z.boolean(),
  comment: z.string().optional()
});

export class FinalReviewController {
  
  public async submitFinalReview(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.user?.id;
      if (!studentId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const parsedData = createReviewSchema.parse(req.body);

      // Verify the student exists
      const student = await prisma.user.findUnique({
        where: { id: studentId }
      });

      if (!student) {
        res.status(403).json({ message: 'Student not found' });
        return;
      }

      // Check if the team already has a pending review
      const existingReview = await prisma.finalReview.findFirst({
        where: { team_id: parsedData.team_id, status: 'PENDING' }
      });

      if (existingReview) {
        res.status(400).json({ message: 'El equipo ya tiene una revisión en curso.' });
        return;
      }

      // Fetch the team to get project context
      const team = await prisma.team.findUnique({
        where: { id: parsedData.team_id }
      });
      if (!team) {
        res.status(404).json({ message: 'Team not found' });
        return;
      }

      // Build the enriched proposal_data
      const proposalDataWithMeta = {
        ...(typeof parsedData.proposal_data === 'object' ? parsedData.proposal_data : {}),
        submitted_at: new Date().toISOString(),
        submitted_by: student.full_name || student.username || studentId,
      };
      
      const newReview = await prisma.finalReview.create({
        data: {
          team_id: parsedData.team_id,
          student_id: studentId,
          career_id: student.careerId!,
          university_id: student.universityId!,
          proposal_data: proposalDataWithMeta,
        }
      });

      // Notify Clustering Service to store vectors immediately in Qdrant for plagiarism protection
      try {
        const form = new URLSearchParams();
        form.append('target_id', parsedData.team_id);
        form.append('university_id', student.universityId || 'General');
        form.append('career_id', student.careerId || 'General');
        form.append('professor_id', 'General');
        form.append('status', 'SUBMITTED');

        await axios.post(
          'http://clustering-integrator-service:3002/api/v1/register-historical-proposal',
          form.toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        logger.info(`Successfully registered historical proposal for team ${parsedData.team_id} upon submission`);
      } catch (clusterErr: any) {
        logger.error('Failed to register historical proposal in clustering service upon submission', { 
          error: clusterErr.response?.data || clusterErr.message 
        });
      }

      // Notify professors of the same career and semester
      try {
        const profRole = await prisma.role.findFirst({ where: { name: 'PROFESOR' } });
        if (profRole && student.careerId && student.semester) {
          const matchingProfs = await prisma.user.findMany({
            where: {
              roleId: profRole.id,
              careerId: student.careerId,
              universityId: student.universityId,
              semester: student.semester
            }
          });
          
          for (const prof of matchingProfs) {
            await rabbitmqService.publishPushNotification({
              userId: prof.id,
              title: 'Nueva propuesta de proyecto',
              body: `El equipo de ${student.full_name || student.username} ha enviado su propuesta final.`,
              type: 'SYSTEM',
              data: JSON.stringify({ reviewId: newReview.id, type: 'NEW_PROPOSAL' })
            } as any);
          }
        }
      } catch (qError) {
        logger.error('Failed to emit notification to professors', { qError });
      }

      res.status(201).json({ message: 'Revisión final enviada con éxito', review: newReview });
    } catch (error) {
      logger.error('Error submitting final review', { error });
      if (error instanceof z.ZodError) {
         res.status(400).json({ message: 'Invalid data', errors: (error as any).errors });
         return;
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  public async getReviewByMyTeam(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.user?.id;
      if (!studentId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const teamId = req.params.teamId as string;
      if (!teamId) {
        res.status(400).json({ message: 'Se requiere teamId' });
        return;
      }

      // Fetch the latest review for this team
      const review = await prisma.finalReview.findFirst({
        where: { team_id: teamId },
        orderBy: { createdAt: 'desc' }
      });

      if (!review) {
        res.status(404).json({ message: 'No hay propuesta enviada para este equipo.' });
        return;
      }

      res.status(200).json({ review });
    } catch (error) {
      logger.error('Error fetching team review', { error });
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  public async getReviewsByProfessorCareer(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profId = req.user?.id;
      if (!profId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const projectId = req.query.projectId as string | undefined;

      const prof = await prisma.user.findUnique({
        where: { id: profId },
        include: { role: true }
      });

      if (!prof || !['PROFESOR', 'DOCENTE', 'ADMINISTRADOR'].includes(prof.role.name)) {
        res.status(403).json({ message: 'Only professors can view final reviews' });
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

      // Find final reviews matching the project or the professor's career
      const whereCondition: any = {};
      
      if (projectId) {
         whereCondition.team = { projectId };
      } else {
         whereCondition.career_id = prof.careerId || undefined;
         whereCondition.university_id = prof.universityId || undefined;
      }

      const reviews = await prisma.finalReview.findMany({
        where: whereCondition,
        orderBy: { createdAt: 'desc' },
        include: { team: true }
      });

      let finalReviews = reviews;

      if (!projectId && prof.semester) {
        // Only apply semester filtering if we are doing the global career fetch
        const studentIds = [...new Set(reviews.map(r => r.student_id))];
        const students = await prisma.user.findMany({
          where: { id: { in: studentIds } },
          select: { id: true, semester: true }
        });
        
        const studentSemesterMap = new Map(students.map(s => [s.id, s.semester]));
        
        finalReviews = reviews.filter(r => {
          const sSemester = studentSemesterMap.get(r.student_id);
          return sSemester === prof.semester;
        });
      }

      res.status(200).json({ reviews: finalReviews });
    } catch (error) {
      logger.error('Error getting final reviews', { error });
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  public async updateReviewStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profId = req.user?.id;
      const reviewId = req.params.id as string;

      if (!profId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const parsedData = updateReviewStatusSchema.parse(req.body);

      const review = await prisma.finalReview.findUnique({
        where: { id: reviewId },
        include: { team: true }
      });

      if (!review || !review.team) {
        res.status(404).json({ message: 'Review not found' });
        return;
      }

      const projectId = review.team.projectId;
      
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
        res.status(403).json({ message: 'You are not a collaborator on this project' });
        return;
      }

      // If SUMMONED, preserve previous status in proposal_data
      let proposalDataUpdate: Record<string, any> | undefined;
      if (parsedData.status === 'SUMMONED') {
        const existingProposalData = typeof review.proposal_data === 'object' && review.proposal_data !== null
          ? { ...review.proposal_data as Record<string, any> }
          : {};
        existingProposalData['previous_status'] = review.status;
        proposalDataUpdate = existingProposalData;
      }

      const updatedReview = await prisma.finalReview.update({
        where: { id: reviewId },
        data: {
          status: parsedData.status,
          appointment_date: parsedData.appointment_date ? new Date(parsedData.appointment_date) : null,
          location_link: parsedData.location_link as string | undefined,
          ...(proposalDataUpdate ? { proposal_data: proposalDataUpdate } : {})
        }
      });

      // Log the action to ActivityLog
      try {
        let actionStr = 'EVALUATE_PROPOSAL';
        let detailStr = `Cambió el estado a ${parsedData.status}.`;
        if (parsedData.reason) {
           detailStr += ` Motivo: ${parsedData.reason}`;
        }
        await prisma.activityLog.create({
           data: {
             userId: profId,
             action: actionStr,
             detail: detailStr,
             ipAddress: req.ip || '0.0.0.0'
           }
        });
      } catch (err) {
        logger.error('Failed to log ActivityLog for review', { err });
      }

      // (El almacenamiento de Qdrant ahora ocurre al enviar la propuesta, no aquí)

      // Emit notification to the student (leader)
      try {
        let notifMessage = `Tu propuesta ha cambiado a estado: ${parsedData.status}`;
        if (parsedData.status === 'SUMMONED') {
           notifMessage = `Tu equipo ha sido citado a revisión el ${parsedData.appointment_date}`;
        }
        await rabbitmqService.publishPushNotification({
          userId: review.student_id,
          title: 'Actualización de Revisión Final',
          body: notifMessage,
          type: 'SYSTEM',
          data: JSON.stringify({ reviewId: updatedReview.id, status: parsedData.status })
        } as any);
      } catch (qError) {
        logger.error('Failed to emit notification', { qError });
      }

      res.status(200).json({ message: 'Review status updated', review: updatedReview });
    } catch (error) {
      logger.error('Error updating review status', { error });
      if (error instanceof z.ZodError) {
         res.status(400).json({ message: 'Invalid data', errors: (error as any).errors });
         return;
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  public async addProfessorEvaluation(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profId = req.user?.id;
      const reviewId = req.params.id as string;

      if (!profId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const parsedData = evaluateIndividualSchema.parse(req.body);
      const evalStatus = parsedData.is_approved ? 'APPROVED' : 'REJECTED';

      const review = await prisma.finalReview.findUnique({
        where: { id: reviewId },
        include: { team: true }
      });

      if (!review || !review.team) {
        res.status(404).json({ message: 'Review not found' });
        return;
      }

      const projectId = review.team.projectId;
      
      // Verify if the professor belongs to the project
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
        res.status(403).json({ message: 'You are not a collaborator on this project' });
        return;
      }

      const currentComments: any[] = Array.isArray(review.professor_comments) 
                                      ? review.professor_comments 
                                      : [];

      // Update or add the professor's evaluation
      const existingIdx = currentComments.findIndex(c => c.professorId === profId);
      if (existingIdx >= 0) {
        currentComments[existingIdx] = { professorId: profId, status: evalStatus, comment: parsedData.comment, timestamp: new Date().toISOString() };
      } else {
        currentComments.push({ professorId: profId, status: evalStatus, comment: parsedData.comment, timestamp: new Date().toISOString() });
      }

      // Logic to auto-update overall status
      const allProjectProfs = await prisma.projectProfessor.count({
        where: { projectId }
      });

      const approvedCount = currentComments.filter(c => c.status === 'APPROVED').length;
      const rejectedCount = currentComments.filter(c => c.status === 'REJECTED').length;

      let newOverallStatus = review.status;
      if (rejectedCount > 0) {
        newOverallStatus = 'REJECTED';
      } else if (approvedCount > 0) {
        newOverallStatus = 'APPROVED';
      }

      const updatedReview = await prisma.finalReview.update({
        where: { id: reviewId },
        data: {
          professor_comments: currentComments,
          status: newOverallStatus
        }
      });

      res.status(200).json({ message: 'Evaluación individual guardada', review: updatedReview });
    } catch (error) {
      logger.error('Error in addProfessorEvaluation', { error });
      if (error instanceof z.ZodError) {
         res.status(400).json({ message: 'Invalid data', errors: (error as any).errors });
         return;
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}
