/**
 * Seed an ISOLATED local database with one complete learning-loop setup.
 *
 *   DATABASE_URL=postgresql://…@127.0.0.1:…/synthex_dev npx tsx scripts/learning-loop/seed-dev.ts
 *
 * Refuses to run unless DATABASE_URL points at localhost. Everything it writes
 * is labelled SYNTHETIC SEED: two organisations (to prove tenant isolation), an
 * owner, a collaborator, the published card page, an IntentScape workspace,
 * hypothesis and approved goal contract, and the experiment authorisation that
 * binds the card to them. The goal contract here stands in for the one the
 * approve-goal route creates after a human promotes a hypothesis; in
 * production that human step is never skipped.
 */
import prisma from '@/lib/prisma';
import { seedLearningLoop } from './seed';

const url = process.env.DATABASE_URL ?? '';
if (!/@(127\.0\.0\.1|localhost)(:\d+)?\//.test(url)) {
  console.error(
    'seed-dev: refusing to run; DATABASE_URL is not a localhost database.'
  );
  process.exit(2);
}

seedLearningLoop()
  .catch(e => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
