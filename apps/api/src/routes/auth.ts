import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';
import { signToken } from '../lib/jwt';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { UnauthorizedError } from '../lib/errors';

const router = Router();

// ─── POST /login ────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

router.post(
  '/login',
  validate('body', loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      // MVP: simple password check — in production use bcrypt
      if (password !== 'password') {
        throw new UnauthorizedError('Invalid credentials');
      }

      // Look up the user by email (with full role enum for type safety)
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          firmId: true,
          role: true,
          avatarUrl: true,
        },
      });

      if (!user) {
        throw new UnauthorizedError('Invalid credentials');
      }

      const token = signToken({
        id: user.id,
        email: user.email,
        name: user.name,
        firmId: user.firmId,
        role: user.role,
      });

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          firmId: user.firmId,
          role: user.role,
          avatarUrl: user.avatarUrl,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /me ────────────────────────────────────────────────────────────────
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        firmId: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Also get firm info
    const firm = await prisma.firm.findUnique({
      where: { id: user.firmId },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        seatCount: true,
      },
    });

    res.json({
      user,
      firm,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /logout ───────────────────────────────────────────────────────────
router.post('/logout', (_req: Request, res: Response) => {
  // No-op for JWT — client should discard the token
  // In production, you might add the token to a blocklist
  res.json({ message: 'Logged out successfully' });
});

export default router;
