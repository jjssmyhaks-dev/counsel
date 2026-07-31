/**
 * Audit log helper — thin wrapper around prisma.auditLog.create
 * for consistent integration-action logging across the platform.
 */
import { prisma } from '@counsel/database';

export interface IntegrationLogDetails {
  provider?: string;
  envelopeId?: string;
  status?: string;
  recipients?: string[];
  documentName?: string;
  emailSubject?: string;
  calendarEventId?: string;
  query?: string;
  [key: string]: any;
}

/**
 * Log an integration action to the audit trail.
 */
export async function logIntegrationAction(
  userId: string,
  firmId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  details?: IntegrationLogDetails | null,
  ipAddress?: string,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        firmId,
        userId,
        action,
        resourceType,
        resourceId,
        details: details ? (details as any) : null,
        ipAddress: ipAddress || null,
      },
    });
  } catch (err) {
    // Audit logging must never break the request — log and continue
    console.error('[AuditLog] Failed to write audit entry:', (err as Error).message);
  }
}
