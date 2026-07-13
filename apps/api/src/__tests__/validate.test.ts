import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { validate } from '../middleware/validate';

describe('Validation Middleware', () => {
  let req: any, res: any, next: any;

  beforeEach(() => {
    req = { body: {}, query: {}, params: {} };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
  });

  const testSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email'),
    age: z.number().min(0).optional(),
  });

  describe('body validation', () => {
    it('should pass valid body data through', () => {
      req.body = { name: 'John', email: 'john@test.com' };
      const middleware = validate('body', testSchema);
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(400);
    });

    it('should reject invalid body data with 400', () => {
      req.body = { name: '', email: 'not-an-email' };
      const middleware = validate('body', testSchema);
      middleware(req, res, next);
      // ValidationError is passed to next(), not a 400 response
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('VALIDATION_ERROR');
    });

    it('should reject missing required fields', () => {
      req.body = { email: 'john@test.com' }; // missing name
      const middleware = validate('body', testSchema);
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });

    it('should validate optional fields when present', () => {
      req.body = { name: 'John', email: 'john@test.com', age: 25 };
      const middleware = validate('body', testSchema);
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('query validation', () => {
    it('should validate query parameters', () => {
      req.query = { name: 'John', email: 'john@test.com' };
      const middleware = validate('query', testSchema);
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('params validation', () => {
    it('should validate route parameters', () => {
      const paramSchema = z.object({ id: z.string().uuid() });
      req.params = { id: '550e8400-e29b-41d4-a716-446655440000' };
      const middleware = validate('params', paramSchema);
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should reject invalid UUIDs in params', () => {
      const paramSchema = z.object({ id: z.string().uuid() });
      req.params = { id: 'not-a-uuid' };
      const middleware = validate('params', paramSchema);
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });
  });
});
