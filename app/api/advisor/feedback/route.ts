/**
 * POST /api/advisor/feedback
 *
 * Records whether the weekly advisor brief was useful.
 * Upserts to advisor_feedback (one row per org per week).
 *
 * Body: { weekStart: string; response: 'useful' | 'not_useful' | 'skipped' }
 *
 * @task SYN-594
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

const BodySchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  response: z.enum(['useful', 'not_useful', 'skipped']),
});

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  if (!user?.organizationId) {
    return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { weekStart, response } = parsed.data;
  const { organizationId } = user;

  // Upsert — only one feedback row per org per week
  const feedback = await prisma.advisorFeedback.upsert({
    where: {
      advisor_feedback_org_week: {
        organizationId,
        weekStart: new Date(weekStart),
      },
    },
    create: {
      organizationId,
      weekStart: new Date(weekStart),
      response,
    },
    update: { response },
  });

  logger.info('advisor/feedback: recorded', {
    orgId: organizationId,
    weekStart,
    response,
  });

  return NextResponse.json({ feedback }, { status: 201 });
}
