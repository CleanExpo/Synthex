/**
 * GET /api/effect-report/by-period?quarter=Q1+2026
 *
 * Returns a single Effect Report for the given quarter label.
 * Used by /dashboard/effect-report/[period] viewer.
 * SYN-674
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAuth, type AuthContext } from '@/lib/auth/with-auth';
import { getEffectReportByPeriod } from '@/lib/effect-report/generator';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthex.social';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const GET = withAuth(
  async (req: NextRequest, { clientId }: AuthContext) => {
    const { searchParams } = new URL(req.url);
    const quarterLabel = searchParams.get('quarter');

    if (!quarterLabel) {
      return NextResponse.json(
        { error: 'quarter param required' },
        { status: 400 }
      );
    }

    const admin = getAdmin() as ReturnType<
      typeof import('@supabase/supabase-js').createClient<any>
    >;
    const report = await getEffectReportByPeriod(admin, clientId, quarterLabel);

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    return NextResponse.json({
      reportId: report.id,
      quarterLabel: report.report_data?.quarterLabel ?? quarterLabel,
      reportData: report.report_data,
      // SECURITY (2026-05-16): /api/og/effect-report now derives clientId
      // from the authenticated session; the param is ignored if supplied.
      pngUrl:
        report.png_url ??
        `${APP_URL}/api/og/effect-report?period=${encodeURIComponent(quarterLabel)}`,
      pdfUrl: report.pdf_url ?? `${APP_URL}/api/effect-report/${report.id}/pdf`,
    });
  }
);
