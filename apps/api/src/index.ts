import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { authMiddleware } from './middleware/auth';
import { requestIdMiddleware } from './middleware/requestId';
import { tenantMiddleware } from './middleware/tenant';
import { errorHandler } from './middleware/errorHandler';
import { initWorkOS } from './lib/workos';
import { initResend } from './lib/email';

import authRoutes from './routes/auth';
import firmRoutes from './routes/firms';
import documentRoutes from './routes/documents';
import matterRoutes from './routes/matters';
import draftRoutes from './routes/drafts';
import meetingRoutes from './routes/meetings';
import kbRoutes from './routes/kb';
import jobRoutes from './routes/jobs';
import playbookRoutes from './routes/playbook';
import auditRoutes from './routes/audit';
import userRoutes from './routes/users';

// Initialize services
initWorkOS();
initResend();

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Global middleware ──────────────────────────────────────────────────────

// Security headers (CSP, HSTS, XSS filter, etc.)
app.use(helmet());

// CORS — allow all origins in dev
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  }),
);

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Health check — before auth middleware so it's always accessible
app.get('/api/health', async (_req, res) => {
  const checks: Record<string, any> = { status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() };

  // Live DB check
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    checks.database = 'connected';
  } catch {
    checks.database = 'disconnected';
    checks.status = 'degraded';
  }

  // Live AI service check
  try {
    const ai = await fetch(`${process.env.AI_SERVICE_URL || 'http://localhost:8000'}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (ai.ok) {
      const aiBody = await ai.json();
      checks.ai = { status: 'connected', model: aiBody.embedding_model || 'unknown' };
    } else {
      checks.ai = { status: 'unhealthy', code: ai.status };
      if (checks.status === 'ok') checks.status = 'degraded';
    }
  } catch {
    checks.ai = { status: 'unreachable' };
    if (checks.status === 'ok') checks.status = 'degraded';
  }

  const statusCode = checks.status === 'degraded' ? 503 : 200;
  res.status(statusCode).json(checks);
});

// ─── Rate limiting ─────────────────────────────────────────────────────────
import rateLimit from 'express-rate-limit';

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' } },
  }),
);

// ─── Request ID — inject tracing ID into every request ──────────────────────
app.use(requestIdMiddleware);

// ─── Auth middleware (applied to all routes except /auth/login) ─────────────
app.use(authMiddleware);

// ─── Tenant context (sets RLS variable for all authenticated requests) ──────
app.use(tenantMiddleware);

// ─── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/firms', firmRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/matters', matterRoutes);
app.use('/api/v1/drafts', draftRoutes);
app.use('/api/v1/meetings', meetingRoutes);
app.use('/api/v1/kb', kbRoutes);
app.use('/api/v1/jobs', jobRoutes);
app.use('/api/v1/playbook', playbookRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/users', userRoutes);

// ─── Global error handler (must be last) ────────────────────────────────────
app.use(errorHandler);

// ─── Start server ───────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Counsel API running at http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
    console.log(`   Auth bypass: POST http://localhost:${PORT}/api/v1/auth/login`);
  });
}

export default app;
