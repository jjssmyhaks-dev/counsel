import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('@counsel/database', () => ({
  prisma: {
    matter: {
      findMany: vi.fn().mockResolvedValue([
        { id: '1', name: 'Test Matter', clientName: 'Test Client', status: 'ACTIVE', type: 'LEGAL', updatedAt: new Date() },
      ]),
      count: vi.fn().mockResolvedValue(1),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import matterRoutes from '../../src/routes/matters';

const app = express();
app.use(express.json());
app.use((req: any, _res: any, next: any) => {
  req.firmId = 'test-firm-id';
  req.user = { id: 'test-user-id' };
  next();
});
app.use('/api/v1/matters', matterRoutes);

describe('Matters Routes', () => {
  describe('GET /', () => {
    it('returns paginated matters', async () => {
      const res = await request(app).get('/api/v1/matters');
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.pagination).toBeDefined();
    });

    it('accepts page and limit params', async () => {
      const res = await request(app).get('/api/v1/matters?page=1&limit=5');
      expect(res.status).toBe(200);
    });

    it('accepts status filter', async () => {
      const res = await request(app).get('/api/v1/matters?status=ACTIVE');
      expect(res.status).toBe(200);
    });
  });
});
