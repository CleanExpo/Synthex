/**
 * POST /api/collaborator/pageview
 *
 * Records a page view for a collaborator team member.
 * Called client-side whenever a collaborator navigates to a new page.
 * Feeds `collaborator_weekly_sessions` and `collaborator_most_viewed_page`
 * in the `team_analytics` Supabase view.
 *
 * @task SYN-599
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

const BodySchema = z.object({
  pagePath: z.string().min(1).max(500),
});

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Verify this user is an active collaborator
  const membership = await prisma.teamMember.findFirst({
    where: { userId, role: 'collaborator', acceptedAt: { not: null } },
    select: { id: true, organizationId: true },
  });

  if (!membership) {
    // Non-collaborators can call this silently — just no-op
    return NextResponse.json({ recorded: false });
  }

  await prisma.teamMemberPageView.create({
    data: {
      teamMemberId: membership.id,
      organizationId: membership.organizationId,
      pagePath: parsed.data.pagePath,
    },
  });

  return NextResponse.json({ recorded: true });
}
