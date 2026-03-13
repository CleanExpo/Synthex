/**
 * Onboarding Progress API
 *
 * GET /api/onboarding/progress — Returns the current user's onboarding progress
 *
 * Used by the review page as a fallback when sessionStorage is cleared
 * (e.g. tab close, device switch). Returns the pipeline result stored
 * in the auditData field of OnboardingProgress.
 *
 * @module app/api/onboarding/progress/route
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies, unauthorizedResponse } from '@/lib/auth/jwt-utils';
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
      return NextResponse.json({ error: 'No organisation found' }, { status: 404 });
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
      return NextResponse.json({ error: 'No onboarding progress found' }, { status: 404 });
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
