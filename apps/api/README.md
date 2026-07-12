# API Server

Node.js + Express + TypeScript backend for the Counsel platform. Handles authentication, tenant isolation, document management, and orchestration of the AI service.

## Overview

The API server is the central gateway for the Counsel frontend and Chrome extension. It enforces authentication, applies tenant-level Row-Level Security (RLS) context, validates requests, routes them to the appropriate handlers, and coordinates with the Python AI service for ML-heavy operations.

## Tech Stack

- **Runtime:** Node.js 22
- **Framework:** Express 5
- **Language:** TypeScript (strict mode)
- **Validation:** Zod
- **Auth:** JWT (jsonwebtoken)
- **Queue:** BullMQ (Redis-backed job processing)
- **Storage:** Cloudflare R2 (S3-compatible API via `@aws-sdk/client-s3`)

## Getting Started

```bash
# From monorepo root
npm install

# Start in development mode (hot reload via tsx watch)
npm run dev:api      # Starts on port 3001
```

Create `apps/api/.env` with required variables (see root README for full list).

## Middleware Chain

Requests flow through middleware in this order:

```
Request
  │
  ├─ 1. requestLogger        — Logs method, path, duration, status
  ├─ 2. cors                 — Cross-origin allowlist for frontend
  ├─ 3. authenticate         — Verifies JWT, attaches user to req
  ├─ 4. tenantContext        — Sets firm_id on request from user
  ├─ 5. withTenantContext    — Wraps remainder in DB tenant context
  ├─ 6. validate             — Zod schema validation on body/params/query
  ├─ 7. auditLog             — (write-only routes) Records action
  │
  ▼ Route Handler
```

### Key Middleware Files

```
src/middleware/
├── auth.ts            # JWT verification, req.user population
├── tenant.ts           # Extracts firmId, calls withTenantContext
├── validate.ts         # Zod-based request validation
├── audit.ts            # Appends to audit_log table
├── error-handler.ts    # Global error handler (custom AppError)
└── request-logger.ts   # HTTP request logging
```

## Route Structure

Routes are organized by domain under `src/routes/`:

```
src/routes/
├── index.ts            # Mounts all routers under /api/v1
├── auth.ts             # POST /auth/login, /auth/refresh, GET /auth/me
├── documents.ts        # CRUD + upload + analysis trigger
├── matters.ts          # CRUD + research trigger
├── drafts.ts           # Generate + status
├── kb.ts               # RAG query (Ask the Firm)
├── meetings.ts         # Transcript upload + analysis
├── audit.ts            # Audit log queries
└── admin.ts            # User management, playbook CRUD
```

## Adding a New Route

1. **Create the route file** in `src/routes/`:

```typescript
// src/routes/example.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const router = Router();

const createSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
  }),
});

// All routes are mounted under /api/v1
router.post('/', authenticate, validate(createSchema), async (req, res) => {
  const firmId = req.firmId; // Set by tenant middleware
  const userId = req.user!.id; // Set by auth middleware

  // Business logic here
  res.status(201).json({ success: true });
});

export default router;
```

2. **Register the router** in `src/routes/index.ts`:

```typescript
import exampleRouter from './example';

// ...
apiRouter.use('/example', exampleRouter);
```

3. **Add validation schemas** — every route that accepts input must have a Zod schema.

## Error Handling

The API uses a custom `AppError` class for consistent error responses:

```typescript
import { AppError } from '../lib/errors';

throw new AppError(404, 'Document not found');
throw new AppError(403, 'Insufficient permissions');
throw new AppError(422, 'Validation failed', { fields: { title: 'Required' } });
```

The global error handler (`src/middleware/error-handler.ts`) catches all errors and returns a standardized JSON envelope:

```json
{
  "error": {
    "code": 404,
    "message": "Document not found",
    "details": null
  }
}
```

## Async Processing

Long-running AI operations (document analysis, research synthesis) are offloaded to BullMQ jobs:

```typescript
import { analysisQueue } from '../lib/queue';

// Enqueue a job
await analysisQueue.add('contract-analysis', {
  documentId: doc.id,
  firmId: req.firmId,
  userId: req.user!.id,
});

// The job is picked up by a worker that calls the AI service
// Status is polled by the frontend via GET /api/v1/drafts/:id
```

Queue definitions are in `src/lib/queue.ts`.

## File Structure

```
apps/api/
├── src/
│   ├── index.ts              # Entry point — creates Express app, mounts middleware & routes
│   ├── middleware/
│   │   ├── auth.ts           # JWT authentication
│   │   ├── tenant.ts         # Tenant context injection
│   │   ├── validate.ts       # Zod validation
│   │   ├── audit.ts          # Audit logging
│   │   ├── error-handler.ts  # Global error handler
│   │   └── request-logger.ts # HTTP request logging
│   ├── routes/
│   │   ├── index.ts          # Router aggregation
│   │   ├── auth.ts           # Auth endpoints
│   │   ├── documents.ts      # Document endpoints
│   │   ├── matters.ts        # Matter endpoints
│   │   ├── drafts.ts         # Draft endpoints
│   │   ├── kb.ts             # Knowledge base endpoints
│   │   ├── meetings.ts       # Meeting endpoints
│   │   ├── audit.ts          # Audit log endpoints
│   │   └── admin.ts          # Admin endpoints
│   └── lib/
│       ├── jwt.ts            # Token creation & verification
│       ├── errors.ts         # AppError class
│       ├── r2.ts             # Cloudflare R2 client wrapper
│       ├── queue.ts          # BullMQ queue & worker definitions
│       └── ai-client.ts      # HTTP client for Python AI service
├── tests/
│   ├── auth.test.ts
│   ├── documents.test.ts
│   └── ...
├── .env                      # Environment variables (not committed)
├── package.json
└── tsconfig.json
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:api` | Start with hot reload on port 3001 |
| `npm run build` | Compile TypeScript to dist/ |
| `npm run start` | Start compiled production server |
| `npm run test` | Run Jest test suite |
| `npm run lint` | ESLint check |

## Development Guidelines

- **Always use Zod validation** on every route that accepts user input. Never trust `req.body` directly.
- **Always use the tenant context** — never write raw queries that could leak cross-firm data. The `firmId` on the request is your source of truth.
- **Use async jobs for AI operations** — document analysis and embedding can take 30+ seconds. Don't block the HTTP response. Return a job ID and let the frontend poll.
- **Log all AI actions** to the audit trail via the audit middleware or by calling `auditLog.create()` directly.
- **Keep routes thin** — move business logic to service modules (future enhancement; currently routes contain logic directly).
