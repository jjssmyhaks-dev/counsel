import bcrypt from 'bcryptjs';
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';
import { signToken } from '../lib/jwt';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { UnauthorizedError } from '../lib/errors';
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

      const firm = await prisma.firm.findUnique({
        where: { id: user.firmId },
        select: { id: true, name: true, slug: true, plan: true, seatCount: true, createdAt: true },
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
        firm: firm ? {
          id: firm.id,
          name: firm.name,
          slug: firm.slug,
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
router.post('/logout', (_req: Request, res: Response) => {
  res.json({ message: 'Logged out successfully' });
});

// ─── POST /register ─────────────────────────────────────────────────────────
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
  firmName: z.string().optional(),
});

router.post(
  '/register',
  validate('body', registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, name, firmName } = req.body;

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
          data: { name: firmName, slug },
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
      res.status(503).json({ error: 'SSO not configured — set WORKOS_API_KEY and WORKOS_CLIENT_ID' });
      return;
    }
    const { connectionId, email, organizationId } = req.body;

    let result: string;

    if (email) {
      result = await getAuthorizationUrl(connectionId || '', email);
    } else if (organizationId) {
      result = await getAuthorizationUrl(connectionId || '');
    } else if (connectionId) {
      result = await getAuthorizationUrl(connectionId);
    } else {
      res.status(400).json({ error: 'Must provide connectionId, email, or organizationId' });
      return;
    }

    res.json({ url: result });
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
