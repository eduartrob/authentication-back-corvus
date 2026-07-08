import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();
const authController = new AuthController();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/google', authController.googleLogin);
router.post('/logout', authenticateJWT, authController.logout);
router.post('/recover-password', authController.recoverPassword);
router.get('/me', authenticateJWT, authController.me);
router.put('/complete-student-profile', authenticateJWT, authController.completeStudentProfile);
router.put('/profile-picture', authenticateJWT, authController.updateProfilePicture);
router.delete('/delete-account', authenticateJWT, authController.deleteAccount);

export default router;
