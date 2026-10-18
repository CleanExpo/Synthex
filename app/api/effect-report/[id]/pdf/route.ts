/**
 * GET /api/effect-report/[id]/pdf
 *
 * Downloadable Effect Report for one of the caller's own reports.
 *
 * NOT PROVISIONED: the `effect_reports` table has no Prisma model, so after
 * auth this returns 503 FEATURE_NOT_PROVISIONED instead of reading a report.
 *
 * SYN-674
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { notProvisionedResponse } from '@/lib/api/not-provisioned';

export const GET = withAuth(async (_req: NextRequest) =>
  notProvisionedResponse('Effect Report storage is not provisioned', {
    available: false,
    reason: 'effect_reports table is not provisioned',
  })
);
