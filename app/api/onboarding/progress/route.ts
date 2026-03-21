/**
 * Onboarding Progress API
 *
 * GET /api/onboarding/progress — Returns the current user's onboarding progress
 * POST /api/onboarding/progress — Saves pipeline result to auditData (server-side persistence)
 *
 * The POST is called immediately after the pipeline completes on the entry page
 * so data survives sessionStorage loss (tab close, device switch).
 *
 * @module app/api/onboarding/progress/route
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';

// ─── Validation ──────────────────────────────────────────────────────────────

const progressBodySchema = z.object({
  businessName: z.string().max(255).optional(),
  url: z.string().url().max(2048).optional(),
  // Pipeline audit data — flexible JSON payload from the onboarding pipeline
  industry: z.string().max(255).optional(),
  description: z.string().max(5000).optional(),
  keyTopics: z.array(z.string().max(255)).optional(),
  targetAudience: z.string().max(1000).optional(),
  suggestedTone: z.string().max(100).optional(),
  suggestedPersonaName: z.string().max(255).optional(),
}).passthrough(); // Allow additional pipeline fields

// ─── GET /api/onboarding/progress ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) return unauthorizedResponse();

    // Find the user's org
    const org = await prisma.organization.findFirst({
      where: { users: { some: { id: userId } } },
      select: { id: true },
    });

    if (!org) {
      return NextResponse.json(
        { error: 'No organisation found' },
        { status: 404 }
      );
    }

    // Find their onboarding progress
    const progress = await prisma.onboardingProgress.findUnique({
      where: {
        userId_organizationId: {
          userId: userId,
          organizationId: org.id,
        },
      },
    });

    if (!progress) {
      return NextResponse.json(
        { error: 'No onboarding progress found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      currentStage: progress.currentStage,
      businessName: progress.businessName,
      website: progress.website,
      auditData: progress.auditData,
      goalsData: progress.goalsData,
      postingMode: progress.postingMode,
      socialProfileUrls: progress.socialProfileUrls,
      status: progress.status,
    });
  } catch (error) {
    console.error('[onboarding/progress GET]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ─── POST /api/onboarding/progress ────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) return unauthorizedResponse();

    const rawBody = await request.json().catch(() => null);
    if (!rawBody) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const parsed = progressBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    // Use validated+typed fields; keep rawBody for Prisma JSON (auditData is flexible)
    const { businessName, url } = parsed.data;

    // Find the user's org
    const org = await prisma.organization.findFirst({
      where: { users: { some: { id: userId } } },
      select: { id: true },
    });

    if (!org) {
      return NextResponse.json(
        { error: 'No organisation found' },
        { status: 404 }
      );
    }

    // Upsert OnboardingProgress with the pipeline result in auditData
    await prisma.onboardingProgress.upsert({
      where: {
        userId_organizationId: {
          userId: userId,
          organizationId: org.id,
        },
      },
      update: {
        auditData: rawBody,
        businessName: businessName ?? undefined,
        website: url ?? undefined,
      },
      create: {
        userId,
        organizationId: org.id,
        auditData: rawBody,
        businessName: businessName ?? undefined,
        website: url ?? undefined,
        currentStage: 'review',
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[onboarding/progress POST]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
