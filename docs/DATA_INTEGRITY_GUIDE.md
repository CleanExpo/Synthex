# SYNTHEX Data Integrity Guide

> **Task:** UNI-431 - Data Migration & Integrity Epic

This guide covers data validation, integrity checking, migration tracking, and backup procedures.

## Table of Contents

1. [Data Validation](#data-validation)
2. [Integrity Checks](#integrity-checks)
3. [Migration Tracking](#migration-tracking)
4. [Backup & Recovery](#backup--recovery)
5. [Maintenance Scripts](#maintenance-scripts)

---

## Data Validation

### TypeScript Validators

Use Zod-based validators for type-safe data validation:

```typescript
import { validateUser, validateCampaign, ValidationResult } from '@/lib/data';

// Validate user data
const userResult = validateUser({
  email: 'user@example.com',
  name: 'John Doe',
  authProvider: 'local',
});

if (!userResult.valid) {
  console.log('Validation errors:', userResult.errors);
}

// Validate campaign
const campaignResult = validateCampaign({
  name: 'Summer Sale',
  status: 'draft',
  userId: 'user_123',
  startDate: new Date(),
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
});
```

### Batch Validation

```typescript
import { validateBatch, campaignSchema } from '@/lib/data';

const results = validateBatch(campaignSchema, campaigns);

console.log(`Valid: ${results.stats.valid}`);
console.log(`Invalid: ${results.stats.invalid}`);

// Process valid items
for (const campaign of results.valid) {
  await prisma.campaign.create({ data: campaign });
}

// Log invalid items
for (const { index, errors } of results.invalid) {
  console.error(`Item ${index} failed:`, errors);
}
```

### Sanitization Utilities

```typescript
import { sanitizeString, sanitizeEmail, sanitizeStringArray } from '@/lib/data';

const cleanEmail = sanitizeEmail('  User@EXAMPLE.com  '); // 'user@example.com'
const cleanTags = sanitizeStringArray(['  tag1 ', '', '  tag2  ']); // ['tag1', 'tag2']
```

---

## Integrity Checks

### Running Integrity Checks

```bash
# Full integrity check
node scripts/data/data-integrity-check.js

# JSON output for automation
node scripts/data/data-integrity-check.js --json

# Verbose mode with detailed breakdowns
node scripts/data/data-integrity-check.js --verbose
```

### Check Output

```
📊 SYNTHEX DATA INTEGRITY REPORT
==================================================
Generated: 2026-02-02T10:30:00.000Z
Environment: production

📡 Database Connection
  Status: ✅ Connected
  Latency: 12ms

📋 Table Statistics
  Users: 1250 (890 verified)
  Campaigns: 3420
  Posts: 15800
  Projects: 520
  Sessions: 850 (750 active)
  ...

⚠️  Integrity Issues
  Errors:
    ❌ 3 campaigns without user reference
  Warnings:
    ⚠️  150 expired sessions should be cleaned up

💡 Recommendations
  → Run: node scripts/data/data-cleanup.js --expired
  → Run: node scripts/data/data-cleanup.js --orphaned
```

### Reference Validation in Code

```typescript
import { validateReference, integrityChecks } from '@/lib/data';

// Check if user exists before creating campaign
const userExists = await validateReference(prisma, 'user', userId);
if (!userExists) {
  throw new Error('User not found');
}

// List all integrity checks
for (const check of integrityChecks) {
  console.log(`${check.table}.${check.field} -> ${check.referencedTable}.${check.referencedField}`);
}
```

---

## Migration Tracking

### Using Migration Tracker

```typescript
import { migrationTracker, createDataSnapshot, compareSnapshots } from '@/lib/data';

// Take snapshot before migration
const before = await createDataSnapshot();

// Start tracking
const migration = await migrationTracker.startMigration(
  'Add user preferences',
  'Adding JSONB column for user preferences'
);

try {
  // Record steps
  await migrationTracker.recordStep(migration.id, 'backup', 'Creating backup...');
  // ... perform backup

  await migrationTracker.recordStep(migration.id, 'alter', 'Adding column...');
  await prisma.$executeRaw`ALTER TABLE users ADD COLUMN preferences JSONB`;

  await migrationTracker.recordStep(migration.id, 'migrate', 'Migrating data...');
  // ... migrate existing data

  await migrationTracker.completeMigration(migration.id, 'success');

  // Compare snapshots
  const after = await createDataSnapshot();
  const diff = compareSnapshots(before, after);
  console.log('Changes:', diff);

} catch (error) {
  await migrationTracker.completeMigration(migration.id, 'failed', error.message);
  throw error;
}
```

### Rollback Plans

```typescript
import { createRollbackPlan, executeRollback, migrationTracker } from '@/lib/data';

// Create rollback plan before migration
const rollbackPlan = createRollbackPlan('mig_123', [
  {
    description: 'Remove preferences column',
    sql: 'ALTER TABLE users DROP COLUMN preferences',
    riskLevel: 'low',
  },
]);

// If migration fails, execute rollback
await executeRollback(rollbackPlan, migrationTracker);
```

### CLI Migration Tool

```bash
# Apply migrations
node scripts/db/migrate.js up

# Dry run
node scripts/db/migrate.js up --dry-run

# With backup
node scripts/db/migrate.js up --backup

# Check status
node scripts/db/migrate.js status --verbose

# Rollback
node scripts/db/migrate.js rollback
```

---

## Backup & Recovery

### Backup System

```bash
# Create backup
node scripts/db/migrate.js backup

# Production backup with timestamp
node scripts/db/migrate.js backup --production

# Verify backup integrity
node scripts/backup-verification.js verify

# Verify all backups
node scripts/backup-verification.js verify-all
```

### Backup Verification

```bash
# Run backup verification
node scripts/run-backup-verification.js

# Generate checksums
node scripts/generate-backup-checksum.js

# Generate checksums for all backups
node scripts/generate-backup-checksum.js generate-all
```

### Restore Procedure

```bash
# List available backups
node scripts/db/migrate.js backup --list

# Restore from backup
node scripts/db/migrate.js restore --file backup_2026-02-02.sql

# Verify after restore
node scripts/data/data-integrity-check.js
```

---

## Maintenance Scripts

### Data Cleanup

```bash
# Cleanup all stale data
node scripts/data/data-cleanup.js --all

# Cleanup expired sessions only
node scripts/data/data-cleanup.js --expired

# Cleanup orphaned records
node scripts/data/data-cleanup.js --orphaned

# Cleanup demo accounts (production only)
node scripts/data/data-cleanup.js --demo

# Dry run (preview only)
node scripts/data/data-cleanup.js --all --dry-run
```

### Data Validation

```bash
# Validate all data
node scripts/data/data-validator.js

# Auto-fix issues
node scripts/data/data-validator.js --fix

# Validate specific table
node scripts/data/data-validator.js --table users
```

---

## Best Practices

### 1. Pre-Migration Checklist

- [ ] Create database backup
- [ ] Run integrity check
- [ ] Take data snapshot
- [ ] Prepare rollback plan
- [ ] Test in staging first
- [ ] Schedule during low traffic

### 2. During Migration

```typescript
// Always use transactions for data migrations
await prisma.$transaction(async (tx) => {
  // Migration steps here
  await tx.user.updateMany({ ... });
});

// Track all steps
await migrationTracker.recordStep(migration.id, 'step_name', 'description');
```

### 3. Post-Migration Verification

```bash
# Run full integrity check
node scripts/data/data-integrity-check.js --json > post_migration_report.json

# Compare with pre-migration report
diff pre_migration_report.json post_migration_report.json
```

### 4. Automated Integrity Checks

Add to CI/CD pipeline:

```yaml
# .github/workflows/data-integrity.yml
name: Data Integrity Check
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: node scripts/data/data-integrity-check.js --json
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Pooled connection string | Yes |
| `DIRECT_URL` | Direct connection string | Yes |
| `BACKUP_RETENTION_DAYS` | Days to keep backups | No (default: 30) |
| `INTEGRITY_CHECK_INTERVAL` | Hours between checks | No (default: 6) |

---

## Troubleshooting

### Common Issues

**1. Orphaned Records**
```bash
# Find and clean orphaned records
node scripts/data/data-integrity-check.js --verbose
node scripts/data/data-cleanup.js --orphaned
```

**2. Expired Sessions Accumulating**
```bash
# Clean expired sessions
node scripts/data/data-cleanup.js --expired
```

**3. Migration Failed Mid-Way**
```bash
# Check migration status
node scripts/db/migrate.js status

# Rollback if needed
node scripts/db/migrate.js rollback

# Restore from backup
node scripts/db/migrate.js restore --latest
```

---

## Related Documentation

- [Database Migration Strategy](./DATABASE_MIGRATION_STRATEGY.md)
- [Production Deployment Runbook](./PRODUCTION_DEPLOYMENT_RUNBOOK.md)
- [Scalability Guide](./SCALABILITY_GUIDE.md)

---

*Last updated: 2026-02-02*
