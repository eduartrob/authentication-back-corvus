import { Router } from 'express';
import { ProfessorController } from '../controllers/professor.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();
const controller = new ProfessorController();

router.get('/search', authenticateJWT, controller.searchProfessors.bind(controller));
router.get('/dashboard', authenticateJWT, controller.getDashboardStats.bind(controller));
router.get('/history', authenticateJWT, controller.getHistory.bind(controller));

export default router;
