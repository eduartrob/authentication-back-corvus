import { Router } from 'express';
import { resolveCareer } from '../controllers/career.controller';

const router = Router();

router.post('/resolve', resolveCareer);

export default router;
