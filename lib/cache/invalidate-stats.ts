/**
 * invalidate-stats — lib/cache/invalidate-stats.ts
 *
 * Fire-and-forget cache invalidation for the dashboard-stats lane.
 *
 * THE BUG THIS CLOSES (#386 dead-subsystem pattern):
 * The dashboard-stats routes (`app/api/dashboard/stats/route.ts` and
 * `app/api/analytics/dashboard-stats/route.ts`) cache their payload tagged
 * `user:${userId}` with a 60s / 300s TTL. The post-write paths (publish, bulk
 * ops, schedule create) never invalidated that tag, so after a write the stale
 * (or, on a freshly-wired data source, stub/zero) stats persisted until the TTL
 * expired. `lib/cache/invalidation-strategy.ts` existed to do exactly this but
 * had ZERO callers across `app/` and `lib/`.
 *
 * THE FIX:
 * After a successful post create / update / publish / schedule, the write path
 * calls `invalidatePostStats(userId, orgId)`. This clears the SHARED tags the
 * stats lane sets so the next read re-computes from the database.
 *
 * TAG CONVENTION (must match the stats lane — see those routes' `cache.set`):
 * - `user:${userId}` — the tag both stats routes set. This is the load-bearing
 *   one for dashboard-stats refresh.
 * - `org:${orgId ?? 'self'}` — the shared org tag (set by the organizations
 *   route and used by org-scoped caches); cleared too so org-scoped stats lanes
 *   refresh on the same write.
 *
 * SAFETY (fire-and-forget — directive: NEVER throw, NEVER block the write):
 * Every call is wrapped in try/catch and any rejected invalidation promise is
 * swallowed (logged at debug). Callers do NOT need to `await` it — passing a
 * post-write invalidation through here can never break or roll back the write
 * that already succeeded. This holds whether or not Redis is provisioned: with
 * no `REDIS_URL`, the underlying tag scan simply returns 0 and the L1 in-memory
 * layer still benefits.
 *
 * This module is the single caller that makes `InvalidationStrategy` (and thus
 * `getCache().invalidateByTag`) actually used.
 *
 * @task SYN — wire dead cache-invalidation subsystem into post-write paths
 */

import { InvalidationStrategy } from './invalidation-strategy';
import { logger } from '../logger';

/**
 * Invalidate the dashboard-stats caches for the affected user (and org).
 *
 * Fire-and-forget: returns a promise the caller MAY await, but never has to.
 * It never rejects — all errors are caught internally — so a write path can
 * safely call `void invalidatePostStats(userId, orgId)` in its success path
 * without risking the write.
 *
 * @param userId    The owning user whose stats caches must refresh. Required —
 *                  a falsy value is a no-op (nothing to invalidate safely).
 * @param orgId     The effective organisation id, if known. Falls back to the
 *                  shared `'self'` sentinel used by org-scoped caches.
 */
export async function invalidatePostStats(
  userId: string | null | undefined,
  orgId?: string | null
): Promise<void> {
  if (!userId) return;

  try {
    // Clear the tag the stats routes actually set (`user:${userId}`) plus the
    // shared org tag. invalidateByTag delegates to getCache().invalidateByTag,
    // which is a no-op (returns 0) when Redis is unavailable — safe either way.
    await Promise.all([
      InvalidationStrategy.invalidateByTag(`user:${userId}`),
      InvalidationStrategy.invalidateByTag(`org:${orgId ?? 'self'}`),
    ]);
  } catch (error) {
    // Fire-and-forget: a failed invalidation must NEVER surface to the write
    // path. Worst case the stats stay stale until their (short) TTL expires.
    logger.debug('[invalidate-stats] post-write invalidation failed (non-fatal)', {
      userId,
      orgId: orgId ?? 'self',
      error,
    });
  }
}

export default invalidatePostStats;
