/**
 * Personalisation Status API — SYN-637
 *
 * GET /api/dashboard/personalisation-status
 *
 * Returns the current org's personalisation readiness:
 *   - postCount: total posts analysed in the ContentPerformanceProfile
 *   - isPersonalised: true when postCount >= 50 (personalisation threshold)
 *
 * Read-only, non-fatal — returns { postCount: 0, isPersonalised: false }
 * on any DB error so the banner degrades gracefully.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Post count at which Synthex switches from global baseline to client fingerprint */
const PERSONALISATION_THRESHOLD = 50;

interface PersonalisationPayload {
  postCount: number;
  isPersonalised: boolean;
}

const EMPTY_PAYLOAD: PersonalisationPayload = {
  postCount: 0,
  isPersonalised: false,
};

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json({ success: true, data: EMPTY_PAYLOAD });
    }

    const profile = await prisma.contentPerformanceProfile.findUnique({
      where: { organizationId: user.organizationId },
      select: { postCount: true },
    });

    if (!profile) {
      return NextResponse.json({ success: true, data: EMPTY_PAYLOAD });
    }

    const payload: PersonalisationPayload = {
      postCount: profile.postCount,
      isPersonalised: profile.postCount >= PERSONALISATION_THRESHOLD,
    };

    return NextResponse.json({ success: true, data: payload });
  } catch (err) {
    logger.error('[PersonalisationStatus] Dashboard route error:', err);
    // Non-fatal — return empty rather than error so the banner degrades gracefully
    return NextResponse.json({ success: true, data: EMPTY_PAYLOAD });
  }
}
