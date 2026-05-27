#!/usr/bin/env node

/**
 * Read-only migration-history reconciliation for databases that already have
 * public tables but no Prisma migration ledger.
 */

import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: '.env.local', quiet: true });

let Pool;
try {
  Pool = require('pg').Pool;
} catch {
  Pool = null;
}

const args = process.argv.slice(2);

function getArg(name, fallback = null) {
  const prefix = `${name}=`;
  const match = args.find(arg => arg === name || arg.startsWith(prefix));
  if (!match) return fallback;
  if (match === name) {
    const index = args.indexOf(match);
    return args[index + 1] && !args[index + 1].startsWith('--')
      ? args[index + 1]
      : true;
  }
  return match.slice(prefix.length);
}

const JSON_FILE = getArg('--json-file');
const SCHEMA_FILE = getArg(
  '--schema-file',
  path.join(process.cwd(), 'prisma', 'schema.prisma')
);
const MIGRATIONS_DIR = getArg(
  '--migrations-dir',
  path.join(process.cwd(), 'prisma', 'migrations')
);
const STRICT = args.includes('--strict');
const FORMAT_JSON = args.includes('--json');

function normalizeTableName(raw) {
  return raw
    .replace(/^ONLY\s+/i, '')
    .replace(/"/g, '')
    .replace(/^public\./, '')
    .trim();
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

function parsePrismaMappedTables(schemaText) {
  const tables = [];
  const modelBlocks = schemaText.matchAll(
    /model\s+(\w+)\s+\{([\s\S]*?)^\s*\}/gm
  );

  for (const match of modelBlocks) {
    const modelName = match[1];
    const body = match[2];
    const mapMatch = body.match(/@@map\("([^"]+)"\)/);
    tables.push(mapMatch ? mapMatch[1] : modelName);
  }

  return uniqueSorted(tables);
}

function parseMigrationCreateTables(sql) {
  const tables = [];
  const executableSql = sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*--.*$/gm, '');
  const createTablePattern =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:"public"\.)?"[^"]+"|public\.[a-zA-Z0-9_]+|[a-zA-Z0-9_]+)/gi;

  for (const match of executableSql.matchAll(createTablePattern)) {
    tables.push(normalizeTableName(match[1]));
  }

  return tables;
}

async function readLocalMigrations(migrationsDir) {
  if (!fs.existsSync(migrationsDir)) {
    return { migrationDirs: [], createTables: [] };
  }

  const entries = await fsp.readdir(migrationsDir, { withFileTypes: true });
  const migrationDirs = entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(name => /^\d+_/.test(name))
    .sort();

  const createTables = [];
  for (const dir of migrationDirs) {
    const sqlPath = path.join(migrationsDir, dir, 'migration.sql');
    if (!fs.existsSync(sqlPath)) continue;
    const sql = await fsp.readFile(sqlPath, 'utf8');
    createTables.push(...parseMigrationCreateTables(sql));
  }

  return { migrationDirs, createTables: uniqueSorted(createTables) };
}

async function readDatabaseSnapshotFromFixture(fixturePath) {
  const fixture = JSON.parse(await fsp.readFile(fixturePath, 'utf8'));
  return {
    publicTables: uniqueSorted(fixture.publicTables || []),
    prismaMigrationRows: fixture.prismaMigrationRows || [],
    customMigrationRows: fixture.customMigrationRows || [],
    databaseLabel: fixture.databaseLabel || 'fixture',
  };
}

async function readDatabaseSnapshotFromPostgres() {
  if (!Pool) {
    throw new Error('pg module is not available');
  }

  const databaseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL or DIRECT_URL is required');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const tables = await pool.query(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name`
    );

    const prismaRows = await pool.query(
      `SELECT to_regclass('public._prisma_migrations') AS regclass`
    );
    const customRows = await pool.query(
      `SELECT to_regclass('public.schema_migrations') AS regclass`
    );

    let prismaMigrationRows = [];
    if (prismaRows.rows[0]?.regclass) {
      const result = await pool.query(
        `SELECT migration_name, finished_at, applied_steps_count
           FROM public._prisma_migrations
          ORDER BY migration_name`
      );
      prismaMigrationRows = result.rows;
    }

    let customMigrationRows = [];
    if (customRows.rows[0]?.regclass) {
      const result = await pool.query(
        `SELECT filename, executed_at, checksum
           FROM public.schema_migrations
          ORDER BY filename`
      );
      customMigrationRows = result.rows;
    }

    const databaseName = await pool.query('SELECT current_database() AS name');

    return {
      publicTables: uniqueSorted(tables.rows.map(row => row.table_name)),
      prismaMigrationRows,
      customMigrationRows,
      databaseLabel: databaseName.rows[0]?.name || 'postgres',
    };
  } finally {
    await pool.end();
  }
}

function buildReport({ db, prismaTables, migrationCreateTables, migrationDirs }) {
  const publicTables = new Set(db.publicTables);
  const prismaMigrationNames = new Set(
    db.prismaMigrationRows.map(row => row.migration_name)
  );

  const migrationTablesPresent = migrationCreateTables.filter(table =>
    publicTables.has(table)
  );
  const migrationTablesMissing = migrationCreateTables.filter(
    table => !publicTables.has(table)
  );
  const prismaTablesPresent = prismaTables.filter(table => publicTables.has(table));
  const prismaTablesMissing = prismaTables.filter(table => !publicTables.has(table));
  const publicTablesNotInPrisma = db.publicTables.filter(
    table => !prismaTables.includes(table)
  );
  const localMigrationsNotRecorded = migrationDirs.filter(
    dir => !prismaMigrationNames.has(dir)
  );

  const hasPublicTables = db.publicTables.length > 0;
  const hasPrismaLedger = db.prismaMigrationRows.length > 0;
  const status =
    hasPublicTables && !hasPrismaLedger
      ? 'blocked_missing_prisma_migration_ledger'
      : migrationTablesMissing.length > 0
        ? 'blocked_schema_mismatch'
        : localMigrationsNotRecorded.length > 0
          ? 'needs_baseline_review'
          : 'ready';

  return {
    status,
    databaseLabel: db.databaseLabel,
    counts: {
      publicTables: db.publicTables.length,
      prismaSchemaTables: prismaTables.length,
      localMigrationDirs: migrationDirs.length,
      localMigrationCreateTables: migrationCreateTables.length,
      prismaMigrationRows: db.prismaMigrationRows.length,
      customMigrationRows: db.customMigrationRows.length,
      migrationTablesPresent: migrationTablesPresent.length,
      migrationTablesMissing: migrationTablesMissing.length,
      prismaTablesPresent: prismaTablesPresent.length,
      prismaTablesMissing: prismaTablesMissing.length,
      publicTablesNotInPrisma: publicTablesNotInPrisma.length,
      localMigrationsNotRecorded: localMigrationsNotRecorded.length,
    },
    samples: {
      migrationTablesMissing: migrationTablesMissing.slice(0, 25),
      prismaTablesMissing: prismaTablesMissing.slice(0, 25),
      publicTablesNotInPrisma: publicTablesNotInPrisma.slice(0, 25),
      localMigrationsNotRecorded: localMigrationsNotRecorded.slice(0, 25),
    },
  };
}

function printTextReport(report) {
  console.log('\nSynthex migration-history reconciliation (read-only)');
  console.log('='.repeat(58));
  console.log(`Database: ${report.databaseLabel}`);
  console.log(`Status: ${report.status}`);
  console.log('');
  console.log(`Public base tables: ${report.counts.publicTables}`);
  console.log(`Prisma schema mapped tables: ${report.counts.prismaSchemaTables}`);
  console.log(`Local Prisma migration folders: ${report.counts.localMigrationDirs}`);
  console.log(
    `Local CREATE TABLE targets: ${report.counts.localMigrationCreateTables}`
  );
  console.log(`Prisma ledger rows: ${report.counts.prismaMigrationRows}`);
  console.log(`Custom ledger rows: ${report.counts.customMigrationRows}`);
  console.log('');
  console.log(
    `Migration-created tables present/missing: ${report.counts.migrationTablesPresent}/${report.counts.migrationTablesMissing}`
  );
  console.log(
    `Prisma schema tables present/missing: ${report.counts.prismaTablesPresent}/${report.counts.prismaTablesMissing}`
  );
  console.log(
    `Public tables outside Prisma schema: ${report.counts.publicTablesNotInPrisma}`
  );
  console.log(
    `Local migrations not recorded in Prisma ledger: ${report.counts.localMigrationsNotRecorded}`
  );

  for (const [label, values] of Object.entries(report.samples)) {
    if (values.length === 0) continue;
    console.log(`\n${label}:`);
    for (const value of values) console.log(`  - ${value}`);
  }

  console.log('\nDecision:');
  if (report.status === 'blocked_missing_prisma_migration_ledger') {
    console.log(
      '  BLOCKED - do not run prisma migrate deploy against this database until a reviewed baseline is created.'
    );
  } else if (report.status === 'blocked_schema_mismatch') {
    console.log(
      '  BLOCKED - local migration CREATE TABLE targets are absent from the database.'
    );
  } else if (report.status === 'needs_baseline_review') {
    console.log(
      '  REVIEW - schema appears populated, but migration ledger rows do not match local migrations.'
    );
  } else {
    console.log('  READY - migration history and local migration folders align.');
  }
  console.log('Secret values were not requested or printed.');
}

async function main() {
  const schemaText = await fsp.readFile(SCHEMA_FILE, 'utf8');
  const prismaTables = parsePrismaMappedTables(schemaText);
  const { migrationDirs, createTables } =
    await readLocalMigrations(MIGRATIONS_DIR);
  const db = JSON_FILE
    ? await readDatabaseSnapshotFromFixture(JSON_FILE)
    : await readDatabaseSnapshotFromPostgres();

  const report = buildReport({
    db,
    prismaTables,
    migrationCreateTables: createTables,
    migrationDirs,
  });

  if (FORMAT_JSON) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTextReport(report);
  }

  if (STRICT && report.status !== 'ready') {
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`Migration history reconciliation failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export {
  buildReport,
  normalizeTableName,
  parseMigrationCreateTables,
  parsePrismaMappedTables,
};
