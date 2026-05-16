/**
 * tests/security/cross-tenant.spec.ts — Synthex Phase 1 Deliverable 1.
 *
 * Adversarial RLS baseline. Companion to scripts/validate-rls-coverage.ts.
 *
 * Why this test exists
 * --------------------
 * The CI validator (PR #232) checks that every Prisma model has a matching
 * `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` migration. That is a schema-
 * presence check — it does NOT verify that the table's policies actually
 * block cross-tenant access.
 *
 * Per Margot research finding Q1, 32% of "RLS Enabled" tables in AI-
 * generated apps are actually broken — they ship with `using (true)`
 * policies or no policies at all, which permit cross-tenant reads/writes.
 *
 * This test queries pg_policies directly (the Postgres source of truth)
 * and classifies every public table into one of four buckets:
 *
 *   SECURE          — RLS on, ≥1 policy, no `using (true)` / null predicate,
 *                     at least one organization_id- or auth.uid-scoped clause.
 *   USING_TRUE      — RLS on, has at least one `using (true)` policy. Broken.
 *   NO_POLICY       — RLS on, but zero policies. Service-role only access;
 *                     anon/authenticated keys see nothing (acceptable iff
 *                     app never uses those keys against this table).
 *   NULL_PREDICATE  — RLS on, policy exists but qual + with_check are both
 *                     NULL. Broken.
 *
 * Usage
 * -----
 *   RLS_ADVERSARIAL=true \
 *   SUPABASE_DB_URL=postgresql://... \
 *   npx jest tests/security/cross-tenant.spec.ts
 *
 * Failure modes
 * -------------
 *   - secure < SECURE_MINIMUM (default 5)  → P0 incident — STOP and escalate.
 *   - secure < SECURE_FLOOR  (default 18)  → regression vs baseline — investigate.
 *
 * The baseline doc is at docs/security/rls-adversarial-baseline-2026-05-16.md.
 */

import { Client } from 'pg';

// Skip entire suite unless explicitly opted in — keeps default `npm test` fast
// and prevents accidental production-DB connections in CI without secrets.
const RUN = process.env.RLS_ADVERSARIAL === 'true';

const SECURE_MINIMUM = Number(process.env.RLS_SECURE_MINIMUM ?? 5);
const SECURE_FLOOR = Number(process.env.RLS_SECURE_FLOOR ?? 18);

const describeIf = RUN ? describe : describe.skip;

interface VerdictRow {
  verdict: 'SECURE' | 'USING_TRUE' | 'NO_POLICY' | 'NULL_PREDICATE' | 'OTHER';
  table_count: string;
}

interface PerTableRow {
  tablename: string;
  rls_on: boolean;
  policy_count: string;
  using_true_count: string;
  null_predicate_count: string;
  tenant_scoped_count: string;
  user_scoped_count: string;
}

const VERDICT_SQL = `
WITH per_table AS (
  SELECT
    t.tablename,
    t.rowsecurity AS rls_on,
    COUNT(p.policyname) AS policy_count,
    COUNT(*) FILTER (WHERE p.qual = 'true' OR p.with_check = 'true') AS using_true_count,
    COUNT(*) FILTER (WHERE p.qual IS NULL AND p.with_check IS NULL) AS null_predicate_count,
    COUNT(*) FILTER (WHERE p.qual ILIKE '%organization_id%' OR p.with_check ILIKE '%organization_id%') AS tenant_scoped_count,
    COUNT(*) FILTER (WHERE p.qual ILIKE '%auth.uid%' OR p.with_check ILIKE '%auth.uid%') AS user_scoped_count
  FROM pg_tables t
  LEFT JOIN pg_policies p
    ON p.schemaname = t.schemaname AND p.tablename = t.tablename
  WHERE t.schemaname = 'public'
  GROUP BY t.tablename, t.rowsecurity
),
classified AS (
  SELECT *,
    CASE
      WHEN NOT rls_on                                       THEN 'RLS_OFF'
      WHEN policy_count = 0                                 THEN 'NO_POLICY'
      WHEN using_true_count > 0                             THEN 'USING_TRUE'
      WHEN null_predicate_count > 0                         THEN 'NULL_PREDICATE'
      WHEN tenant_scoped_count > 0 OR user_scoped_count > 0 THEN 'SECURE'
      ELSE 'OTHER'
    END AS verdict
  FROM per_table
)
SELECT verdict, COUNT(*)::text AS table_count
FROM classified
GROUP BY verdict
ORDER BY table_count DESC;
`;

const HIGH_EXPOSURE_TABLES = [
  'leads',
  'email_campaigns',
  'testimonials',
  'testimonial_requests',
  'gbp_locations',
  'gbp_reviews',
  'gsc_snapshots',
  'keyword_targets',
  'keyword_rank_snapshots',
  'invoices',
  'invoice_line_items',
  'founder_outreach_queue',
  'generated_content',
  'content_performance_profiles',
  'nexus_databases',
  'autopilot_configs',
  'autopilot_runs',
];

describeIf('RLS adversarial baseline (pg_policies ground truth)', () => {
  let client: Client;
  let verdicts: Record<string, number> = {};

  beforeAll(async () => {
    const connStr = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
    if (!connStr) {
      throw new Error(
        'SUPABASE_DB_URL or DATABASE_URL is required for adversarial RLS tests'
      );
    }
    client = new Client({ connectionString: connStr });
    await client.connect();

    const { rows } = await client.query<VerdictRow>(VERDICT_SQL);
    verdicts = Object.fromEntries(rows.map((r) => [r.verdict, Number(r.table_count)]));
  }, 30_000);

  afterAll(async () => {
    if (client) await client.end();
  });

  test('classification covers all public tables', () => {
    const total = Object.values(verdicts).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(100);
  });

  test('SECURE count exceeds P0 minimum', () => {
    const secure = verdicts.SECURE ?? 0;
    // P0 GATE: if < SECURE_MINIMUM, the test logs the count and fails so the
    // operator (or alert pipeline reading exit code 1) can fire Telegram.
    if (secure < SECURE_MINIMUM) {
      console.error(
        `[RLS-P0] secure=${secure} < minimum=${SECURE_MINIMUM}. STOP, escalate.`
      );
    }
    expect(secure).toBeGreaterThanOrEqual(SECURE_MINIMUM);
  });

  test('SECURE count is at or above baseline floor (regression check)', () => {
    const secure = verdicts.SECURE ?? 0;
    expect(secure).toBeGreaterThanOrEqual(SECURE_FLOOR);
  });

  test('high-exposure tables surface their policy verdict', async () => {
    const { rows } = await client.query<PerTableRow>(`
      SELECT
        t.tablename,
        t.rowsecurity AS rls_on,
        COUNT(p.policyname)::text AS policy_count,
        COUNT(*) FILTER (WHERE p.qual = 'true' OR p.with_check = 'true')::text AS using_true_count,
        COUNT(*) FILTER (WHERE p.qual IS NULL AND p.with_check IS NULL)::text AS null_predicate_count,
        COUNT(*) FILTER (WHERE p.qual ILIKE '%organization_id%' OR p.with_check ILIKE '%organization_id%')::text AS tenant_scoped_count,
        COUNT(*) FILTER (WHERE p.qual ILIKE '%auth.uid%' OR p.with_check ILIKE '%auth.uid%')::text AS user_scoped_count
      FROM pg_tables t
      LEFT JOIN pg_policies p
        ON p.schemaname = t.schemaname AND p.tablename = t.tablename
      WHERE t.schemaname = 'public'
        AND t.tablename = ANY($1::text[])
      GROUP BY t.tablename, t.rowsecurity
      ORDER BY t.tablename
    `, [HIGH_EXPOSURE_TABLES]);

    const broken = rows.filter(
      (r) => Number(r.using_true_count) > 0 || Number(r.null_predicate_count) > 0
    );
    if (broken.length > 0) {
      console.warn(
        `[RLS-WARN] high-exposure broken-policy tables: ${broken
          .map((r) => r.tablename)
          .join(', ')}`
      );
    }
    expect(rows.length).toBeGreaterThan(0);
  });
});
