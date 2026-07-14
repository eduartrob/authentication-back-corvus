import { Router } from 'express';
import { FinalReviewController } from '../controllers/finalReview.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();
const controller = new FinalReviewController();

router.post('/', authenticateJWT, controller.submitFinalReview);
router.get('/', authenticateJWT, controller.getReviewsByProfessorCareer);
router.get('/team/:teamId', authenticateJWT, controller.getReviewByMyTeam);
router.patch('/:id/status', authenticateJWT, controller.updateReviewStatus);
router.post('/:id/evaluate', authenticateJWT, controller.addProfessorEvaluation);

export default router;
