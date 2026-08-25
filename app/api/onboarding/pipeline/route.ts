/**
 * Onboarding Pipeline API — Unified AI Analysis
 *
 * POST /api/onboarding/pipeline
 * Body: { url: string, businessName: string }
 *
 * Runs the full onboarding pipeline: website scrape + PageSpeed + AI analysis
 * + social link detection + verification. Returns a single unified result
 * that pre-populates the entire onboarding profile.
 *
 * Saves progress to OnboardingProgress model server-side (survives tab close).
 *
 * @module app/api/onboarding/pipeline/route
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import {
  runOnboardingPipeline,
  type PipelineResult,
} from '@/lib/ai/onboarding-pipeline';
import { discoverWebsite } from '@/lib/ai/discover-website';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { Prisma } from '@prisma/client';
import { ensureOnboardingOrganization } from '@/lib/onboarding/ensure-org';
import { organizationProfileFromAudit } from '@/lib/onboarding/org-profile-from-audit';
import { attachUserToOrganization } from '@/lib/onboarding/persist';

// ============================================================================
// VALIDATION
// ============================================================================

const pipelineSchema = z.object({
  // URL optional (SYN-1022): a name with no URL triggers a discovery pass.
  url: z.string().url('Please enter a valid URL').optional(),
  businessName: z.string().min(1, 'Business name is required').max(200),
  industry: z.string().max(100).optional(),
  description: z.string().trim().max(2000).optional(),
});

// ============================================================================
// RATE LIMITING (simple in-memory)
// ============================================================================

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT) return false;

  entry.count++;
  return true;
}

// ============================================================================
// POST — Run Pipeline
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) return unauthorizedResponse();

    if (!checkRateLimit(userId)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    const rawBody = await request.json();
    const validation = pipelineSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { url, businessName, industry, description } = validation.data;

    // Name-only intake (SYN-1022): discover the likely site, ask the user to
    // confirm/choose, and persist nothing until a URL is settled (confirm-first).
    if (!url) {
      logger.info('[pipeline] Name-only intake — running discovery', {
        userId,
      });
      const discovery = await discoverWebsite(businessName);
      return NextResponse.json({ mode: 'discovery', discovery });
    }

    logger.info('[pipeline] Running pipeline', { userId: userId, url });

    // Run the full pipeline, then persist under the caller's org
    const result: PipelineResult = await runOnboardingPipeline({
      url,
      businessName,
      industry,
    });

    try {
      const org = await ensureOnboardingOrganization(userId, businessName, {
        description,
      });

      if (org) {
        await attachUserToOrganization(userId, org.id);
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
            currentStage: 'vetting',
            businessName,
            website: url,
            auditData: result as unknown as Prisma.InputJsonValue,
            completedStages: [],
            requiredProviders: [],
            selectedPlatforms: [],
          },
          update: {
            businessName,
            website: url,
            auditData: result as unknown as Prisma.InputJsonValue,
            currentStage: 'vetting',
          },
        });

        // Seed Organization identity early so Brand Profile is populated even
        // if the user abandons before review/complete.
        await prisma.organization.update({
          where: { id: org.id },
          data: organizationProfileFromAudit({
            businessName: result.businessName || businessName,
            industry: result.industry || industry,
            description: description ?? result.description,
            url: result.url || url,
            teamSize: result.teamSize,
            logoUrl: result.logoUrl,
            faviconUrl: result.faviconUrl,
            brandColours: result.brandColours,
            socialProfiles: result.socialProfiles,
            socialHandles: result.socialHandles,
            structuredData: result.structuredData,
            seoScore: result.seoScore,
            pageSpeed: result.pageSpeed,
            overallHealth: result.overallHealth,
            quickWins: result.quickWins,
            contentGaps: result.contentGaps,
            keyTopics: result.keyTopics,
            targetAudience: result.targetAudience,
            suggestedTone: result.suggestedTone,
            suggestedPersonaName: result.suggestedPersonaName,
          }),
        });
      } else {
        logger.warn(
          '[pipeline] Could not provision organisation — skipping persist',
          { userId }
        );
      }
    } catch (dbError) {
      // Non-fatal — pipeline result is still returned to the client
      logger.warn('[pipeline] Failed to persist OnboardingProgress', {
        error: String(dbError),
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(
      '[pipeline] Pipeline failed',
      error instanceof Error ? error : undefined,
      { message: msg }
    );
    return NextResponse.json(
      { error: 'Pipeline failed. Please try again.' },
      { status: 500 }
    );
  }
}

// Allow up to 45s for scrape + AI. PageSpeed is capped and optional.
export const maxDuration = 45;
export const runtime = 'nodejs';
