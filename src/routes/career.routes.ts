import { Router } from 'express';
import { resolveCareer, getCareers } from '../controllers/career.controller';

const router = Router();

router.get('/', getCareers);
router.post('/resolve', resolveCareer);

export default router;
