/**
 * Personalisation Activation Notifier — SYN-637
 *
 * Fires a one-time notification to the org owner when their content profile
 * crosses the personalisation threshold (postCount >= threshold AND confidence >= 0.3).
 *
 * NOT PROVISIONED: the notification was stored in, and de-duplicated against,
 * the `client_notifications` table, which has no Prisma model in
 * `prisma/schema.prisma`. Until it exists, a qualifying org gets an explicit
 * `{ fired: false, reason: 'feature_not_provisioned' }` result and a warning
 * log — never a reported success for a notification that was not stored.
 * Non-fatal: errors are logged but never thrown.
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { TopicScore } from '@/lib/content-intelligence/types';

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
    const rawThreshold =
      process.env.PERSONALISATION_NOTIFICATION_THRESHOLD ?? '8';
    const threshold = parseInt(rawThreshold, 10);

    if (postCount < threshold) {
      return {
        fired: false,
        skipped: true,
        reason: 'post_count_below_threshold',
      };
    }

    if (confidenceLevel < 0.3) {
      return {
        fired: false,
        skipped: true,
        reason: 'confidence_below_threshold',
      };
    }

    const ownerMembership = await prisma.teamMember.findFirst({
      where: { organizationId: organisationId, role: 'owner' },
      select: { userId: true },
    });

    if (!ownerMembership) {
      return { fired: false, skipped: true, reason: 'no_owner_found' };
    }

    const userId = ownerMembership.userId;
    logger.warn(
      'Personalisation notification not delivered: client_notifications is not provisioned',
      {
        organizationId: organisationId,
        userId,
        missingTable: 'client_notifications',
      }
    );
    return {
      fired: false,
      skipped: true,
      userId,
      reason: 'feature_not_provisioned',
    };
  } catch (error) {
    logger.warn('Personalisation notification failed', {
      organizationId: organisationId,
      error,
    });
    return { fired: false, skipped: true, reason: 'unexpected_error' };
  }
}
