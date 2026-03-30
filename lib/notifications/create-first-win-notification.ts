// SYN-525: Write first-win notification to DB and update user flag
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { WinEvent, formatWinCopy } from './detect-first-win';

export async function createFirstWinNotification(win: WinEvent): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    logger.error('[first-win] missing env vars, notification skipped', {
      userId: win.userId,
    });
    return;
  }

  const supabase = createClient(url, key);
  const { title, body } = formatWinCopy(win);

  try {
    // 1. Insert notification
    const { error: notifError } = await supabase
      .from('client_notifications')
      .insert({
        user_id: win.userId,
        type: 'first_win',
        title,
        body,
        payload: {
          post_id: win.postId,
          metric: win.metric,
          actual_value: win.actualValue,
          baseline_value: win.baselineValue,
          improvement_pct: win.improvementPct,
          detected_at: win.detectedAt.toISOString(),
        },
        read: false,
      });

    if (notifError) {
      logger.error('[first-win] notification insert failed', {
        error: notifError.message,
        userId: win.userId,
      });
      return;
    }

    // 2. Flag user as having received first win (idempotency guard)
    const { error: userError } = await supabase
      .from('users')
      .update({
        first_win_detected: true,
        first_win_detected_at: win.detectedAt.toISOString(),
      })
      .eq('id', win.userId);

    if (userError) {
      logger.error('[first-win] user flag update failed', {
        error: userError.message,
        userId: win.userId,
      });
    }

    logger.info('[first-win] notification created', {
      userId: win.userId,
      postId: win.postId,
      improvement_pct: win.improvementPct,
      metric: win.metric,
    });
  } catch (err) {
    logger.error('[first-win] unexpected error', {
      error: err instanceof Error ? err.message : String(err),
      userId: win.userId,
    });
  }
}
