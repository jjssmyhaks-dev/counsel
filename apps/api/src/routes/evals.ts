/**
 * Eval API Routes — quality scores, benchmarks, feedback persistence, regressions.
 *
 * GET  /evals/report          — quality report for the firm
 * GET  /evals/benchmarks      — per-tool benchmark stats
 * GET  /evals/regressions     — detect quality regressions
 * GET  /evals/feedback        — list feedback entries
 * POST /evals/feedback        — persist feedback (thumbs up/down)
 * GET  /evals/tool/:toolName  — single tool performance
 */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';

const router = Router();

// ─── GET /evals/report ──────────────────────────────────────────────────────

router.get('/report', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const firmId = (req as any).firmId;
    const days = parseInt(req.query.days as string) || 7;

    const since = new Date(Date.now() - days * 86400000);

    const [evalResults, feedbackLogs, toolStats] = await Promise.all([
      prisma.evalResult.findMany({
        where: { firmId, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      prisma.feedbackLog.findMany({
        where: { firmId, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      prisma.$queryRawUnsafe(`
        SELECT
          tool_or_crew as "toolName",
          COUNT(*) as "totalCalls",
          COUNT(*) FILTER (WHERE feedback_type = 'task_success') as "successes",
          COUNT(*) FILTER (WHERE feedback_type = 'task_failure') as "failures",
          COUNT(*) FILTER (WHERE feedback_type = 'explicit_positive') as "explicitPositive",
          COUNT(*) FILTER (WHERE feedback_type = 'explicit_negative') as "explicitNegative",
          ROUND(AVG(score)::numeric, 3) as "avgScore"
        FROM feedback_logs
        WHERE firm_id = $1 AND created_at >= $2
        GROUP BY tool_or_crew
        ORDER BY totalCalls DESC
      `, firmId, since),
    ]);

    // Aggregate eval scores
    const avgScores: Record<string, number> = {};
    const scoreCounts: Record<string, number> = {};
    for (const ev of evalResults) {
      const scores = ev.scores as Record<string, number>;
      for (const [dim, score] of Object.entries(scores)) {
        avgScores[dim] = (avgScores[dim] || 0) + score;
        scoreCounts[dim] = (scoreCounts[dim] || 0) + 1;
      }
    }
    const dimensionAverages: Record<string, number> = {};
    for (const [dim, total] of Object.entries(avgScores)) {
      dimensionAverages[dim] = Math.round((total / (scoreCounts[dim] || 1)) * 1000) / 1000;
    }

    // Feedback summary
    const positive = feedbackLogs.filter(f => f.feedbackType === 'explicit_positive').length;
    const negative = feedbackLogs.filter(f => f.feedbackType === 'explicit_negative').length;

    res.json({
      period: `${days} days`,
      totalEvaluations: evalResults.length,
      totalFeedback: feedbackLogs.length,
      feedbackBreakdown: { positive, negative, implicit: feedbackLogs.length - positive - negative },
      dimensionAverages,
      toolStats: (toolStats as any[]).map((t: any) => ({
        tool: t.toolName,
        calls: Number(t.totalCalls),
        successes: Number(t.successes),
        failures: Number(t.failures),
        successRate: Number(t.totalCalls) > 0 ? Math.round((Number(t.successes) / Number(t.totalCalls)) * 1000) / 1000 : 0,
        explicitPositive: Number(t.explicitPositive),
        explicitNegative: Number(t.explicitNegative),
        satisfactionRate: (Number(t.explicitPositive) + Number(t.explicitNegative)) > 0
          ? Math.round((Number(t.explicitPositive) / (Number(t.explicitPositive) + Number(t.explicitNegative))) * 1000) / 1000
          : 0,
        avgScore: Number(t.avgScore) || 0,
      })),
    });
  } catch (err) { next(err); }
});

// ─── GET /evals/benchmarks ──────────────────────────────────────────────────

router.get('/benchmarks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const firmId = (req as any).firmId;
    const period = (req.query.period as string) || 'week';

    const periodDays: Record<string, number> = { day: 1, week: 7, month: 30 };
    const days = periodDays[period] || 7;
    const since = new Date(Date.now() - days * 86400000);

    const results = await prisma.evalResult.findMany({
      where: { firmId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
    });

    // Group by tool
    const byTool: Record<string, typeof results> = {};
    for (const r of results) {
      if (!byTool[r.toolName]) byTool[r.toolName] = [];
      byTool[r.toolName].push(r);
    }

    const benchmarks = Object.entries(byTool).map(([toolName, toolResults]) => {
      const overalls = toolResults.map((r: any) => r.overallScore).sort((a: number, b: number) => a - b);
      const scoresMap: Record<string, number[]> = {};

      for (const r of toolResults) {
        const scores = r.scores as Record<string, number>;
        for (const [dim, score] of Object.entries(scores)) {
          if (!scoresMap[dim]) scoresMap[dim] = [];
          scoresMap[dim].push(score);
        }
      }

      const avgScores: Record<string, number> = {};
      for (const [dim, scores] of Object.entries(scoresMap)) {
        avgScores[dim] = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 1000) / 1000;
      }

      return {
        toolName,
        sampleCount: toolResults.length,
        avgScores,
        overallAvg: Math.round((overalls.reduce((a, b) => a + b, 0) / overalls.length) * 1000) / 1000,
        p50: overalls[Math.floor(overalls.length * 0.5)] || 0,
        p95: overalls[Math.floor(overalls.length * 0.95)] || 0,
        min: overalls[0] || 0,
        max: overalls[overalls.length - 1] || 0,
      };
    });

    res.json({ period, benchmarks: benchmarks.sort((a, b) => b.overallAvg - a.overallAvg) });
  } catch (err) { next(err); }
});

// ─── GET /evals/regressions ─────────────────────────────────────────────────

router.get('/regressions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const firmId = (req as any).firmId;

    // Compare last 24h vs previous 7 days
    const now = new Date();
    const last24h = new Date(now.getTime() - 86400000);
    const prev7d = new Date(now.getTime() - 7 * 86400000);

    const [recent, baseline] = await Promise.all([
      prisma.evalResult.findMany({
        where: { firmId, createdAt: { gte: last24h } },
      }),
      prisma.evalResult.findMany({
        where: { firmId, createdAt: { gte: prev7d, lt: last24h } },
      }),
    ]);

    const regressions: any[] = [];

    if (recent.length >= 5 && baseline.length >= 10) {
      const recentAvg = recent.reduce((s, r) => s + r.overallScore, 0) / recent.length;
      const baselineAvg = baseline.reduce((s, r) => s + r.overallScore, 0) / baseline.length;

      if (recentAvg < baselineAvg * 0.85) {
        regressions.push({
          type: 'overall_quality',
          recentAvg: Math.round(recentAvg * 1000) / 1000,
          baselineAvg: Math.round(baselineAvg * 1000) / 1000,
          regressionPct: Math.round((1 - recentAvg / baselineAvg) * 1000) / 10,
          recentSamples: recent.length,
          baselineSamples: baseline.length,
        });
      }
    }

    // Check per-tool regressions
    const recentByTool: Record<string, number[]> = {};
    const baselineByTool: Record<string, number[]> = {};
    for (const r of recent) {
      if (!recentByTool[r.toolName]) recentByTool[r.toolName] = [];
      recentByTool[r.toolName].push(r.overallScore);
    }
    for (const r of baseline) {
      if (!baselineByTool[r.toolName]) baselineByTool[r.toolName] = [];
      baselineByTool[r.toolName].push(r.overallScore);
    }

    for (const [tool, recentScores] of Object.entries(recentByTool)) {
      const baseScores = baselineByTool[tool];
      if (!baseScores || recentScores.length < 3 || baseScores.length < 5) continue;

      const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
      const baseAvg = baseScores.reduce((a, b) => a + b, 0) / baseScores.length;

      if (recentAvg < baseAvg * 0.85) {
        regressions.push({
          type: 'tool_quality',
          tool,
          recentAvg: Math.round(recentAvg * 1000) / 1000,
          baselineAvg: Math.round(baseAvg * 1000) / 1000,
          regressionPct: Math.round((1 - recentAvg / baseAvg) * 1000) / 10,
        });
      }
    }

    res.json({ regressions, hasRegressions: regressions.length > 0 });
  } catch (err) { next(err); }
});

// ─── GET /evals/feedback ────────────────────────────────────────────────────

router.get('/feedback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const firmId = (req as any).firmId;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const tool = req.query.tool as string | undefined;

    const where: any = { firmId };
    if (tool) where.toolOrCrew = tool;

    const feedback = await prisma.feedbackLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        messageId: true,
        toolOrCrew: true,
        feedbackType: true,
        score: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    });

    res.json({ feedback, total: feedback.length });
  } catch (err) { next(err); }
});

// ─── POST /evals/feedback ───────────────────────────────────────────────────

router.post('/feedback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const firmId = (req as any).firmId;
    const userId = (req as any).user?.id;
    const { messageId, threadId, planId, stepId, toolOrCrew, type, score } = req.body;

    if (!messageId || !type || !['positive', 'negative'].includes(type)) {
      res.status(400).json({ error: 'messageId and type (positive|negative) required' });
      return;
    }

    const feedbackType = type === 'positive' ? 'explicit_positive' : 'explicit_negative';
    const feedbackScore = type === 'positive' ? 1.0 : -1.0;

    // Persist to database
    const entry = await prisma.feedbackLog.create({
      data: {
        firmId,
        userId: userId || null,
        messageId,
        threadId: threadId || null,
        planId: planId || null,
        stepId: stepId || null,
        toolOrCrew: toolOrCrew || 'general',
        feedbackType,
        score: score ?? feedbackScore,
        metadata: { source: 'chat_ui', userAgent: req.headers['user-agent'] },
      },
    });

    // Also record in audit log for backward compatibility
    await prisma.auditLog.create({
      data: {
        firmId,
        userId,
        action: type === 'positive' ? 'CHAT_FEEDBACK_POSITIVE' : 'CHAT_FEEDBACK_NEGATIVE',
        resourceType: 'ChatMessage',
        resourceId: messageId,
        details: { type, threadId, toolOrCrew },
      },
    }).catch(() => {});

    res.json({ recorded: true, id: entry.id, type });
  } catch (err) { next(err); }
});

// ─── GET /evals/tool/:toolName ──────────────────────────────────────────────

router.get('/tool/:toolName', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const firmId = (req as any).firmId;
    const { toolName } = req.params;
    const days = parseInt(req.query.days as string) || 30;
    const since = new Date(Date.now() - days * 86400000);

    const [evalResults, feedbackLogs] = await Promise.all([
      prisma.evalResult.findMany({
        where: { firmId, toolName, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.feedbackLog.findMany({
        where: { firmId, toolOrCrew: toolName, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    ]);

    // Compute averages
    const avgScores: Record<string, number> = {};
    const scoreCounts: Record<string, number> = {};
    for (const ev of evalResults) {
      const scores = ev.scores as Record<string, number>;
      for (const [dim, score] of Object.entries(scores)) {
        avgScores[dim] = (avgScores[dim] || 0) + score;
        scoreCounts[dim] = (scoreCounts[dim] || 0) + 1;
      }
    }
    const dimensionAverages: Record<string, number> = {};
    for (const [dim, total] of Object.entries(avgScores)) {
      dimensionAverages[dim] = Math.round((total / (scoreCounts[dim] || 1)) * 1000) / 1000;
    }

    const overallAvg = evalResults.length > 0
      ? Math.round((evalResults.reduce((s, r) => s + r.overallScore, 0) / evalResults.length) * 1000) / 1000
      : 0;

    const positive = feedbackLogs.filter(f => f.feedbackType === 'explicit_positive').length;
    const negative = feedbackLogs.filter(f => f.feedbackType === 'explicit_negative').length;

    // Trend: split in half and compare
    let trend = 'insufficient_data';
    if (evalResults.length >= 10) {
      const mid = Math.floor(evalResults.length / 2);
      const recentHalf = evalResults.slice(0, mid);
      const olderHalf = evalResults.slice(mid);
      const recentAvg = recentHalf.reduce((s, r) => s + r.overallScore, 0) / recentHalf.length;
      const olderAvg = olderHalf.reduce((s, r) => s + r.overallScore, 0) / olderHalf.length;
      if (recentAvg > olderAvg + 0.05) trend = 'improving';
      else if (recentAvg < olderAvg - 0.05) trend = 'declining';
      else trend = 'stable';
    }

    res.json({
      toolName,
      period: `${days} days`,
      totalEvaluations: evalResults.length,
      overallAvg,
      dimensionAverages,
      feedback: { positive, negative, total: positive + negative },
      trend,
      recentEvals: evalResults.slice(0, 10).map(r => ({
        id: r.id,
        scores: r.scores,
        overallScore: r.overallScore,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) { next(err); }
});

// ─── POST /evals/score (internal — called by AI service) ───────────────────

router.post('/score', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const firmId = (req as any).firmId || req.body.firmId;
    const { planId, toolName, inputText, outputText, scores, overallScore, executionMs, metadata } = req.body;

    if (!toolName || !scores || overallScore === undefined) {
      res.status(400).json({ error: 'toolName, scores, and overallScore required' });
      return;
    }

    const entry = await prisma.evalResult.create({
      data: {
        firmId,
        planId: planId || null,
        toolName,
        inputText: inputText?.substring(0, 5000) || null,
        outputText: outputText?.substring(0, 10000) || null,
        scores,
        overallScore,
        executionMs: executionMs || null,
        metadata: metadata || null,
      },
    });

    res.json({ recorded: true, id: entry.id });
  } catch (err) { next(err); }
});

export default router;
