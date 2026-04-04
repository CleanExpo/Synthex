/**
 * GET /api/dashboard/content-score-history
 *
 * Returns the authenticated org's Content Score history — latest 8 weeks
 * from `content_score_history`.
 *
 * Response:
 * {
 *   current: { score, delta, components, dataPoints, weekStart } | null,
 *   history: Array<{ score, weekStart }>,
 * }
 *
 * @task SYN-665
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

const WEEKS_HISTORY = 8;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface ContentScoreRow {
  score: number;
  delta: number;
  components: {
    data_availability: number;
    engagement_lift: number;
    volume_bonus: number;
  };
  data_points: number;
  week_start: string;
}

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  if (!user?.organizationId) {
    return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
  }
  const organizationId = user.organizationId;

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  const { data, error } = await supabaseAdmin
    .from('content_score_history')
    .select('score, delta, components, data_points, week_start')
    .eq('organization_id', organizationId)
    .order('week_start', { ascending: false })
    .limit(WEEKS_HISTORY);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch score history' }, { status: 500 });
  }

  const rows = (data ?? []) as ContentScoreRow[];
  const current = rows[0] ?? null;
  const history = rows.map((r) => ({ score: r.score, weekStart: r.week_start }));

  return NextResponse.json({ current, history });
}
