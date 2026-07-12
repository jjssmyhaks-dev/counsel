import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'counsel-dev-secret';

export interface TokenPayload {
  id: string;
  email: string;
  name: string;
  firmId: string;
  role: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: '24h' });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, SECRET) as TokenPayload;
}
