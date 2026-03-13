/**
 * Onboarding AI Kickstart API
 *
 * POST /api/onboarding/kickstart
 *
 * Called immediately after onboarding completes (fire-and-forget from the
 * connect page). Generates 5-7 first-week content drafts using the
 * AI pipeline data collected during onboarding.
 *
 * Safe to call multiple times — idempotent via a check on existing kickstart
 * posts in the organisation. If drafts already exist from a kickstart,
 * returns early rather than generating duplicates.
 *
 * @module app/api/onboarding/kickstart/route
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies, unauthorizedResponse } from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { generateKickstartContent } from '@/lib/ai/content-kickstart';
import type { KickstartInput } from '@/lib/ai/content-kickstart';

// ============================================================================
// GET — Return kickstart status (for FirstWeekWidget)
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) return unauthorizedResponse();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, activeOrganizationId: true },
    });

    if (!user?.activeOrganizationId) {
      return NextResponse.json({ hasKickstart: false, draftsCount: 0, scheduledCount: 0, platforms: [] });
    }

    const orgId = user.activeOrganizationId;

    // Find all kickstart posts for this org
    const kickstartPosts = await prisma.post.findMany({
      where: {
        campaign: { userId: userId, organizationId: orgId },
        metadata: { path: ['source'], equals: 'kickstart' },
      },
      select: {
        id: true,
        platform: true,
        status: true,
        scheduledAt: true,
        campaign: { select: { name: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    const platforms = [...new Set(kickstartPosts.map((p) => p.platform))];
    const scheduledCount = kickstartPosts.filter((p) => p.status === 'scheduled').length;
    const draftCount = kickstartPosts.filter((p) => p.status === 'draft').length;

    return NextResponse.json({
      hasKickstart: kickstartPosts.length > 0,
      draftsCount: draftCount,
      scheduledCount,
      totalCount: kickstartPosts.length,
      platforms,
      posts: kickstartPosts.slice(0, 5).map((p) => ({
        id: p.id,
        platform: p.platform,
        status: p.status,
        scheduledAt: p.scheduledAt,
        campaignName: p.campaign?.name,
      })),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[kickstart] GET status failed', undefined, { message: msg });
    return NextResponse.json({ hasKickstart: false, draftsCount: 0, scheduledCount: 0, platforms: [] });
  }
}

// ============================================================================
// POST — Generate First-Week Content
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) return unauthorizedResponse();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        activeOrganizationId: true,
        onboardingComplete: true,
      },
    });

    if (!user || !user.onboardingComplete) {
      return NextResponse.json(
        { error: 'Onboarding must be complete before kickstart' },
        { status: 400 },
      );
    }

    const orgId = user.activeOrganizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: 'No active organisation found' },
        { status: 400 },
      );
    }

    // Idempotency check — if kickstart drafts already exist, skip
    // Posts are org-scoped via Campaign, not directly
    const existingKickstartPost = await prisma.post.findFirst({
      where: {
        campaign: { userId: userId, organizationId: orgId },
        metadata: { path: ['source'], equals: 'kickstart' },
      },
      select: { id: true },
    });

    if (existingKickstartPost) {
      logger.info('[kickstart] Kickstart posts already exist — skipping', {
        userId: userId,
        orgId,
      });
      return NextResponse.json({ success: true, alreadyRun: true, draftsCreated: 0 });
    }

    // Load onboarding pipeline data
    const progress = await prisma.onboardingProgress.findFirst({
      where: { userId: userId, organizationId: orgId },
      select: {
        auditData: true,
        postingMode: true,
        businessName: true,
        selectedPlatforms: true,
      },
    });

    const auditData = (progress?.auditData ?? {}) as Record<string, unknown>;

    // Load connected OAuth platforms
    const connections = await prisma.platformConnection.findMany({
      where: { userId: userId, organizationId: orgId, isActive: true },
      select: { platform: true },
    });

    const connectedPlatforms =
      connections.length > 0
        ? connections.map((c) => c.platform.toLowerCase())
        : ((progress?.selectedPlatforms ?? []) as string[]);

    const kickstartInput: KickstartInput = {
      userId: userId,
      organizationId: orgId,
      businessName:
        (auditData.businessName as string | undefined) ??
        progress?.businessName ??
        'Your Business',
      industry: auditData.industry as string | undefined,
      description: auditData.description as string | undefined,
      keyTopics: auditData.keyTopics as string[] | undefined,
      targetAudience: auditData.targetAudience as string | undefined,
      suggestedTone: auditData.suggestedTone as string | undefined,
      suggestedPersonaName: auditData.suggestedPersonaName as string | undefined,
      connectedPlatforms,
      postingMode: (progress?.postingMode as KickstartInput['postingMode']) ?? 'assisted',
    };

    logger.info('[kickstart] Starting AI content generation', {
      userId: userId,
      orgId,
      platforms: connectedPlatforms,
    });

    const result = await generateKickstartContent(kickstartInput);

    return NextResponse.json({
      success: true,
      draftsCreated: result.draftsCreated,
      platforms: result.platforms,
      postIds: result.postIds,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[kickstart] Kickstart failed', error instanceof Error ? error : undefined, {
      message: msg,
    });
    return NextResponse.json(
      { error: 'Kickstart failed. Content drafts can be generated from the dashboard.' },
      { status: 500 },
    );
  }
}

export const maxDuration = 60;
export const runtime = 'nodejs';
