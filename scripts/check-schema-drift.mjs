/**
 * Schema drift smoke test — run AFTER `prisma migrate deploy` in the build
 * pipeline (see scripts/build-with-migrations.sh).
 *
 * Compares every scalar field on every model in prisma/schema.prisma against
 * the live `information_schema.columns`. If any column declared in the schema
 * is missing from the DB, exits with code 1 to fail the build BEFORE
 * `next build` ships a Prisma client that expects columns the DB lacks.
 *
 * Root cause this guards against: a migration row in `_prisma_migrations` can
 * be marked finished while its DDL silently no-op'd — OR, in Synthex's case,
 * migrations were historically applied out of band and the ledger never tracked
 * them, so `migrate deploy` thinks there's nothing to do. Either way the live
 * DB ends up missing columns and dashboards 500. RestoreAssist hit the
 * no-op variant on 2026-05-12 (24 columns missing across 7 tables).
 *
 * SYNTHEX-SPECIFIC: this schema maps every model to a snake_case table via
 * `@@map(...)` and most columns to snake_case via `@map(...)`. This checker
 * resolves those maps so it compares DB names against DB names. A field with no
 * `@map` keeps its Prisma name (Prisma's default when unmapped).
 *
 * Limits:
 * - Doesn't check enum types, relations, indexes, or constraints. Scalar columns only.
 * - Tolerant of legacy DB columns NOT in schema (extra-in-DB drift is dormant).
 * - Reads DIRECT_URL (falls back to DATABASE_URL) — same pattern as the build script.
 *
 * Usage:
 *   node scripts/check-schema-drift.mjs
 *
 * Exit codes:
 *   0  No drift (all schema scalar columns exist in DB)
 *   1  Drift detected (with details on stderr)
 *   2  Could not connect / could not read schema
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const SCHEMA_PATH = "prisma/schema.prisma";

const PRISMA_SCALARS = new Set([
  "String",
  "Int",
  "Boolean",
  "DateTime",
  "Float",
  "Json",
  "BigInt",
  "Bytes",
  "Decimal",
]);

/** Extract the value of an inline attribute like @map("x") or @@map("x"). */
function extractMap(line, attr) {
  // attr is "@map" or "@@map"; match @map("snake") / @map(name: "snake")
  const re = new RegExp(`${attr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\(\\s*(?:name:\\s*)?["']([^"']+)["']`);
  const m = line.match(re);
  return m ? m[1] : null;
}

function parseSchema(content) {
  // Match: model <Name> { ... }
  const models = {};
  const modelRe = /^model\s+(\w+)\s*\{/gm;
  let m;
  while ((m = modelRe.exec(content)) !== null) {
    const name = m[1];
    // Walk forward to find the matching close brace
    let i = m.index + m[0].length;
    let depth = 1;
    while (depth > 0 && i < content.length) {
      const c = content[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      i++;
    }
    const body = content.slice(m.index + m[0].length, i - 1);
    models[name] = body;
  }

  // Collect enum names so we can recognize them in field types.
  const enums = new Set();
  const enumRe = /^enum\s+(\w+)\s*\{/gm;
  while ((m = enumRe.exec(content)) !== null) enums.add(m[1]);

  // For each model, extract the DB table name (@@map or model name) and the
  // DB column name of each scalar field (@map or field name).
  const tables = {}; // dbTableName -> { prismaModel, columns: string[] }
  for (const [name, body] of Object.entries(models)) {
    let tableName = name; // Prisma default table name = model name when no @@map
    const columns = [];
    for (let rawLine of body.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("//")) continue;
      if (line.startsWith("@@")) {
        // block attribute — only @@map changes the table name
        const mapped = extractMap(line, "@@map");
        if (mapped) tableName = mapped;
        continue;
      }
      // <name> <Type>[?][[]] [attributes...]
      const tokens = line.split(/\s+/);
      if (tokens.length < 2) continue;
      const fname = tokens[0];
      const ftype = tokens[1];
      if (ftype.endsWith("[]")) continue; // relation array
      const core = ftype.replace(/[?[\]]/g, "");
      // Keep scalars + known enums. Skip unknown types (probably relations).
      if (!PRISMA_SCALARS.has(core) && !enums.has(core)) continue;
      // Resolve the DB column name: @map("snake") wins, else the field name.
      const mappedCol = extractMap(line, "@map");
      columns.push(mappedCol || fname);
    }
    tables[tableName] = { prismaModel: name, columns };
  }
  return tables;
}

async function main() {
  if (!fs.existsSync(SCHEMA_PATH)) {
    console.error(`✗ schema file not found at ${SCHEMA_PATH}`);
    process.exit(2);
  }
  const schemaText = fs.readFileSync(SCHEMA_PATH, "utf-8");
  const expected = parseSchema(schemaText);
  const tableNames = Object.keys(expected);
  if (tableNames.length === 0) {
    console.error("✗ no models found in schema — parse error?");
    process.exit(2);
  }

  const prisma = new PrismaClient();
  let rows;
  try {
    rows = await prisma.$queryRawUnsafe(
      `
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
    `,
      tableNames,
    );
  } catch (err) {
    console.error(`✗ could not query information_schema.columns: ${err.message}`);
    await prisma.$disconnect();
    process.exit(2);
  }
  await prisma.$disconnect();

  // Build {dbTableName: Set<dbColumn>}
  const actual = {};
  for (const r of rows) {
    if (!actual[r.table_name]) actual[r.table_name] = new Set();
    actual[r.table_name].add(r.column_name);
  }

  // Diff — a table entirely absent from the DB is the strongest drift signal.
  const drift = [];
  const missingTables = [];
  for (const [table, { prismaModel, columns }] of Object.entries(expected)) {
    const dbCols = actual[table];
    if (!dbCols) {
      missingTables.push({ table, prismaModel });
      continue;
    }
    const missing = columns.filter((c) => !dbCols.has(c));
    if (missing.length > 0) {
      drift.push({ table, prismaModel, missing });
    }
  }

  if (drift.length === 0 && missingTables.length === 0) {
    console.log(
      `[drift-check] ✓ no schema drift — ${tableNames.length} models, all scalar columns present`,
    );
    process.exit(0);
  }

  console.error(
    `[drift-check] ✗ schema drift detected: ${missingTables.length} missing table(s), ${drift.length} table(s) with missing columns:`,
  );
  for (const { table, prismaModel } of missingTables) {
    console.error(`  ${table} (model ${prismaModel}): TABLE MISSING from DB`);
  }
  for (const { table, prismaModel, missing } of drift) {
    console.error(
      `  ${table} (model ${prismaModel}): ${missing.length} missing — ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ", …" : ""}`,
    );
  }
  console.error("");
  console.error("This means the live DB does not match prisma/schema.prisma. Either");
  console.error("`prisma migrate deploy` reported success but the DDL never applied, or");
  console.error("the migration that adds these columns/tables was never authored. Apply");
  console.error("the missing DDL (Supabase MCP apply_migration / `prisma db execute`) and");
  console.error("baseline the ledger — see .claude/rules/database/supabase-migrations.md.");
  process.exit(1);
}

main().catch((err) => {
  console.error(`[drift-check] unexpected error: ${err.stack || err.message}`);
  process.exit(2);
});
