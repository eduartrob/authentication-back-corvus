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
router.get('/profile/complete', authenticateJWT, authController.getCompleteProfile);
router.put('/complete-student-profile', authenticateJWT, authController.completeStudentProfile);
router.put('/profile', authenticateJWT, authController.updateProfile);
router.put('/profile-picture', authenticateJWT, authController.updateProfilePicture);
router.post('/verify/request', authenticateJWT, authController.requestEmailVerification);
router.post('/verify/confirm', authenticateJWT, authController.confirmEmailVerification);
router.delete('/delete-account', authenticateJWT, authController.deleteAccount);

export default router;
