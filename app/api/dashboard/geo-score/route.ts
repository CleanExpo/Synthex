/**
 * GET /api/dashboard/geo-score
 *
 * Returns the latest client_geo_scores row for the authenticated user.
 * Returns { score: null } when no row exists yet (cold start).
 *
 * SYN-657
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let _admin: ReturnType<typeof createClient> | null = null;
function getAdmin() {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return _admin;
}

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = getAdmin() as ReturnType<typeof createClient<any>>;

    const { data, error } = await admin
      .from('client_geo_scores')
      .select('score, components, trend_data, recommended_actions, computed_at')
      .eq('client_id', userId)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[geo-score] Supabase error:', error);
      return NextResponse.json({ error: 'Failed to fetch GEO score' }, { status: 500 });
    }

    // No row yet — cold start
    if (!data) {
      return NextResponse.json({ score: null });
    }

    return NextResponse.json({
      score:               data.score ?? 0,
      components:          data.components ?? {},
      trend_data:          data.trend_data ?? [],
      recommended_actions: data.recommended_actions ?? [],
      computed_at:         data.computed_at,
    });
  } catch (err) {
    console.error('[geo-score] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
