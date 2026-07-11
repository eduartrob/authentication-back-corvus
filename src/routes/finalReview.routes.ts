import { Router } from 'express';
import { FinalReviewController } from '../controllers/finalReview.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();
const controller = new FinalReviewController();

router.post('/', authenticate, controller.submitFinalReview);
router.get('/', authenticate, authorize('PROFESOR', 'ADMINISTRADOR'), controller.getReviewsByProfessorCareer);
router.patch('/:id/status', authenticate, authorize('PROFESOR', 'ADMINISTRADOR'), controller.updateReviewStatus);

export default router;
