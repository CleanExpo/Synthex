/**
 * Personalisation Activation Notifier — SYN-637
 *
 * Fires a one-time notification to the org owner when their content profile
 * crosses the personalisation threshold (postCount >= threshold AND confidence >= 0.3).
 *
 * Idempotent: will not fire more than once per org (checked via client_notifications).
 * Non-fatal: errors are logged but never thrown.
 */

import { createClient } from '@/lib/platform/noop-client';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { TopicScore } from '@/lib/content-intelligence/types';

const DAY_LABELS: Record<string, string> = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
  SUN: 'Sunday',
};

export interface PersonalisationNotificationResult {
  fired: boolean;
  skipped: boolean;
  userId?: string;
  reason?: string;
}

export async function firePersonalisationNotification(
  organisationId: string,
  postCount: number,
  confidenceLevel: number,
  topTopics: TopicScore[],
  optimalTimes: Record<string, string[]>
): Promise<PersonalisationNotificationResult> {
  try {
    const rawThreshold = process.env.PERSONALISATION_NOTIFICATION_THRESHOLD ?? '8';
    const threshold = parseInt(rawThreshold, 10);

    if (postCount < threshold) {
      return { fired: false, skipped: true, reason: 'post_count_below_threshold' };
    }

    if (confidenceLevel < 0.3) {
      return { fired: false, skipped: true, reason: 'confidence_below_threshold' };
    }

    const ownerMembership = await prisma.teamMember.findFirst({
      where: { organizationId: organisationId, role: 'owner' },
      select: { userId: true },
    });

    if (!ownerMembership) {
      return { fired: false, skipped: true, reason: 'no_owner_found' };
    }

    const userId = ownerMembership.userId;
    const platform = createClient();

    const { data: existing, error: existingError } = await platform
      .from('client_notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'personalisation_activated')
      .limit(1);

    if (existingError) {
      logger.warn('Personalisation notification idempotency check failed', {
        organizationId: organisationId,
        userId,
        error: existingError,
      });
    }

    if ((existing ?? []).length > 0) {
      return { fired: false, skipped: true, userId, reason: 'already_fired' };
    }

    const topTopic = topTopics[0]?.topic?.replace(/-/g, ' ') ?? 'your strongest topics';
    const bestDayCode = Object.keys(optimalTimes)[0];
    const dayLabel = bestDayCode ? DAY_LABELS[bestDayCode] ?? bestDayCode : 'your best day';

    const { error: insertError } = await platform.from('client_notifications').insert({
      user_id: userId,
      type: 'personalisation_activated',
      title: 'Your strategy just got personal',
      body: `We now have enough signal to personalise your strategy around ${topTopic}. Based on ${postCount} posts analysed, ${dayLabel} is one of your best posting windows.`,
      read: false,
      metadata: {
        organisationId,
        postCount,
        confidenceLevel,
        topTopics,
        optimalTimes,
      },
    });

    if (insertError) {
      logger.warn('Personalisation notification insert failed', {
        organizationId: organisationId,
        userId,
        error: insertError,
      });
      return { fired: false, skipped: true, userId, reason: 'insert_failed' };
    }

    logger.info('Personalisation notification fired', {
      organizationId: organisationId,
      userId,
    });
    return { fired: true, skipped: false, userId };
  } catch (error) {
    logger.warn('Personalisation notification failed', {
      organizationId: organisationId,
      error,
    });
    return { fired: false, skipped: true, reason: 'unexpected_error' };
  }
}
