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

router.post('/activity', async (req, res) => {
  try {
    const { userId, action, detail, ipAddress } = req.body;
    if (!action || !detail) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    
    const log = await prisma.activityLog.create({
      data: {
        userId: userId || null,
        action,
        detail,
        ipAddress: ipAddress || null
      }
    });
    
    return res.status(201).json({ success: true, log });
  } catch (error) {
    console.error('Error in POST /activity:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/activity', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const logs = await prisma.activityLog.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            full_name: true,
            role: { select: { name: true } },
            profile_picture: true,
            email: true
          }
        }
      }
    });
    
    const total = await prisma.activityLog.count();
    
    return res.json({
      success: true,
      total,
      limit,
      offset,
      items: logs
    });
  } catch (error) {
    console.error('Error in GET /activity:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
