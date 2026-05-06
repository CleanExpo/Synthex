/**
 * HERMES — org resolution helpers (SYN-911 / HER-1c · production fix)
 *
 * The HERMES cron writes posts via the existing /api/scheduler/posts contract,
 * which requires a real userId. HERMES has no user of its own — instead it
 * impersonates the org's canonical "owner".
 *
 * ─── Why business_ownerships, not roles ───────────────────────────────────
 * The original HER-1c implementation looked for `Role.name = 'Owner'`. That
 * was wrong: production rolesets across all seven orgs are
 * `Admin / Editor / Viewer` — there is no Owner role anywhere, so the lookup
 * always returned null and the cron skipped every org.
 *
 * The RLS policies on `hermes_*` tables (and on `content_calendars`,
 * `publish_queue`, `vault_secrets`) all reference
 * `business_ownerships(owner_id, organization_id, is_active)` — that table
 * IS the canonical "who owns this org" source in this codebase. Using it for
 * impersonation means HERMES is consistent with the RLS surface: the
 * impersonated author is exactly the user whose access the data lives behind.
 *
 * Returns null when no active ownership row exists. The caller must escalate
 * via Linear and skip the org — never throw, never fall back silently.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Find the canonical impersonation user for an organization.
 *
 * Strategy: oldest active row in `business_ownerships`. Deterministic across
 * runs so the same user is impersonated every cron tick. If multiple owners
 * exist (multi-business owners flow per SYN-847), the founder/oldest grant
 * wins — matches the autopilot semantic of "the original org owner".
 *
 * @param orgId Organization.id (cuid).
 * @returns userId of the active business owner, or null if none.
 */
export async function resolveImpersonatedAuthor(
  orgId: string
): Promise<string | null> {
  const ownership = await prisma.businessOwnership.findFirst({
    where: {
      organizationId: orgId,
      isActive: true,
    },
    // Secondary sort on `id` is the tie-breaker — `createdAt` alone is not
    // deterministic when two ownership rows share the same timestamp (common
    // after bulk seeds or rows created in the same transaction). Without the
    // tie-breaker the impersonated user could flip between cron ticks.
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { ownerId: true },
  });

  if (!ownership) {
    logger.warn('[hermes:orgs] No active business_ownerships row for org', {
      orgId,
    });
    return null;
  }

  return ownership.ownerId;
}
