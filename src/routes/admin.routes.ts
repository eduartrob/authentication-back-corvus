import { Router } from 'express';
import prisma from '../utils/prisma';

const router = Router();

router.get('/stats/users', async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    
    // -# contamos por rol para dar mas detalles
    const studentsRole = await prisma.role.findUnique({ where: { name: 'ALUMNO' } });
    const teachersRole = await prisma.role.findUnique({ where: { name: 'PROFESOR' } });
    
    const studentsCount = studentsRole ? await prisma.user.count({ where: { roleId: studentsRole.id } }) : 0;
    const teachersCount = teachersRole ? await prisma.user.count({ where: { roleId: teachersRole.id } }) : 0;

    return res.json({
      success: true,
      total_users: totalUsers,
      students: studentsCount,
      teachers: teachersCount
    });
  } catch (error) {
    console.error('Error in GET /stats/users:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
