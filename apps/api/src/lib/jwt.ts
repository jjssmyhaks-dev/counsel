import jwt from 'jsonwebtoken';

const SECRET: string = process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' ? require('crypto').randomBytes(32).toString('hex') : '');
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
  return jwt.sign(payload, SECRET, { expiresIn: (expiresIn || '24h') as jwt.SignOptions['expiresIn'] });
}

export function verifyToken(token: string, allowExpired = false): TokenPayload | null {
  try {
    const opts: jwt.VerifyOptions = allowExpired ? { ignoreExpiration: true } : {};
    const decoded = jwt.verify(token, SECRET, opts) as jwt.JwtPayload;
    if (typeof decoded === 'string' || !decoded.id) return null;
    return {
      id: decoded.id as string,
      email: decoded.email as string,
      name: decoded.name as string,
      firmId: decoded.firmId as string,
      role: decoded.role as string,
    };
  } catch {
    return null;
  }
}
