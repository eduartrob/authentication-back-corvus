import { Router } from 'express';
import { ProjectController } from '../controllers/project.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();
const projectController = new ProjectController();

// All project routes require authentication
router.use(authenticateJWT);

router.post('/', projectController.createProject.bind(projectController));
router.post('/join', projectController.joinProject.bind(projectController));
router.get('/my-projects', projectController.getMyProjects.bind(projectController));

export default router;
