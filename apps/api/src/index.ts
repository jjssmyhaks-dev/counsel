import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { authMiddleware } from './middleware/auth';
import { tenantMiddleware } from './middleware/tenant';
import { errorHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth';
import firmRoutes from './routes/firms';
import documentRoutes from './routes/documents';
import matterRoutes from './routes/matters';
import draftRoutes from './routes/drafts';
import meetingRoutes from './routes/meetings';
import kbRoutes from './routes/kb';
import jobRoutes from './routes/jobs';
import auditRoutes from './routes/audit';

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
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: 'neon-postgres',
    ai: 'cloudflare-workers-ai',
    auth: 'jwt+workos-sso',
  });
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
app.use('/api/v1/audit', auditRoutes);

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
