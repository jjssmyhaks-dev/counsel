import { PrismaClient, Prisma as PrismaTypes } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Execute a closure within a tenant (firm) context.
 * Sets the app.current_firm_id local variable on the transaction,
 * enabling RLS policies to scope queries to a single firm.
 */
export async function withTenantContext<T>(
  firmId: string,
  fn: (tx: PrismaTypes.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_firm_id = '${firmId}'`,
    );
    return fn(tx);
  });
}

/**
 * Retrieve the current firm ID from the session-local variable.
 * Returns null when no tenant context has been set.
 */
export async function getCurrentFirmId(): Promise<string | null> {
  const result = await prisma.$queryRawUnsafe(
    `SELECT current_setting('app.current_firm_id', true)`,
  ) as [{ current_setting: string }];
  return result[0]?.current_setting || null;
}

export * from '@prisma/client';
