# Database Backup & Restore

## Automated Backups (Neon)

Counsel uses Neon serverless PostgreSQL which provides:

- **Automatic backups**: Point-in-time recovery up to 7 days
- **Branching**: Create test branches from production data
- **Connection pooling**: Built-in pooler for connection management

## Restore Procedure

### Point-in-Time Recovery (PITR)

1. Go to [Neon Console](https://console.neon.tech)
2. Select your project (`ep-super-math-aolcnxm7`)
3. Navigate to **Backups** → **Restore**
4. Choose the timestamp to restore to
5. Select "Restore to new branch" (recommended) or "Restore in place"
6. Update `DATABASE_URL` in `.env` if restoring to a new branch

### Manual Backup (pg_dump)

```bash
# Export
pg_dump "$DATABASE_URL" -F c -f backup-$(date +%Y%m%d).dump

# Restore
pg_restore --clean --if-exists -d "$DATABASE_URL" backup-20260101.dump
```

### Prisma Migration Restore

```bash
# Reset to a specific migration
cd packages/database
npx prisma migrate reset --schema prisma/schema.prisma

# Apply all pending migrations
npx prisma migrate deploy
```

## Backup Schedule

- **Neon automatic**: Continuous (PITR up to 7 days)
- **Manual pg_dump**: Before each deployment (run by CI/CD)
- **Schema snapshots**: Stored in `packages/database/prisma/migrations/`

## Disaster Recovery

1. **Data loss < 7 days**: Use Neon PITR
2. **Data loss > 7 days**: Use last manual pg_dump from CI artifacts
3. **Schema corruption**: Reset via `prisma migrate reset` + reseed via `npm run seed`
