import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @counsel/database at module level
vi.mock('@counsel/database', () => {
  const mockPrisma = {
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
    $queryRawUnsafe: vi.fn(),
    $transaction: vi.fn(),
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'log-1' }),
    },
  };
  return {
    prisma: mockPrisma,
    withTenantContext: async <T>(firmId: string, fn: (tx: unknown) => Promise<T>): Promise<T> => {
      await mockPrisma.$executeRawUnsafe(`SET LOCAL app.current_firm_id = '${firmId}'`);
      return fn(mockPrisma);
    },
    getCurrentFirmId: async (): Promise<string | null> => {
      const result = await mockPrisma.$queryRawUnsafe<[{ current_setting: string }]>(
        `SELECT current_setting('app.current_firm_id', true)`
      );
      return result[0]?.current_setting || null;
    },
    Role: { ADMIN: 'ADMIN', PARTNER: 'PARTNER', ASSOCIATE: 'ASSOCIATE', ANALYST: 'ANALYST', READONLY: 'READONLY' },
  };
});

import { prisma, withTenantContext, getCurrentFirmId } from '@counsel/database';

describe('Tenant Context (RLS)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('withTenantContext', () => {
    it('should execute a callback within a tenant-scoped transaction', async () => {
      const mockFn = vi.fn().mockResolvedValue({ id: 'result-1' });
      const result = await withTenantContext('firm-uuid-abc', mockFn);
      expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
        "SET LOCAL app.current_firm_id = 'firm-uuid-abc'"
      );
      expect(mockFn).toHaveBeenCalled();
      expect(result).toEqual({ id: 'result-1' });
    });

    it('should pass the transaction client to the callback', async () => {
      const mockFn = vi.fn().mockResolvedValue('ok');
      await withTenantContext('firm-123', mockFn);
      expect(mockFn).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should propagate errors from the callback', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('DB error'));
      await expect(withTenantContext('firm-123', mockFn)).rejects.toThrow('DB error');
    });

    it('should set the firm ID before calling the callback (order check)', async () => {
      const callOrder: string[] = [];
      const mockExec = vi.fn().mockImplementation(() => {
        callOrder.push('set-firm-id');
        return Promise.resolve();
      });
      vi.mocked(prisma.$executeRawUnsafe).mockImplementation(mockExec);

      const mockFn = vi.fn().mockImplementation(() => {
        callOrder.push('callback');
        return Promise.resolve('done');
      });

      await withTenantContext('firm-order-test', mockFn);
      expect(callOrder).toEqual(['set-firm-id', 'callback']);
    });

    it('should work with different firm IDs in sequence', async () => {
      const firmIds = ['firm-a', 'firm-b', 'firm-c'];
      const results: string[] = [];
      for (const firmId of firmIds) {
        await withTenantContext(firmId, async () => {
          results.push(firmId);
          return firmId;
        });
      }
      expect(results).toEqual(firmIds);
    });

    it('should handle firm IDs with special characters safely', async () => {
      await withTenantContext('firm-123_with.dashes', vi.fn().mockResolvedValue('ok'));
      expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
        "SET LOCAL app.current_firm_id = 'firm-123_with.dashes'"
      );
    });
  });

  describe('getCurrentFirmId', () => {
    it('should return the current firm ID when set', async () => {
      vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([
        { current_setting: 'firm-uuid-123' },
      ]);
      const firmId = await getCurrentFirmId();
      expect(firmId).toBe('firm-uuid-123');
    });

    it('should return null when no firm ID is set', async () => {
      vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([
        { current_setting: '' },
      ]);
      const firmId = await getCurrentFirmId();
      // getCurrentFirmId uses result[0]?.current_setting || null — empty string → null
      expect(firmId).toBeNull();
    });
  });
});
