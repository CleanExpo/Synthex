/**
 * POST /api/brand-video/generate
 *
 * Queues a Brand Video Studio render job. Inserts a row into
 * `brand_video_jobs` (status='queued'); a worker
 * (scripts/brand-video-worker.ts) claims and renders it out of band.
 *
 * Auth: withAuth (401 no session → 403 no org). Zod-validated body per
 * CLAUDE.md. Insert runs via the service-role Supabase client (mirrors
 * lib/platform-server.ts serverDb pattern); created_by is the session user.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth/with-auth';
import { withRateLimit } from '@/lib/rate-limit';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { createServerClient } from '@/lib/platform/server';
import {
  BRAND_VIDEO_STYLE_KEYS,
  DEFAULT_BRAND_VIDEO_STYLE,
} from '@/lib/brand-video/styles';
import { preflightBrandAssets } from '@/lib/brand-video/preflight';

const generateSchema = z.object({
  brand: z.string().min(1, 'Brand is required').max(120),
  style: z.enum(BRAND_VIDEO_STYLE_KEYS).default(DEFAULT_BRAND_VIDEO_STYLE),
  topic: z.string().min(1, 'Topic is required').max(2000),
  // Capped at 1 deliberately. The worker renders exactly one video per job and
  // never reads `count`, and `brand_video_jobs` has a single `output_url`, so a
  // job cannot even represent more than one output. Accepting up to 10 promised
  // work that was silently never done. Raising this cap needs multi-output
  // storage first (SYN-1139).
  count: z.coerce.number().int().min(1).max(1).optional().default(1),
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

    // Refuse here rather than at render time. The worker resolves nothing about
    // the brand — it logs the string and applies no tokens — so an unrecognised
    // or unapproved brand used to queue, render, spend on voiceover and images,
    // and report success while producing something unbranded (SYN-1113).
    const preflight = preflightBrandAssets(brand);

    if (!preflight.ok) {
      return NextResponse.json(
        {
          error: 'Brand preflight failed',
          details: preflight.findings.map(f => f.message),
        },
        { status: 400 }
      );
    }

    // Org-scope to the ACTIVE brand (getEffectiveOrganizationId resolves a
    // multi-business owner's activeOrganizationId, not just their home org) so
    // jobs are isolated per brand. NULL is tolerated for org-less users (the
    // row stays visible via created_by). Kept alongside created_by.
    const organizationId = await getEffectiveOrganizationId(userId);

    const platform = createServerClient();
    const { data, error } = await platform
      .from('brand_video_jobs')
      .insert({
        // The normalised slug, not the raw input, so the column holds a value
        // that resolves against brand-config rather than whatever was typed.
        brand: preflight.slug,
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
      {
        jobId: data.id,
        status: data.status,
        // Non-blocking gaps (e.g. a declared logo file that does not exist).
        // Omitted when clean so a normal response shape does not change.
        ...(preflight.warnings.length > 0 && {
          warnings: preflight.warnings.map(w => w.message),
        }),
      },
      { status: 201 }
    );
  })
);
