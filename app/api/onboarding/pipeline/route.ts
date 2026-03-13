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
import { getAuthUser } from '@/lib/supabase-server';
import { runOnboardingPipeline, type PipelineResult } from '@/lib/ai/onboarding-pipeline';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { Prisma } from '@prisma/client';

// ============================================================================
// VALIDATION
// ============================================================================

const pipelineSchema = z.object({
  url: z.string().url('Please enter a valid URL'),
  businessName: z.string().min(1, 'Business name is required').max(200),
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
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    if (!checkRateLimit(user.id)) {
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

    const { url, businessName } = validation.data;

    logger.info('[pipeline] Running pipeline', { userId: user.id, url });

    // Run the full pipeline (~15-20 seconds)
    const result: PipelineResult = await runOnboardingPipeline({ url, businessName });

    // Persist pipeline results to OnboardingProgress (server-side, survives tab close)
    // OnboardingProgress requires organizationId — find or skip if org doesn't exist yet
    try {
      const org = await prisma.organization.findFirst({
        where: { users: { some: { id: user.id } } },
        select: { id: true },
      });

      if (org) {
        await prisma.onboardingProgress.upsert({
          where: {
            userId_organizationId: {
              userId: user.id,
              organizationId: org.id,
            },
          },
          create: {
            userId: user.id,
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
      } else {
        logger.info('[pipeline] No org found — skipping OnboardingProgress write', { userId: user.id });
      }
    } catch (dbError) {
      // Non-fatal — pipeline result is still returned to the client
      logger.warn('[pipeline] Failed to persist OnboardingProgress', { error: String(dbError) });
    }

    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[pipeline] Pipeline failed', error instanceof Error ? error : undefined, { message: msg });
    return NextResponse.json(
      { error: 'Pipeline failed. Please try again.' },
      { status: 500 }
    );
  }
}

// Allow up to 60s for the full pipeline (PageSpeed can be slow)
export const maxDuration = 60;
export const runtime = 'nodejs';
