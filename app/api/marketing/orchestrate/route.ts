/**
 * POST /api/marketing/orchestrate — SYN-967 (10x Organic Marketing Engine, Lane 2)
 *
 * Turns a single marketing brief into a full authority campaign set (calendar +
 * platform drafts + evidence manifest + publish gates) via the real, deterministic
 * orchestrator `generateFullAuthorityCampaign`. This route is the API + review-gate
 * slice: the generated set is returned in a `pending_review` state and is NEVER
 * auto-published. A human (owner/admin) reviews it in the admin surface before any
 * downstream publish step (a later slice) can act on it.
 *
 * Auth: owner/admin only (org-scoped via withAuth). 401 unauth · 403 non-admin ·
 * 400 invalid brief · 200 pending-review set.
 *
 * Note: the orchestrator is fully deterministic (template/algorithmic, no external
 * AI provider), so there is no provider key to configure and no fabricated output —
 * the assets are produced from the brief the caller supplies.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth/with-auth';
import { logger } from '@/lib/logger';
import {
  generateFullAuthorityCampaign,
  type AuthorityCampaignChannel,
  type AuthorityCampaignInput,
} from '@/lib/marketing-agency/full-campaign-generator';

export const runtime = 'nodejs';

const CHANNELS = [
  'blog',
  'newsletter',
  'linkedin',
  'facebook',
  'instagram',
  'youtube_shorts',
  'reddit',
] as const satisfies readonly AuthorityCampaignChannel[];

const sourceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  sourceType: z.string().min(1),
  checkedAt: z.string().min(1),
  url: z.string().url().optional(),
  path: z.string().optional(),
});

const briefSchema = z.object({
  business: z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    websiteUrl: z.string().url().optional(),
    positioning: z.string().min(1),
    audience: z.array(z.string().min(1)).min(1),
    offers: z.array(z.string()).default([]),
    voiceRules: z.array(z.string()).default([]),
    forbiddenClaims: z.array(z.string()).default([]),
  }),
  objective: z.string().min(1),
  operatingMandate: z.string().min(1).optional(),
  channels: z.array(z.enum(CHANNELS)).nonempty().optional(),
  // Default 7 → a seven-asset organic set per brief (one draft per horizon day).
  horizonDays: z.number().int().min(1).max(30).optional(),
  sources: z.array(sourceSchema).default([]),
});

export const POST = withAuth(
  async (request: NextRequest, { userId, clientId, role }) => {
    // Admin gate — owner/admin only (mirrors the /dashboard/admin owner-only guard).
    if (role !== 'owner') {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Marketing orchestration is admin-only',
        },
        { status: 403 }
      );
    }

    const rawBody = await request.json().catch(() => undefined);
    const parsed = briefSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const brief = parsed.data;
    const generatedAt = new Date().toISOString();
    const campaignId = `${brief.business.slug}-${Date.now().toString(36)}`;

    const input: AuthorityCampaignInput = {
      campaignId,
      generatedAt,
      business: brief.business,
      objective: brief.objective,
      operatingMandate:
        brief.operatingMandate ??
        'Source-first, owned-media-first. External publishing stays gated until approvals and rights are recorded.',
      sources: brief.sources,
      channels: brief.channels,
      horizonDays: brief.horizonDays ?? 7,
    };

    try {
      const pack = generateFullAuthorityCampaign(input);

      logger.info('marketing: orchestrated pending-review set', {
        campaignId,
        organizationId: clientId,
        triggeredBy: userId,
        assetCount: pack.drafts.length,
      });

      // NOT auto-published — held for human review. No persistence in this slice
      // (see SYN-967 follow-ups); the admin surface holds and reviews the set.
      return NextResponse.json({
        data: {
          reviewState: 'pending_review' as const,
          campaignId: pack.campaignId,
          generatedAt: pack.generatedAt,
          assetCount: pack.drafts.length,
          set: pack,
        },
      });
    } catch (error) {
      logger.error('POST /api/marketing/orchestrate failed', {
        campaignId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: 'Failed to orchestrate campaign',
        },
        { status: 500 }
      );
    }
  }
);
