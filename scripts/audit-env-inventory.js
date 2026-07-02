#!/usr/bin/env node

/**
 * Masked Synthex environment inventory.
 *
 * Compares names referenced in source code against Vercel environment metadata.
 * This script never requests or prints secret values.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseVercelJson } from './verify-vercel-production-env.js';

const DEFAULT_SCAN_ROOTS = [
  'app',
  'components',
  'hooks',
  'lib',
  'prisma',
  'packages',
];
const DEFAULT_TARGETS = ['production', 'preview', 'development'];
const SKIP_DIRS = new Set([
  '.git',
  '.next',
  '.vercel',
  'coverage',
  'dist',
  'node_modules',
  'test-results',
]);
const SCAN_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.prisma',
]);

const CANONICAL_KEEP = new Set([
  'DATABASE_URL',
  'DIRECT_URL',
  'JWT_SECRET',
  'NEXTAUTH_SECRET',
  'OAUTH_STATE_SECRET',
  'FIELD_ENCRYPTION_KEY',
  'OWNER_EMAILS',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'REDIS_URL',
  'CRON_SECRET',
  'OPENROUTER_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'APIFY_API_TOKEN',
  'HEYGEN_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_APP_URL',
  'NEXTAUTH_URL',
  'SENTRY_DSN',
  'NEXT_PUBLIC_SENTRY_DSN',
]);

const ALIAS_MIGRATIONS = new Map([
  ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'],
  ['SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
  ['STRIPE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'],
  ['STRIPE_API_KEY', 'STRIPE_SECRET_KEY'],
  ['SESSION_SECRET', 'NEXTAUTH_SECRET'],
  ['ENCRYPTION_KEY', 'FIELD_ENCRYPTION_KEY'],
  ['ENCRYPTION_KEY_V1', 'FIELD_ENCRYPTION_KEY'],
  ['API_URL', 'NEXT_PUBLIC_APP_URL'],
  ['APP_URL', 'NEXT_PUBLIC_APP_URL'],
  ['CORS_ORIGIN', 'CORS_ALLOWED_ORIGINS'],
]);

const QUARANTINE_PATTERNS = [
  /^ENABLE_/,
  /^TRACK_/,
  /^CACHE_/,
  /^RATE_LIMIT_(ENABLED|MAX_REQUESTS|WINDOW_MS)$/,
  /^NEXT_PUBLIC_BYPASS_TOKEN$/,
  /^CORS_ORIGIN$/,
];

function parseArgs(argv) {
  const args = {
    scope: 'unite-group',
    target: 'production',
    jsonFile: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--scope') args.scope = argv[++i];
    else if (arg === '--target') args.target = argv[++i];
    else if (arg === '--json-file') args.jsonFile = argv[++i];
    else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printUsage() {
  console.log(`Usage: node scripts/audit-env-inventory.js [options]

Options:
  --scope <team>       Vercel team scope (default: unite-group)
  --target <target>    Vercel target to assess for missing runtime keys (default: production)
  --json-file <path>   Read saved vercel env JSON instead of invoking CLI
`);
}

function loadVercelMetadata(args) {
  if (args.jsonFile) {
    return readFileSync(args.jsonFile, 'utf8');
  }

  return execFileSync(
    'vercel',
    [
      'env',
      'ls',
      '--scope',
      args.scope,
      '--non-interactive',
      '--format',
      'json',
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
}

function normalizeTargets(env) {
  if (Array.isArray(env.target)) return env.target;
  if (typeof env.target === 'string') return [env.target];
  if (Array.isArray(env.targets)) return env.targets;
  if (typeof env.environment === 'string') return [env.environment];
  return [];
}

function walkFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];
  const entries = readdirSync(root);

  for (const entry of entries) {
    const path = join(root, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) files.push(...walkFiles(path));
      continue;
    }

    const ext = path.slice(path.lastIndexOf('.'));
    if (SCAN_EXTENSIONS.has(ext)) files.push(path);
  }

  return files;
}

function scanEnvUsage(cwd = process.cwd()) {
  const names = new Map();
  const bracketPattern = /process\.env\[['"]([A-Z0-9_]+)['"]\]/g;
  const dotPattern = /process\.env\.([A-Z0-9_]+)/g;

  for (const root of DEFAULT_SCAN_ROOTS) {
    for (const file of walkFiles(join(cwd, root))) {
      const content = readFileSync(file, 'utf8');
      for (const pattern of [bracketPattern, dotPattern]) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const key = match[1];
          if (!names.has(key)) names.set(key, new Set());
          names.get(key).add(relative(cwd, file));
        }
      }
    }
  }

  return names;
}

function collectVercelKeys(raw) {
  const parsed = parseVercelJson(raw);
  const envs = Array.isArray(parsed.envs) ? parsed.envs : [];
  const byKey = new Map();

  for (const env of envs) {
    if (!byKey.has(env.key)) byKey.set(env.key, new Set());
    for (const target of normalizeTargets(env)) {
      byKey.get(env.key).add(target);
    }
  }

  return byKey;
}

function classify({ usedKeys, vercelKeys, target }) {
  const used = new Set(usedKeys.keys());
  const configuredForTarget = new Set(
    [...vercelKeys.entries()]
      .filter(([, targets]) => targets.has(target))
      .map(([key]) => key)
  );

  const keep = [...configuredForTarget]
    .filter(key => CANONICAL_KEEP.has(key) || used.has(key))
    .sort();

  const migrateAliases = [...configuredForTarget]
    .filter(key => ALIAS_MIGRATIONS.has(key))
    .map(key => ({
      key,
      canonical: ALIAS_MIGRATIONS.get(key),
      used: used.has(key),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const quarantine = [...configuredForTarget]
    .filter(key => QUARANTINE_PATTERNS.some(pattern => pattern.test(key)))
    .filter(key => !CANONICAL_KEEP.has(key))
    .map(key => ({
      key,
      used: used.has(key),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const missingFromTarget = [...used]
    .filter(key => !configuredForTarget.has(key))
    .filter(key => !key.startsWith('NEXT_PUBLIC_VERCEL_'))
    .filter(key => !key.startsWith('__NEXT_'))
    .sort();

  return { keep, migrateAliases, quarantine, missingFromTarget };
}

function printList(title, items, formatter = item => item) {
  console.log(`${title}: ${items.length}`);
  for (const item of items) {
    console.log(`- ${formatter(item)}`);
  }
  console.log('');
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const raw = loadVercelMetadata(args);
  const vercelKeys = collectVercelKeys(raw);
  const usedKeys = scanEnvUsage();
  const classified = classify({ usedKeys, vercelKeys, target: args.target });

  console.log(
    `Synthex masked env inventory: target=${args.target}, scope=${args.scope}`
  );
  console.log(`Vercel unique env names: ${vercelKeys.size}`);
  console.log(`Runtime process.env names scanned: ${usedKeys.size}`);
  for (const target of DEFAULT_TARGETS) {
    const count = [...vercelKeys.values()].filter(targets =>
      targets.has(target)
    ).length;
    console.log(`Configured for ${target}: ${count}`);
  }
  console.log('');

  printList('KEEP configured runtime/canonical names', classified.keep);
  printList(
    'MIGRATE alias candidates',
    classified.migrateAliases,
    item =>
      `${item.key} -> ${item.canonical}${item.used ? ' (still referenced)' : ' (not referenced in runtime scan)'}`
  );
  printList(
    'QUARANTINE removal candidates',
    classified.quarantine,
    item =>
      `${item.key}${item.used ? ' (still referenced; migrate before removal)' : ' (not referenced in runtime scan)'}`
  );
  printList(
    'MISSING from selected target but referenced in runtime scan',
    classified.missingFromTarget
  );

  console.log('Secret values were not requested or printed.');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
