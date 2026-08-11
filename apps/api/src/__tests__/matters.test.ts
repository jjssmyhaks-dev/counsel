import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

jest.mock('@counsel/database', () => ({
  prisma: {
    matter: {
      findMany: jest.fn().mockResolvedValue([
        { id: '1', name: 'Test Matter', clientName: 'Test Client', status: 'ACTIVE', type: 'LEGAL', updatedAt: new Date() },
      ]),
      count: jest.fn().mockResolvedValue(1),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import matterRoutes from '../../src/routes/matters';

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.firmId = 'test-firm-id';
  req.user = { id: 'test-user-id' };
  next();
});
app.use('/api/v1/matters', matterRoutes);

describe('Matters Routes', () => {
  describe('GET /', () => {
    it('should return paginated matters', async () => {
      const res = await request(app).get('/api/v1/matters');
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.pagination).toBeDefined();
    });

    it('should accept page and limit params', async () => {
      const res = await request(app).get('/api/v1/matters?page=1&limit=5');
      expect(res.status).toBe(200);
    });

    it('should accept status filter', async () => {
      const res = await request(app).get('/api/v1/matters?status=ACTIVE');
      expect(res.status).toBe(200);
    });
  });
});
