import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { auditAction } from '../middleware/audit';
import { NotFoundError } from '../lib/errors';

const router = Router();

// ─── POST /query ─── Query the knowledge base ───────────────────────────────
const querySchema = z.object({
  question: z.string().min(1, 'Question is required'),
  matterId: z.string().uuid().optional(),
});

router.post(
  '/query',
  validate('body', querySchema),
  auditAction('KbQuery', 'KB_QUERY'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { question, matterId } = req.body;

      // Store the query in the database
      const kbQuery = await prisma.kbQuery.create({
        data: {
          firmId: req.firmId!,
          question,
          matterId: matterId || null,
          createdById: req.user!.id,
        },
      });

      // Stub: In production, this would call the AI service to search document chunks
      // and generate a real answer. For MVP, return a realistic stub.
      const answer =
        'Based on your firm\'s document corpus, the key clauses related to this question include the standard indemnification provisions (with a 0.5% basket and escrow cap for third-party claims), liability caps at 1x fees with carve-outs for fraud and IP infringement, and 60-day termination notice requirements. For more specific guidance, please narrow your query to a particular contract or clause type.';

      const sourceChunks = [
        {
          chunkIndex: 0,
          sectionTitle: 'Indemnification',
          documentName: 'Standard M&A Contract Playbook',
          relevance: 0.95,
          excerpt:
            'Indemnification for third-party claims arising from breach of representations, with a basket of 0.5% of purchase price...',
        },
        {
          chunkIndex: 1,
          sectionTitle: 'Liability Cap',
          documentName: 'Standard M&A Contract Playbook',
          relevance: 0.91,
          excerpt:
            'Aggregate liability cap at 1x fees paid over the preceding 12 months. Excludes death, personal injury, fraud...',
        },
        {
          chunkIndex: 2,
          sectionTitle: 'Termination',
          documentName: 'Standard M&A Contract Playbook',
          relevance: 0.87,
          excerpt:
            'Either party may terminate on 60 days written notice without cause. Immediate termination for material breach...',
        },
      ];

      // Update the stored query with the answer
      const updatedQuery = await prisma.kbQuery.update({
        where: { id: kbQuery.id },
        data: {
          answer,
          sourceChunks,
          confidence: 0.91,
          modelUsed: 'gpt-4o',
        },
        include: {
          createdBy: {
            select: { id: true, name: true },
          },
          matter: {
            select: { id: true, name: true },
          },
        },
      });

      res.json({
        id: updatedQuery.id,
        question: updatedQuery.question,
        answer: updatedQuery.answer,
        confidence: updatedQuery.confidence,
        sourceChunks: updatedQuery.sourceChunks,
        modelUsed: updatedQuery.modelUsed,
        matter: updatedQuery.matter,
        createdAt: updatedQuery.createdAt,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /history ─── Get KB query history ──────────────────────────────────
router.get('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const matterId = req.query.matterId as string | undefined;

    const where: any = { firmId: req.firmId };
    if (matterId) {
      where.matterId = matterId;
    }

    const [queries, total] = await Promise.all([
      prisma.kbQuery.findMany({
        where,
        select: {
          id: true,
          question: true,
          answer: true,
          confidence: true,
          modelUsed: true,
          createdAt: true,
          matter: {
            select: { id: true, name: true },
          },
          createdBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.kbQuery.count({ where }),
    ]);

    res.json({
      data: queries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
