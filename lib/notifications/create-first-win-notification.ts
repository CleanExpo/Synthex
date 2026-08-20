// SYN-525: Write first-win notification to DB and update user flag
import { createClient } from '@/lib/platform/noop-client';
import { logger } from '@/lib/logger';
import { WinEvent, formatWinCopy } from './detect-first-win';

export async function createFirstWinNotification(win: WinEvent): Promise<void> {
  const platform = createClient();
  const copy = formatWinCopy(win);

  try {
    await platform.from('client_notifications').insert({
      user_id: win.userId,
      type: 'first_win',
      title: copy.title,
      body: copy.body,
      read: false,
      metadata: {
        postId: win.postId,
        metric: win.metric,
        actualValue: win.actualValue,
        baselineValue: win.baselineValue,
        improvementPct: win.improvementPct,
        detectedAt: win.detectedAt.toISOString(),
      },
    });
  } catch (error) {
    logger.warn('Failed to create first win notification', {
      error,
      userId: win.userId,
    });
  }
}
