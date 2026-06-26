import { Router } from 'express';
import { addFolder, getFolders, checkFolder } from '../controllers/folder.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();

// Usamos el middleware authenticate para proteger las rutas
router.post('/', authenticateJWT, addFolder);
router.get('/', authenticateJWT, getFolders);
router.get('/check/:folder_id', checkFolder); // Endpoint interno para clustering (sin token de usuario o con token de servicio en un escenario real)

export default router;
