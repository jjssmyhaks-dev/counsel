import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { auditAction } from '../middleware/audit';
import { NotFoundError, ValidationError } from '../lib/errors';
import { aiClient } from '../lib/ai-client';

const router = Router();

// ─── POST /:id/analyze ─── Trigger contract analysis with real AI pipeline ──
const analyzeSchema = z.object({
  playbookId: z.string().uuid().optional(),
  model: z.enum(['default', 'power', 'reasoning']).optional().default('default'),
});

router.post(
  '/:id/analyze',
  validate('body', analyzeSchema),
  auditAction('Analysis', 'ANALYSIS_REQUESTED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const document = await prisma.document.findFirst({
        where: { id: req.params.id, firmId: req.firmId },
        include: {
          chunks: {
            select: { id: true, text: true, chunkIndex: true, sectionTitle: true },
            orderBy: { chunkIndex: 'asc' },
          },
        },
      });

      if (!document) throw new NotFoundError('Document');

      // Create an analysis record
      const analysis = await prisma.analysis.create({
        data: {
          documentId: document.id,
          firmId: req.firmId!,
          type: 'CONTRACT_RISK',
          status: 'PROCESSING',
          modelUsed: req.body.model,
        },
      });

      // Build full document text from chunks
      const fullText = document.chunks
        .map((c) => c.text)
        .join('\n\n');

      const playbookRules = req.body.playbookId
        ? await prisma.playbookRule.findMany({
            where: { firmId: req.firmId, enabled: true },
          })
        : [];

      // ── Call the AI pipeline ──
      let aiResult: any;
      try {
        // Reconstruct the contract text from chunks and send to Crew 1
        aiResult = await analyzeWithAI(fullText, req.firmId!, req.user!.id, playbookRules);
      } catch (aiErr: any) {
        // AI failed — record the failure but don't crash
        await prisma.analysis.update({
          where: { id: analysis.id },
          data: {
            status: 'FAILED',
            error: aiErr?.message?.substring(0, 500) || 'AI analysis failed',
          },
        });
        res.status(502).json({
          error: 'AI analysis failed',
          detail: process.env.NODE_ENV === 'development' ? aiErr?.message : undefined,
          analysisId: analysis.id,
        });
        return;
      }

      // ── Store the AI results ──
      const updated = await prisma.analysis.update({
        where: { id: analysis.id },
        data: {
          status: 'COMPLETED',
          result: aiResult,
          modelUsed: aiResult.model_used || req.body.model,
          completedAt: new Date(),
        },
      });

      (res as any).locals = {
        auditDetails: {
          type: 'CONTRACT_RISK',
          analysisId: analysis.id,
          riskScore: aiResult.overall_risk_score,
          clausesFound: aiResult.clauses?.length || 0,
        },
      };

      res.status(201).json({
        analysis: updated,
        result: aiResult,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Helper: Call the CrewAI document intelligence pipeline ─────────────────

async function analyzeWithAI(
  documentText: string,
  firmId: string,
  userId: string,
  playbookRules: any[],
) {
  // Try CrewAI pipeline first (POST /agents/analyze/contract on the Python service)
  try {
    const response = await fetch(`${process.env.AI_SERVICE_URL || 'http://localhost:8000'}/agents/analyze/contract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_text: documentText.substring(0, 30000), // Truncate if enormous
        firm_id: firmId,
        user_id: userId,
        playbook_rules: playbookRules.length > 0 ? playbookRules.map((r) => ({
          rule_name: r.ruleName,
          description: r.description,
          check_type: r.checkType,
          target_field: r.targetField,
          required_value: r.requiredValue,
          acceptable_range: r.acceptableRange,
          risk_level: r.riskLevel,
        })) : undefined,
      }),
      signal: AbortSignal.timeout(300_000), // 5 min timeout for CrewAI pipeline
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || err.error || `AI service returned ${response.status}`);
    }

    const result = await response.json();

    // Transform CrewAI output into analysis format
    return {
      model_used: 'cloudflare-crewai-document-intelligence',
      raw_output: result.raw_output,
      overall_risk_score: extractRiskScore(result.raw_output),
      risk_level: extractRiskLevel(result.raw_output),
      clauses: extractClauses(result.raw_output),
      token_usage: result.token_usage || {},
    };
  } catch (err: any) {
    // If CrewAI fails, try the standalone analyzer fallback
    console.warn('CrewAI pipeline unavailable, trying standalone analyzer:', err.message);

    try {
      const fallback = await fetch(`${process.env.AI_SERVICE_URL || 'http://localhost:8000'}/analyze/contract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: `doc-${Date.now()}`,
          chunks: [{ index: 0, text: documentText.substring(0, 15000), section_title: 'Full Document' }],
        }),
        signal: AbortSignal.timeout(120_000),
      });

      if (fallback.ok) {
        const fb = await fallback.json();
        return {
          model_used: 'cloudflare-standalone-analyzer',
          raw_output: JSON.stringify(fb),
          overall_risk_score: fb.risk_score || null,
          risk_level: fb.risk_level || null,
          clauses: fb.clauses || [],
          summary: fb.summary || '',
          token_usage: {},
        };
      }
    } catch (fbErr: any) {
      console.warn('Standalone analyzer also failed:', fbErr.message);
    }

    // Both failed — return structured fallback
    return generateFallbackAnalysis(documentText);
  }
}

// ─── Simple extraction helpers ──────────────────────────────────────────────

function extractRiskScore(rawOutput: string): number | null {
  if (!rawOutput) return null;
  // Try to find "risk_score": 62 or "overall_risk_score": 7
  const match = rawOutput.match(/(?:overall_risk_score|risk_score|riskScore)[^\d]*(\d+)/i);
  return match ? parseInt(match[1]) : null;
}

function extractRiskLevel(rawOutput: string): string | null {
  if (!rawOutput) return null;
  const match = rawOutput.match(/(?:risk_level|riskLevel)[^"]*"([^"]+)"/i);
  return match ? match[1].toUpperCase() : null;
}

function extractClauses(rawOutput: string): any[] {
  if (!rawOutput) return [];
  // Best effort — CrewAI returns JSON inside code blocks
  const jsonMatch = rawOutput.match(/```json\s*([\s\S]*?)```/i)
    || rawOutput.match(/\{[\s\S]*"clauses"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      return parsed.clauses || [];
    } catch { /* fall through */ }
  }
  return [];
}

function generateFallbackAnalysis(documentText: string) {
  const wordCount = documentText.split(/\s+/).length;
  const hasIndemnification = /indemnif/i.test(documentText);
  const hasLiability = /liabilit/i.test(documentText);
  const hasTermination = /terminat/i.test(documentText);

  return {
    model_used: 'fallback-heuristic',
    raw_output: '',
    overall_risk_score: null,
    risk_level: null,
    clauses: [
      ...(hasIndemnification ? [{ name: 'Indemnification', risk: 'HIGH',
        summary: 'Indemnification clause detected. Review cap and basket amounts.' }] : []),
      ...(hasLiability ? [{ name: 'Limitation of Liability', risk: 'MEDIUM',
        summary: 'Liability limitation clause detected. Verify carve-outs for fraud and IP.' }] : []),
      ...(hasTermination ? [{ name: 'Termination', risk: 'MEDIUM',
        summary: 'Termination clause detected. Check notice period and for-cause conditions.' }] : []),
    ],
    summary: `Heuristic analysis of ${wordCount}-word document. AI pipeline was unavailable. Detected ${hasIndemnification ? 'indemnification, ' : ''}${hasLiability ? 'liability, ' : ''}${hasTermination ? 'termination' : ''} clauses for manual review.`,
    token_usage: {},
  };
}

export default router;
