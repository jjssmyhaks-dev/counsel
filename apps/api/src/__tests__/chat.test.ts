import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('@counsel/database', () => ({
  prisma: {
    matter: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    chatConversation: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    document: { findMany: vi.fn() },
    researchBrief: { create: vi.fn(), findFirst: vi.fn() },
    draft: { create: vi.fn() },
    meeting: { create: vi.fn() },
    playbook: { findMany: vi.fn() },
    integrationHealthStatus: { findMany: vi.fn() },
    firm: { findUnique: vi.fn() },
    client: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    complianceItem: { findMany: vi.fn() },
    reconciliation: { findMany: vi.fn() },
    engagement: { findMany: vi.fn() },
  },
}));

import chatRoutes from '../../src/routes/chat';

const app = express();
app.use(express.json());

// Mock auth middleware (attaches firm/user context)
app.use((req: any, _res: any, next: any) => {
  req.firmId = 'test-firm-id';
  req.user = { id: 'test-user-id' };
  next();
});
app.use('/api/v1/chat', chatRoutes);

describe('Chat Routes', () => {
  describe('GET /tools', () => {
    it('returns the tool catalog', async () => {
      const res = await request(app).get('/api/v1/chat/tools');
      expect(res.status).toBe(200);
      expect(res.body.tools).toBeDefined();
      expect(Array.isArray(res.body.tools)).toBe(true);
      expect(res.body.tools.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('POST /message', () => {
    it('returns 400 for missing message', async () => {
      const res = await request(app).post('/api/v1/chat/message').send({});
      expect(res.status).toBe(400);
    });

    it('returns 400 for non-string message', async () => {
      const res = await request(app).post('/api/v1/chat/message').send({ message: 123 });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /history', () => {
    it('returns 400 for invalid action', async () => {
      const res = await request(app).post('/api/v1/chat/history').send({ action: 'invalid' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for save without messages', async () => {
      const res = await request(app).post('/api/v1/chat/history').send({ action: 'save' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for get without conversationId', async () => {
      const res = await request(app).post('/api/v1/chat/history').send({ action: 'get' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for delete without conversationId', async () => {
      const res = await request(app).post('/api/v1/chat/history').send({ action: 'delete' });
      expect(res.status).toBe(400);
    });
  });
});
