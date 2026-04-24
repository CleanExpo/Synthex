/**
 * POST /api/internal/generate-effect-reports
 *
 * Quarterly batch job that:
 * 1. Finds all active clients created ≥ 45 days before period_start
 * 2. Skips clients who already have a report for this quarter
 * 3. Generates Effect Report (5 sections, conditional on data)
 * 4. Persists to effect_reports table + sends Resend email
 * 5. Records journey event in client_journey_events
 *
 * Feature flag: EFFECT_REPORT_ENABLED=true required (defaults disabled).
 * Called by: supabase/functions/generate-effect-reports (Deno cron proxy)
 * Auth: CRON_SECRET bearer token
 * SYN-674
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';
import { generateEffectReport } from '@/lib/effect-report/generator';
import { sendEffectReportEmail } from '@/lib/email/effect-report-email';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

// ── Config ────────────────────────────────────────────────────────────────────

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthex.social';

/** One quarter in days (approximate) */
const QUARTER_DAYS = 90;

// ── Supabase admin singleton ──────────────────────────────────────────────────

let _admin: ReturnType<typeof createClient> | null = null;

function getAdmin() {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return _admin;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentQuarterBounds(): { periodStart: Date; periodEnd: Date } {
  const now = new Date();
  const month = now.getUTCMonth();
  const year = now.getUTCFullYear();

  const qStart = Math.floor(month / 3) * 3;
  const periodStart = new Date(Date.UTC(year, qStart, 1));
  const periodEnd = new Date(Date.UTC(year, qStart + 3, 0, 23, 59, 59)); // last day of quarter
  return { periodStart, periodEnd };
}

function getQuarterLabel(date: Date): string {
  const q = Math.floor(date.getUTCMonth() / 3) + 1;
  return `Q${q} ${date.getUTCFullYear()}`;
}

async function resolveEmail(organizationId: string): Promise<string | null> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        businessOwners: {
          where: { isActive: true },
          include: { owner: { select: { email: true } } },
          take: 1,
        },
      },
    });
    return org?.businessOwners?.[0]?.owner?.email ?? null;
  } catch {
    return null;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Feature flag guard
  if (process.env.EFFECT_REPORT_ENABLED !== 'true') {
    return NextResponse.json({
      ok: true,
      message: 'EFFECT_REPORT_ENABLED is not set — no reports generated',
    });
  }

  // Auth guard
  const auth = verifyCronRequest(req, 'GENERATE_EFFECT_REPORTS');
  if (!auth.ok) return auth.response;

  const { periodStart, periodEnd } = currentQuarterBounds();
  const quarterLabel = getQuarterLabel(periodEnd);
  const admin = getAdmin() as ReturnType<
    typeof import('@supabase/supabase-js').createClient<any>
  >;

  // Fetch all active orgs
  const orgs = await prisma.organization.findMany({
    where: {
      businessOwners: { some: { billingStatus: 'active', isActive: true } },
    },
    select: { id: true, name: true },
  });

  let generated = 0;
  let skippedCold = 0;
  let skippedExist = 0;
  let skippedEmail = 0;
  let errors = 0;

  for (const org of orgs) {
    try {
      // Skip if report already exists for this quarter
      const { data: existing } = await admin
        .from('effect_reports')
        .select('id')
        .eq('client_id', org.id)
        .eq('period_start', periodStart.toISOString().slice(0, 10))
        .limit(1);

      if (existing && existing.length > 0) {
        skippedExist++;
        continue;
      }

      // Generate report (cold-start guard runs inside generator)
      const result = await generateEffectReport(
        { organizationId: org.id, periodStart, periodEnd },
        admin,
        APP_URL
      );

      if (!result) {
        skippedCold++;
        continue;
      }

      // Resolve contact email
      const email = await resolveEmail(org.id);
      if (!email) {
        skippedEmail++;
        continue;
      }

      // Send email
      const reportUrl = `${APP_URL}/dashboard/effect-report/${encodeURIComponent(quarterLabel)}`;
      const pdfUrl = `${APP_URL}/api/effect-report/${result.reportId}/pdf`;

      const { success } = await sendEffectReportEmail({
        to: email,
        businessName: org.name,
        quarterLabel,
        reportUrl,
        pngUrl: result.pngUrl,
        pdfUrl,
        reportData: result.reportData,
      });

      if (success) {
        // Record delivery timestamp
        await admin
          .from('effect_reports')
          .update({ email_sent_at: new Date().toISOString() })
          .eq('id', result.reportId);
      }

      // Record journey event
      await admin.from('client_journey_events').insert({
        client_id: org.id,
        event_type: 'quarterly_milestone_review',
        delivered_at: new Date().toISOString(),
        metadata: {
          report_id: result.reportId,
          quarter_label: quarterLabel,
          sections_included: result.reportData.sectionsIncluded,
          email_sent: success,
        },
      });

      generated++;
    } catch (err) {
      console.error(`[generate-effect-reports] Error for org ${org.id}:`, err);
      errors++;
    }
  }

  return NextResponse.json({
    ok: true,
    quarter_label: quarterLabel,
    orgs_evaluated: orgs.length,
    generated,
    skipped_cold: skippedCold,
    skipped_existing: skippedExist,
    skipped_no_email: skippedEmail,
    errors,
  });
}
