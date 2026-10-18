/**
 * GET /api/effect-report/list
 *
 * Effect Report summaries for the authenticated user's organisation.
 * Used by the /dashboard/effect-report index page.
 *
 * NOT PROVISIONED: the `effect_reports` table has no Prisma model, so after
 * auth this returns 501 FEATURE_NOT_PROVISIONED (available:false) rather than
 * an empty list that would read as "no reports yet".
 *
 * SYN-674
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';

export const GET = withAuth(async (_req: NextRequest) =>
  NextResponse.json(
    {
      error: 'FEATURE_NOT_PROVISIONED',
      message: 'Effect Report storage is not provisioned',
      available: false,
      reason: 'effect_reports table is not provisioned',
    },
    { status: 501 }
  )
);
