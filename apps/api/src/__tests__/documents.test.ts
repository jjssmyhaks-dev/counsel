import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('@counsel/database', () => ({
  prisma: {
    document: {
      findMany: vi.fn().mockResolvedValue([
        { id: '1', originalName: 'contract.pdf', mimeType: 'application/pdf', sizeBytes: 1024, status: 'READY', createdAt: new Date() },
      ]),
      count: vi.fn().mockResolvedValue(1),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import documentRoutes from '../../src/routes/documents';

const app = express();
app.use(express.json());
app.use((req: any, _res: any, next: any) => {
  req.firmId = 'test-firm-id';
  req.user = { id: 'test-user-id' };
  next();
});
app.use('/api/v1/documents', documentRoutes);

describe('Documents Routes', () => {
  describe('GET /', () => {
    it('returns the firm document list', async () => {
      const res = await request(app).get('/api/v1/documents');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
    });
  });
});
