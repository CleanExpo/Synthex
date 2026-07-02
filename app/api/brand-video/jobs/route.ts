/**
 * GET /api/brand-video/jobs
 *
 * Lists the authenticated user's recent Brand Video Studio jobs (newest first)
 * for the dashboard recent-jobs panel. Auth: withAuth. Read via service-role
 * client, scoped to the session user (created_by) AND, for multi-business
 * owners, to their ACTIVE brand (getEffectiveOrganizationId) so a brand switch
 * never serves another brand's jobs — never cross-user, never cross-brand.
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { createServerClient } from '@/lib/supabase-server';

export const GET = withAuth(async (_request, { userId }) => {
  const organizationId = await getEffectiveOrganizationId(userId);

  const supabase = createServerClient();
  let query = supabase
    .from('brand_video_jobs')
    .select(
      'id, brand, style, topic, count, status, output_url, error, created_at'
    )
    .eq('created_by', userId);

  // Org-scope to the active brand when the user has one. Org-less users fall
  // back to created_by only (they have no brands to isolate).
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data, error } = await query
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
