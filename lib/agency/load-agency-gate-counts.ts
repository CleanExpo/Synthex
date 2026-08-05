/**
 * Load WorkflowExecution status counts for the agency-loop Gate block
 * used by Tier-1 snapshots (manual POST and Monday cron).
 */

import prisma from '@/lib/prisma';
import type { AgencyGateCounts } from '@/lib/agency/tier1-snapshot';

export async function loadAgencyGateCounts(
  organizationId: string
): Promise<AgencyGateCounts> {
  const byStatus = await prisma.workflowExecution.groupBy({
    by: ['status'],
    where: { organizationId },
    _count: { _all: true },
  });

  const countFor = (status: string) =>
    byStatus.find(row => row.status === status)?._count._all ?? 0;

  return {
    completed: countFor('completed'),
    revisionRequested: countFor('revision_requested'),
    awaitingApproval: countFor('waiting_approval'),
    failed: countFor('failed'),
    cancelled: countFor('cancelled'),
  };
}
