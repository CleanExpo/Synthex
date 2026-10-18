/**
 * GET /api/brand-video/jobs
 *
 * Lists the authenticated user's recent Brand Video Studio jobs. Jobs live in
 * `brand_video_jobs`, which has no Prisma model (a Supabase-only table removed
 * with SYN-1070), so after auth the route answers 503 FEATURE_NOT_PROVISIONED
 * instead of an empty list that would read as "no jobs yet".
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import {
  notProvisionedBody,
  NOT_PROVISIONED_STATUS,
} from '@/lib/api/not-provisioned';

export const GET = withAuth(async () =>
  NextResponse.json(
    notProvisionedBody('brand_video_jobs', 'Brand video job history'),
    { status: NOT_PROVISIONED_STATUS }
  )
);
