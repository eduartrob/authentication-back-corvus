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

export default router;
