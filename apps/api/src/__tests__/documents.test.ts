import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

jest.mock('@counsel/database', () => ({
  prisma: {
    document: {
      findMany: jest.fn().mockResolvedValue([
        { id: '1', originalName: 'contract.pdf', mimeType: 'application/pdf', sizeBytes: 1024, status: 'READY', createdAt: new Date() },
      ]),
      count: jest.fn().mockResolvedValue(1),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import documentRoutes from '../../src/routes/documents';

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.firmId = 'test-firm-id';
  req.user = { id: 'test-user-id' };
  next();
});
app.use('/api/v1/documents', documentRoutes);

describe('Documents Routes', () => {
  describe('GET /', () => {
    it('should return list of documents', async () => {
      const res = await request(app).get('/api/v1/documents');
      expect(res.status).toBe(200);
    });
  });
});
