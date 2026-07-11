import { Router } from 'express';
import { FinalReviewController } from '../controllers/finalReview.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();
const controller = new FinalReviewController();

router.post('/', authenticateJWT, controller.submitFinalReview);
router.get('/', authenticateJWT, controller.getReviewsByProfessorCareer);
router.patch('/:id/status', authenticateJWT, controller.updateReviewStatus);

export default router;
