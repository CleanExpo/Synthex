/**
 * GET /api/effect-report/[id]/pdf
 *
 * Downloadable Effect Report for one of the caller's own reports.
 *
 * NOT PROVISIONED: the `effect_reports` table has no Prisma model, so after
 * auth this returns 501 FEATURE_NOT_PROVISIONED instead of reading a report.
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
