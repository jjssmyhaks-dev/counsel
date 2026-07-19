import bcrypt from 'bcryptjs';
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { UnauthorizedError } from '../lib/errors';
import { signToken, verifyToken } from '../lib/jwt';
import { issueRefreshToken, rotateRefreshToken, revokeRefreshTokens } from '../lib/refresh';
import {
  getWorkOS,
  isWorkOSAvailable,
  getWorkOSClientId,
  getWorkOSRedirectUri,
  getAuthorizationUrl,
  authenticateWithCode,
  createOrganization,
  listDirectories,
  listDirectoryUsers,
  createWorkOSUser,
} from '../lib/workos';

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

      // Look up the user by email
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        throw new UnauthorizedError('Invalid credentials');
      }

      // Verify password against stored bcrypt hash
      if (!user.passwordHash) {
        throw new UnauthorizedError('Account not fully provisioned');
      }
      const isValid = await bcrypt.compare(password, user.passwordHash);

      if (!isValid) {
        throw new UnauthorizedError('Invalid credentials');
      }

      const token = signToken({
        id: user.id,
        email: user.email,
        name: user.name,
        firmId: user.firmId,
        role: user.role,
      });
      const refreshToken = issueRefreshToken({
        id: user.id,
        email: user.email,
        name: user.name,
        firmId: user.firmId,
        role: user.role,
      });

      const firm = await prisma.firm.findUnique({
        where: { id: user.firmId },
        select: { id: true, name: true, slug: true, firmType: true, onboardingCompleted: true, plan: true, seatCount: true, createdAt: true },
      });

      res.json({
        token,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          firmId: user.firmId,
          role: user.role,
          avatarUrl: user.avatarUrl,
        },
        firm: firm ? {
          id: firm.id,
          name: firm.name,
          slug: firm.slug,
          firmType: (firm as any).firmType || 'LEGAL',
          onboardingCompleted: (firm as any).onboardingCompleted || false,
          plan: firm.plan,
          seatCount: firm.seatCount,
        } : { id: user.firmId },
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
router.post('/logout', async (req: Request, res: Response) => {
  if (req.user?.id) {
    revokeRefreshTokens(req.user.id);
  }
  res.json({ message: 'Logged out successfully — all refresh tokens revoked' });
});

// ─── POST /refresh ─── Rotate access token using refresh token ───────────────
const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

router.post(
  '/refresh',
  validate('body', refreshSchema),
  (req: Request, res: Response) => {
    const result = rotateRefreshToken(req.body.refreshToken);
    if (!result) {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }
    res.json({
      token: result.accessToken,
      refreshToken: result.refreshToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        firmId: result.user.firmId,
        role: result.user.role,
      },
    });
  },
);

// ─── POST /register ─────────────────────────────────────────────────────────
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
  firmName: z.string().optional(),
  firmType: z.enum(['LEGAL', 'CONSULTING', 'HYBRID']).optional(),
});

router.post(
  '/register',
  validate('body', registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, name, firmName, firmType } = req.body;

      // Check if user already exists
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        res.status(409).json({ error: 'A user with this email already exists' });
        return;
      }

      // Get or create a firm
      let firmId: string;
      const slug = (firmName || 'default').toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 50);
      if (firmName) {
        const firm = await prisma.firm.create({
          data: { name: firmName, slug, firmType: (firmType || 'LEGAL') as any },
        });
        firmId = firm.id;
      } else {
        // Assign to first available firm (demo mode)
        const firstFirm = await prisma.firm.findFirst({ select: { id: true } });
        if (!firstFirm) {
          const firm = await prisma.firm.create({
            data: { name: 'Default Firm', slug: 'default' },
          });
          firmId = firm.id;
        } else {
          firmId = firstFirm.id;
        }
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          name,
          passwordHash,
          firmId,
          role: 'ASSOCIATE',
        },
        select: {
          id: true,
          email: true,
          name: true,
          firmId: true,
          role: true,
          avatarUrl: true,
        },
      });

      // Issue token
      const token = signToken({
        id: user.id,
        email: user.email,
        name: user.name,
        firmId: user.firmId,
        role: user.role as any,
      });

      const firm = await prisma.firm.findUnique({
        where: { id: user.firmId },
        select: { id: true, name: true, slug: true, plan: true },
      });

      res.status(201).json({ token, user, firm });
    } catch (err) {
      next(err);
    }
  },
);


// ─── POST /forgot-password ──────────────────────────────────────────────────
const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

router.post(
  '/forgot-password',
  validate('body', forgotPasswordSchema),
  async (req, res, next) => {
    try {
      const { email } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });

      // Always return success — don't leak whether the email exists
      if (!user) {
        res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
        return;
      }

      // Generate a short-lived reset token (15 min)
      const resetToken = signToken(
        { id: user.id, email: user.email, name: user.name, firmId: user.firmId, role: user.role },
        '15m',
      );

      // In production: send email. In dev: return the token in response
      res.json({
        message: 'If an account with that email exists, a reset link has been sent.',
        ...(process.env.NODE_ENV !== 'production' && { resetToken }),
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /reset-password ───────────────────────────────────────────────────
const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

router.post(
  '/reset-password',
  validate('body', resetPasswordSchema),
  async (req, res, next) => {
    try {
      const { token, newPassword } = req.body;

      // Verify the reset token (allow expired for this specific check? No — enforce 15min expiry)
      const payload = verifyToken(token);
      if (!payload) {
        res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
        return;
      }

      // Update the password
      const passwordHash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({
        where: { id: payload.id },
        data: { passwordHash },
      });

      // Revoke all refresh tokens for security
      revokeRefreshTokens(payload.id);

      res.json({ message: 'Password has been reset. You can now sign in with your new password.' });
    } catch (err) {
      next(err);
    }
  },
);

// ─── WorkOS SSO ─────────────────────────────────────────────────────────────

// GET /sso/connections — list available SSO connections
router.get('/sso/connections', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isWorkOSAvailable()) {
      res.json({ connections: [], note: 'WorkOS SSO not configured' });
      return;
    }
    const w = getWorkOS();
    const { data } = await w.sso.listConnections();
    res.json({
      connections: data.map((c: any) => ({
        id: c.id,
        name: c.name,
        state: c.state,
        connectionType: c.connectionType,
        domains: c.domains,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /sso/create — create a Mock SAML connection for demo/testing
router.post('/sso/create', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isWorkOSAvailable()) {
      res.status(503).json({ error: 'SSO not configured' });
      return;
    }
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Connection name is required' });
      return;
    }

    const w = getWorkOS();
    // WorkOS SDK: create a MockSAML connection for testing
    const connection = await (w.sso as any).createConnection({
      name,
      connectionType: 'MockSAML',
      clientId: getWorkOSClientId(),
    });

    res.status(201).json({ connection });
  } catch (err) {
    console.error('Create SSO connection error:', (err as Error).message);
    next(err);
  }
});

// ─── POST /sso/authorize — get WorkOS SSO authorization URL ─────────────────
router.post('/sso/authorize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isWorkOSAvailable()) {
      res.status(503).json({ error: 'SSO not configured — use password login instead' });
      return;
    }
    const { connectionId, email, organizationId } = req.body;

    try {
      const result = await getAuthorizationUrl(
        connectionId || undefined,
        { email, organizationId },
      );
      res.json({ url: result });
    } catch (workosErr: any) {
      const message = workosErr?.message || String(workosErr);
      console.error('WorkOS SSO error:', message);
      res.status(400).json({
        error: 'SSO not available for this email domain. Use password login instead.',
        detail: process.env.NODE_ENV === 'development' ? message : undefined,
      });
    }
  } catch (err) {
    next(err);
  }
});

// GET /callback — WorkOS SSO callback
router.get('/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isWorkOSAvailable()) {
      res.status(503).json({ error: 'SSO not configured' });
      return;
    }
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Missing authorization code' });
      return;
    }

    const profile = await authenticateWithCode(code);

    // Find or create user in our database keyed by WorkOS profile ID
    // We'll store the WorkOS profile ID in the user record
    let user = await prisma.user.findFirst({
      where: {
        // Look up by email (WorkOS-managed users)
        email: profile.email,
      },
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
      // Auto-provision user if they have an associated firm
      // In production you'd match by organization domain
      const firm = await prisma.firm.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });

      if (!firm) {
        res.status(400).json({ error: 'No firm found. Contact your administrator.' });
        return;
      }

      const displayName = [profile.firstName, profile.lastName]
        .filter(Boolean)
        .join(' ') || profile.email.split('@')[0];

      user = await prisma.user.create({
        data: {
          email: profile.email,
          name: displayName,
          firmId: firm.id,
          role: 'READONLY', // SSO users default to read-only until admin promotes them
        },
        select: {
          id: true,
          email: true,
          name: true,
          firmId: true,
          role: true,
          avatarUrl: true,
        },
      });
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      firmId: user.firmId,
      role: user.role,
    });

    // Redirect to frontend with token as query param
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/?token=${token}`);
  } catch (err) {
    next(err);
  }
});

// ─── WorkOS Org Management (Admin) ──────────────────────────────────────────

// POST /orgs — create a WorkOS organization for a firm
router.post('/orgs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, domains } = req.body;
    if (!name || !domains || !Array.isArray(domains)) {
      res.status(400).json({ error: 'name and domains (array) are required' });
      return;
    }

    const org = await createOrganization(name, domains);
    res.json(org);
  } catch (err) {
    next(err);
  }
});

// GET /directories — list SCIM directories
router.get('/directories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.query;
    const dirs = await listDirectories(organizationId as string | undefined);
    res.json({ directories: dirs });
  } catch (err) {
    next(err);
  }
});

// GET /directories/:id/users — list users synced from a directory
router.get('/directories/:id/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await listDirectoryUsers(req.params.id);
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

// ─── WorkOS User Management ─────────────────────────────────────────────────

// POST /users/invite — invite a user via WorkOS
router.post('/users/invite', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, firstName, lastName } = req.body;
    if (!email) {
      res.status(400).json({ error: 'email is required' });
      return;
    }

    const workosUser = await createWorkOSUser({ email, firstName, lastName });
    res.json(workosUser);
  } catch (err) {
    next(err);
  }
});

export default router;
