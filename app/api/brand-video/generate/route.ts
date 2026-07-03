/**
 * POST /api/brand-video/generate
 *
 * Queues a Brand Video Studio render job. Inserts a row into
 * `brand_video_jobs` (status='queued'); a worker
 * (scripts/brand-video-worker.ts) claims and renders it out of band.
 *
 * Auth: withAuth (401 no session → 403 no org). Zod-validated body per
 * CLAUDE.md. Insert runs via the service-role Supabase client (mirrors
 * lib/supabase-server.ts serverDb pattern); created_by is the session user.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth/with-auth';
import { withRateLimit } from '@/lib/rate-limit';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { createServerClient } from '@/lib/supabase-server';
import {
  BRAND_VIDEO_STYLE_KEYS,
  DEFAULT_BRAND_VIDEO_STYLE,
} from '@/lib/brand-video/styles';

const generateSchema = z.object({
  brand: z.string().min(1, 'Brand is required').max(120),
  style: z.enum(BRAND_VIDEO_STYLE_KEYS).default(DEFAULT_BRAND_VIDEO_STYLE),
  topic: z.string().min(1, 'Topic is required').max(2000),
  count: z.coerce.number().int().min(1).max(10).optional().default(1),
});

export const POST = withAuth(async (request, { userId }) =>
  withRateLimit(request, async () => {
    const body = await request.json().catch(() => null);
    const parsed = generateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { brand, style, topic, count } = parsed.data;

    // Org-scope to the ACTIVE brand (getEffectiveOrganizationId resolves a
    // multi-business owner's activeOrganizationId, not just their home org) so
    // jobs are isolated per brand. NULL is tolerated for org-less users (the
    // row stays visible via created_by). Kept alongside created_by.
    const organizationId = await getEffectiveOrganizationId(userId);

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('brand_video_jobs')
      .insert({
        brand,
        style,
        topic,
        count,
        status: 'queued',
        created_by: userId,
        organization_id: organizationId,
      })
      .select('id, status')
      .single();

    if (error) {
      console.error('Failed to queue brand video job:', error);
      return NextResponse.json(
        { error: 'Failed to queue brand video job' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { jobId: data.id, status: data.status },
      { status: 201 }
    );
  })
);
