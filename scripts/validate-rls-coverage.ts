/**
 * scripts/validate-rls-coverage.ts — RA-3021.
 *
 * CI gate that fails the build if a Prisma model exists without a
 * matching `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` statement in
 * any supabase/migrations/*.sql or prisma/migrations/* migration.
 *
 * Run:
 *   npx tsx scripts/validate-rls-coverage.ts
 *
 * Exit code:
 *   0 — every Prisma model has RLS coverage
 *   1 — one or more models are uncovered (list printed to stderr)
 *
 * Bypass for a specific model: add `@@map("X")` + a same-name
 * `ALTER TABLE "X" ENABLE ROW LEVEL SECURITY;` in any migration.
 *
 * To intentionally exempt a model (e.g. catalog table that is
 * read-publicly), add its DB name to RLS_EXEMPT below with a
 * justification comment.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename_local = fileURLToPath(import.meta.url);
const __dirname_local = path.dirname(__filename_local);
const REPO_ROOT = path.resolve(__dirname_local, '..');
const SCHEMA = path.join(REPO_ROOT, 'prisma', 'schema.prisma');
const SUPABASE_MIGRATIONS = path.join(REPO_ROOT, 'supabase', 'migrations');
const PRISMA_MIGRATIONS = path.join(REPO_ROOT, 'prisma', 'migrations');

// Intentional exemptions — each one MUST have a justification comment.
// Add carefully: every entry here is a tenant-isolation hole if wrong.
const RLS_EXEMPT = new Set<string>([
  // Add table DB names here, one per line, with reason:
  // "_migrations",  // Prisma internal — service-role only
]);

function extractModelDbNames(schemaText: string): Set<string> {
  // Parse `model X { ... @@map("table_name") }` blocks.
  // For models without @@map, the table name defaults to the model
  // name verbatim (Prisma's default behaviour).
  const out = new Set<string>();
  const modelPattern = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let m: RegExpExecArray | null;
  while ((m = modelPattern.exec(schemaText)) !== null) {
    const modelName = m[1];
    const body = m[2];
    // Skip models with @@ignore — Prisma won't generate a table.
    if (/@@ignore\b/.test(body)) continue;
    const mapMatch = body.match(/@@map\(\s*"([^"]+)"\s*\)/);
    out.add(mapMatch ? mapMatch[1] : modelName);
  }
  return out;
}

function collectRlsEnabledTables(): Set<string> {
  const out = new Set<string>();
  const patterns: string[][] = [];
  // Pattern: ALTER TABLE "?<name>"? ENABLE ROW LEVEL SECURITY
  for (const dir of [SUPABASE_MIGRATIONS, PRISMA_MIGRATIONS]) {
    if (!fs.existsSync(dir)) continue;
    const sqlFiles: string[] = [];
    const walk = (p: string) => {
      for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
        const full = path.join(p, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.sql')) sqlFiles.push(full);
      }
    };
    walk(dir);
    for (const f of sqlFiles) {
      const content = fs.readFileSync(f, 'utf-8');
      // Handles: ALTER TABLE [IF EXISTS] [public.]"<name>" ENABLE ROW LEVEL SECURITY
      const re = /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?"?([a-zA-Z0-9_]+)"?\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        out.add(m[1]);
      }
    }
  }
  return out;
}

function main(): void {
  if (!fs.existsSync(SCHEMA)) {
    console.error(`[rls-coverage] schema.prisma not found at ${SCHEMA}`);
    process.exit(1);
  }
  const schemaText = fs.readFileSync(SCHEMA, 'utf-8');
  const models = extractModelDbNames(schemaText);
  const rlsTables = collectRlsEnabledTables();

  const uncovered: string[] = [];
  for (const t of models) {
    if (RLS_EXEMPT.has(t)) continue;
    if (!rlsTables.has(t)) uncovered.push(t);
  }
  uncovered.sort();

  console.log(`[rls-coverage] models: ${models.size}`);
  console.log(`[rls-coverage] rls-enabled tables: ${rlsTables.size}`);
  console.log(`[rls-coverage] exempted: ${RLS_EXEMPT.size}`);
  console.log(`[rls-coverage] uncovered: ${uncovered.length}`);

  if (uncovered.length > 0) {
    console.error('');
    console.error(`[rls-coverage] FAIL — ${uncovered.length} Prisma model(s) without RLS coverage:`);
    for (const t of uncovered) console.error(`  - ${t}`);
    console.error('');
    console.error('Fix path: add a migration with `ALTER TABLE "X" ENABLE ROW LEVEL SECURITY;`');
    console.error('+ appropriate `CREATE POLICY` statement(s) scoped to organization_id.');
    console.error('See supabase/migrations/20260319000001_rls_comprehensive_all_tables.sql for the canonical pattern.');
    process.exit(1);
  }
  console.log('[rls-coverage] OK — all Prisma models covered.');
}

main();
