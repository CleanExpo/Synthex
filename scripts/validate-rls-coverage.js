#!/usr/bin/env node

/**
 * Plain-Node runtime for the RLS schema coverage gate.
 *
 * Keep this in sync with scripts/validate-rls-coverage.ts. The JS entrypoint
 * avoids tsx IPC/socket setup so it can run in restricted local sandboxes and
 * in the consolidated /shipit status reporter.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const REPO_ROOT = path.resolve(dirname, '..');
const SCHEMA = path.join(REPO_ROOT, 'prisma', 'schema.prisma');
const SUPABASE_MIGRATIONS = path.join(REPO_ROOT, 'supabase', 'migrations');
const PRISMA_MIGRATIONS = path.join(REPO_ROOT, 'prisma', 'migrations');

const RLS_EXEMPT = new Set([
  // Add table DB names here, one per line, with reason:
  // "_migrations",  // Prisma internal — service-role only
]);

function extractModelDbNames(schemaText) {
  const out = new Set();
  const modelPattern = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let match;
  while ((match = modelPattern.exec(schemaText)) !== null) {
    const modelName = match[1];
    const body = match[2];
    if (/@@ignore\b/.test(body)) continue;
    const mapMatch = body.match(/@@map\(\s*"([^"]+)"\s*\)/);
    out.add(mapMatch ? mapMatch[1] : modelName);
  }
  return out;
}

function collectSqlFiles(dir) {
  const sqlFiles = [];
  if (!fs.existsSync(dir)) return sqlFiles;

  const walk = (currentPath) => {
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const full = path.join(currentPath, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.sql')) sqlFiles.push(full);
    }
  };

  walk(dir);
  return sqlFiles;
}

function collectRlsEnabledTables() {
  const out = new Set();
  const re =
    /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?"?([a-zA-Z0-9_]+)"?\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;

  for (const dir of [SUPABASE_MIGRATIONS, PRISMA_MIGRATIONS]) {
    for (const file of collectSqlFiles(dir)) {
      const content = fs.readFileSync(file, 'utf8');
      let match;
      while ((match = re.exec(content)) !== null) {
        out.add(match[1]);
      }
    }
  }

  return out;
}

function main() {
  if (!fs.existsSync(SCHEMA)) {
    console.error(`[rls-coverage] schema.prisma not found at ${SCHEMA}`);
    process.exit(1);
  }

  const schemaText = fs.readFileSync(SCHEMA, 'utf8');
  const models = extractModelDbNames(schemaText);
  const rlsTables = collectRlsEnabledTables();
  const uncovered = [];

  for (const table of models) {
    if (RLS_EXEMPT.has(table)) continue;
    if (!rlsTables.has(table)) uncovered.push(table);
  }
  uncovered.sort();

  console.log(`[rls-coverage] models: ${models.size}`);
  console.log(`[rls-coverage] rls-enabled tables: ${rlsTables.size}`);
  console.log(`[rls-coverage] exempted: ${RLS_EXEMPT.size}`);
  console.log(`[rls-coverage] uncovered: ${uncovered.length}`);

  if (uncovered.length > 0) {
    console.error('');
    console.error(
      `[rls-coverage] FAIL — ${uncovered.length} Prisma model(s) without RLS coverage:`
    );
    for (const table of uncovered) console.error(`  - ${table}`);
    console.error('');
    console.error(
      'Fix path: add a migration with `ALTER TABLE "X" ENABLE ROW LEVEL SECURITY;`'
    );
    console.error('+ appropriate `CREATE POLICY` statement(s) scoped to organization_id.');
    console.error(
      'See supabase/migrations/20260319000001_rls_comprehensive_all_tables.sql for the canonical pattern.'
    );
    process.exit(1);
  }

  console.log('[rls-coverage] OK — all Prisma models covered.');
}

main();
