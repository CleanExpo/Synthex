#!/usr/bin/env tsx
/**
 * CLI for the portfolio brand setup + 4-week draft calendar. The logic lives in
 * lib/marketing-calendar/portfolio-seed.ts; the same thing runs in production
 * through the owner-only /api/admin/portfolio-calendar route.
 *
 * USAGE (needs a DATABASE_URL for the Synthex Supabase project):
 *   npx tsx --env-file=<env> scripts/seed-portfolio-marketing-calendar.ts             # dry run
 *   npx tsx --env-file=<env> scripts/seed-portfolio-marketing-calendar.ts --write
 *   npx tsx --env-file=<env> scripts/seed-portfolio-marketing-calendar.ts --undo <manifest.json> [--write]
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { homedir } from 'node:os';
import { prisma } from '../lib/prisma';
import {
  applyPortfolioSetup,
  undoPortfolioSetup,
  type PortfolioManifest,
} from '../lib/marketing-calendar/portfolio-seed';

const EXPECTED_DB_REF = 'znyjoyjsvjotlzjppzal'; // Synthex Supabase project
const OWNER_EMAIL =
  process.env.PORTFOLIO_OWNER_EMAIL ?? 'contact@unite-group.in';

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const UNDO_PATH = args.includes('--undo')
  ? args[args.indexOf('--undo') + 1]
  : undefined;
// One manifest per run, so a re-run never overwrites the ids an undo needs.
const MANIFEST_PATH = args.includes('--manifest')
  ? args[args.indexOf('--manifest') + 1]
  : `${homedir()}/session-handoffs/synthex-portfolio-calendar-records-${new Date()
      .toISOString()
      .replace(/[:.]/g, '-')}.json`;

/** Supabase project ref of DATABASE_URL; never prints the URL itself. */
function dbRef(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) return 'unset';
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return 'unparseable';
  }
  // Supavisor users look like postgres.<ref>; direct hosts are db.<ref>.supabase.co.
  const user = decodeURIComponent(url.username);
  const fromUser = user.includes('.') ? user.split('.').pop()! : '';
  const fromHost =
    /^db\.([a-z0-9]+)\.supabase\.co$/.exec(url.hostname)?.[1] ?? '';
  return fromUser || fromHost || `unknown (${url.protocol}//${url.hostname})`;
}

function saveManifest(manifest: PortfolioManifest) {
  mkdirSync(dirname(MANIFEST_PATH), { recursive: true });
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`Manifest: ${MANIFEST_PATH}`);
}

async function main() {
  const ref = dbRef();
  console.log(`Database project: ${ref}  mode: ${WRITE ? 'WRITE' : 'dry run'}`);
  if (ref !== EXPECTED_DB_REF) {
    throw new Error(
      `Refusing to run: expected Synthex project ${EXPECTED_DB_REF}, got ${ref}`
    );
  }

  if (UNDO_PATH) {
    const manifest = JSON.parse(
      readFileSync(UNDO_PATH, 'utf8')
    ) as PortfolioManifest;
    for (const line of await undoPortfolioSetup(manifest, WRITE))
      console.log(line);
    return;
  }

  const owner = await prisma.user.findUnique({
    where: { email: OWNER_EMAIL },
    select: { id: true },
  });
  if (!owner) throw new Error(`Owner ${OWNER_EMAIL} not found`);

  try {
    const manifest = await applyPortfolioSetup({
      write: WRITE,
      ownerUserId: owner.id,
    });
    for (const line of manifest.log) console.log(line);
    if (WRITE) saveManifest(manifest);
  } catch (err) {
    // Save what was written before the failure so it can still be undone.
    const partial = (err as { manifest?: PortfolioManifest }).manifest;
    if (WRITE && partial) saveManifest(partial);
    throw err;
  }
}

main()
  .catch(err => {
    console.error('FATAL:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
