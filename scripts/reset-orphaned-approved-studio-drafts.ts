#!/usr/bin/env tsx
/**
 * Hand back Studio drafts that were approved under the OLD semantics.
 *
 * Before the approve → schedule bridge (feat/golden-path-restoreassist, g2),
 * approving a Studio draft flipped its status to `approved` and stopped: no
 * Post was ever created. The bridge's claim matches only `awaiting_approval`,
 * so those rows are unreachable by the new code and would show on the board
 * as approved forever. This script returns them to `awaiting_approval` so a
 * human can approve them again — the second approval is what schedules.
 *
 * The discriminator is exact: every approval that commits under the new code
 * writes `metadata.studioSchedule`; the old route never did. Belt and braces,
 * a row is also required to have no live Post carrying its id. So the reset is
 * a no-op when there is nothing to fix and idempotent when there is: re-running
 * after a partial failure lands on the same state. Who approved each row is
 * preserved under `metadata.legacyApproval` — a bare status reset would destroy
 * the only record that the approval happened.
 *
 * Decision (spec.md, Decisions): re-open, not retire — these were approved by
 * a human and should publish once re-approved.
 *
 * ORDER MATTERS: run this AFTER the bridge is deployed, never before. A reset
 * under the old code would hand the rows to the old approve route, which flips
 * them straight back to `approved` and schedules nothing.
 *
 * Defaults to dry-run (prints the count and the ids). Use --write to apply.
 */

import { prisma } from '../lib/prisma';

const WRITE = process.argv.includes('--write');

type Orphan = {
  id: string;
  organization_id: string;
  approved_by: string | null;
  approved_at: Date | null;
};

async function main() {
  const orphans = await prisma.$queryRaw<Orphan[]>`
    SELECT d.id, d.organization_id, d.approved_by, d.approved_at
    FROM studio_content_drafts d
    WHERE d.status = 'approved'
      AND d.metadata -> 'studioSchedule' IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM posts p
        WHERE p.metadata->>'studioDraftId' = d.id
          AND p.deleted_at IS NULL
      )
    ORDER BY d.approved_at ASC NULLS FIRST`;

  console.log(
    `${orphans.length} draft(s) are 'approved' under the old route with no schedule record and no live Post (${WRITE ? 'WRITE' : 'dry-run'})`
  );
  for (const row of orphans) {
    console.log(
      `  ${row.id}  org=${row.organization_id}  approved_by=${row.approved_by ?? 'null'}  approved_at=${row.approved_at?.toISOString() ?? 'null'}`
    );
  }
  if (orphans.length === 0 || !WRITE) {
    if (!WRITE && orphans.length > 0) {
      console.log('Re-run with --write to return them to awaiting_approval.');
    }
    return;
  }

  const reset = await prisma.$executeRaw`
    UPDATE studio_content_drafts d
       SET metadata = COALESCE(d.metadata, '{}'::jsonb) || jsonb_build_object(
             'legacyApproval', jsonb_build_object('approvedBy', d.approved_by, 'approvedAt', d.approved_at)
           ),
           status = 'awaiting_approval', approved_by = NULL, approved_at = NULL, updated_at = now()
     WHERE d.status = 'approved'
       AND d.metadata -> 'studioSchedule' IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM posts p
         WHERE p.metadata->>'studioDraftId' = d.id
           AND p.deleted_at IS NULL
       )`;
  console.log(
    `${reset} draft(s) returned to awaiting_approval (approver preserved under metadata.legacyApproval).`
  );
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
