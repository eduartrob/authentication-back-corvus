import { Router } from 'express';
import prisma from '../utils/prisma';

const router = Router();

router.get('/users/:userId/llm-quota', async (req, res) => {
  const { userId } = req.params;

  try {
    const sessionsCount = await (prisma as any).llmSession.count({
      where: { userId },
    });

    return res.json({
      user_id: userId,
      sessions_used: sessionsCount,
    });
  } catch (error) {
    console.error('[internal/llm-quota] Error:', error);
    return res.status(500).json({ error: 'Error consultando cuotas' });
  }
});

router.post('/users/:userId/llm-sessions', async (req, res) => {
  const { userId } = req.params;
  const { session_id, verdict, proposal_summary, analysis_json } = req.body;

  try {
    // -# obtener el numero de sesion actual
    const sessionCount = await (prisma as any).llmSession.count({
      where: { userId },
    });

    const newSession = await (prisma as any).llmSession.create({
      data: {
        id: session_id,
        userId,
        verdict: verdict || 'unknown',
        proposal_title: proposal_summary?.slice(0, 100) || null,
        analysis_json: analysis_json || {},
        messages: [],
        session_number: sessionCount + 1,
      },
    });

    return res.status(201).json({ success: true, session_id: newSession.id });
  } catch (error) {
    console.error('[internal/llm-sessions] Error:', error);
    return res.status(500).json({ error: 'Error registrando sesión LLM' });
  }
});

router.post('/activity-log', async (req, res) => {
  const { userId, action, detail } = req.body;

  if (!userId || !action || !detail) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const log = await (prisma as any).activityLog.create({
      data: {
        userId,
        action,
        detail,
        ipAddress: req.ip || '0.0.0.0'
      }
    });
    return res.status(201).json({ success: true, log });
  } catch (error) {
    console.error('[internal/activity-log] Error:', error);
    return res.status(500).json({ error: 'Error creating activity log' });
  }
});

router.get('/projects/:projectId/members', async (req, res) => {
  const { projectId } = req.params;
  try {
    const project = await (prisma as any).project.findUnique({
      where: { id: projectId },
      include: {
        students: { select: { userId: true } },
        professors: { select: { userId: true } }
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    const students = project.students.map((s: any) => s.userId);
    const professors = project.professors.map((p: any) => p.userId);
    professors.push(project.creator_id);

    return res.json({
      students,
      professors: Array.from(new Set(professors))
    });
  } catch (error) {
    console.error('[internal/projects/members] Error:', error);
    return res.status(500).json({ error: 'Error consultando miembros del proyecto' });
  }
});

router.get('/projects/:projectId/team-size', async (req, res) => {
  const { projectId } = req.params;
  try {
    const project = await (prisma as any).project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, team_size: true }
    });
    if (!project) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }
    return res.json({
      projectId: project.id,
      name: project.name,
      team_size: project.team_size
    });
  } catch (error) {
    console.error('[internal/projects/team-size] Error:', error);
    return res.status(500).json({ error: 'Error consultando proyecto' });
  }
});
router.patch('/projects/:projectId/team-size', async (req, res) => {
  const { projectId } = req.params;
  const { team_size } = req.body;
  const parsedTeamSize = typeof team_size === 'number' ? team_size : parseInt(team_size);
  if (!parsedTeamSize || isNaN(parsedTeamSize)) {
    return res.status(400).json({ error: 'team_size invalido' });
  }
  try {
    const project = await (prisma as any).project.update({
      where: { id: projectId },
      data: { team_size: parsedTeamSize }
    });
    return res.json({ success: true, team_size: project.team_size });
  } catch (error) {
    console.error('[internal/projects/team-size] Patch Error:', error);
    return res.status(500).json({ error: 'Error actualizando proyecto' });
  }
});

router.get('/projects/:projectId/rules', async (req, res) => {
  const { projectId } = req.params;
  try {
    const project = await (prisma as any).project.findUnique({
      where: { id: projectId },
      include: {
        sections: true
      }
    });
    if (!project) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }
    return res.json({
      min_team_members: project.min_team_size,
      max_team_members: project.team_size,
      allowed_extensions: project.allowed_extensions,
      exclusion_rules: project.blocked_topics,
      project_sections: project.sections.map((s: any) => ({
        nombre: s.nombre,
        obligatoria: s.obligatoria
      }))
    });
  } catch (error) {
    console.error('[internal/projects/rules] Error:', error);
    return res.status(500).json({ error: 'Error consultando reglas del proyecto' });
  }
});

router.patch('/projects/:projectId/rules', async (req, res) => {
  const { projectId } = req.params;
  const { min_team_members, max_team_members, allowed_extensions, exclusion_rules, project_sections } = req.body;
  
  try {
    // Transacción para borrar y recrear las secciones
    const updatedProject = await (prisma as any).$transaction(async (tx: any) => {
      // 1. Update basic fields if provided
      const updateData: any = {};
      if (typeof min_team_members === 'number') updateData.min_team_size = min_team_members;
      if (typeof max_team_members === 'number') updateData.team_size = max_team_members;
      if (Array.isArray(allowed_extensions)) updateData.allowed_extensions = allowed_extensions;
      if (Array.isArray(exclusion_rules)) updateData.blocked_topics = exclusion_rules;
      
      let project = await tx.project.findUnique({ where: { id: projectId } });
      if (!project) throw new Error('Project not found');

      if (Object.keys(updateData).length > 0) {
        project = await tx.project.update({
          where: { id: projectId },
          data: updateData
        });
      }

      // 2. Handle sections if provided
      if (Array.isArray(project_sections)) {
        await tx.projectSection.deleteMany({
          where: { projectId: projectId }
        });
        
        if (project_sections.length > 0) {
          await tx.projectSection.createMany({
            data: project_sections.map((s: any) => ({
              projectId: projectId,
              nombre: s.nombre,
              obligatoria: s.obligatoria === true || s.obligatoria === 'true'
            }))
          });
        }
      }

      return project;
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('[internal/projects/rules] Error:', error);
    return res.status(500).json({ error: 'Error actualizando reglas del proyecto' });
  }
});

export default router;
