import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

jest.mock('@counsel/database', () => ({
  prisma: {
    matter: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    chatConversation: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    document: { findMany: jest.fn() },
    researchBrief: { create: jest.fn(), findFirst: jest.fn() },
    draft: { create: jest.fn() },
    meeting: { create: jest.fn() },
    playbook: { findMany: jest.fn() },
    integrationHealth: { findMany: jest.fn() },
    firm: { findUnique: jest.fn() },
    client: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
  },
}));

import chatRoutes from '../../src/routes/chat';

const app = express();
app.use(express.json());

// Mock auth middleware
app.use((req: any, _res, next) => {
  req.firmId = 'test-firm-id';
  req.user = { id: 'test-user-id' };
  next();
});
app.use('/api/v1/chat', chatRoutes);

describe('Chat Routes', () => {
  describe('GET /tools', () => {
    it('should return list of tools', async () => {
      const res = await request(app).get('/api/v1/chat/tools');
      expect(res.status).toBe(200);
      expect(res.body.tools).toBeDefined();
      expect(Array.isArray(res.body.tools)).toBe(true);
      expect(res.body.tools.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('POST /message', () => {
    it('should return 400 for missing message', async () => {
      const res = await request(app).post('/api/v1/chat/message').send({});
      expect(res.status).toBe(400);
    });

    it('should return 400 for non-string message', async () => {
      const res = await request(app).post('/api/v1/chat/message').send({ message: 123 });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /history', () => {
    it('should return 400 for invalid action', async () => {
      const res = await request(app).post('/api/v1/chat/history').send({ action: 'invalid' });
      expect(res.status).toBe(400);
    });

    it('should return 400 for save without messages', async () => {
      const res = await request(app).post('/api/v1/chat/history').send({ action: 'save' });
      expect(res.status).toBe(400);
    });

    it('should return 400 for get without conversationId', async () => {
      const res = await request(app).post('/api/v1/chat/history').send({ action: 'get' });
      expect(res.status).toBe(400);
    });

    it('should return 400 for delete without conversationId', async () => {
      const res = await request(app).post('/api/v1/chat/history').send({ action: 'delete' });
      expect(res.status).toBe(400);
    });
  });
});
