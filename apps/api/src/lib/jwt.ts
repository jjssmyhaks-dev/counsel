import jwt from 'jsonwebtoken';

const SECRET = proces…RET;
if (!SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

export interface TokenPayload {
  id: string;
  email: string;
  name: string;
  firmId: string;
  role: string;
  iat?: number;
  exp?: number;
}

export function signToken(payload: TokenPayload, expiresIn?: string): string {
  return jwt.sign(payload, SECRET, { expiresIn: expiresIn || '24h' });
}

export function verifyToken(token: string, allowExpired = false): TokenPayload | null {
  try {
    return jwt.verify(token, SECRET, allowExpired ? { ignoreExpiration: true } : {}) as TokenPayload;
  } catch {
    return null;
  }
}
