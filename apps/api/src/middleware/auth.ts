import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../lib/jwt';

/**
 * JWT authentication middleware.
 * Extracts Bearer token from the Authorization header,
 * verifies it, and sets req.user with the decoded payload.
 *
 * Skips authentication for paths matching `publicPaths`.
 */
const publicPaths = [
  { method: 'POST', path: '/api/v1/auth/login' },
  { method: 'GET', path: '/api/v1/auth/callback' },
  { method: 'POST', path: '/api/v1/auth/sso' },
];

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  // Check if this route is public
  const isPublic = publicPaths.some(
    (p) => p.method === req.method && req.path.startsWith(p.path),
  );
  if (isPublic) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    _res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    _res.status(401).json({ error: 'Invalid Authorization header format. Expected: Bearer <token>' });
    return;
  }

  const token = parts[1];

  try {
    const payload: TokenPayload = verifyToken(token);
    req.user = {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      firmId: payload.firmId,
      role: payload.role,
    };
    req.firmId = payload.firmId;
    next();
  } catch (err) {
    _res.status(401).json({ error: 'Invalid or expired token' });
  }
}
