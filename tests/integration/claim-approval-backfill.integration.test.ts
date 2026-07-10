/**
 * SYN-MCP-001 — backfill proof for the approval/evidence split migration
 * (prisma/migrations/20260710100000_add_claim_approval_status/migration.sql).
 *
 * Why this test exists: the integration profile's globalSetup materialises the
 * schema with `prisma db push` (schema only) — migration SQL is NEVER executed
 * by the harness, so the backfill UPDATEs would otherwise ship unproven. This
 * test executes the ACTUAL migration file raw against the Docker sandbox
 * (:5499, guard-enforced) and asserts the full backfill matrix:
 *
 *   evidence_status='verified'  (no source) → approval_status='approved'
 *       + metadata.migratedLegacyVerified=true
 *       + approved_by_id/approved_at stay NULL (no fabricated approver)
 *       + evidence_status GRANDFATHERED (stays 'verified', no re-derive)
 *   evidence_status='disputed'              → approval_status='rejected'
 *       + metadata.migratedLegacyDisputed=true, evidence_status untouched
 *   evidence_status='blocked'               → untouched (approval 'pending')
 *   evidence_status='pending_evidence'      → untouched (approval 'pending')
 *
 * …and idempotency: a second execution of the same file affects 0 rows.
 *
 * Run: npm run sandbox:up && npm run test:integration
 */

import * as fs from 'fs';
import * as path from 'path';
import { assertSandboxDatabaseUrl } from './setup/sandbox-guard';
import { createSandboxPrismaClient } from './setup/seed';

const MIGRATION_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'prisma',
  'migrations',
  '20260710100000_add_claim_approval_status',
  'migration.sql'
);

const FIXTURES = [
  {
    id: 'itest-backfill-verified',
    evidenceStatus: 'verified',
    statement: 'Legacy verified row (approved via the old conflated verb).',
  },
  {
    id: 'itest-backfill-disputed',
    evidenceStatus: 'disputed',
    statement: 'Legacy disputed row (rejected via the old conflated verb).',
  },
  {
    id: 'itest-backfill-blocked',
    evidenceStatus: 'blocked',
    statement: 'Blocked row — must stay pending.',
  },
  {
    id: 'itest-backfill-pending',
    evidenceStatus: 'pending_evidence',
    statement: 'Pending-evidence row — must stay pending.',
  },
] as const;

describe('SYN-MCP-001 migration backfill (executed raw in-sandbox)', () => {
  assertSandboxDatabaseUrl(process.env.DATABASE_URL);
  const { prisma, pool } = createSandboxPrismaClient();
  const migrationSql = fs.readFileSync(MIGRATION_PATH, 'utf8');

  beforeAll(async () => {
    // Seed the 4 legacy row shapes on FIXED ids, resetting approval state so
    // the suite is re-runnable (the sandbox schema was created by db push, so
    // approval_status already exists with its default 'pending').
    for (const f of FIXTURES) {
      await prisma.marketingAgencyClaim.upsert({
        where: { id: f.id },
        update: {
          evidenceStatus: f.evidenceStatus,
          approvalStatus: 'pending',
          approvedById: null,
          approvedAt: null,
          metadata: {},
        },
        create: {
          id: f.id,
          organizationId: 'itest-org',
          createdById: 'itest-user',
          campaignId: 'itest-campaign',
          sourceRefId: null, // all legacy shapes are source-less
          statement: f.statement,
          claimType: 'factual',
          evidenceStatus: f.evidenceStatus,
          approvalStatus: 'pending',
          metadata: {},
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.marketingAgencyClaim.deleteMany({
      where: { id: { in: FIXTURES.map(f => f.id) } },
    });
    await prisma.$disconnect();
    await pool.end();
  });

  it('executes the real migration file against the sandbox', async () => {
    // node-postgres runs multi-statement SQL via the simple query protocol.
    await expect(pool.query(migrationSql)).resolves.toBeDefined();
  });

  it('legacy verified → approved + migratedLegacyVerified, NULL approver, evidence grandfathered', async () => {
    const row = await prisma.marketingAgencyClaim.findUnique({
      where: { id: 'itest-backfill-verified' },
    });
    expect(row?.approvalStatus).toBe('approved');
    expect(row?.approvedById).toBeNull();
    expect(row?.approvedAt).toBeNull();
    // Grandfathered: v1 policy would call a source-less row 'blocked', but the
    // backfill must NOT re-derive.
    expect(row?.evidenceStatus).toBe('verified');
    expect(
      (row?.metadata as Record<string, unknown>).migratedLegacyVerified
    ).toBe(true);
    expect(
      (row?.metadata as Record<string, unknown>).migratedLegacyDisputed
    ).toBeUndefined();
  });

  it('legacy disputed → rejected + migratedLegacyDisputed, evidence untouched', async () => {
    const row = await prisma.marketingAgencyClaim.findUnique({
      where: { id: 'itest-backfill-disputed' },
    });
    expect(row?.approvalStatus).toBe('rejected');
    expect(row?.approvedById).toBeNull();
    expect(row?.approvedAt).toBeNull();
    expect(row?.evidenceStatus).toBe('disputed');
    expect(
      (row?.metadata as Record<string, unknown>).migratedLegacyDisputed
    ).toBe(true);
    expect(
      (row?.metadata as Record<string, unknown>).migratedLegacyVerified
    ).toBeUndefined();
  });

  it.each([
    ['itest-backfill-blocked', 'blocked'],
    ['itest-backfill-pending', 'pending_evidence'],
  ])(
    '%s stays approval=pending, evidence=%s, no flags',
    async (id, evidence) => {
      const row = await prisma.marketingAgencyClaim.findUnique({
        where: { id },
      });
      expect(row?.approvalStatus).toBe('pending');
      expect(row?.evidenceStatus).toBe(evidence);
      const metadata = (row?.metadata ?? {}) as Record<string, unknown>;
      expect(metadata.migratedLegacyVerified).toBeUndefined();
      expect(metadata.migratedLegacyDisputed).toBeUndefined();
    }
  );

  it('is idempotent: re-running the migration file updates 0 rows', async () => {
    const results = await pool.query(migrationSql);
    // Multi-statement query → array of per-statement results. Every UPDATE
    // must be a no-op on the second pass (the approval_status='pending'
    // guard excludes already-migrated rows).
    const resultArray = Array.isArray(results) ? results : [results];
    const updates = resultArray.filter(r => r.command === 'UPDATE');
    expect(updates.length).toBeGreaterThanOrEqual(2);
    for (const update of updates) {
      expect(update.rowCount).toBe(0);
    }
  });
});
