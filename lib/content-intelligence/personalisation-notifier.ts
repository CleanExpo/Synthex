/**
 * Personalisation Activation Notifier — SYN-637
 *
 * Fires a one-time notification to the org owner when their content profile
 * crosses the personalisation threshold (postCount >= threshold AND confidence >= 0.3).
 *
 * Idempotent: will not fire more than once per org (checked via client_notifications).
 * Non-fatal: errors are logged but never thrown.
 */

import { createClient } from '@supabase/supabase-js';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { TopicScore } from '@/lib/content-intelligence/types';

// ── Day-of-week label map ──────────────────────────────────────────────────────

const DAY_LABELS: Record<string, string> = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
  SUN: 'Sunday',
};

// ── Result types ──────────────────────────────────────────────────────────────

export interface PersonalisationNotificationResult {
  fired: boolean;
  skipped: boolean;
  userId?: string;
  reason?: string;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Fire a personalisation-activated notification for an org owner.
 *
 * @param organisationId   Prisma Organisation id
 * @param postCount        Number of posts analysed in the profile
 * @param confidenceLevel  0.0–1.0 confidence level from computeConfidenceLevel()
 * @param topTopics        Ranked topic scores from the content profile
 * @param optimalTimes     Day → hour[] map from the content profile
 */
export async function firePersonalisationNotification(
  organisationId: string,
  postCount: number,
  confidenceLevel: number,
  topTopics: TopicScore[],
  optimalTimes: Record<string, string[]>
): Promise<PersonalisationNotificationResult> {
  try {
    // ── 1. Check threshold ───────────────────────────────────────────────────
    const rawThreshold = process.env.PERSONALISATION_NOTIFICATION_THRESHOLD ?? '8';
    const threshold = parseInt(rawThreshold, 10);

    if (postCount < threshold) {
      return { fired: false, skipped: true, reason: 'post_count_below_threshold' };
    }

    if (confidenceLevel < 0.3) {
      return { fired: false, skipped: true, reason: 'confidence_below_threshold' };
    }

    // ── 2. Find org owner via TeamMember (role = 'owner') ───────────────────
    const ownerMembership = await prisma.teamMember.findFirst({
      where: { organizationId: organisationId, role: 'owner' },
      select: { userId: true },
    });

    if (!ownerMembership) {
      return { fired: false, skipped: true, reason: 'no_owner_found' };
    }

    const userId = ownerMembership.userId;

    // ── 3. Idempotency check via Supabase ────────────────────────────────────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      logger.error('[personalisation-notifier] missing Supabase env vars', { organisationId });
      return { fired: false, skipped: true, reason: 'missing_env_vars' };
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: existing, error: checkError } = await supabase
      .from('client_notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'personalisation_activated')
      .limit(1);

    if (checkError) {
      logger.error('[personalisation-notifier] idempotency check failed', {
        organisationId,
        userId,
        error: checkError.message,
      });
      return { fired: false, skipped: true, reason: 'idempotency_check_failed' };
    }

    if (existing && existing.length > 0) {
      return { fired: false, skipped: true, reason: 'already_fired' };
    }

    // ── 4. Derive human-readable copy ────────────────────────────────────────
    const topContentType =
      topTopics[0]?.topic?.replace(/-/g, ' ') ?? 'your content';

    const firstDay = Object.keys(optimalTimes)[0];
    const optimalDayOfWeek = firstDay ? (DAY_LABELS[firstDay.toUpperCase()] ?? 'your best day') : 'your best day';

    const body =
      `Synthex has analysed your last ${postCount} posts and updated your content strategy. ` +
      `Your audience engages most with ${topContentType} on ${optimalDayOfWeek}. ` +
      `Your next scheduled posts reflect this.`;

    const payload = {
      postsAnalysedCount: postCount,
      topContentType,
      optimalDayOfWeek,
    };

    // ── 5. Insert notification ────────────────────────────────────────────────
    const { error: insertError } = await supabase
      .from('client_notifications')
      .insert({
        user_id: userId,
        type: 'personalisation_activated',
        title: 'Your strategy just got personal',
        body,
        payload,
        read: false,
      });

    if (insertError) {
      logger.error('[personalisation-notifier] notification insert failed', {
        organisationId,
        userId,
        error: insertError.message,
      });
      return { fired: false, skipped: true, reason: 'insert_failed' };
    }

    logger.info('[personalisation-notifier] notification fired', {
      organisationId,
      userId,
      postCount,
      confidenceLevel,
      topContentType,
      optimalDayOfWeek,
    });

    return { fired: true, skipped: false, userId };
  } catch (err) {
    logger.error('[personalisation-notifier] unexpected error', {
      organisationId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { fired: false, skipped: true, reason: 'unexpected_error' };
  }
}
