import { Router } from 'express';
import { getUniversities, getRegisteredUniversities, generateUniversityCode, validateUniversityCode } from '../controllers/university.controller';

const router = Router();

router.get('/registered', getRegisteredUniversities);
router.post('/validate', validateUniversityCode);
router.get('/', getUniversities);
router.put('/:id/code', generateUniversityCode);

export default router;
