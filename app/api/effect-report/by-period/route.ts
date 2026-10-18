/**
 * GET /api/effect-report/by-period?quarter=Q1+2026
 *
 * Single Effect Report for the given quarter label, for the caller's org.
 * Used by /dashboard/effect-report/[period] viewer.
 *
 * NOT PROVISIONED: the `effect_reports` table has no Prisma model, so after
 * auth and input validation this returns 503 FEATURE_NOT_PROVISIONED.
 *
 * SYN-674
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { notProvisionedResponse } from '@/lib/api/not-provisioned';

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  if (!searchParams.get('quarter')) {
    return NextResponse.json(
      { error: 'quarter param required' },
      { status: 400 }
    );
  }

  return notProvisionedResponse('Effect Report storage is not provisioned', {
    available: false,
    reason: 'effect_reports table is not provisioned',
  });
});
