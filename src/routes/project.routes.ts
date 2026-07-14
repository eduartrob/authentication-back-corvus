import { Router } from 'express';
import { ProjectController } from '../controllers/project.controller';
import { verifyAuth } from '../middlewares/auth.middleware';

const router = Router();
const projectController = new ProjectController();

// Todas las rutas requieren autenticación
router.use(verifyAuth);

router.post('/', projectController.createProject.bind(projectController));
router.post('/join', projectController.joinProject.bind(projectController));
router.get('/my-projects', projectController.getMyProjects.bind(projectController));

export default router;
