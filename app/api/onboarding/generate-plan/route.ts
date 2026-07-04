/**
 * Onboarding — Generate Marketing Plan (SYN-23)
 *
 * Receives the 6-question onboarding answers and generates a personalised
 * 90-day marketing plan via the generate-plan service (premium AI model).
 *
 * If the user already has an organisation, the result is saved to
 * OnboardingProgress.goalsData for persistence. Otherwise the data is returned
 * for the client to cache via sessionStorage.
 *
 * POST /api/onboarding/generate-plan
 * Body: GoalsAnswers
 * Returns: MarketingPlan
 */

import { type NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getAuthUser } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { goalsSchema, generatePlanWithAI } from '@/lib/onboarding/generate-plan';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const rawBody = await request.json();
    const validation = goalsSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 },
      );
    }

    const answers = validation.data;
    logger.info('Generating marketing plan', { userId: user.id, answers });

    const plan = await generatePlanWithAI(answers);

    // Persist to OnboardingProgress if user already has an organisation
    // (Non-fatal — client falls back to sessionStorage if org doesn't exist yet)
    const goalsPayload = { answers, plan };

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
            goalsData: goalsPayload as unknown as Prisma.InputJsonValue,
            completedStages: [],
            requiredProviders: [],
            selectedPlatforms: [],
          },
          update: {
            goalsData: goalsPayload as unknown as Prisma.InputJsonValue,
          },
        });
        logger.info('goalsData saved to OnboardingProgress', { userId: user.id });
      }
    } catch (dbErr) {
      logger.warn('OnboardingProgress goalsData save skipped', { error: String(dbErr) });
    }

    return NextResponse.json(plan);
  } catch (error) {
    logger.error('Generate plan error', { error: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
