import { Router } from 'express';
import { getUniversities } from '../controllers/university.controller';

const router = Router();

router.get('/', getUniversities);

export default router;
