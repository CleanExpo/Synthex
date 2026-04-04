// SYN-525: GET unread notifications for authenticated user
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      logger.error('[notifications] Missing Supabase env vars');
      return NextResponse.json({ notifications: [] });
    }

    const supabase = createClient(url, key);

    const { data, error } = await supabase
      .from('client_notifications')
      .select('id, type, title, body, payload, created_at')
      .eq('user_id', userId)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      logger.error('[notifications] Query error:', error.message);
      return NextResponse.json({ notifications: [] });
    }

    return NextResponse.json(
      { notifications: data ?? [] },
      {
        headers: {
          'Cache-Control': 'private, no-store',
        },
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[notifications] GET error:', msg);
    return NextResponse.json({ notifications: [] });
  }
}
