/**
 * GET /api/effect-report/list
 *
 * Returns all Effect Report summaries for the authenticated user's organisation.
 * Used by the /dashboard/effect-report index page.
 * SYN-674
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAuth, type AuthContext } from '@/lib/auth/with-auth';
import type { EffectReportData } from '@/lib/effect-report/types';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const GET = withAuth(
  async (_req: NextRequest, { clientId }: AuthContext) => {
    const admin = getAdmin() as ReturnType<
      typeof import('@supabase/supabase-js').createClient<any>
    >;

    const { data, error } = await admin
      .from('effect_reports')
      .select(
        'id, period_start, period_end, report_data, png_url, pdf_url, created_at'
      )
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(8);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch reports' },
        { status: 500 }
      );
    }

    const reports = (data ?? []).map(
      (row: {
        id: string;
        period_start: string;
        period_end: string;
        report_data: EffectReportData;
        png_url: string | null;
        pdf_url: string | null;
        created_at: string;
      }) => ({
        id: row.id,
        periodStart: row.period_start,
        periodEnd: row.period_end,
        quarterLabel: row.report_data?.quarterLabel ?? '',
        createdAt: row.created_at,
      })
    );

    return NextResponse.json({ reports });
  }
);
