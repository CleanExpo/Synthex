#!/usr/bin/env node
/**
 * scripts/fleet/provision.mjs [--dry-run] [--dir <worktree>]
 * Prepares a worktree before a Builder starts: refuses any DATABASE_URL that is not local,
 * runs npm ci, prisma generate, and builds file-linked @unite-group packages when present.
 * --dry-run checks preconditions and prints the plan without running installs.
 */
import { run, ROOT, report } from './lib.mjs';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
const a = process.argv.slice(2);
const dry = a.includes('--dry-run');
const di = a.indexOf('--dir');
const dir = di >= 0 ? path.resolve(a[di + 1]) : ROOT;
const items = [];
const add = (id, text, state, detail) =>
  items.push({ id, text, state, detail });
const dbu = process.env.DATABASE_URL || '';
let host = '';
try {
  host = dbu ? new URL(dbu.replace(/^postgres(ql)?:/, 'http:')).hostname : '';
} catch {
  host = 'unparseable';
}
if (dbu && host !== 'localhost' && host !== '127.0.0.1') {
  console.log(
    `FAIL provision: DATABASE_URL names ${host}; only localhost or 127.0.0.1 are allowed`
  );
  process.exit(1);
}
add('db', 'DATABASE_URL is unset or local', 'PASS', dbu ? host : 'unset');
add(
  'tree',
  'worktree has package.json and package-lock.json',
  existsSync(path.join(dir, 'package.json')) &&
    existsSync(path.join(dir, 'package-lock.json'))
    ? 'PASS'
    : 'FAIL',
  dir
);
add(
  'env',
  'no .env* file in the worktree',
  existsSync(path.join(dir, '.env')) || existsSync(path.join(dir, '.env.local'))
    ? 'FAIL'
    : 'PASS'
);
const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
const linked = Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })
  .filter(
    ([k, v]) => k.startsWith('@unite-group/') && String(v).startsWith('file:')
  )
  .map(([k, v]) => v.replace(/^file:/, ''));
add(
  'linked',
  `${linked.length} file-linked @unite-group package(s) to build`,
  'PASS',
  linked.join(',') || 'none'
);
if (dry) {
  console.log(
    'plan: npm ci --legacy-peer-deps; npx prisma generate' +
      (linked.length ? `; build ${linked.join(', ')}` : '')
  );
  process.exit(report('provision --dry-run', items));
}
const npm = path.join(path.dirname(process.execPath), 'npm');
const npx = path.join(path.dirname(process.execPath), 'npx');
const ci = run(npm, ['ci', '--legacy-peer-deps', '--no-audit', '--no-fund'], {
  cwd: dir,
  timeout: 1200000,
});
add(
  'npm-ci',
  'npm ci',
  ci.code === 0 ? 'PASS' : 'FAIL',
  ci.stderr.trim().split('\n').slice(-1)[0]
);
const pg = run(npx, ['prisma', 'generate'], { cwd: dir, timeout: 600000 });
add(
  'prisma',
  'prisma generate',
  pg.code === 0 ? 'PASS' : 'FAIL',
  pg.stderr.trim().split('\n').slice(-1)[0]
);
for (const l of linked) {
  const b = run(npm, ['run', 'build', '--if-present'], {
    cwd: path.join(dir, l),
    timeout: 600000,
  });
  add(`build:${l}`, `build ${l}`, b.code === 0 ? 'PASS' : 'FAIL');
}
process.exit(report('provision', items));
