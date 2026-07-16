import { Router } from 'express';
import prisma from '../utils/prisma';

const router = Router();

router.get('/stats/users', async (req, res) => {
  try {
    const universityId = req.query.university_id as string;
    const careerId = req.query.career_id as string;

    const whereClause: any = {};
    if (universityId) whereClause.universityId = universityId;
    if (careerId) whereClause.careerId = careerId;

    const totalUsers = await prisma.user.count({ where: whereClause });
    
    // -# contamos por rol para dar mas detalles
    const studentsRole = await prisma.role.findUnique({ where: { name: 'ALUMNO' } });
    const teachersRole = await prisma.role.findUnique({ where: { name: 'PROFESOR' } });
    
    const studentsCount = studentsRole ? await prisma.user.count({ where: { ...whereClause, roleId: studentsRole.id } }) : 0;
    const teachersCount = teachersRole ? await prisma.user.count({ where: { ...whereClause, roleId: teachersRole.id } }) : 0;

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
    const universityId = req.query.university_id as string;
    const careerId = req.query.career_id as string;

    const whereClause: any = {};
    if (universityId || careerId) {
      whereClause.user = {};
      if (universityId) whereClause.user.universityId = universityId;
      if (careerId) whereClause.user.careerId = careerId;
    }
    
    const logs = await prisma.activityLog.findMany({
      take: limit,
      skip: offset,
      where: whereClause,
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
    
    const total = await prisma.activityLog.count({ where: whereClause });
    
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

// Internal endpoint used by clustering service to match a Drive folder owner to a professor
router.get('/find-professor-by-email', async (req, res) => {
  try {
    const email = req.query.email as string;
    if (!email) {
      return res.status(400).json({ error: 'email query param required' });
    }

    const professorRoles = ['PROFESOR', 'DOCENTE'];
    const roles = await prisma.role.findMany({ where: { name: { in: professorRoles } } });
    const roleIds = roles.map(r => r.id);

    // Search both primary and secondary email
    const professor = await prisma.user.findFirst({
      where: {
        roleId: { in: roleIds },
        OR: [
          { email: email },
          { secondary_email: email }
        ]
      },
      select: {
        id: true,
        email: true,
        secondary_email: true,
        full_name: true,
        universityId: true,
        careerId: true
      }
    });

    if (!professor) {
      return res.status(404).json({ error: `No professor found with email: ${email}` });
    }

    return res.json({
      id: professor.id,
      email: professor.email,
      full_name: professor.full_name,
      university_id: professor.universityId,
      career_id: professor.careerId
    });
  } catch (error) {
    console.error('Error in GET /admin/find-professor-by-email:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

