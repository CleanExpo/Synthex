/**
 * POST /api/calendar/seasonal-dismiss
 *
 * Records that the authenticated user's org has dismissed a seasonal
 * market opportunity signal. The signal will no longer appear in
 * subsequent calendar generations for this org.
 *
 * Body: { signalId: string }
 *
 * @task SYN-549
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import prisma from '@/lib/prisma';

const BodySchema = z.object({
  signalId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  // Auth
  const userId = await getUserIdFromRequestOrCookies(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  if (!user?.organizationId) {
    return NextResponse.json({ error: 'No organisation' }, { status: 403 });
  }

  const { organizationId } = user;

  // Validate body
  const body = await req.json();
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { signalId } = parsed.data;

  try {
    await prisma.seasonalSignalDismissal.upsert({
      where: {
        organizationId_signalId: { organizationId, signalId },
      },
      create: { organizationId, signalId },
      update: { dismissedAt: new Date() },
    });

    return NextResponse.json({ dismissed: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // FK violation = signal doesn't exist
    if (message.includes('foreign key') || message.includes('violates')) {
      return NextResponse.json({ error: 'Signal not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Failed to record dismissal', message },
      { status: 500 }
    );
  }
}
