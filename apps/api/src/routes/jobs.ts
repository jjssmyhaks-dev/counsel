import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';
import { NotFoundError } from '../lib/errors';
import { aiClient } from '../lib/ai-client';
import fs from 'fs';
import path from 'path';

const router = Router();

// ─── GET /:id ─── Poll job status ───────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await prisma.job.findFirst({
      where: {
        id: req.params.id,
        firmId: req.firmId,
      },
    });

    if (!job) {
      throw new NotFoundError('Job');
    }

    res.json({
      id: job.id,
      type: job.type,
      status: job.status,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET / ─── List jobs ────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as string | undefined;
    const type = req.query.type as string | undefined;

    const where: any = { firmId: req.firmId };
    if (status) where.status = status;
    if (type) where.type = type;

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.job.count({ where }),
    ]);

    res.json({
      data: jobs,
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

// ─── POST /process/:jobId ─── Process a pending job ─────────────────────────
router.post('/process/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await prisma.job.findFirst({
      where: { id: req.params.jobId, firmId: req.firmId },
    });

    if (!job) throw new NotFoundError('Job');
    if (job.status !== 'PENDING') {
      res.json({ message: 'Job already processed', status: job.status });
      return;
    }

    // Mark as processing
    await prisma.job.update({ where: { id: job.id }, data: { status: 'PROCESSING' } });

    try {
      if (job.type === 'DOCUMENT_PARSE') {
        const docId = (job.result as any)?.documentId;
        const document = docId ? await prisma.document.findUnique({ where: { id: docId } }) : null;

        if (!document) throw new Error('Document not found');

        // Read file from disk
        const filePath = path.resolve(process.cwd(), 'uploads', document.filename);
        if (!fs.existsSync(filePath)) throw new Error('File not found on disk: ' + filePath);

        const fileBytes = fs.readFileSync(filePath);

        // Step 1: Parse (extract text) — send base64 encoded content
        const parseResult = await aiClient.parseDocument(
          document.id,
          document.mimeType,
          fileBytes,
        );

        // Step 2: Embed chunks
        const texts = parseResult.chunks.map((c) => c.text);
        const embedResult = await aiClient.embedTexts(texts);

        // Step 3: Index
        await aiClient.indexDocument(
          document.id,
          document.firmId,
          parseResult.chunks,
          embedResult.embeddings,
          document.matterId || undefined,
        );

        // Update document status
        await prisma.document.update({
          where: { id: document.id },
          data: { status: 'READY', pageCount: parseResult.total_pages },
        });

        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            result: { documentId: document.id, chunks: parseResult.chunks.length, pages: parseResult.total_pages },
          },
        });

        res.json({ status: 'COMPLETED', chunks: parseResult.chunks.length, pages: parseResult.total_pages });
      } else {
        res.status(400).json({ error: 'Unknown job type: ' + job.type });
      }
    } catch (err: any) {
      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'FAILED', error: err.message || 'Unknown error', completedAt: new Date() },
      });
      await prisma.document.update({
        where: { id: (job.result as any)?.documentId },
        data: { status: 'FAILED' },
      });
      res.status(500).json({ error: err.message });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
