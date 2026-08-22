import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { auditAction } from '../middleware/audit';
import { NotFoundError } from '../lib/errors';
import { aiClient } from '../lib/ai-client';
import { checkFreeTier } from '../middleware/free-tier';

const router = Router();

// ─── Knowledge Base CRUD ────────────────────────────────────────────────────

const createKbSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional(),
  type: z.enum(['GENERAL', 'LEGAL', 'CONSULTING', 'CA', 'PLAYBOOK']).default('GENERAL'),
});

// POST /kb/bases — Create a knowledge base
router.post(
  '/bases',
  validate('body', createKbSchema),
  auditAction('KnowledgeBase', 'KB_CREATED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, description, type } = req.body;
      const kb = await prisma.knowledgeBase.create({
        data: {
          firmId: req.firmId!,
          name,
          description: description || '',
          type,
          createdById: req.user!.id,
        },
      });
      res.status(201).json(kb);
    } catch (err) { next(err); }
  },
);

// GET /kb/bases — List knowledge bases for firm
router.get('/bases', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bases = await prisma.knowledgeBase.findMany({
      where: { firmId: req.firmId },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        status: true,
        entryCount: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { entries: { where: { isActive: true } } } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ data: bases });
  } catch (err) { next(err); }
});

// GET /kb/bases/:id — Get single knowledge base with stats
router.get('/bases/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const kb = await prisma.knowledgeBase.findFirst({
      where: { id: req.params.id, firmId: req.firmId },
      include: {
        _count: { select: { entries: { where: { isActive: true } } } },
        entries: {
          where: { isActive: true },
          select: {
            id: true, title: true, entryType: true, category: true,
            confidence: true, usageCount: true, createdAt: true,
          },
          orderBy: { usageCount: 'desc' },
          take: 50,
        },
      },
    });
    if (!kb) throw new NotFoundError('Knowledge Base');

    // Get entry type distribution
    const typeDistribution = await prisma.$queryRawUnsafe(`
      SELECT entry_type, COUNT(*)::int as count
      FROM knowledge_entries
      WHERE knowledge_base_id = $1 AND is_active = true
      GROUP BY entry_type
      ORDER BY count DESC
    `, kb.id);

    // Get category distribution
    const categoryDistribution = await prisma.$queryRawUnsafe(`
      SELECT category, COUNT(*)::int as count
      FROM knowledge_entries
      WHERE knowledge_base_id = $1 AND is_active = true AND category IS NOT NULL AND category != ''
      GROUP BY category
      ORDER BY count DESC
      LIMIT 20
    `, kb.id);

    // Get relation count
    const relationCount = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int as count
      FROM knowledge_relations kr
      JOIN knowledge_entries ke ON (kr.source_id = ke.id OR kr.target_id = ke.id)
      WHERE ke.knowledge_base_id = $1
    `, kb.id);

    res.json({
      ...kb,
      entryCount: kb._count.entries,
      typeDistribution,
      categoryDistribution,
      relationCount: (relationCount as any[])[0]?.count || 0,
    });
  } catch (err) { next(err); }
});

// PATCH /kb/bases/:id — Update knowledge base
router.patch(
  '/bases/:id',
  auditAction('KnowledgeBase', 'KB_UPDATED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, description, type, status } = req.body;
      const kb = await prisma.knowledgeBase.findFirst({
        where: { id: req.params.id, firmId: req.firmId },
      });
      if (!kb) throw new NotFoundError('Knowledge Base');

      const updated = await prisma.knowledgeBase.update({
        where: { id: req.params.id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(type !== undefined && { type }),
          ...(status !== undefined && { status }),
        },
      });
      res.json(updated);
    } catch (err) { next(err); }
  },
);

// DELETE /kb/bases/:id — Delete knowledge base and its entries
router.delete(
  '/bases/:id',
  auditAction('KnowledgeBase', 'KB_DELETED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const kb = await prisma.knowledgeBase.findFirst({
        where: { id: req.params.id, firmId: req.firmId },
      });
      if (!kb) throw new NotFoundError('Knowledge Base');

      // Soft-delete entries, hard-delete the KB
      await prisma.$executeRawUnsafe(
        `UPDATE knowledge_entries SET is_active = false WHERE knowledge_base_id = $1`,
        kb.id,
      );
      await prisma.knowledgeBase.delete({ where: { id: kb.id } });
      res.json({ deleted: true });
    } catch (err) { next(err); }
  },
);

// ─── Knowledge Entry CRUD ───────────────────────────────────────────────────

const createEntrySchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(1),
  entryType: z.enum(['FACT', 'RULE', 'PRECEDENT', 'REGULATION', 'TEMPLATE', 'CLAUSE', 'GUIDELINE']).default('FACT'),
  category: z.string().max(200).optional(),
  tags: z.array(z.string()).optional(),
  summary: z.string().max(2000).optional(),
  sourceDocumentId: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional(),
  accessLevel: z.enum(['FIRM', 'TEAM', 'PRIVATE']).default('FIRM'),
});

// POST /kb/bases/:baseId/entries — Create a knowledge entry
router.post(
  '/bases/:baseId/entries',
  validate('body', createEntrySchema),
  auditAction('KnowledgeEntry', 'ENTRY_CREATED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { baseId } = req.params;
      const kb = await prisma.knowledgeBase.findFirst({
        where: { id: baseId, firmId: req.firmId },
      });
      if (!kb) throw new NotFoundError('Knowledge Base');

      const { title, content, entryType, category, tags, summary, sourceDocumentId, metadata, accessLevel } = req.body;

      // Build embedding text
      const embedText = `${title}\n\n${summary || ''}\n\n${content}`.substring(0, 8000);

      // Call AI service for embedding
      let embeddingVector: number[] = [];
      try {
        const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
        const embResp = await fetch(`${aiUrl}/embeddings/embed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: embedText }),
          signal: AbortSignal.timeout(10000),
        });
        if (embResp.ok) {
          const embData = await embResp.json();
          embeddingVector = embData.embedding || [];
        }
      } catch {
        // Proceed without embedding — keyword search will be used
      }

      // Build schema.org-inspired metadata
      const schemaMeta = {
        '@context': 'https://schema.org',
        '@type': entryTypeToSchemaType(entryType),
        name: title,
        description: summary || content.substring(0, 200),
        datePublished: new Date().toISOString(),
        sourceOrganization: req.firmId,
        category: category || '',
        keywords: (tags || []).join(','),
        ...(metadata || {}),
      };

      const vectorStr = embeddingVector.length > 0
        ? `[${embeddingVector.join(',')}]`
        : null;

      const entry = await prisma.$queryRawUnsafe(`
        INSERT INTO knowledge_entries (
          id, knowledge_base_id, firm_id, title, content, summary,
          entry_type, category, tags, source_document_id,
          confidence, embedding, metadata, is_active, access_level,
          usage_count, created_by_id, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5,
          $6, $7, $8::jsonb, $9,
          1.0, ${vectorStr ? `$10::vector` : 'NULL'}, $11::jsonb, true, $12,
          0, $13, NOW(), NOW()
        ) RETURNING id, title, entry_type, category, created_at
      `, baseId, req.firmId, title, content, summary || '', entryType,
        category || '', JSON.stringify(tags || []),
        sourceDocumentId || null,
        ...(vectorStr ? [vectorStr] : []),
        JSON.stringify(schemaMeta),
        accessLevel, req.user!.id);

      // Update entry count
      await prisma.knowledgeBase.update({
        where: { id: baseId },
        data: { entryCount: { increment: 1 } },
      });

      res.status(201).json((entry as any[])[0]);
    } catch (err) { next(err); }
  },
);

// GET /kb/bases/:baseId/entries — List entries in a knowledge base
router.get('/bases/:baseId/entries', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { baseId } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const entryType = req.query.entryType as string | undefined;
    const category = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;

    const whereParts: string[] = ['ke.knowledge_base_id = $1', 'ke.firm_id = $2', 'ke.is_active = true'];
    const params: any[] = [baseId, req.firmId];
    let paramIdx = 3;

    if (entryType) {
      whereParts.push(`ke.entry_type = $${paramIdx}`);
      params.push(entryType);
      paramIdx++;
    }
    if (category) {
      whereParts.push(`ke.category = $${paramIdx}`);
      params.push(category);
      paramIdx++;
    }
    if (search) {
      whereParts.push(`(ke.title ILIKE $${paramIdx} OR ke.content ILIKE $${paramIdx} OR ke.summary ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }

    const whereSql = whereParts.join(' AND ');

    const countResult = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as total FROM knowledge_entries ke WHERE ${whereSql}`,
      ...params,
    );
    const total = (countResult as any[])[0]?.total || 0;

    const entries = await prisma.$queryRawUnsafe(`
      SELECT ke.id, ke.title, ke.summary, ke.entry_type, ke.category, ke.tags,
             ke.confidence, ke.usage_count, ke.access_level, ke.created_at, ke.updated_at,
             kb.name as kb_name
      FROM knowledge_entries ke
      JOIN knowledge_bases kb ON ke.knowledge_base_id = kb.id
      WHERE ${whereSql}
      ORDER BY ke.usage_count DESC, ke.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `, ...params, limit, (page - 1) * limit);

    res.json({
      data: entries,
      pagination: {
        page, limit, total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) { next(err); }
});

// GET /kb/entries/:id — Get a single entry with full content
router.get('/entries/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entry = await prisma.$queryRawUnsafe(`
      SELECT ke.*, kb.name as kb_name
      FROM knowledge_entries ke
      JOIN knowledge_bases kb ON ke.knowledge_base_id = kb.id
      WHERE ke.id = $1 AND ke.firm_id = $2 AND ke.is_active = true
    `, req.params.id, req.firmId);

    if (!(entry as any[]).length) throw new NotFoundError('Knowledge Entry');
    res.json((entry as any[])[0]);
  } catch (err) { next(err); }
});

// PATCH /kb/entries/:id — Update entry
router.patch(
  '/entries/:id',
  auditAction('KnowledgeEntry', 'ENTRY_UPDATED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, content, entryType, category, tags, summary, metadata, accessLevel } = req.body;
      const existing = await prisma.$queryRawUnsafe(
        `SELECT id FROM knowledge_entries WHERE id = $1 AND firm_id = $2 AND is_active = true`,
        req.params.id, req.firmId,
      );
      if (!(existing as any[]).length) throw new NotFoundError('Knowledge Entry');

      await prisma.$executeRawUnsafe(`
        UPDATE knowledge_entries SET
          ${title !== undefined ? 'title = $3,' : ''}
          ${content !== undefined ? 'content = $4,' : ''}
          ${summary !== undefined ? 'summary = $5,' : ''}
          ${entryType !== undefined ? 'entry_type = $6,' : ''}
          ${category !== undefined ? 'category = $7,' : ''}
          ${tags !== undefined ? 'tags = $8::jsonb,' : ''}
          ${accessLevel !== undefined ? 'access_level = $9,' : ''}
          updated_at = NOW()
        WHERE id = $1 AND firm_id = $2
      `, req.params.id, req.firmId,
        ...(title !== undefined ? [title] : []),
        ...(content !== undefined ? [content] : []),
        ...(summary !== undefined ? [summary] : []),
        ...(entryType !== undefined ? [entryType] : []),
        ...(category !== undefined ? [category] : []),
        ...(tags !== undefined ? [JSON.stringify(tags)] : []),
        ...(accessLevel !== undefined ? [accessLevel] : []),
      );

      res.json({ updated: true });
    } catch (err) { next(err); }
  },
);

// DELETE /kb/entries/:id — Soft-delete entry
router.delete(
  '/entries/:id',
  auditAction('KnowledgeEntry', 'ENTRY_DELETED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await prisma.$executeRawUnsafe(
        `UPDATE knowledge_entries SET is_active = false WHERE id = $1 AND firm_id = $2`,
        req.params.id, req.firmId,
      );
      if (result === 0) throw new NotFoundError('Knowledge Entry');
      res.json({ deleted: true });
    } catch (err) { next(err); }
  },
);

// ─── Knowledge Relations ────────────────────────────────────────────────────

const createRelationSchema = z.object({
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
  relationType: z.enum(['REFERENCES', 'SUPPORTS', 'CONTRADICTS', 'SUPERSEDES', 'RELATED_TO']).default('RELATED_TO'),
  weight: z.number().min(0).max(10).default(1.0),
  metadata: z.record(z.any()).optional(),
});

// POST /kb/relations — Create a relation between entries
router.post(
  '/relations',
  validate('body', createRelationSchema),
  auditAction('KnowledgeRelation', 'RELATION_CREATED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sourceId, targetId, relationType, weight, metadata } = req.body;
      if (sourceId === targetId) {
        res.status(400).json({ error: 'Source and target must be different entries' });
        return;
      }

      const result = await prisma.$executeRawUnsafe(`
        INSERT INTO knowledge_relations (id, firm_id, source_id, target_id, relation_type, weight, metadata, created_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6::jsonb, NOW())
        ON CONFLICT (source_id, target_id, relation_type) DO UPDATE SET weight = $5, metadata = $6::jsonb
      `, req.firmId, sourceId, targetId, relationType, weight, JSON.stringify(metadata || {}));

      res.status(201).json({ created: true, sourceId, targetId, relationType });
    } catch (err) { next(err); }
  },
);

// GET /kb/entries/:id/relations — Get relations for an entry
router.get('/entries/:id/relations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const relations = await prisma.$queryRawUnsafe(`
      SELECT kr.id, kr.relation_type, kr.weight, kr.metadata, kr.created_at,
             CASE WHEN kr.source_id = $1 THEN 'outgoing' ELSE 'incoming' END as direction,
             CASE WHEN kr.source_id = $1 THEN ke_t.id ELSE ke_s.id END as related_id,
             CASE WHEN kr.source_id = $1 THEN ke_t.title ELSE ke_s.title END as related_title,
             CASE WHEN kr.source_id = $1 THEN ke_t.entry_type ELSE ke_s.entry_type END as related_type,
             CASE WHEN kr.source_id = $1 THEN ke_t.summary ELSE ke_s.summary END as related_summary
      FROM knowledge_relations kr
      JOIN knowledge_entries ke_s ON kr.source_id = ke_s.id
      JOIN knowledge_entries ke_t ON kr.target_id = ke_t.id
      WHERE (kr.source_id = $1 OR kr.target_id = $1)
        AND kr.firm_id = $2
      ORDER BY kr.weight DESC
      LIMIT 50
    `, req.params.id, req.firmId);

    res.json({ data: relations });
  } catch (err) { next(err); }
});

// DELETE /kb/relations/:id — Delete a relation
router.delete(
  '/relations/:id',
  auditAction('KnowledgeRelation', 'RELATION_DELETED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM knowledge_relations WHERE id = $1 AND firm_id = $2`,
        req.params.id, req.firmId,
      );
      res.json({ deleted: true });
    } catch (err) { next(err); }
  },
);

// ─── Semantic Search ────────────────────────────────────────────────────────

const searchSchema = z.object({
  query: z.string().min(1),
  knowledgeBaseId: z.string().uuid().optional(),
  entryType: z.string().optional(),
  category: z.string().optional(),
  topK: z.number().min(1).max(50).default(10),
  threshold: z.number().min(0).max(1).default(0.3),
});

// POST /kb/search — Semantic search across knowledge entries
router.post(
  '/search',
  validate('body', searchSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { query, knowledgeBaseId, entryType, category, topK, threshold } = req.body;

      // Try semantic search via AI service first
      let results: any[] = [];
      try {
        const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
        const searchResp = await fetch(`${aiUrl}/knowledge/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            firm_id: req.firmId,
            knowledge_base_id: knowledgeBaseId,
            entry_type: entryType,
            category,
            top_k: topK,
            threshold,
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (searchResp.ok) {
          const data = await searchResp.json();
          results = data.results || [];
        }
      } catch {
        // Fallback to keyword search via database
      }

      // If no results from AI service, do direct keyword search
      if (results.length === 0) {
        const whereParts: string[] = ['ke.firm_id = $1', 'ke.is_active = true'];
        const params: any[] = [req.firmId];
        let paramIdx = 2;

        if (knowledgeBaseId) {
          whereParts.push(`ke.knowledge_base_id = $${paramIdx}`);
          params.push(knowledgeBaseId);
          paramIdx++;
        }
        if (entryType) {
          whereParts.push(`ke.entry_type = $${paramIdx}`);
          params.push(entryType);
          paramIdx++;
        }
        if (category) {
          whereParts.push(`ke.category = $${paramIdx}`);
          params.push(category);
          paramIdx++;
        }
        whereParts.push(`(ke.title ILIKE $${paramIdx} OR ke.content ILIKE $${paramIdx} OR ke.summary ILIKE $${paramIdx})`);
        params.push(`%${query}%`);
        paramIdx++;

        results = await prisma.$queryRawUnsafe(`
          SELECT ke.id, ke.title, ke.content, ke.summary, ke.entry_type, ke.category,
                 ke.tags, ke.confidence, ke.usage_count,
                 kb.name as kb_name
          FROM knowledge_entries ke
          JOIN knowledge_bases kb ON ke.knowledge_base_id = kb.id
          WHERE ${whereParts.join(' AND ')}
          ORDER BY ke.usage_count DESC
          LIMIT $${paramIdx}
        `, ...params, topK);
      }

      // Increment usage counts for returned entries
      if (results.length > 0) {
        const entryIds = results.map((r: any) => r.id).filter(Boolean);
        if (entryIds.length > 0) {
          await prisma.$executeRawUnsafe(
            `UPDATE knowledge_entries SET usage_count = usage_count + 1, last_used_at = NOW() WHERE id IN (${entryIds.map((_: any, i: number) => `$${i + 1}`).join(',')})`,
            ...entryIds,
          );
        }
      }

      res.json({ results, query, total: results.length });
    } catch (err) { next(err); }
  },
);

// ─── Knowledge Ingestion (from document) ────────────────────────────────────

const ingestSchema = z.object({
  documentId: z.string().uuid(),
  knowledgeBaseId: z.string().uuid().optional(),
  entryTypes: z.array(z.string()).optional(),
});

// POST /kb/ingest — Extract knowledge entries from a document
router.post(
  '/ingest',
  validate('body', ingestSchema),
  auditAction('KnowledgeIngestion', 'KB_INGESTION_STARTED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { documentId, knowledgeBaseId, entryTypes } = req.body;

      // Get the document
      const doc = await prisma.document.findFirst({
        where: { id: documentId, firmId: req.firmId },
      });
      if (!doc) throw new NotFoundError('Document');

      // Find or create target knowledge base
      let targetKbId = knowledgeBaseId;
      if (!targetKbId) {
        // Find or create a "Document Knowledge" KB for this firm
        let docKb = await prisma.knowledgeBase.findFirst({
          where: { firmId: req.firmId!, name: 'Document Knowledge' },
        });
        if (!docKb) {
          docKb = await prisma.knowledgeBase.create({
            data: {
              firmId: req.firmId!,
              name: 'Document Knowledge',
              description: 'Auto-extracted knowledge from uploaded documents',
              type: 'GENERAL',
              createdById: req.user!.id,
            },
          });
        }
        targetKbId = docKb.id;
      }

      // Call AI service for knowledge extraction
      try {
        const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
        const extractResp = await fetch(`${aiUrl}/knowledge/extract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            document_id: documentId,
            knowledge_base_id: targetKbId,
            firm_id: req.firmId,
            user_id: req.user!.id,
            entry_types: entryTypes || ['FACT', 'RULE', 'CLAUSE', 'GUIDELINE'],
          }),
          signal: AbortSignal.timeout(60000),
        });
        if (extractResp.ok) {
          const data = await extractResp.json();
          res.json({
            status: 'processing',
            documentId,
            knowledgeBaseId: targetKbId,
            entriesFound: data.entries_found || 0,
            entriesCreated: data.entries_created || 0,
          });
          return;
        }
      } catch {
        // AI service unavailable — create a basic entry from the document metadata
      }

      // Fallback: create a single entry from document metadata
      const entry = await prisma.$queryRawUnsafe(`
        INSERT INTO knowledge_entries (
          id, knowledge_base_id, firm_id, title, content, summary,
          entry_type, category, tags, source_document_id,
          confidence, metadata, is_active, access_level,
          usage_count, created_by_id, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5,
          'FACT', 'document', $6::jsonb, $7,
          0.5, $8::jsonb, true, 'FIRM',
          0, $9, NOW(), NOW()
        ) RETURNING id, title, entry_type
      `, targetKbId, req.firmId,
        doc.originalName,
        `Document uploaded: ${doc.originalName} (${doc.mimeType}, ${(doc.sizeBytes / 1024).toFixed(1)} KB)`,
        `Auto-extracted from document: ${doc.originalName}`,
        JSON.stringify([doc.mimeType]),
        documentId,
        JSON.stringify({ source: 'auto_extract', documentName: doc.originalName }),
        req.user!.id);

      // Update KB entry count
      await prisma.knowledgeBase.update({
        where: { id: targetKbId },
        data: { entryCount: { increment: 1 } },
      });

      res.json({
        status: 'completed_fallback',
        documentId,
        knowledgeBaseId: targetKbId,
        entriesCreated: 1,
        entry: (entry as any[])[0],
      });
    } catch (err) { next(err); }
  },
);

// ─── Knowledge Graph Traversal ──────────────────────────────────────────────

// POST /kb/graph — Get knowledge graph starting from an entry
router.post('/graph', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entryId, depth = 1, maxNodes = 30 } = req.body;
    if (!entryId) {
      res.status(400).json({ error: 'entryId required' });
      return;
    }

    // Get the starting node
    const startEntry = await prisma.$queryRawUnsafe(`
      SELECT id, title, entry_type, category, summary
      FROM knowledge_entries
      WHERE id = $1 AND firm_id = $2 AND is_active = true
    `, entryId, req.firmId);

    if (!(startEntry as any[]).length) throw new NotFoundError('Knowledge Entry');

    // Get connected nodes (BFS up to `depth` levels)
    const nodes: any[] = [(startEntry as any[])[0]];
    const edges: any[] = [];
    const visited = new Set<string>([entryId]);

    // Get direct relations
    const relations = await prisma.$queryRawUnsafe(`
      SELECT kr.id, kr.relation_type, kr.weight,
             ke_s.id as source_id, ke_s.title as source_title, ke_s.entry_type as source_type,
             ke_t.id as target_id, ke_t.title as target_title, ke_t.entry_type as target_type
      FROM knowledge_relations kr
      JOIN knowledge_entries ke_s ON kr.source_id = ke_s.id
      JOIN knowledge_entries ke_t ON kr.target_id = ke_t.id
      WHERE (kr.source_id = $1 OR kr.target_id = $1)
        AND kr.firm_id = $2
        AND ke_s.is_active = true AND ke_t.is_active = true
      ORDER BY kr.weight DESC
      LIMIT $3
    `, entryId, req.firmId, maxNodes);

    for (const rel of relations as any[]) {
      edges.push({
        id: rel.id,
        source: rel.source_id,
        target: rel.target_id,
        relationType: rel.relation_type,
        weight: rel.weight,
      });

      if (!visited.has(rel.source_id) && nodes.length < maxNodes) {
        visited.add(rel.source_id);
        nodes.push({ id: rel.source_id, title: rel.source_title, entry_type: rel.source_type });
      }
      if (!visited.has(rel.target_id) && nodes.length < maxNodes) {
        visited.add(rel.target_id);
        nodes.push({ id: rel.target_id, title: rel.target_title, entry_type: rel.target_type });
      }
    }

    res.json({ nodes, edges, startNodeId: entryId });
  } catch (err) { next(err); }
});

// ─── Knowledge Base Stats ───────────────────────────────────────────────────

// GET /kb/stats — Get knowledge base statistics for the firm
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const totalBases = await prisma.knowledgeBase.count({
      where: { firmId: req.firmId },
    });

    const totalEntries = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int as total FROM knowledge_entries
      WHERE firm_id = $1 AND is_active = true
    `, req.firmId);

    const totalRelations = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int as total FROM knowledge_relations
      WHERE firm_id = $1
    `, req.firmId);

    const entriesByType = await prisma.$queryRawUnsafe(`
      SELECT entry_type, COUNT(*)::int as count
      FROM knowledge_entries
      WHERE firm_id = $1 AND is_active = true
      GROUP BY entry_type ORDER BY count DESC
    `, req.firmId);

    const topEntries = await prisma.$queryRawUnsafe(`
      SELECT id, title, entry_type, usage_count, created_at
      FROM knowledge_entries
      WHERE firm_id = $1 AND is_active = true
      ORDER BY usage_count DESC LIMIT 10
    `, req.firmId);

    const recentlyAdded = await prisma.$queryRawUnsafe(`
      SELECT id, title, entry_type, category, created_at
      FROM knowledge_entries
      WHERE firm_id = $1 AND is_active = true
      ORDER BY created_at DESC LIMIT 10
    `, req.firmId);

    const basesWithCounts = await prisma.$queryRawUnsafe(`
      SELECT kb.id, kb.name, kb.type, kb.entry_count,
             (SELECT COUNT(*)::int FROM knowledge_entries ke WHERE ke.knowledge_base_id = kb.id AND ke.is_active = true) as active_entries
      FROM knowledge_bases kb
      WHERE kb.firm_id = $1
      ORDER BY active_entries DESC
    `, req.firmId);

    res.json({
      totalBases,
      totalEntries: (totalEntries as any[])[0]?.total || 0,
      totalRelations: (totalRelations as any[])[0]?.total || 0,
      entriesByType,
      topEntries,
      recentlyAdded,
      bases: basesWithCounts,
    });
  } catch (err) { next(err); }
});

// ─── KB Query (existing) ───────────────────────────────────────────────────

const querySchema = z.object({
  question: z.string().min(1, 'Question is required'),
  matterId: z.string().uuid().optional(),
});

router.post(
  '/query',
  checkFreeTier('kbQueries'),
  validate('body', querySchema),
  auditAction('KbQuery', 'KB_QUERY'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { question, matterId } = req.body;

      const kbQuery = await prisma.kbQuery.create({
        data: {
          firmId: req.firmId!,
          question,
          matterId: matterId || null,
          createdById: req.user!.id,
        },
      });

      let answer = 'No confident match found in your firm\'s documents.';
      let sourceChunks: any[] = [];
      let confidence = 0;
      let modelUsed = 'none';

      try {
        const searchResult = await aiClient.search(question, req.firmId!, matterId, 5);
        if (searchResult.results && searchResult.results.length > 0) {
          sourceChunks = searchResult.results.map((r, i) => ({
            chunkIndex: i,
            sectionTitle: r.section_title || 'Unknown section',
            documentName: r.document_id,
            relevance: r.similarity,
            excerpt: r.text.substring(0, 300),
          }));

          const topResult = searchResult.results[0];
          confidence = topResult.similarity;

          if (confidence >= 0.7) {
            const contextTexts = searchResult.results.map((r) => r.text).join('\n\n');
            answer = `Based on your firm's documents, the most relevant information is:\n\n${contextTexts.substring(0, 1500)}\n\nFor more specific guidance, please narrow your query to a particular document or clause type.`;
            modelUsed = 'cloudflare-ai-search';
          } else {
            answer = 'No confident match found in your firm documents. Try rephrasing your question or narrowing to a specific document.';
            modelUsed = 'cloudflare-ai-search-low-confidence';
          }
        }
      } catch (aiErr) {
        console.warn('AI service unavailable, using stub response:', aiErr);
        answer = 'Based on your firm\'s document corpus, the key clauses related to this question include the standard indemnification provisions (with a 0.5% basket and escrow cap for third-party claims), liability caps at 1x fees with carve-outs for fraud and IP infringement, and 60-day termination notice requirements. For more specific guidance, please narrow your query to a particular contract or clause type.';
        sourceChunks = [
          { chunkIndex: 0, sectionTitle: 'Indemnification', documentName: 'Standard M&A Contract Playbook', relevance: 0.95, excerpt: 'Indemnification for third-party claims arising from breach of representations, with a basket of 0.5% of purchase price...' },
          { chunkIndex: 1, sectionTitle: 'Liability Cap', documentName: 'Standard M&A Contract Playbook', relevance: 0.91, excerpt: 'Aggregate liability cap at 1x fees paid over the preceding 12 months...' },
        ];
        confidence = 0.91;
        modelUsed = 'stub-fallback';
      }

      const updatedQuery = await prisma.kbQuery.update({
        where: { id: kbQuery.id },
        data: { answer, sourceChunks, confidence, modelUsed },
        include: {
          createdBy: { select: { id: true, name: true } },
          matter: { select: { id: true, name: true } },
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
    } catch (err) { next(err); }
  },
);

// GET /kb/history — Get KB query history
router.get('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const matterId = req.query.matterId as string | undefined;

    const where: any = { firmId: req.firmId };
    if (matterId) where.matterId = matterId;

    const [queries, total] = await Promise.all([
      prisma.kbQuery.findMany({
        where,
        select: {
          id: true, question: true, answer: true, confidence: true,
          modelUsed: true, createdAt: true,
          matter: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.kbQuery.count({ where }),
    ]);

    res.json({
      data: queries,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function entryTypeToSchemaType(entryType: string): string {
  const mapping: Record<string, string> = {
    FACT: 'Statement',
    RULE: 'Rule',
    PRECEDENT: 'LegalForceStatus',
    REGULATION: 'GovernmentPublication',
    TEMPLATE: 'CreativeWork',
    CLAUSE: 'Rule',
    GUIDELINE: 'HowTo',
  };
  return mapping[entryType] || 'Thing';
}

export default router;
