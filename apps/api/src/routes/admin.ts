import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';

const router = Router();

// ─── GET /admin/metrics ───────────────────────────────────────────────────
router.get('/metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const firmId = (req as any).firmId;

    const [userCount, matterCount, documentCount, draftCount, meetingCount] = await Promise.all([
      prisma.user.count({ where: { firmId } }),
      prisma.matter.count({ where: { firmId } }),
      prisma.document.count({ where: { firmId } }),
      prisma.draft.count({ where: { firmId } }),
      prisma.meeting.count({ where: { firmId } }),
    ]);

    // Active matters (status filter)
    const activeMatters = await prisma.matter.count({
      where: { firmId, status: 'ACTIVE' },
    });

    // Today's activity
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayActivity = await prisma.auditLog.count({
      where: { firmId, createdAt: { gte: today } },
    });

    // Total storage (approximate from document sizes)
    const docs = await prisma.document.findMany({
      where: { firmId },
      select: { sizeBytes: true },
    });
    const totalStorageBytes = docs.reduce((sum, d) => sum + (d.sizeBytes || 0), 0);

    res.json({
      users: { total: userCount },
      matters: { total: matterCount, active: activeMatters },
      documents: { total: documentCount, totalSizeBytes: totalStorageBytes },
      drafts: { total: draftCount },
      meetings: { total: meetingCount },
      activity: { today: todayActivity },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /admin/audit ─────────────────────────────────────────────────────
router.get('/audit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const firmId = (req as any).firmId;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { firmId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.auditLog.count({ where: { firmId } }),
    ]);

    res.json({
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /admin/users ─────────────────────────────────────────────────────
router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const firmId = (req as any).firmId;

    const users = await prisma.user.findMany({
      where: { firmId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: users, total: users.length });
  } catch (err) {
    next(err);
  }
});

export default router;
