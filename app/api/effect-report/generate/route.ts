/**
 * POST /api/effect-report/generate
 *
 * Manual trigger that generates an Effect Report for the authenticated
 * user's organisation. No body parameters are honoured — the organisation
 * comes exclusively from `auth.clientId` (service-role leak fix 3/N).
 *
 * NOT PROVISIONED: the `effect_reports` table has no Prisma model, so the
 * report cannot be persisted. After auth this returns 503
 * FEATURE_NOT_PROVISIONED instead of silently dropping the write.
 *
 * SYN-674 (initial); service-role leak fix 3/N (override removed).
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { notProvisionedResponse } from '@/lib/api/not-provisioned';

export const POST = withAuth(async (_req: NextRequest) =>
  notProvisionedResponse('Effect Report storage is not provisioned')
);
