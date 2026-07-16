import { Request, Response } from 'express';
import { signToken, verifyToken, TokenPayload } from './jwt';

/**
 * Refresh token store — maps userId → current refresh token.
 * In production, this should be in Redis or a DB table.
 */
const refreshTokens = new Map<string, string>();

/**
 * Issue a new refresh token for a user.
 * Refreshes are single-use — issuing a new one invalidates the old one.
 */
export function issueRefreshToken(payload: TokenPayload): string {
  const token = signToken(payload, '7d'); // 7-day expiry for refresh tokens
  refreshTokens.set(payload.id, token);
  return token;
}

/**
 * Validate and consume a refresh token.
 * Returns new access + refresh token pair, or null if invalid/expired.
 */
export function rotateRefreshToken(refreshToken: string): {
  accessToken: string;
  refreshToken: string;
  user: TokenPayload;
} | null {
  const payload = verifyToken(refreshToken, true); // Allow expired tokens for refresh
  if (!payload) return null;

  const stored = refreshTokens.get(payload.id);
  if (stored !== refreshToken) return null; // Token already consumed (replay attack)

  // Issue new pair — old refresh is now invalid
  const accessToken = signToken(payload, '24h');
  const newRefresh = issueRefreshToken(payload);

  const { iat, exp, ...user } = payload;
  return { accessToken, refreshToken: newRefresh, user };
}

/**
 * Invalidate all refresh tokens for a user (on logout / password change).
 */
export function revokeRefreshTokens(userId: string): void {
  refreshTokens.delete(userId);
}

/**
 * In-memory store size — for monitoring.
 */
export function refreshStoreSize(): number {
  return refreshTokens.size;
}
