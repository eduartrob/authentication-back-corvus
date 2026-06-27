import { Router } from 'express';
import prisma from '../utils/prisma';

const router = Router();

/**
 * GET /internal/users/:userId/llm-quota
 * Devuelve cuántas sesiones LLM ha usado un usuario.
 * Este endpoint es INTERNO — no está expuesto al API Gateway.
 * Solo lo llama llm-back-corvus desde la red Docker interna.
 */
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

/**
 * POST /internal/users/:userId/llm-sessions
 * Registra una nueva sesión LLM en la DB.
 * Llamado por llm-back-corvus al crear una sesión (solo en modo producción).
 */
router.post('/users/:userId/llm-sessions', async (req, res) => {
  const { userId } = req.params;
  const { session_id, verdict, proposal_summary, analysis_json } = req.body;

  try {
    // Obtener el número de sesión actual
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
