/**
 * GET /api/brand-video/jobs
 *
 * Lists the authenticated user's recent Brand Video Studio jobs (newest first)
 * for the dashboard recent-jobs panel. Auth: withAuth. Read via service-role
 * client, scoped to the session user (created_by) — never cross-user.
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { createServerClient } from '@/lib/supabase-server';

export const GET = withAuth(async (_request, { userId }) => {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('brand_video_jobs')
    .select(
      'id, brand, style, topic, count, status, output_url, error, created_at'
    )
    .eq('created_by', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Failed to list brand video jobs:', error);
    return NextResponse.json(
      { error: 'Failed to list brand video jobs' },
      { status: 500 }
    );
  }

  return NextResponse.json({ jobs: data ?? [] });
});
