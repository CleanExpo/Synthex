/**
 * Onboarding Review API
 *
 * POST /api/onboarding/review — Saves the user-reviewed onboarding data
 *
 * Called when the user clicks "Looks good — Connect socials" on the review page.
 * Persists the (potentially edited) pipeline data + posting mode to
 * OnboardingProgress and updates the stage to 'platforms'.
 *
 * If no organisation exists yet, creates one using the reviewed business name.
 *
 * @module app/api/onboarding/review/route
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequestOrCookies, unauthorizedResponse } from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { Prisma } from '@prisma/client';

// ============================================================================
// VALIDATION
// ============================================================================

const reviewSchema = z.object({
  businessName: z.string().min(1).max(200),
  industry: z.string().max(100).optional(),
  teamSize: z.string().max(50).optional(),
  description: z.string().max(2000).optional(),
  brandColours: z.object({
    primary: z.string(),
    secondary: z.string().optional(),
    accent: z.string().optional(),
  }).optional(),
  socialProfiles: z.array(z.object({
    platform: z.string(),
    url: z.string(),
    verified: z.boolean(),
  })).optional(),
  postingMode: z.enum(['manual', 'assisted', 'auto']).optional(),
  // Pass-through fields (read-only on client, stored for reference)
  seoScore: z.number().optional(),
  pageSpeed: z.any().optional(),
  overallHealth: z.string().optional(),
  quickWins: z.array(z.string()).optional(),
  contentGaps: z.array(z.string()).optional(),
  keyTopics: z.array(z.string()).optional(),
  targetAudience: z.string().optional(),
  suggestedTone: z.string().optional(),
  suggestedPersonaName: z.string().optional(),
  structuredData: z.any().optional(),
  logoUrl: z.string().nullable().optional(),
  faviconUrl: z.string().nullable().optional(),
  url: z.string().optional(),
});

// ============================================================================
// POST — Save reviewed data
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) return unauthorizedResponse();

    const rawBody = await request.json();
    const validation = reviewSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 },
      );
    }

    const data = validation.data;

    logger.info('[review] Saving reviewed data', { userId: userId });

    // Find or create organisation
    let org = await prisma.organization.findFirst({
      where: { users: { some: { id: userId } } },
      select: { id: true },
    });

    if (!org) {
      // Create a new org during onboarding — will be fleshed out on completion
      const slug = data.businessName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50);

      org = await prisma.organization.create({
        data: {
          name: data.businessName,
          slug: `${slug}-${Date.now().toString(36)}`,
          users: { connect: { id: userId } },
        },
        select: { id: true },
      });

      logger.info('[review] Created organisation', { orgId: org.id, userId: userId });
    }

    // Build the audit data payload (merge reviewed edits with pipeline data)
    const auditData: Record<string, unknown> = {
      businessName: data.businessName,
      industry: data.industry,
      teamSize: data.teamSize,
      description: data.description,
      brandColours: data.brandColours,
      socialProfiles: data.socialProfiles,
      seoScore: data.seoScore,
      pageSpeed: data.pageSpeed,
      overallHealth: data.overallHealth,
      quickWins: data.quickWins,
      contentGaps: data.contentGaps,
      keyTopics: data.keyTopics,
      targetAudience: data.targetAudience,
      suggestedTone: data.suggestedTone,
      suggestedPersonaName: data.suggestedPersonaName,
      structuredData: data.structuredData,
      logoUrl: data.logoUrl,
      faviconUrl: data.faviconUrl,
      url: data.url,
      reviewedAt: new Date().toISOString(),
    };

    // Build social profile URLs map for the dedicated field
    const socialProfileUrls: Record<string, string> = {};
    if (data.socialProfiles) {
      for (const profile of data.socialProfiles) {
        if (profile.url) {
          socialProfileUrls[profile.platform.toLowerCase()] = profile.url;
        }
      }
    }

    // Upsert OnboardingProgress
    await prisma.onboardingProgress.upsert({
      where: {
        userId_organizationId: {
          userId: userId,
          organizationId: org.id,
        },
      },
      create: {
        userId: userId,
        organizationId: org.id,
        currentStage: 'platforms',
        businessName: data.businessName,
        website: data.url,
        auditData: auditData as Prisma.InputJsonValue,
        postingMode: data.postingMode ?? 'assisted',
        socialProfileUrls: socialProfileUrls as Prisma.InputJsonValue,
        completedStages: ['vetting'],
        requiredProviders: [],
        selectedPlatforms: Object.keys(socialProfileUrls),
      },
      update: {
        currentStage: 'platforms',
        businessName: data.businessName,
        website: data.url,
        auditData: auditData as Prisma.InputJsonValue,
        postingMode: data.postingMode ?? 'assisted',
        socialProfileUrls: socialProfileUrls as Prisma.InputJsonValue,
        completedStages: ['vetting'],
        selectedPlatforms: Object.keys(socialProfileUrls),
      },
    });

    // Update the organisation with reviewed details
    await prisma.organization.update({
      where: { id: org.id },
      data: {
        name: data.businessName,
        industry: data.industry ?? undefined,
        website: data.url ?? undefined,
        description: data.description ?? undefined,
      },
    });

    return NextResponse.json({ success: true, organizationId: org.id });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[review] Save failed', error instanceof Error ? error : undefined, { message: msg });
    return NextResponse.json(
      { error: 'Failed to save review data' },
      { status: 500 },
    );
  }
}
