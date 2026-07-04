import { Router } from 'express';
import { addFolder, getFolders, checkFolder } from '../controllers/folder.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();

router.post('/', authenticateJWT, addFolder);
router.get('/', authenticateJWT, getFolders);
router.get('/check/:folder_id', checkFolder);

export default router;
