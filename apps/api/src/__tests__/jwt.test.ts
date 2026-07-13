import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { signToken, verifyToken } from '../lib/jwt';

describe('JWT Authentication', () => {
  const mockPayload = {
    id: 'user-abc-123',
    email: 'lawyer@demo-firm.com',
    name: 'Jane Partner',
    firmId: 'firm-xyz-456',
    role: 'ADMIN',
  };

  describe('signToken', () => {
    it('should return a valid JWT string', () => {
      const token = signToken(mockPayload);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // header.payload.signature
    });

    it('should encode all payload fields', () => {
      const token = signToken(mockPayload);
      const decoded = jwt.decode(token) as Record<string, unknown>;
      expect(decoded.id).toBe(mockPayload.id);
      expect(decoded.email).toBe(mockPayload.email);
      expect(decoded.name).toBe(mockPayload.name);
      expect(decoded.firmId).toBe(mockPayload.firmId);
      expect(decoded.role).toBe(mockPayload.role);
    });

    it('should set expiry to 24 hours', () => {
      const token = signToken(mockPayload);
      const decoded = jwt.decode(token) as { iat: number; exp: number };
      expect(decoded.exp - decoded.iat).toBe(86400); // 24h in seconds
    });
  });

  describe('verifyToken', () => {
    it('should decode a valid token back to the original payload', () => {
      const token = signToken(mockPayload);
      const decoded = verifyToken(token);
      expect(decoded.id).toBe(mockPayload.id);
      expect(decoded.email).toBe(mockPayload.email);
      expect(decoded.name).toBe(mockPayload.name);
      expect(decoded.firmId).toBe(mockPayload.firmId);
      expect(decoded.role).toBe(mockPayload.role);
    });

    it('should reject a tampered token', () => {
      const parts = signToken(mockPayload).split('.');
      parts[1] = 'dGFtcGVyZWQ'; // base64 for "tampered"
      const tampered = parts.join('.');
      expect(() => verifyToken(tampered)).toThrow();
    });

    it('should reject a token signed with a different secret', () => {
      const token = jwt.sign(mockPayload, 'wrong-secret', { expiresIn: '1h' });
      expect(() => verifyToken(token)).toThrow();
    });

    it('should reject an empty string', () => {
      expect(() => verifyToken('')).toThrow();
    });

    it('should reject a completely invalid string', () => {
      expect(() => verifyToken('not-a-token-at-all')).toThrow();
    });

    it('should handle tokens with minimal fields', () => {
      const minimal = { id: 'u1', email: 'a@b.com', name: 'N', firmId: 'f1', role: 'READONLY' };
      const token = signToken(minimal);
      const decoded = verifyToken(token);
      expect(decoded.id).toBe('u1');
      expect(decoded.role).toBe('READONLY');
    });
  });

  describe('roundtrip', () => {
    it('should sign and verify consistently for different roles', () => {
      const roles = ['ADMIN', 'PARTNER', 'ASSOCIATE', 'ANALYST', 'READONLY'];
      for (const role of roles) {
        const payload = { ...mockPayload, role };
        const token = signToken(payload);
        const decoded = verifyToken(token);
        expect(decoded.role).toBe(role);
      }
    });

    it('should sign and verify consistently for different firms', () => {
      for (let i = 0; i < 5; i++) {
        const payload = { ...mockPayload, firmId: `firm-${i}` };
        const token = signToken(payload);
        const decoded = verifyToken(token);
        expect(decoded.firmId).toBe(`firm-${i}`);
      }
    });
  });
});
