/**
 * Legacy claim re-score (SYN-MCP-006 wiring) — batch-enqueue verify-claim.
 *
 * Targets ONLY grandfathered rows: claims whose SYN-MCP-001 backfill stamped
 * `metadata.migratedLegacyVerified = true` (legacy 'verified' rows that were
 * never re-derived). Each enqueued `evidence:verify-claim` job re-scores the
 * claim through the bundle-based policy — evidenceStatus is derived by the
 * evaluator chain, NEVER written by this script.
 *
 * DRY-RUN BY DEFAULT: without `--execute` the script only LISTS candidates.
 *
 *   npx tsx scripts/rescore-legacy-claims.ts             # dry-run (list only)
 *   npx tsx scripts/rescore-legacy-claims.ts --execute   # enqueue jobs
 *
 * NEVER AUTO-RUN: this script is deliberately not wired to any cron, CI
 * workflow, or app entry point — a human runs it, deliberately.
 *
 * Org/user provenance for the job data comes from each claim row itself
 * (a trusted DB read): organizationId = the claim's org, userId = the
 * claim's creator (createdById provenance for any SourceRefs the job makes).
 */

import type { PrismaClient } from '@prisma/client';
import type { VerifyClaimJobData } from '../lib/evidence/verify-claim-job';

export interface RescoreCandidate {
  claimId: string;
  organizationId: string;
  createdById: string;
  evidenceStatus: string;
  statement: string;
}

export interface RescoreOutcome {
  dryRun: boolean;
  candidates: RescoreCandidate[];
  enqueued: number;
}

type EnqueueFn = (data: VerifyClaimJobData) => Promise<{ id: string }>;

/**
 * Core routine — exported for unit testing (db + enqueue are injected;
 * the dry-run default is enforced by the CLI wrapper below).
 */
export async function rescoreLegacyClaims(
  db: Pick<PrismaClient, 'marketingAgencyClaim'>,
  options: { execute: boolean },
  enqueueFn: EnqueueFn
): Promise<RescoreOutcome> {
  const claims = await db.marketingAgencyClaim.findMany({
    where: {
      metadata: { path: ['migratedLegacyVerified'], equals: true },
    },
    select: {
      id: true,
      organizationId: true,
      createdById: true,
      evidenceStatus: true,
      statement: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const candidates: RescoreCandidate[] = claims.map(claim => ({
    claimId: claim.id,
    organizationId: claim.organizationId,
    createdById: claim.createdById,
    evidenceStatus: claim.evidenceStatus,
    statement: claim.statement,
  }));

  if (!options.execute) {
    return { dryRun: true, candidates, enqueued: 0 };
  }

  let enqueued = 0;
  for (const claim of candidates) {
    await enqueueFn({
      claimId: claim.claimId,
      organizationId: claim.organizationId,
      userId: claim.createdById,
    });
    enqueued++;
  }
  return { dryRun: false, candidates, enqueued };
}

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute');

  // Lazy imports keep the unit test of rescoreLegacyClaims dependency-free.
  const { default: prisma } = await import('../lib/prisma');
  const { queueVerifyClaim, registerVerifyClaimHandler } =
    await import('../lib/evidence/verify-claim-job');

  if (execute) registerVerifyClaimHandler();

  const outcome = await rescoreLegacyClaims(prisma, { execute }, data =>
    queueVerifyClaim(data)
  );

  console.log(
    `Found ${outcome.candidates.length} grandfathered claim(s) ` +
      `(metadata.migratedLegacyVerified=true):`
  );
  for (const c of outcome.candidates) {
    console.log(
      `  ${c.claimId}  org=${c.organizationId}  status=${c.evidenceStatus}  ` +
        `"${c.statement.slice(0, 60)}${c.statement.length > 60 ? '…' : ''}"`
    );
  }

  if (outcome.dryRun) {
    console.log(
      '\nDRY RUN — no jobs enqueued. Re-run with --execute to enqueue ' +
        'verify-claim jobs for the claims listed above.'
    );
  } else {
    console.log(`\nEnqueued ${outcome.enqueued} verify-claim job(s).`);
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('rescore-legacy-claims failed:', err);
      process.exit(1);
    });
}
