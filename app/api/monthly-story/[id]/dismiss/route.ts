/**
 * POST /api/monthly-story/[id]/dismiss
 *
 * Sets dismissedAt on the story so the dashboard card is hidden.
 * The story remains accessible from the nav at any time.
 *
 * @task SYN-553
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import prisma from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  if (!user?.organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 403 }
    );
  }

  // Verify the story belongs to this org
  const story = await prisma.monthlyStory.findUnique({
    where: { id },
    select: { organizationId: true, dismissedAt: true },
  });

  if (!story) {
    return NextResponse.json({ error: 'Story not found' }, { status: 404 });
  }
  if (story.organizationId !== user.organizationId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.monthlyStory.update({
    where: { id },
    data: { dismissedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
