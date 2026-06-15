/**
 * connection-warnings — non-blocking "no connected account" warnings for the
 * scheduler.
 *
 * BACKGROUND (SYN-SCHED-CONNECTION-WARN):
 * `POST /api/scheduler/posts` (and the bulk reschedule path) happily accept a
 * post for ANY platform string. If the active org has no active
 * `platformConnection` for that platform, the post is still created (201) and
 * only fails ASYNCHRONOUSLY at cron publish time
 * (`/api/cron/publish-scheduled` → `lib/publish/safetyChecks.ts` gate 5), via
 * an in-app notification. The user thinks the post is queued; it silently never
 * publishes until they connect an account.
 *
 * DESIGN: WARN, do not hard-block. Autopilot / HERMES legitimately schedule
 * BEFORE connecting an account, so a 4xx would break those flows. Instead we
 * STILL create the post (201) and attach a structured, non-blocking warning the
 * UI can surface ("scheduled, but no <platform> account is connected — connect
 * one before it publishes").
 *
 * The active-connection lookup mirrors the EXACT query shape used at publish
 * time (`lib/publish/safetyChecks.ts` gate 5, `lib/publish/publishQueue.ts`) and
 * by the connections route (`app/api/auth/connections/route.ts`): scope by the
 * effective organizationId when present, else fall back to the personal
 * (userId + organizationId:null) connection, and only count rows that are
 * `isActive: true` and not soft-deleted. Matching that shape means this warning
 * agrees with what the cron will actually find.
 *
 * @module lib/social/connection-warnings
 */

import prisma from '@/lib/prisma';

/** Structured warning code for a missing active platform connection. */
export const NO_ACTIVE_CONNECTION = 'no_active_connection';

/**
 * A non-blocking warning attached to an otherwise-successful (201) schedule
 * response so the UI can surface it without the request having failed.
 */
export interface ScheduleWarning {
  code: typeof NO_ACTIVE_CONNECTION;
  platform: string;
  message: string;
}

/**
 * True when the (org-or-user, platform) pair has at least one active,
 * non-deleted platform connection — i.e. the cron WILL have an account to
 * publish through.
 *
 * Mirrors the publish-time gate exactly:
 *   - org context  → { organizationId, platform, isActive: true, deletedAt: null }
 *   - no org (legacy/personal) → { userId, platform, organizationId: null,
 *     isActive: true, deletedAt: null }
 *
 * Falling back to userId for the no-org case (rather than querying
 * organizationId:null alone) avoids matching another user's personal rows —
 * the same caveat the connections route documents.
 */
export async function hasActiveConnection(
  userId: string,
  organizationId: string | null,
  platform: string
): Promise<boolean> {
  const where = organizationId
    ? { organizationId, platform, isActive: true, deletedAt: null }
    : { userId, organizationId: null, platform, isActive: true, deletedAt: null };

  const connection = await prisma.platformConnection.findFirst({
    where,
    select: { id: true },
  });

  return connection !== null;
}

/**
 * Build the structured "no active connection" warning for a platform. Pure —
 * no DB access — so it is trivially testable and reusable by both the single
 * and bulk schedule routes.
 */
export function buildNoConnectionWarning(platform: string): ScheduleWarning {
  return {
    code: NO_ACTIVE_CONNECTION,
    platform,
    message: `Scheduled, but no ${platform} account is connected — connect one before it publishes, or the post will not be sent.`,
  };
}

/**
 * Resolve the non-blocking warnings (if any) for scheduling a post on
 * `platform` in the given (user, org) context. Returns an empty array when an
 * active connection exists — callers should only attach a `warnings` key when
 * the array is non-empty, keeping the happy-path response byte-for-byte
 * unchanged.
 *
 * Defensive: a lookup failure must never break scheduling (the post is already
 * valid), so on error we return no warnings rather than throwing.
 */
export async function getScheduleConnectionWarnings(
  userId: string,
  organizationId: string | null,
  platform: string
): Promise<ScheduleWarning[]> {
  try {
    const connected = await hasActiveConnection(userId, organizationId, platform);
    return connected ? [] : [buildNoConnectionWarning(platform)];
  } catch {
    // Never let a warning lookup failure turn a valid schedule into an error.
    return [];
  }
}
