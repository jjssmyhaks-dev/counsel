/**
 * OpenAPI 3.0 specification for the Counsel API.
 *
 * Serves Swagger UI at /api/docs for interactive API exploration.
 */
import { Router, Request, Response } from 'express';

const router = Router();

const OPENAPI_SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'Counsel API',
    description: 'B2B AI Workforce Suite for Legal & Consulting Firms — REST API.',
    version: '0.2.0',
    contact: { name: 'Counsel Team' },
  },
  servers: [
    { url: 'http://localhost:3001', description: 'Local development' },
    { url: '/api/v1', description: 'Production (relative)' },
  ],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          code: { type: 'string' },
          detail: { type: 'string' },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          firmId: { type: 'string', format: 'uuid' },
          role: { type: 'string', enum: ['PARTNER', 'ASSOCIATE', 'PARALEGAL', 'READONLY', 'ADMIN'] },
          avatarUrl: { type: 'string', nullable: true },
        },
      },
      Firm: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          slug: { type: 'string' },
          plan: { type: 'string', enum: ['FREE', 'PRO', 'ENTERPRISE'] },
          seatCount: { type: 'integer' },
        },
      },
      Document: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          originalName: { type: 'string' },
          filename: { type: 'string' },
          mimeType: { type: 'string' },
          sizeBytes: { type: 'integer' },
          status: { type: 'string', enum: ['UPLOADED', 'PROCESSING', 'READY', 'FAILED'] },
          createdAt: { type: 'string', format: 'date-time' },
          matter: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } },
        },
      },
    },
  },
  paths: {
    '/api/v1/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Login with email and password',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' }, password: { type: 'string' } }, required: ['email', 'password'] } } },
        },
        responses: {
          '200': { description: 'JWT token + refresh token + user + firm', content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' }, refreshToken: { type: 'string' }, user: { '$ref': '#/components/schemas/User' }, firm: { '$ref': '#/components/schemas/Firm' } } } } } },
          '401': { description: 'Invalid credentials', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
        },
      },
    },
    '/api/v1/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a new user and firm',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' }, password: { type: 'string', minLength: 8 }, name: { type: 'string' }, firmName: { type: 'string' } }, required: ['email', 'password', 'name'] } } },
        },
        responses: { '201': { description: 'Created — token + user + firm' }, '409': { description: 'Email already exists' } },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Authentication'],
        summary: 'Rotate access token using refresh token',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { refreshToken: { type: 'string' } }, required: ['refreshToken'] } } },
        },
        responses: { '200': { description: 'New access + refresh token pair' }, '401': { description: 'Invalid/expired refresh token' } },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'Logout — revoke all refresh tokens',
        responses: { '200': { description: 'Logged out' } },
      },
    },
    '/api/v1/auth/sso/authorize': {
      post: {
        tags: ['Authentication'],
        summary: 'Get WorkOS SSO authorization URL',
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { connectionId: { type: 'string' }, email: { type: 'string' }, organizationId: { type: 'string' } } } } } },
        responses: { '200': { description: 'Authorization URL' }, '400': { description: 'SSO not available for this domain' } },
      },
    },
    '/api/v1/documents': {
      get: {
        tags: ['Documents'],
        summary: 'List firm documents',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Paginated document list' } },
      },
      post: {
        tags: ['Documents'],
        summary: 'Upload a document',
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, matterId: { type: 'string' } } } } } },
        responses: { '201': { description: 'Document uploaded — queued for processing' } },
      },
    },
    '/api/v1/documents/{id}': {
      get: {
        tags: ['Documents'],
        summary: 'Get document with metadata and analysis history',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Document details' }, '404': { description: 'Not found' } },
      },
    },
    '/api/v1/documents/{id}/analyze': {
      post: {
        tags: ['Documents'],
        summary: 'Run CrewAI contract analysis on a document',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '201': { description: 'Analysis triggered' }, '400': { description: 'Document not in READY status' } },
      },
    },
    '/api/v1/documents/{id}/compare': {
      post: {
        tags: ['Documents'],
        summary: 'Compare two documents',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { otherDocumentId: { type: 'string' } }, required: ['otherDocumentId'] } } } },
        responses: { '201': { description: 'Comparison triggered' } },
      },
    },
    '/api/v1/matters': {
      get: {
        tags: ['Matters'],
        summary: 'List firm matters',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'type', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Paginated matter list' } },
      },
      post: { tags: ['Matters'], summary: 'Create a new matter', responses: { '201': { description: 'Matter created' } } },
    },
    '/api/v1/drafts': {
      get: { tags: ['Drafts'], summary: 'List drafts', responses: { '200': { description: 'Paginated draft list' } } },
      post: { tags: ['Drafts'], summary: 'Create a draft', responses: { '201': { description: 'Draft created' } } },
    },
    '/api/v1/meetings': {
      get: { tags: ['Meetings'], summary: 'List meetings', responses: { '200': { description: 'Meeting list' } } },
      post: { tags: ['Meetings'], summary: 'Create a meeting with transcript', responses: { '201': { description: 'Meeting created' } } },
    },
    '/api/v1/kb/query': {
      post: {
        tags: ['Knowledge Base'],
        summary: 'Query the firm knowledge base (RAG)',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { question: { type: 'string' }, matterId: { type: 'string' } }, required: ['question'] } } } },
        responses: { '200': { description: 'Answer with source citations and confidence score' } },
      },
    },
    '/api/v1/playbook': {
      get: { tags: ['Playbook'], summary: 'List playbook rules', responses: { '200': { description: 'Rule list' } } },
      post: { tags: ['Playbook'], summary: 'Create a playbook rule (Partner only)', responses: { '201': { description: 'Rule created' } } },
    },
    '/api/v1/playbook/{id}': {
      get: { tags: ['Playbook'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], summary: 'Get a rule', responses: { '200': { description: 'Rule detail' } } },
      patch: { tags: ['Playbook'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], summary: 'Update a rule', responses: { '200': { description: 'Rule updated' } } },
      delete: { tags: ['Playbook'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], summary: 'Delete a rule', responses: { '200': { description: 'Rule deleted' } } },
    },
    '/api/v1/playbook/toggle/{id}': {
      post: { tags: ['Playbook'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], summary: 'Toggle enable/disable', responses: { '200': { description: 'Toggled' } } },
    },
    '/api/v1/jobs': {
      get: { tags: ['Jobs'], summary: 'List background jobs', responses: { '200': { description: 'Job list' } } },
    },
    '/api/v1/jobs/{id}': {
      get: { tags: ['Jobs'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], summary: 'Get job status', responses: { '200': { description: 'Job details' } } },
    },
    '/api/v1/billing': {
      get: { tags: ['Billing'], summary: 'Get current subscription', responses: { '200': { description: 'Subscription details' } } },
    },
    '/api/v1/billing/checkout': {
      post: { tags: ['Billing'], summary: 'Create Stripe Checkout Session (Partner only)', responses: { '200': { description: 'Checkout URL' } } },
    },
    '/api/v1/billing/portal': {
      get: { tags: ['Billing'], summary: 'Get Customer Portal URL', responses: { '200': { description: 'Portal URL' } } },
    },
    '/api/v1/audit/logs': {
      get: {
        tags: ['Audit'],
        summary: 'Query audit logs (Admin only)',
        parameters: [
          { name: 'resourceType', in: 'query', schema: { type: 'string' } },
          { name: 'action', in: 'query', schema: { type: 'string' } },
          { name: 'startDate', in: 'query', schema: { type: 'string' } },
          { name: 'endDate', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Filtered audit log entries' } },
      },
    },
    '/api/v1/users': {
      get: { tags: ['Admin'], summary: 'List firm users (Admin only)', responses: { '200': { description: 'User list' } } },
    },
    '/api/health': {
      get: {
        tags: ['System'],
        summary: 'Health check — live DB + AI connectivity',
        responses: {
          '200': { description: 'All systems operational' },
          '503': { description: 'Degraded — one or more dependencies down' },
        },
      },
    },
  },
};

// ─── JSON spec endpoint ─────────────────────────────────────────
router.get('/openapi.json', (_req: Request, res: Response) => {
  res.json(OPENAPI_SPEC);
});

// ─── Swagger UI HTML page ───────────────────────────────────────
router.get('/docs', (_req: Request, res: Response) => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Counsel API Docs</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
  <style>body{margin:0;font-family:Inter,system-ui,sans-serif}.swagger-ui{font-family:Inter,system-ui,sans-serif}.swagger-ui .topbar{display:none}.swagger-ui .info .title{color:#0c0a09;font-family:Georgia,serif}.swagger-ui .opblock-tag{font-family:Georgia,serif;color:#0a8a5f}</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/api/openapi.json',
      dom_id: '#swagger-ui',
      deepLinking: true,
      defaultModelsExpandDepth: 1,
      docExpansion: 'list',
      filter: true,
      persistAuthorization: true,
    });
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

export default router;
