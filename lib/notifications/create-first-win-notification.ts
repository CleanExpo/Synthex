// SYN-525: Write first-win notification to DB and update user flag
//
// NOT_PROVISIONED: the `client_notifications` table this writer targets has no
// Prisma model (prisma/schema.prisma), so the write cannot be persisted. Rather
// than silently dropping it, the function logs the undelivered notification and
// returns an explicit `{ delivered: false }` result. Callers that only await the
// promise keep working; the function still never throws.
import { logger } from '@/lib/logger';
import { WinEvent, formatWinCopy } from './detect-first-win';

export const FIRST_WIN_NOTIFICATION_TABLE = 'client_notifications';

export type FirstWinNotificationResult = {
  delivered: false;
  reason: 'FEATURE_NOT_PROVISIONED';
  table: typeof FIRST_WIN_NOTIFICATION_TABLE;
};

export async function createFirstWinNotification(
  win: WinEvent
): Promise<FirstWinNotificationResult> {
  const copy = formatWinCopy(win);

  logger.warn('First win notification not delivered: storage not provisioned', {
    reason: 'FEATURE_NOT_PROVISIONED',
    table: FIRST_WIN_NOTIFICATION_TABLE,
    userId: win.userId,
    postId: win.postId,
    title: copy.title,
  });

  return {
    delivered: false,
    reason: 'FEATURE_NOT_PROVISIONED',
    table: FIRST_WIN_NOTIFICATION_TABLE,
  };
}
