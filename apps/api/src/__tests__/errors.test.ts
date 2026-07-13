import { describe, it, expect } from 'vitest';
import { NotFoundError, ForbiddenError, ValidationError, UnauthorizedError, AppError } from '../lib/errors';

describe('Custom Error Classes', () => {
  describe('NotFoundError', () => {
    it('should have status 404 and default message', () => {
      const err = new NotFoundError();
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe('NOT_FOUND');
      expect(err.message).toBe('Resource not found');
    });

    it('should accept a custom resource name', () => {
      const err = new NotFoundError('Document');
      expect(err.message).toBe('Document not found');
      expect(err.statusCode).toBe(404);
    });
  });

  describe('ForbiddenError', () => {
    it('should have status 403', () => {
      const err = new ForbiddenError();
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('FORBIDDEN');
    });

    it('should accept a custom message', () => {
      const err = new ForbiddenError('No access to this matter');
      expect(err.message).toBe('No access to this matter');
    });
  });

  describe('ValidationError', () => {
    it('should have status 400', () => {
      const err = new ValidationError('Invalid input');
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('UnauthorizedError', () => {
    it('should have status 401', () => {
      const err = new UnauthorizedError();
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('UNAUTHORIZED');
    });

    it('should accept a custom message', () => {
      const err = new UnauthorizedError('Token expired');
      expect(err.message).toBe('Token expired');
    });
  });

  it('should all be instanceof AppError', () => {
    expect(new NotFoundError()).toBeInstanceOf(AppError);
    expect(new ForbiddenError()).toBeInstanceOf(AppError);
    expect(new ValidationError('x')).toBeInstanceOf(AppError);
    expect(new UnauthorizedError()).toBeInstanceOf(AppError);
  });

  it('should all be instanceof Error', () => {
    expect(new NotFoundError()).toBeInstanceOf(Error);
    expect(new ForbiddenError()).toBeInstanceOf(Error);
    expect(new ValidationError('x')).toBeInstanceOf(Error);
    expect(new UnauthorizedError()).toBeInstanceOf(Error);
  });

  it('should set the error name correctly', () => {
    expect(new NotFoundError().name).toBe('NotFoundError');
    expect(new ForbiddenError().name).toBe('ForbiddenError');
    expect(new ValidationError('x').name).toBe('ValidationError');
    expect(new UnauthorizedError().name).toBe('UnauthorizedError');
  });
});
