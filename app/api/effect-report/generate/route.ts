/**
 * POST /api/effect-report/generate
 *
 * Manual trigger endpoint for admin testing and single-client generation.
 * Generates an Effect Report for the authenticated user's organisation.
 *
 * Body: { client_id?: string }
 *   client_id — only honoured if requester is 'owner' role
 *
 * SYN-674
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
  async (req: NextRequest, { clientId, role }: AuthContext) => {
    const body = (await req.json().catch(() => ({}))) as { client_id?: string };

    // Only owners may request generation for an arbitrary client_id
    const organizationId =
      body.client_id && role === 'owner' ? body.client_id : clientId;

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
