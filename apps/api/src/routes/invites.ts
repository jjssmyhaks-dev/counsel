import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';
import bcrypt from 'bcryptjs';

const router = Router();

// ─── Helper: generate invite token ─────────────────────────────────────
function generateInviteToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

// ─── GET /invites ─── List all invites for firm ────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const firmId = (req as any).firmId;
    const invites = await prisma.teamInvite.findMany({
      where: { firmId }, orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, role: true, status: true, expiresAt: true, createdAt: true },
    });
    res.json({ data: invites, total: invites.length });
  } catch (err) { next(err); }
});

// ─── POST /invites/send ─── Send team invite by email ──────────────────
router.post('/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const firmId = (req as any).firmId;
    const { email, role } = req.body;
    if (!email || !email.includes('@')) { res.status(400).json({ error: 'Valid email required' }); return; }
    const existing = await prisma.user.findFirst({ where: { firmId, email } });
    if (existing) { res.status(400).json({ error: 'Already a team member' }); return; }
    const userId = (req as any).user?.id;
    const token = generateInviteToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    if (!userId) { res.status(401).json({ error: 'Authentication required' }); return; }
    const invite = await prisma.teamInvite.create({ data: { firmId, email, role: (role || 'ASSOCIATE') as any, token, expiresAt, invitedById: userId } });
    res.status(201).json({ invite: { id: invite.id, email, role: invite.role, expiresAt } });
  } catch (err) { next(err); }
});

// ─── GET /invites/accept/:token ─── Validate invite token ────────
router.get('/accept/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const invite = await prisma.teamInvite.findUnique({ where: { token }, include: { firm: { select: { name: true, firmType: true } } } });

    if (!invite) { res.status(404).json({ error: 'Invalid or expired invite link' }); return; }
    if (invite.status !== 'PENDING') { res.status(400).json({ error: `Invite is ${invite.status.toLowerCase()}` }); return; }
    if (new Date(invite.expiresAt) < new Date()) {
      await prisma.teamInvite.update({ where: { id: invite.id }, data: { status: 'EXPIRED' } });
      res.status(400).json({ error: 'Invite has expired. Ask your admin to send a new one.' });
      return;
    }

    res.json({
      valid: true,
      email: invite.email,
      role: invite.role,
      firmName: invite.firm.name,
      firmType: invite.firm.firmType,
    });
  } catch (err) { next(err); }
});

// ─── POST /invites/join ─── Accept invite and create account ─────
router.post('/join', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, name, password } = req.body;

    if (!token || !name || !password) {
      res.status(400).json({ error: 'token, name, and password are required' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const invite = await prisma.teamInvite.findUnique({ where: { token } });
    if (!invite) { res.status(404).json({ error: 'Invalid invite token' }); return; }
    if (invite.status !== 'PENDING') { res.status(400).json({ error: `Invite is already ${invite.status.toLowerCase()}` }); return; }
    if (new Date(invite.expiresAt) < new Date()) {
      await prisma.teamInvite.update({ where: { id: invite.id }, data: { status: 'EXPIRED' } });
      res.status(400).json({ error: 'Invite has expired' });
      return;
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email: invite.email } });
    if (existing) {
      res.status(400).json({ error: 'An account with this email already exists. Please sign in.' });
      return;
    }

    // Create user
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        firmId: invite.firmId,
        email: invite.email,
        name,
        passwordHash,
        role: invite.role,
      },
    });

    // Mark invite as accepted
    await prisma.teamInvite.update({
      where: { id: invite.id },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });

    // Generate JWT
    const { signToken } = await import('../lib/jwt');
    const token_jwt = signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      firmId: user.firmId,
      role: user.role,
    });

    res.json({
      token: token_jwt,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      firm: { id: invite.firmId },
    });
  } catch (err) { next(err); }
});

// ─── GET /invites/list ─── List pending invites for a firm ───────
router.get('/list', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const firmId = (req as any).firmId;
    const invites = await prisma.teamInvite.findMany({
      where: { firmId, status: 'PENDING' },
      select: { id: true, email: true, role: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ invites });
  } catch (err) { next(err); }
});

// ─── DELETE /invites/:id ─── Revoke an invite ────────────────────
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const firmId = (req as any).firmId;
    const { id } = req.params;
    await prisma.teamInvite.updateMany({ where: { id, firmId, status: 'PENDING' }, data: { status: 'REVOKED' } });
    res.json({ revoked: true });
  } catch (err) { next(err); }
});

// ─── GET /access/policies ─── Get RBAC policies for firm ─────────
router.get('/access/policies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const firmId = (req as any).firmId;
    const policies = await prisma.accessPolicy.findMany({ where: { firmId }, orderBy: [{ role: 'asc' }, { resource: 'asc' }] });
    res.json({ policies });
  } catch (err) { next(err); }
});

// ─── POST /access/policies ─── Set RBAC policy ───────────────────
router.post('/access/policies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const firmId = (req as any).firmId;
    const userRole = (req as any).user?.role;
    if (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN') {
      res.status(403).json({ error: 'Only SUPER_ADMIN or ADMIN can manage access policies' });
      return;
    }

    const { role, resource, permission, allowed } = req.body;
    if (!role || !resource || !permission) {
      res.status(400).json({ error: 'role, resource, and permission are required' });
      return;
    }

    const policy = await prisma.accessPolicy.upsert({
      where: { firmId_role_resource_permission: { firmId, role, resource, permission } },
      create: { firmId, role, resource, permission, allowed: allowed !== false },
      update: { allowed: allowed !== false },
    });

    res.json({ policy });
  } catch (err) { next(err); }
});

// ─── GET /access/check ─── Check if current user has a permission ─
router.get('/access/check', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const firmId = (req as any).firmId;
    const userRole = (req as any).user?.role;
    const { resource, permission } = req.query;

    if (!resource || !permission) {
      res.status(400).json({ error: 'resource and permission query params required' });
      return;
    }

    // SUPER_ADMIN always has access
    if (userRole === 'SUPER_ADMIN') {
      res.json({ allowed: true, reason: 'SUPER_ADMIN' });
      return;
    }

    const policy = await prisma.accessPolicy.findUnique({
      where: { firmId_role_resource_permission: { firmId, role: userRole as any, resource: resource as string, permission: permission as string } },
    });

    res.json({ allowed: policy?.allowed ?? false, reason: policy ? 'policy' : 'no_policy' });
  } catch (err) { next(err); }
});

// ─── GET /access/members ─── List all team members ───────────────
router.get('/access/members', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const firmId = (req as any).firmId;
    const members = await prisma.user.findMany({
      where: { firmId },
      select: { id: true, name: true, email: true, role: true, lastLoginAt: true, createdAt: true },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
    res.json({ members });
  } catch (err) { next(err); }
});

// ─── PATCH /access/members/:id/role ─── Change member role ────────
router.patch('/access/members/:id/role', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const firmId = (req as any).firmId;
    const callerRole = (req as any).user?.role;
    const callerId = (req as any).user?.id;
    const { id } = req.params;
    const { role } = req.body;

    if (callerRole !== 'SUPER_ADMIN' && callerRole !== 'ADMIN') {
      res.status(403).json({ error: 'Only SUPER_ADMIN or ADMIN can change roles' });
      return;
    }

    // Cannot change own role
    if (id === callerId) {
      res.status(400).json({ error: 'Cannot change your own role' });
      return;
    }

    const validRoles = ['SUPER_ADMIN', 'ADMIN', 'PARTNER', 'ASSOCIATE', 'ANALYST', 'READONLY'];
    if (!role || !validRoles.includes(role)) {
      res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
      return;
    }

    // Only SUPER_ADMIN can promote to SUPER_ADMIN or ADMIN
    if ((role === 'SUPER_ADMIN' || role === 'ADMIN') && callerRole !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Only SUPER_ADMIN can assign SUPER_ADMIN or ADMIN roles' });
      return;
    }

    await prisma.user.updateMany({ where: { id, firmId }, data: { role } });
    res.json({ updated: true, role });
  } catch (err) { next(err); }
});

// ─── DELETE /access/members/:id ─── Remove team member ────────────
router.delete('/access/members/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const firmId = (req as any).firmId;
    const callerRole = (req as any).user?.role;
    const callerId = (req as any).user?.id;
    const { id } = req.params;

    if (callerRole !== 'SUPER_ADMIN' && callerRole !== 'ADMIN') {
      res.status(403).json({ error: 'Only SUPER_ADMIN or ADMIN can remove members' });
      return;
    }
    if (id === callerId) {
      res.status(400).json({ error: 'Cannot remove yourself' });
      return;
    }

    // Check target is not SUPER_ADMIN (only SUPER_ADMIN can remove SUPER_ADMIN)
    const target = await prisma.user.findFirst({ where: { id, firmId }, select: { role: true } });
    if (target?.role === 'SUPER_ADMIN' && callerRole !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Only SUPER_ADMIN can remove another SUPER_ADMIN' });
      return;
    }

    await prisma.user.deleteMany({ where: { id, firmId } });
    res.json({ removed: true });
  } catch (err) { next(err); }
});

export default router;
