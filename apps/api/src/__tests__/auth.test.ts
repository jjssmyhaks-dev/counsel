import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock prisma before importing the route module
vi.mock('@counsel/database', () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    firm: { findFirst: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
  },
}));

import authRoutes from '../../src/routes/auth';

const app = express();
app.use(express.json());
app.use('/api/v1/auth', authRoutes);

describe('Auth Routes', () => {
  describe('POST /register', () => {
    it('returns 400 for invalid email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'not-an-email', password: 'password123', name: 'Test' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for short password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'test@test.com', password: 'short', name: 'Test' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for missing name', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'test@test.com', password: 'password123' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /login', () => {
    it('returns 400 for missing fields', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({ email: '' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid email format', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'bad', password: 'pass' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /forgot-password', () => {
    it('returns 400 for invalid email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'not-email' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /refresh', () => {
    it('returns 400 for missing refresh token', async () => {
      const res = await request(app).post('/api/v1/auth/refresh').send({});
      expect(res.status).toBe(400);
    });
  });
});
