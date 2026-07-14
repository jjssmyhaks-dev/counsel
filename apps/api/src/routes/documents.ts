import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { auditAction } from '../middleware/audit';
import { NotFoundError, ForbiddenError } from '../lib/errors';
import { generateSignedUrl } from '../lib/storage';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// ─── Multer setup ───────────────────────────────────────────────────────────
const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
  },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png',
      'image/jpeg',
      'application/rtf',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// ─── POST / ─── Upload document (multipart) ─────────────────────────────────
router.post(
  '/',
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            res.status(400).json({ error: 'File too large. Maximum size is 50MB.' });
            return;
          }
          res.status(400).json({ error: err.message });
          return;
        }
        res.status(400).json({ error: err.message });
        return;
      }
      next();
    });
  },
  auditAction('Document', 'DOCUMENT_UPLOADED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const matterId = req.body.matterId || null;

      // Generate storage key
      const r2Key = `firms/${req.firmId}/documents/${file.filename}`;

      // Create document record
      const document = await prisma.document.create({
        data: {
          firmId: req.firmId!,
          matterId,
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          r2Key,
          uploadedById: req.user!.id,
          status: 'UPLOADED',
        },
        include: {
          uploadedBy: {
            select: { id: true, name: true },
          },
          matter: {
            select: { id: true, name: true },
          },
        },
      });

      // Trigger async processing job
      const job = await prisma.job.create({
        data: {
          firmId: req.firmId!,
          type: 'DOCUMENT_PARSE',
          status: 'PENDING',
          result: { documentId: document.id },
        },
      });

      // Update document status to PROCESSING
      await prisma.document.update({
        where: { id: document.id },
        data: { status: 'PROCESSING' },
      });

      (res as any).locals = {
        auditDetails: {
          originalName: file.originalname,
          sizeBytes: file.size,
          mimeType: file.mimetype,
          jobId: job.id,
        },
      };

      res.status(201).json({
        ...document,
        jobId: job.id,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET / ─── List firm's documents ────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as string | undefined;
    const matterId = req.query.matterId as string | undefined;
    const search = req.query.search as string | undefined;

    const where: any = { firmId: req.firmId };

    if (status) {
      where.status = status;
    }
    if (matterId) {
      where.matterId = matterId;
    }
    if (search) {
      where.OR = [
        { originalName: { contains: search, mode: 'insensitive' } },
        { filename: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        select: {
          id: true,
          originalName: true,
          filename: true,
          mimeType: true,
          sizeBytes: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          uploadedBy: {
            select: { id: true, name: true },
          },
          matter: {
            select: { id: true, name: true },
          },
          _count: {
            select: { analyses: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.document.count({ where }),
    ]);

    res.json({
      data: documents,
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

// ─── GET /:id ─── Document metadata ─────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const document = await prisma.document.findFirst({
      where: {
        id: req.params.id,
        firmId: req.firmId,
      },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
        matter: {
          select: { id: true, name: true, clientName: true },
        },
        analyses: {
          select: {
            id: true,
            type: true,
            status: true,
            modelUsed: true,
            createdAt: true,
            completedAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        chunks: {
          select: {
            id: true,
            chunkIndex: true,
            sectionTitle: true,
            pageNumber: true,
          },
          orderBy: { chunkIndex: 'asc' },
        },
      },
    });

    if (!document) {
      throw new NotFoundError('Document');
    }

    res.json(document);
  } catch (err) {
    next(err);
  }
});

// ─── GET /:id/content ─── Signed download URL ───────────────────────────────
router.get(
  '/:id/content',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const document = await prisma.document.findFirst({
        where: {
          id: req.params.id,
          firmId: req.firmId,
        },
        select: {
          id: true,
          r2Key: true,
          originalName: true,
          mimeType: true,
        },
      });

      if (!document) {
        throw new NotFoundError('Document');
      }

      const signed = generateSignedUrl(document.r2Key, 3600);

      res.json({
        url: signed.url,
        expiresAt: signed.expiresAt,
        filename: document.originalName,
        mimeType: document.mimeType,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /download/:key ─── Local file download (MVP stub) ──────────────────
router.get('/download/:key', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const key = req.params.key as string;
    // Extract the filename from the key
    const filename = key.split('/').pop() || key;
    const filePath = path.resolve(uploadsDir, filename);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundError('File');
    }

    res.download(filePath);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /:id ─── Delete a document ──────────────────────────────────────
router.delete(
  '/:id',
  auditAction('Document', 'DOCUMENT_DELETED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const document = await prisma.document.findFirst({
        where: {
          id: req.params.id,
          firmId: req.firmId,
        },
      });

      if (!document) {
        throw new NotFoundError('Document');
      }

      // Delete local file
      const filePath = path.resolve(uploadsDir, document.filename);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {
        // File may not exist locally (e.g., in production on R2)
      }

      await prisma.document.delete({
        where: { id: req.params.id },
      });

      (res as any).locals = {
        auditDetails: { originalName: document.originalName, r2Key: document.r2Key },
      };

      res.json({ message: 'Document deleted', id: req.params.id });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /:id/analyze ─── Trigger contract analysis ────────────────────────
router.post(
  '/:id/analyze',
  auditAction('Analysis', 'ANALYSIS_REQUESTED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const document = await prisma.document.findFirst({
        where: {
          id: req.params.id,
          firmId: req.firmId,
        },
      });

      if (!document) {
        throw new NotFoundError('Document');
      }

      if (document.status !== 'READY') {
        res.status(400).json({
          error: 'Document must be in READY status for analysis. Current status: ' + document.status,
        });
        return;
      }

      // Create analysis record
      const analysis = await prisma.analysis.create({
        data: {
          documentId: document.id,
          firmId: req.firmId!,
          type: 'CONTRACT_RISK',
          status: 'PENDING',
        },
      });

      // Trigger async analysis job
      const job = await prisma.job.create({
        data: {
          firmId: req.firmId!,
          type: 'ANALYSIS_RUN',
          status: 'PENDING',
          result: { analysisId: analysis.id, documentId: document.id },
        },
      });

      // Update analysis to PROCESSING
      await prisma.analysis.update({
        where: { id: analysis.id },
        data: { status: 'PROCESSING' },
      });

      // For MVP: simulate completion with realistic results after creation
      // In production, this would be a background worker processing the job
      simulateAnalysisCompletion(analysis.id, job.id).catch((err) => {
        console.error('Simulated analysis failed:', err);
      });

      (res as any).locals = { auditDetails: { type: 'CONTRACT_RISK', jobId: job.id } };

      res.status(201).json({
        analysis,
        jobId: job.id,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /:id/analysis ─── Get analysis results ─────────────────────────────
router.get('/:id/analysis', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const document = await prisma.document.findFirst({
      where: {
        id: req.params.id,
        firmId: req.firmId,
      },
    });

    if (!document) {
      throw new NotFoundError('Document');
    }

    const analyses = await prisma.analysis.findMany({
      where: {
        documentId: req.params.id,
        firmId: req.firmId,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(analyses);
  } catch (err) {
    next(err);
  }
});

// ─── POST /:id/compare ─── Compare documents ───────────────────────────────
const compareSchema = z.object({
  otherDocumentId: z.string().uuid('Invalid document ID'),
});

router.post(
  '/:id/compare',
  validate('body', compareSchema),
  auditAction('Analysis', 'COMPARISON_REQUESTED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { otherDocumentId } = req.body;

      // Verify both documents exist and belong to the same firm
      const [doc1, doc2] = await Promise.all([
        prisma.document.findFirst({
          where: { id: req.params.id, firmId: req.firmId },
        }),
        prisma.document.findFirst({
          where: { id: otherDocumentId, firmId: req.firmId },
        }),
      ]);

      if (!doc1) throw new NotFoundError('Primary document');
      if (!doc2) throw new NotFoundError('Comparison document');

      // Create comparison analysis
      const analysis = await prisma.analysis.create({
        data: {
          documentId: doc1.id,
          firmId: req.firmId!,
          type: 'COMPARISON',
          status: 'PENDING',
        },
      });

      // Trigger job
      const job = await prisma.job.create({
        data: {
          firmId: req.firmId!,
          type: 'ANALYSIS_RUN',
          status: 'PENDING',
          result: {
            analysisId: analysis.id,
            documentId: doc1.id,
            comparedWithId: doc2.id,
          },
        },
      });

      await prisma.analysis.update({
        where: { id: analysis.id },
        data: { status: 'PROCESSING' },
      });

      // Stub: simulate completion
      simulateComparisonCompletion(analysis.id, job.id, doc1.originalName, doc2.originalName).catch(
        (err) => console.error('Simulated comparison failed:', err),
      );

      (res as any).locals = {
        auditDetails: {
          type: 'COMPARISON',
          comparedWithId: otherDocumentId,
          jobId: job.id,
        },
      };

      res.status(201).json({
        analysis,
        jobId: job.id,
        comparedWith: {
          id: doc2.id,
          originalName: doc2.originalName,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Simulated background processing ────────────────────────────────────────

async function simulateAnalysisCompletion(analysisId: string, jobId: string) {
  // Simulate 3-second processing time
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const result = {
    summary:
      'This contract has been reviewed for risk and compliance. Several clauses warrant attention.',
    riskScore: 62,
    riskLevel: 'MEDIUM',
    clauses: [
      {
        name: 'Indemnification',
        risk: 'HIGH',
        summary:
          'Broad indemnification clause lacks a defined basket amount and cap. Third-party claims coverage is open-ended.',
        recommendation:
          'Add a basket of 0.5% of contract value and cap indemnification at 1x fees, with carve-outs for fraud.',
        page: 3,
      },
      {
        name: 'Termination',
        risk: 'MEDIUM',
        summary:
          'Termination for convenience requires only 15 days notice, which may not allow adequate hand-off.',
        recommendation:
          'Extend notice period to 60 days to allow proper transition and offboarding.',
        page: 7,
      },
      {
        name: 'Liability Cap',
        risk: 'LOW',
        summary:
          'Liability cap is reasonable at 1x fees with standard carve-outs for fraud and IP infringement.',
        page: 5,
      },
      {
        name: 'Confidentiality',
        risk: 'LOW',
        summary:
          'Mutual NDA with standard 5-year term and carve-outs for required disclosures.',
        page: 9,
      },
    ],
    keyDates: [
      { description: 'Effective Date', date: '2026-07-01' },
      { description: 'Termination Notice Deadline', date: '2026-12-31' },
    ],
    parties: ['Sterling & Associates', 'Counterparty Ltd.'],
    governingLaw: 'Delaware',
    contractValue: '$250,000',
    wordCount: 8423,
  };

  await Promise.all([
    prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: 'COMPLETED',
        result,
        modelUsed: 'gpt-4o',
        completedAt: new Date(),
      },
    }),
    prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        result: { analysisId },
        completedAt: new Date(),
      },
    }),
  ]);
}

async function simulateComparisonCompletion(
  analysisId: string,
  jobId: string,
  doc1Name: string,
  doc2Name: string,
) {
  await new Promise((resolve) => setTimeout(resolve, 4000));

  const result = {
    summary: `Comparison between "${doc1Name}" and "${doc2Name}" reveals 12 differences across 5 major clauses.`,
    differences: [
      {
        clause: 'Indemnification',
        document1:
          'Broad indemnification for any third-party claims, uncapped.',
        document2:
          'Indemnification with $50,000 basket and cap at contract value.',
        change: 'MODIFIED',
        impact: 'HIGH',
        explanation:
          'The second document adds significant limitations to indemnification obligations.',
      },
      {
        clause: 'Termination Notice',
        document1: '15 calendar days written notice.',
        document2: '60 calendar days written notice.',
        change: 'MODIFIED',
        impact: 'MEDIUM',
        explanation:
          'Notice period extended from 15 to 60 days, providing more preparation time.',
      },
      {
        clause: 'Governing Law',
        document1: 'Delaware',
        document2: 'New York',
        change: 'MODIFIED',
        impact: 'MEDIUM',
        explanation:
          'Change in governing law jurisdiction may affect interpretation and enforcement.',
      },
      {
        clause: 'Data Protection',
        document1: 'Not addressed.',
        document2:
          'Full DPA addendum with GDPR compliance, 72-hour breach notification.',
        change: 'ADDED',
        impact: 'HIGH',
        explanation:
          'Data protection provisions added, introducing new compliance obligations.',
      },
      {
        clause: 'Non-Compete',
        document1: '12-month non-compete, all regions.',
        document2: 'Not present.',
        change: 'REMOVED',
        impact: 'HIGH',
        explanation:
          'The non-compete clause has been removed entirely from the second document.',
      },
    ],
    addedClauses: 3,
    removedClauses: 2,
    modifiedClauses: 7,
    unchangedClauses: 18,
  };

  await Promise.all([
    prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: 'COMPLETED',
        result,
        modelUsed: 'gpt-4o',
        completedAt: new Date(),
      },
    }),
    prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        result: { analysisId },
        completedAt: new Date(),
      },
    }),
  ]);
}

export default router;
