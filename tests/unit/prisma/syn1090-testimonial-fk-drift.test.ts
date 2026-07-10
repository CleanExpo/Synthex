/**
 * SYN-1090 — Testimonial FK schema<->prod drift regression guards.
 *
 * BUG: TestimonialRequest.organizationId and Testimonial.organizationId were
 * declared `@db.Uuid` in prisma/schema.prisma while Organization.id is text
 * (cuid). Consequences (all verified live 2026-07-10):
 *   - `prisma db push` onto ANY fresh Postgres failed (uuid<->text FK
 *     incompatible), forcing a sandbox-only "patched copy" workaround in
 *     tests/integration/setup/global-setup.ts;
 *   - the declared FKs could not exist in prod (pg_constraint: ZERO FKs on
 *     both tables — even the type-compatible request_id FK was absent);
 *   - the write path (app/api/testimonials/requests) inserted a cuid string
 *     into a uuid column -> 22P02 on every insert: feature dead in prod.
 *
 * FIX (option 1 of the bench): schema drops `@db.Uuid` from the two
 * organizationId columns (text, matching Organization.id); a CREATE-ONLY,
 * founder-applied migration converts the two prod columns uuid -> text and
 * restores the 3 declared FKs, dropping/recreating the 8 RLS tenant policies
 * that reference organization_id (Postgres refuses ALTER COLUMN TYPE on a
 * policy-referenced column) in ONE transaction; the sandbox patched-copy
 * workaround is deleted so the pristine schema pushes clean.
 *
 * These tests pin all three artifacts against regression.
 */

import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const schema = fs.readFileSync(
  path.join(repoRoot, 'prisma', 'schema.prisma'),
  'utf8'
);
const migration = fs.readFileSync(
  path.join(
    repoRoot,
    'prisma',
    'migrations',
    '20260710150000_syn1090_testimonial_org_fk_text',
    'migration.sql'
  ),
  'utf8'
);
const globalSetup = fs.readFileSync(
  path.join(repoRoot, 'tests', 'integration', 'setup', 'global-setup.ts'),
  'utf8'
);

/** Extract the body of a prisma model block by name. */
function modelBody(name: string): string {
  const m = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`));
  if (!m) throw new Error(`model ${name} not found in schema.prisma`);
  return m[1];
}

describe('SYN-1090 schema.prisma: Testimonial org FKs are text (cuid-compatible)', () => {
  it.each(['TestimonialRequest', 'Testimonial'])(
    '%s.organizationId has NO @db.Uuid (Organization.id is text/cuid)',
    model => {
      const line = modelBody(model)
        .split('\n')
        .find(l => /^\s*organizationId\s/.test(l));
      expect(line).toBeDefined();
      expect(line).toContain('@map("organization_id")');
      expect(line).not.toContain('@db.Uuid');
    }
  );

  it('Testimonial.requestId KEEPS @db.Uuid (TestimonialRequest.id is uuid)', () => {
    const line = modelBody('Testimonial')
      .split('\n')
      .find(l => /^\s*requestId\s/.test(l));
    expect(line).toContain('@db.Uuid');
  });

  it.each(['TestimonialRequest', 'Testimonial'])(
    '%s.id stays a db-generated uuid',
    model => {
      const line = modelBody(model)
        .split('\n')
        .find(l => /^\s*id\s/.test(l));
      expect(line).toContain('@default(dbgenerated("gen_random_uuid()"))');
      expect(line).toContain('@db.Uuid');
    }
  );

  it.each(['TestimonialRequest', 'Testimonial'])(
    '%s keeps the Organization relation with onDelete: Cascade',
    model => {
      expect(modelBody(model)).toMatch(
        /organization\s+Organization\s+@relation\(fields: \[organizationId\], references: \[id\], onDelete: Cascade\)/
      );
    }
  );

  it('Organization.id is still a plain text cuid (scope guard)', () => {
    const line = modelBody('Organization')
      .split('\n')
      .find(l => /^\s*id\s/.test(l));
    expect(line).toContain('@default(cuid())');
    expect(line).not.toContain('@db.Uuid');
  });
});

describe('SYN-1090 migration 20260710150000_syn1090_testimonial_org_fk_text', () => {
  const POLICIES = [
    'testimonial_requests_tenant_select',
    'testimonial_requests_tenant_insert',
    'testimonial_requests_tenant_update',
    'testimonial_requests_tenant_delete',
    'testimonials_tenant_select',
    'testimonials_tenant_insert',
    'testimonials_tenant_update',
    'testimonials_tenant_delete',
  ];

  it('runs as ONE transaction (BEGIN ... COMMIT)', () => {
    expect(migration).toMatch(/^BEGIN;$/m);
    expect(migration).toMatch(/^COMMIT;$/m);
    expect(migration.indexOf('BEGIN;')).toBeLessThan(
      migration.indexOf('ALTER TABLE')
    );
    expect(migration.indexOf('COMMIT;')).toBeGreaterThan(
      migration.lastIndexOf('ADD CONSTRAINT')
    );
  });

  it.each(POLICIES)(
    'drops AND recreates policy %s (ALTER COLUMN TYPE is blocked while a policy references the column)',
    policy => {
      const table = policy.startsWith('testimonial_requests')
        ? 'testimonial_requests'
        : 'testimonials';
      expect(migration).toContain(
        `DROP POLICY IF EXISTS ${policy} ON public.${table};`
      );
      expect(migration).toContain(`CREATE POLICY ${policy}`);
    }
  );

  it('drops each policy BEFORE the type conversion and recreates it AFTER', () => {
    const firstAlter = migration.indexOf('ALTER COLUMN organization_id');
    for (const policy of POLICIES) {
      expect(migration.indexOf(`DROP POLICY IF EXISTS ${policy}`)).toBeLessThan(
        firstAlter
      );
      expect(migration.indexOf(`CREATE POLICY ${policy}`)).toBeGreaterThan(
        firstAlter
      );
    }
  });

  it.each(['testimonial_requests', 'testimonials'])(
    'converts %s.organization_id uuid -> text WITH a USING cast (safe even if rows exist at apply time)',
    table => {
      expect(migration).toMatch(
        new RegExp(
          `ALTER TABLE public\\.${table}\\s+ALTER COLUMN organization_id TYPE text USING organization_id::text;`
        )
      );
    }
  );

  it('restores all 3 FKs declared in schema.prisma (prod pg_constraint had ZERO)', () => {
    expect(migration).toMatch(
      /ADD CONSTRAINT testimonial_requests_organization_id_fkey\s+FOREIGN KEY \(organization_id\) REFERENCES public\.organizations\(id\)\s+ON DELETE CASCADE/
    );
    expect(migration).toMatch(
      /ADD CONSTRAINT testimonials_organization_id_fkey\s+FOREIGN KEY \(organization_id\) REFERENCES public\.organizations\(id\)\s+ON DELETE CASCADE/
    );
    expect(migration).toMatch(
      /ADD CONSTRAINT testimonials_request_id_fkey\s+FOREIGN KEY \(request_id\) REFERENCES public\.testimonial_requests\(id\)\s+ON DELETE CASCADE/
    );
  });

  it('recreated policies keep the exact tenant predicate (verbatim vs prod pg_policies dump)', () => {
    // Every USING/WITH CHECK body is the canonical tenant-membership check.
    const predicate =
      /organization_id::text IN \(\s*SELECT organization_id\s+FROM public\.users\s+WHERE id = \(SELECT auth\.uid\(\)\)::text\s*\)/g;
    const matches = migration.match(predicate);
    // 4 SELECT/DELETE USING + 2 INSERT WITH CHECK + 2 UPDATE x (USING + WITH CHECK)
    // = 10 predicate occurrences across the 8 policies (x2 tables = per-table 5).
    expect(matches).toHaveLength(10);
  });

  it('contains no DROP TABLE / TRUNCATE / DELETE (create-only repair)', () => {
    expect(migration).not.toMatch(/DROP TABLE/i);
    expect(migration).not.toMatch(/TRUNCATE/i);
    expect(migration).not.toMatch(/^\s*DELETE FROM/im);
  });
});

describe('SYN-1090 sandbox workaround removal (global-setup.ts)', () => {
  it('no longer writes a patched schema copy', () => {
    expect(globalSetup).not.toContain('schema.sandbox.tmp.prisma');
    expect(globalSetup).not.toContain('@db\\.Uuid');
    expect(globalSetup).not.toMatch(/replace\(/);
  });

  it('pushes the pristine prisma/schema.prisma directly', () => {
    expect(globalSetup).toContain(
      'npx prisma db push --accept-data-loss --schema prisma/schema.prisma'
    );
  });
});
