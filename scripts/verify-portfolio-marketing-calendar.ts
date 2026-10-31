#!/usr/bin/env tsx
/**
 * Read-only check of the portfolio marketing calendar. Exit code 0 only when
 * every check holds. Production can also be checked without credentials at
 * GET https://synthex.social/api/health/portfolio-calendar.
 *
 *   npx tsx --env-file=<env> scripts/verify-portfolio-marketing-calendar.ts
 */

import { prisma } from '../lib/prisma';
import { verifyPortfolioSetup } from '../lib/marketing-calendar/portfolio-seed';

async function main() {
  const { ok, checks } = await verifyPortfolioSetup();
  for (const c of checks)
    console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.label}`);
  console.log(
    ok
      ? '\nAll checks passed'
      : `\n${checks.filter(c => !c.pass).length} check(s) failed`
  );
  if (!ok) process.exitCode = 1;
}

main()
  .catch(err => {
    console.error('FATAL:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
