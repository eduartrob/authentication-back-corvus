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
router.post('/:id/collaborators', projectController.addCollaborator.bind(projectController));
router.get('/:id/collaborators', projectController.getCollaborators.bind(projectController));
router.put('/:id', projectController.updateProject.bind(projectController));
router.get('/:id/students', projectController.getProjectStudents.bind(projectController));
router.post('/:id/collaborators/accept', projectController.acceptInvitation.bind(projectController));
router.delete('/:id/collaborators/reject', projectController.rejectInvitation.bind(projectController));

export default router;
