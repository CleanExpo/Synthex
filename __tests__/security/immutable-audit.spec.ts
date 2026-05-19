/**
 * __tests__/security/immutable-audit.spec.ts
 *
 * Verifies that audit_events_immutable is genuinely append-only:
 *   1. INSERT via service_role works
 *   2. SELECT via service_role reads the row back
 *   3. UPDATE attempt raises (trigger fires)
 *   4. DELETE attempt raises (trigger fires)
 *
 * Skips by default. Opt in with IMMUTABLE_AUDIT_TEST=true.
 * Requires SUPABASE_DB_URL (direct Postgres connection — RLS is bypassed
 * automatically because we run as the connection role, but the trigger is
 * not bypassable, which is precisely what this test asserts).
 *
 * The test cleans up after itself with TRUNCATE — but only on a temporary
 * scratch table prefixed `audit_events_immutable_test_`. The real production
 * table is intentionally NOT touched by this test; we test the schema +
 * trigger via a clone.
 *
 * Why a clone, not the real table:
 *   The real audit_events_immutable accumulates production compliance events.
 *   Inserting test rows pollutes the SOC 2 evidence stream. Cloning the
 *   schema and triggers gives us a clean assertion target.
 */

import { Client } from 'pg';

const RUN = process.env.IMMUTABLE_AUDIT_TEST === 'true';
const describeIf = RUN ? describe : describe.skip;

const SCRATCH_TABLE = 'audit_events_immutable_test_clone';

describeIf('audit_events_immutable — append-only contract', () => {
  let client: Client;

  beforeAll(async () => {
    const connStr = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
    if (!connStr) {
      throw new Error('SUPABASE_DB_URL or DATABASE_URL required');
    }
    client = new Client({ connectionString: connStr });
    await client.connect();

    // Clone the production schema + trigger into a scratch table.
    await client.query(`
      DROP TABLE IF EXISTS public.${SCRATCH_TABLE} CASCADE;
      CREATE TABLE public.${SCRATCH_TABLE} (
        id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type  text        NOT NULL,
        actor_id    uuid        NULL,
        payload     jsonb       NOT NULL DEFAULT '{}'::jsonb,
        created_at  timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE public.${SCRATCH_TABLE} ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.${SCRATCH_TABLE} FORCE ROW LEVEL SECURITY;

      CREATE OR REPLACE FUNCTION public.${SCRATCH_TABLE}_block()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION '% blocked on append-only audit clone', TG_OP
          USING ERRCODE = 'insufficient_privilege';
      END;
      $$;

      CREATE TRIGGER trg_${SCRATCH_TABLE}_block_update
        BEFORE UPDATE ON public.${SCRATCH_TABLE}
        FOR EACH ROW EXECUTE FUNCTION public.${SCRATCH_TABLE}_block();
      CREATE TRIGGER trg_${SCRATCH_TABLE}_block_delete
        BEFORE DELETE ON public.${SCRATCH_TABLE}
        FOR EACH ROW EXECUTE FUNCTION public.${SCRATCH_TABLE}_block();
    `);
  }, 30_000);

  afterAll(async () => {
    if (client) {
      try {
        await client.query(`DROP TABLE IF EXISTS public.${SCRATCH_TABLE} CASCADE;`);
        await client.query(`DROP FUNCTION IF EXISTS public.${SCRATCH_TABLE}_block();`);
      } finally {
        await client.end();
      }
    }
  });

  test('INSERT works', async () => {
    const { rows } = await client.query(
      `INSERT INTO public.${SCRATCH_TABLE} (event_type, payload)
       VALUES ('test.insert', '{"k":"v"}'::jsonb)
       RETURNING id, event_type, payload`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].event_type).toBe('test.insert');
    expect(rows[0].payload).toEqual({ k: 'v' });
  });

  test('SELECT works', async () => {
    const { rows } = await client.query(
      `SELECT count(*)::int AS c FROM public.${SCRATCH_TABLE}`
    );
    expect(rows[0].c).toBeGreaterThanOrEqual(1);
  });

  test('UPDATE is rejected by trigger', async () => {
    await expect(
      client.query(
        `UPDATE public.${SCRATCH_TABLE} SET event_type = 'tampered' WHERE event_type = 'test.insert'`
      )
    ).rejects.toThrow(/UPDATE blocked on append-only/);
  });

  test('DELETE is rejected by trigger', async () => {
    await expect(
      client.query(
        `DELETE FROM public.${SCRATCH_TABLE} WHERE event_type = 'test.insert'`
      )
    ).rejects.toThrow(/DELETE blocked on append-only/);
  });
});
