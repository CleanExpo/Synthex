/**
 * Admin Org Spend API — BUDGET-ENFORCER read endpoint.
 *
 * GET /api/admin/org-spend?organizationId=<id>
 *
 * Returns the organisation's current AI spend vs its budget ceilings:
 *   { dailySpendUsd, monthlySpendUsd, inFlightReservedUsd,
 *     dailyCeilingUsd, monthlyCeilingUsd, enforcementMode, policySource }
 *
 * Spend = SUM over pipeline_cost_ledger for the UTC day/month windows;
 * inFlightReservedUsd = amounts reserved by lib/ai/budget-enforcer.ts for
 * generations currently in flight (not yet committed/released).
 *
 * Auth: verifyAdmin (x-admin-api-key or admin-role JWT) + admin rate limit —
 * same pattern as app/api/admin/platform-stats.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 *   - DATABASE_URL (CRITICAL)
 *   - ADMIN_API_KEY (SECRET) or JWT_SECRET (CRITICAL) for admin auth
 *
 * @module app/api/admin/org-spend/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { sanitizeErrorForResponse } from '@/lib/utils/error-utils';
import { verifyAdmin } from '@/lib/admin/verify-admin';
import { admin as adminRateLimit } from '@/lib/middleware/api-rate-limit';
import { getOrgSpendSnapshot } from '@/lib/ai/budget-enforcer';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  return adminRateLimit(request, async () => {
    try {
      const auth = await verifyAdmin(request);
      if (!auth.isAdmin) {
        return NextResponse.json(
          {
            error: 'Forbidden',
            message: auth.error ?? 'Admin access required',
          },
          { status: 403 }
        );
      }

      const organizationId = new URL(request.url).searchParams.get(
        'organizationId'
      );
      if (!organizationId) {
        return NextResponse.json(
          {
            error: 'Bad Request',
            message: 'organizationId query parameter is required',
          },
          { status: 400 }
        );
      }

      const snapshot = await getOrgSpendSnapshot(organizationId);
      return NextResponse.json({ success: true, data: snapshot });
    } catch (error: unknown) {
      logger.error('Admin org spend error:', error);
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: sanitizeErrorForResponse(error, 'Failed to fetch org spend'),
        },
        { status: 500 }
      );
    }
  });
}

export const runtime = 'nodejs';
