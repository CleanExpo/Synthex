# SYNTHEX Database Migration Strategy

## Overview

This document outlines the database migration strategy for SYNTHEX, including development workflow, production deployment procedures, rollback strategies, and best practices.

## Migration Systems

SYNTHEX uses a dual migration approach:

### 1. Prisma Migrations (Primary)
- **Location**: `prisma/migrations/`
- **Command**: `npx prisma migrate`
- **Use for**: Schema changes managed by Prisma ORM

### 2. Custom SQL Migrations (Secondary)
- **Location**: `database/migrations/`
- **Command**: `node database/run-migrations.js`
- **Use for**: Complex data migrations, stored procedures, custom indexes

---

## Development Workflow

### Creating a New Migration

```bash
# 1. Make schema changes in prisma/schema.prisma

# 2. Generate migration (development)
npx prisma migrate dev --name descriptive_migration_name

# 3. Review generated SQL
cat prisma/migrations/YYYYMMDD_*/migration.sql

# 4. Test migration locally
npm run db:migrate:test
```

### Migration Naming Convention

```
YYYYMMDD_HHMMSS_action_description
```

Examples:
- `20250811_143000_add_user_preferences`
- `20250811_150000_create_analytics_tables`
- `20250811_160000_add_campaign_metrics_index`

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] All migrations tested locally
- [ ] All migrations tested on staging
- [ ] Database backup completed
- [ ] Rollback scripts prepared
- [ ] Downtime window scheduled (if needed)
- [ ] Team notified of deployment
- [ ] Monitoring alerts configured

### Deployment Steps

```bash
# 1. Create production backup
npm run db:backup:production

# 2. Verify backup integrity
npm run db:backup:verify

# 3. Run migrations in dry-run mode
npm run db:migrate:dry-run

# 4. Apply migrations
npm run db:migrate:production

# 5. Verify migration success
npm run db:status

# 6. Run health checks
curl https://app.synthex.com/api/health/db
```

### Zero-Downtime Migrations

For migrations that don't require downtime:

1. **Add new columns as nullable** first
2. **Deploy application code** that handles both old and new schema
3. **Backfill data** in batches
4. **Add constraints** (NOT NULL, indexes) after data is migrated
5. **Remove old columns** in a separate migration

---

## Rollback Procedures

### Automatic Rollback

Each migration should have a corresponding rollback script:

```
prisma/migrations/
├── 20250811_143000_add_user_preferences/
│   ├── migration.sql    # UP migration
│   └── rollback.sql     # DOWN migration (manual)
```

### Manual Rollback Steps

```bash
# 1. Identify the migration to rollback
npm run db:status

# 2. Apply rollback script
npm run db:rollback --migration=20250811_143000_add_user_preferences

# 3. Verify rollback
npm run db:status

# 4. Restore from backup if needed
npm run db:restore --backup=backup_20250811_143000.sql
```

### Emergency Rollback

```bash
# Full database restore from backup
npm run db:emergency-restore --backup=latest
```

---

## Migration Types & Guidelines

### Schema Migrations

**Safe Operations (No Downtime):**
- Adding new tables
- Adding nullable columns
- Adding indexes (CONCURRENTLY)
- Dropping unused indexes

**Risky Operations (May Need Downtime):**
- Renaming columns/tables
- Changing column types
- Adding NOT NULL constraints
- Dropping columns with dependencies

### Data Migrations

```sql
-- Always use transactions
BEGIN;

-- Batch processing for large tables
DO $$
DECLARE
  batch_size INT := 1000;
  processed INT := 0;
BEGIN
  LOOP
    UPDATE users
    SET new_column = compute_value(old_column)
    WHERE new_column IS NULL
    LIMIT batch_size;

    GET DIAGNOSTICS processed = ROW_COUNT;
    EXIT WHEN processed = 0;

    COMMIT;
    BEGIN;
  END LOOP;
END $$;

COMMIT;
```

---

## Environment-Specific Configuration

### Development
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/synthex_dev"
MIGRATION_MODE="dev"
```

### Staging
```env
DATABASE_URL="postgresql://user:pass@staging-db:5432/synthex_staging"
MIGRATION_MODE="staging"
```

### Production
```env
DATABASE_URL="postgresql://user:pass@prod-db:5432/synthex"
MIGRATION_MODE="production"
REQUIRE_BACKUP_BEFORE_MIGRATE="true"
```

---

## Backup Strategy

### Automated Backups
- **Frequency**: Every 6 hours
- **Retention**: 30 days
- **Location**: AWS S3 / Supabase backups

### Pre-Migration Backups
- Created automatically before each production migration
- Stored with migration ID for easy correlation
- Tested for restore capability

### Backup Commands

```bash
# Create backup
npm run db:backup

# List backups
npm run db:backup:list

# Verify backup
npm run db:backup:verify --file=backup_name.sql

# Restore backup
npm run db:restore --file=backup_name.sql
```

---

## Monitoring & Alerts

### Migration Metrics

- Migration duration
- Lock wait times
- Table bloat after migration
- Query performance changes

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Migration duration | > 5 min | > 15 min |
| Lock wait time | > 30 sec | > 2 min |
| Failed migrations | 1 | > 1 |
| Disk usage increase | > 20% | > 50% |

---

## Troubleshooting

### Common Issues

#### Migration Stuck

```bash
# Check for blocking queries
SELECT pid, state, query, wait_event_type
FROM pg_stat_activity
WHERE state != 'idle';

# Cancel blocking query (with caution)
SELECT pg_cancel_backend(pid);
```

#### Migration Failed Mid-Way

```bash
# Check migration state
npm run db:status

# Check for partial changes
npm run db:integrity-check

# Rollback if needed
npm run db:rollback
```

#### Lock Timeout

```sql
-- Increase lock timeout for large migrations
SET lock_timeout = '5min';
SET statement_timeout = '30min';
```

---

## Best Practices

1. **Always test migrations on staging first**
2. **Create backups before production migrations**
3. **Use transactions for data migrations**
4. **Add indexes CONCURRENTLY when possible**
5. **Break large migrations into smaller steps**
6. **Document complex migrations**
7. **Monitor database metrics during migration**
8. **Have rollback plan ready**
9. **Schedule migrations during low-traffic periods**
10. **Communicate migration windows to stakeholders**

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `npm run db:migrate` | Run pending migrations |
| `npm run db:migrate:dry-run` | Preview migration changes |
| `npm run db:status` | Check migration status |
| `npm run db:rollback` | Rollback last migration |
| `npm run db:backup` | Create database backup |
| `npm run db:restore` | Restore from backup |
| `npm run db:integrity-check` | Verify database integrity |

---

## Related Documentation

- [Prisma Migration Guide](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [PostgreSQL Best Practices](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [SYNTHEX API Health Checks](./API_HEALTH_CHECKS.md)
