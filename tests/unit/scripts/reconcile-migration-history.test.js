const { execFileSync, spawnSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

const repoRoot = join(__dirname, '../../..');
const scriptPath = join(repoRoot, 'scripts/db/reconcile-migration-history.js');
const fixturePath = join(repoRoot, 'tests/fixtures/migration-history-snapshot.json');

function makeFixtureProject() {
  const root = mkdtempSync(join(tmpdir(), 'synthex-migration-history-'));
  const migrationsDir = join(root, 'migrations');
  const migrationOne = join(migrationsDir, '20260101000000_init');
  mkdirSync(migrationOne, { recursive: true });
  writeFileSync(
    join(root, 'schema.prisma'),
    `
      model User {
        id String @id
        @@map("users")
      }

      model Organization {
        id String @id
        @@map("organizations")
      }
    `
  );
  writeFileSync(
    join(migrationOne, 'migration.sql'),
    `
      CREATE TABLE "public"."users" ("id" TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS public.organizations ("id" TEXT NOT NULL);
    `
  );

  return { root, schemaFile: join(root, 'schema.prisma'), migrationsDir };
}

describe('reconcile-migration-history', () => {
  it('reports an existing schema with no Prisma ledger as blocked without printing secrets', () => {
    const fixture = makeFixtureProject();

    try {
      const result = spawnSync(
        process.execPath,
        [
          scriptPath,
          '--json-file',
          fixturePath,
          '--schema-file',
          fixture.schemaFile,
          '--migrations-dir',
          fixture.migrationsDir,
          '--strict',
        ],
        { encoding: 'utf8', cwd: repoRoot }
      );

      expect(result.status).toBe(2);
      expect(result.stdout).toContain(
        'Status: blocked_missing_prisma_migration_ledger'
      );
      expect(result.stdout).toContain('Public base tables: 3');
      expect(result.stdout).toContain('Prisma ledger rows: 0');
      expect(result.stdout).toContain('Secret values were not requested or printed.');
      expect(result.stdout).not.toContain('postgresql://');
      expect(result.stdout).not.toContain('sk_');
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('can emit machine-readable reconciliation counts', () => {
    const fixture = makeFixtureProject();

    try {
      const output = execFileSync(
        process.execPath,
        [
          scriptPath,
          '--json-file',
          fixturePath,
          '--schema-file',
          fixture.schemaFile,
          '--migrations-dir',
          fixture.migrationsDir,
          '--json',
        ],
        { encoding: 'utf8', cwd: repoRoot }
      );

      const report = JSON.parse(output);
      expect(report.status).toBe('blocked_missing_prisma_migration_ledger');
      expect(report.counts.localMigrationDirs).toBe(1);
      expect(report.counts.localMigrationCreateTables).toBe(2);
      expect(report.counts.migrationTablesMissing).toBe(0);
      expect(report.counts.publicTablesNotInPrisma).toBe(1);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});
