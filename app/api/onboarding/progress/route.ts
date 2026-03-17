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
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';

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

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

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
        auditData: body,
        businessName: body.businessName ?? undefined,
        website: body.url ?? undefined,
      },
      create: {
        userId,
        organizationId: org.id,
        auditData: body,
        businessName: body.businessName ?? undefined,
        website: body.url ?? undefined,
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
