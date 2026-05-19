/**
 * POST /api/effect-report/generate
 *
 * Manual trigger endpoint that generates an Effect Report for the
 * authenticated user's organisation.
 *
 * No body parameters honoured — `organizationId` is sourced exclusively
 * from `auth.clientId` (AuthContext). The previous `body.client_id`
 * owner-role override was removed in the service-role leak fix 3/N
 * because `owner` is per-organisation (not platform-wide), so an owner
 * of org A could pass org B's client_id and generate a report against
 * org B's data via the service-role client. A future cross-org admin
 * tool, if needed, belongs at /api/admin/* behind a platform-admin gate.
 *
 * SYN-674 (initial); service-role leak fix 3/N (override removed).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAuth, type AuthContext } from '@/lib/auth/with-auth';
import { generateEffectReport } from '@/lib/effect-report/generator';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthex.social';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function currentQuarterBounds(): { periodStart: Date; periodEnd: Date } {
  const now = new Date();
  const month = now.getUTCMonth();
  const year = now.getUTCFullYear();
  const qStart = Math.floor(month / 3) * 3;
  return {
    periodStart: new Date(Date.UTC(year, qStart, 1)),
    periodEnd: new Date(Date.UTC(year, qStart + 3, 0, 23, 59, 59)),
  };
}

export const POST = withAuth(
  async (_req: NextRequest, { clientId }: AuthContext) => {
    const organizationId = clientId;

    const admin = getAdmin() as ReturnType<
      typeof import('@supabase/supabase-js').createClient<any>
    >;
    const { periodStart, periodEnd } = currentQuarterBounds();

    const result = await generateEffectReport(
      { organizationId, periodStart, periodEnd },
      admin,
      APP_URL
    );

    if (!result) {
      return NextResponse.json(
        {
          error:
            'Insufficient data to generate report (cold-start guard or no data)',
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      ok: true,
      report_id: result.reportId,
      png_url: result.pngUrl,
      sections: result.reportData.sectionsIncluded,
    });
  }
);
