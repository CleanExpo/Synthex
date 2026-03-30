// SYN-525: Write first-win notification to DB and update user flag
import { createClient } from '@supabase/supabase-js';
import { WinEvent, formatWinCopy } from './detect-first-win';

export async function createFirstWinNotification(win: WinEvent): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(JSON.stringify({ event: 'first_win_notification_skipped', reason: 'missing env vars', userId: win.userId }));
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
      console.error(JSON.stringify({ event: 'first_win_notification_failed', error: notifError.message, userId: win.userId }));
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
      console.error(JSON.stringify({ event: 'first_win_user_flag_failed', error: userError.message, userId: win.userId }));
    }

    console.log(JSON.stringify({
      event: 'first_win_notification_created',
      userId: win.userId,
      postId: win.postId,
      improvement_pct: win.improvementPct,
      metric: win.metric,
    }));
  } catch (err) {
    console.error(JSON.stringify({
      event: 'first_win_notification_exception',
      error: err instanceof Error ? err.message : String(err),
      userId: win.userId,
    }));
  }
}
