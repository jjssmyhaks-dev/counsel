import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { auditAction, requireRole } from '../middleware/audit';

// Mock @counsel/database
vi.mock('@counsel/database', () => ({
  prisma: {
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-log-1' }),
    },
  },
  Role: { ADMIN: 'ADMIN', PARTNER: 'PARTNER', ASSOCIATE: 'ASSOCIATE', ANALYST: 'ANALYST', READONLY: 'READONLY' },
}));

import { prisma } from '@counsel/database';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('Audit Middleware', () => {
  let req: any, res: any, next: any;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      user: { id: 'user-1', name: 'Test', email: 't@f.com' },
      firmId: 'firm-1',
      params: { id: 'doc-123' },
      headers: {} as Record<string, string>,
      socket: { remoteAddress: '127.0.0.1' },
    };

    res = new EventEmitter();
    res.statusCode = 200;
    (res as any).locals = {};

    next = vi.fn();
  });

  it('should call next() to pass control to the route handler', () => {
    const middleware = auditAction('Document', 'DOCUMENT_READ');
    middleware(req, res as any, next);
    expect(next).toHaveBeenCalled();
  });

  it('should log an audit entry when response finishes with 2xx', async () => {
    const middleware = auditAction('Document', 'DOCUMENT_READ');
    middleware(req, res as any, next);
    res.emit('finish');
    await flushPromises();

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          firmId: 'firm-1',
          userId: 'user-1',
          action: 'DOCUMENT_READ',
          resourceType: 'Document',
          resourceId: 'doc-123',
          ipAddress: '127.0.0.1',
        }),
      })
    );
  });

  it('should NOT log when status code is not 2xx', async () => {
    res.statusCode = 404;
    const middleware = auditAction('Document', 'DOCUMENT_READ');
    middleware(req, res as any, next);
    res.emit('finish');
    await flushPromises();

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('should NOT log when no user is present', async () => {
    req.user = undefined;
    req.firmId = undefined;
    const middleware = auditAction('Document', 'DOCUMENT_READ');
    middleware(req, res as any, next);
    res.emit('finish');
    await flushPromises();

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('should extract IP from x-forwarded-for header', async () => {
    req.headers['x-forwarded-for'] = '10.0.0.1, 10.0.0.2';
    const middleware = auditAction('Document', 'DOCUMENT_READ');
    middleware(req, res as any, next);
    res.emit('finish');
    await flushPromises();

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ipAddress: '10.0.0.1',
        }),
      })
    );
  });
});

describe('requireRole Middleware', () => {
  let req: any, res: any, next: any;

  beforeEach(() => {
    req = { user: null };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
  });

  it('should return 401 when no user is authenticated', () => {
    const middleware = requireRole('ADMIN');
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
  });

  it('should return 403 when user role is not in the allowed list', () => {
    req.user = { role: 'READONLY' };
    const middleware = requireRole('ADMIN', 'PARTNER');
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should call next() when user has the required role', () => {
    req.user = { role: 'ADMIN' };
    const middleware = requireRole('ADMIN', 'PARTNER');
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
