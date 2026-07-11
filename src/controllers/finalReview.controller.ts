import { Request, Response } from 'express';
import { z } from 'zod';
import logger from '../utils/logger';
import prisma from '../utils/prisma';
import { rabbitmqService } from '../services/rabbitmq.service';

const createReviewSchema = z.object({
  team_id: z.string().uuid(),
  proposal_data: z.any()
});

const updateReviewStatusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'SUMMONED']),
  appointment_date: z.string().datetime().optional(),
  location_link: z.string().optional()
});

export class FinalReviewController {
  
  public async submitFinalReview(req: Request, res: Response): Promise<void> {
    try {
      const studentId = req.user?.userId;
      if (!studentId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const parsedData = createReviewSchema.parse(req.body);

      // Verify the student exists and is part of this team
      const student = await prisma.user.findUnique({
        where: { id: studentId }
      });

      if (!student || student.team_id !== parsedData.team_id) {
         res.status(403).json({ message: 'User does not belong to this team' });
         return;
      }

      // Check if team already has a pending review
      const existingReview = await prisma.finalReview.findFirst({
        where: { team_id: parsedData.team_id, status: 'PENDING' }
      });

      if (existingReview) {
        res.status(400).json({ message: 'El equipo ya tiene una revisión en curso.' });
        return;
      }
      
      const newReview = await prisma.finalReview.create({
        data: {
          team_id: parsedData.team_id,
          student_id: studentId,
          career_id: student.careerId!,
          university_id: student.universityId!,
          proposal_data: parsedData.proposal_data,
        }
      });

      res.status(201).json({ message: 'Revisión final enviada con éxito', review: newReview });
    } catch (error) {
      logger.error('Error submitting final review', { error });
      if (error instanceof z.ZodError) {
         res.status(400).json({ message: 'Invalid data', errors: error.errors });
         return;
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  public async getReviewsByProfessorCareer(req: Request, res: Response): Promise<void> {
    try {
      const profId = req.user?.userId;
      if (!profId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const prof = await prisma.user.findUnique({
        where: { id: profId },
        include: { role: true }
      });

      if (!prof || prof.role.name !== 'PROFESOR') {
        res.status(403).json({ message: 'Only professors can view final reviews' });
        return;
      }

      // Find final reviews matching the professor's career
      const reviews = await prisma.finalReview.findMany({
        where: { 
           career_id: prof.careerId || undefined,
           university_id: prof.universityId || undefined
        },
        orderBy: { createdAt: 'desc' }
      });

      res.status(200).json({ reviews });
    } catch (error) {
      logger.error('Error getting final reviews', { error });
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  public async updateReviewStatus(req: Request, res: Response): Promise<void> {
    try {
      const profId = req.user?.userId;
      const reviewId = req.params.id;

      if (!profId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const parsedData = updateReviewStatusSchema.parse(req.body);

      const review = await prisma.finalReview.findUnique({
        where: { id: reviewId }
      });

      if (!review) {
        res.status(404).json({ message: 'Review not found' });
        return;
      }

      const updatedReview = await prisma.finalReview.update({
        where: { id: reviewId },
        data: {
          status: parsedData.status,
          appointment_date: parsedData.appointment_date ? new Date(parsedData.appointment_date) : null,
          location_link: parsedData.location_link
        }
      });

      // Emit notification to the student (leader)
      try {
        let notifMessage = `Tu propuesta ha cambiado a estado: ${parsedData.status}`;
        if (parsedData.status === 'SUMMONED') {
           notifMessage = `Tu equipo ha sido citado a revisión el ${parsedData.appointment_date}`;
        }
        await rabbitmqService.publishNotification({
          userId: review.student_id,
          title: 'Actualización de Revisión Final',
          body: notifMessage,
          type: 'SYSTEM',
          data: { reviewId: updatedReview.id, status: parsedData.status }
        });
      } catch (qError) {
        logger.error('Failed to emit notification', { qError });
      }

      res.status(200).json({ message: 'Review status updated', review: updatedReview });
    } catch (error) {
      logger.error('Error updating review status', { error });
      if (error instanceof z.ZodError) {
         res.status(400).json({ message: 'Invalid data', errors: error.errors });
         return;
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}
