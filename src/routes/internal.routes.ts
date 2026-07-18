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
  if (!team_size || typeof team_size !== 'number') {
    return res.status(400).json({ error: 'team_size invalido' });
  }
  try {
    const project = await (prisma as any).project.update({
      where: { id: projectId },
      data: { team_size }
    });
    return res.json({ success: true, team_size: project.team_size });
  } catch (error) {
    console.error('[internal/projects/team-size] Patch Error:', error);
    return res.status(500).json({ error: 'Error actualizando proyecto' });
  }
});

export default router;
