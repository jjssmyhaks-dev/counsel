# Database Package

Shared Prisma schema, migrations, and seed data for the Counsel platform.

## Overview

This package is the single source of truth for the Counsel database layer. It defines the Prisma schema, manages migrations, provides seed data for development and demo environments, and exposes the tenant-context helper used by the API layer.

## Schema

The Prisma schema (`prisma/schema.prisma`) models the core domain:

- **Firm** — Tenant entity; every other entity belongs to a firm
- **User** — Firm member with role-based permissions
- **Document** — Uploaded file with metadata, parse status, and vector embeddings
- **Matter** — Legal/consulting matter (case, deal, project)
- **Draft** — AI-generated draft with prompt, result, and approval status
- **Meeting** — Meeting record with transcript and extracted intelligence
- **AuditLog** — Immutable append-only log of all AI interactions
- **PlaybookRule** — Firm-specific contract review rules

Multi-tenancy is enforced via **PostgreSQL Row-Level Security (RLS)** policies defined in the migration files.

## Getting Started

### Prerequisites
- PostgreSQL 15+ with the `pgvector` extension
- Node.js 22+

### Setup

```bash
# From the monorepo root
npm install

# Create the database
createdb counsel

# Enable pgvector extension
psql counsel -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Environment

Create a `.env` file in this package directory:

```
DATABASE_URL=postgresql://user:password@localhost:5432/counsel
```

### Running Migrations

```bash
# Generate a migration from schema changes
npm run db:migrate:dev

# Apply migrations to the database
npm run db:migrate

# Reset the database (drops all data)
npm run db:reset
```

### Seeding

```bash
# Seed with demo firm and sample data
npm run db:seed
```

The seed script creates:
- A demo firm (`demo-firm`)
- Admin and standard users
- Sample documents (contracts, memos, research notes)
- Sample matters
- Default playbook rules
- Pre-generated embeddings for demo documents

## Tenant Context

Every database query in Counsel must be tenant-scoped. This package provides the `withTenantContext` helper that uses the firm's `tenant_id` to scope all subsequent queries via PostgreSQL runtime variables:

```typescript
import { withTenantContext, prisma } from '@counsel/database';

async function getDocuments(firmId: string) {
  return withTenantContext(firmId, async () => {
    // All Prisma queries here are automatically scoped to this firm
    return prisma.document.findMany();
  });
}
```

### How It Works

1. `withTenantContext` calls `SET LOCAL counsel.tenant_id = '<firmId>'` at the start of the transaction
2. RLS policies on every table check `current_setting('counsel.tenant_id')` against the row's `firm_id`
3. Postgres enforces the policy — even a raw SQL query without a WHERE clause cannot return cross-tenant data
4. The transaction is rolled back if the context cannot be set

### RLS Policies

Defined in migrations. Key policies:

```sql
-- Every table gets this pattern:
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm_isolation" ON "Document"
  FOR ALL
  USING ("firmId" = current_setting('counsel.tenant_id')::uuid)
  WITH CHECK ("firmId" = current_setting('counsel.tenant_id')::uuid);
```

Tables with RLS enabled: `Firm`, `User`, `Document`, `DocumentChunk`, `Matter`, `Draft`, `Meeting`, `AuditLog`, `PlaybookRule`.

### Bypass for Admin Operations

Certain admin operations (creating a new firm, running migrations) execute outside tenant context. These use a privileged Prisma client that runs as the database owner and bypasses RLS:

```typescript
import { adminPrisma } from '@counsel/database';

// Only for firm creation and system-level operations
await adminPrisma.firm.create({ data: { ... } });
```

## File Structure

```
packages/database/
├── prisma/
│   ├── schema.prisma        # Data model definition
│   ├── migrations/          # Applied migration files
│   └── seed.ts              # Seed script
├── src/
│   ├── client.ts            # Standard (tenant-scoped) Prisma client
│   ├── admin-client.ts      # Admin Prisma client (bypasses RLS)
│   ├── tenant.ts            # withTenantContext helper
│   └── index.ts             # Package public API
├── .env                     # DATABASE_URL (not committed)
├── package.json
└── tsconfig.json
```

## Common Tasks

### Adding a New Model

1. Add the model to `prisma/schema.prisma`
2. Include the `firmId` foreign key field
3. Run `npm run db:migrate:dev` to generate the migration
4. Add the RLS policy in the generated migration SQL
5. Export the model from `src/index.ts`

### Resetting to Clean State

```bash
npm run db:reset   # Drops and recreates the database
npm run db:migrate # Applies all migrations
npm run db:seed    # Seeds demo data
```

### Inspecting the Database

```bash
npx prisma studio   # Opens Prisma Studio GUI at http://localhost:5555
```
