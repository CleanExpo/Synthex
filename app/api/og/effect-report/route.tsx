/**
 * GET /api/og/effect-report?period=Q1+2026
 *
 * Generates a 1200×1200px PNG shareable card for the Effect Report for the
 * authenticated user's organisation.
 *
 * Card content: business name, headline metric, quarter label,
 * "Powered by Synthex" watermark.
 *
 * SECURITY (2026-05-16, service-role-leak triage refactor 1/N):
 *   Previously accepted `?client_id=<uuid>` and passed it straight into
 *   `.eq('client_id', clientId)` over a service-role Supabase client. That
 *   bypassed RLS and let any UNAUTHENTICATED requester fetch any tenant's
 *   Effect Report — business name, GEO score, attribution figures, reach.
 *
 *   The route now:
 *   1. Requires an authenticated session (cookie or Authorization header).
 *   2. Derives `clientId` from the authenticated user's `organizationId`
 *      via Prisma. The `client_id` query param is ignored.
 *   3. Returns 401 if no session, 403 if no org membership.
 *
 *   Runtime switched from `edge` → `nodejs` because Prisma is not edge-
 *   compatible. ImageResponse from next/og is supported on both runtimes.
 *
 *   The service-role Supabase client is retained for the actual `effect_reports`
 *   read (Synthex's connection-pooler-broken path) — the tenant boundary now
 *   sits at the auth check, not at the DB client choice.
 *
 * SYN-674
 */

import { NextRequest, NextResponse } from 'next/server';
import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import type { EffectReportData } from '@/lib/effect-report/types';

export const runtime = 'nodejs';

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase not configured');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface CardData {
  businessName: string;
  quarterLabel: string;
  headlineStat: string;
  headlineLabel: string;
  subtext: string;
}

async function buildCardData(
  clientId: string,
  period: string
): Promise<CardData> {
  const admin = getAdmin() as ReturnType<
    typeof import('@supabase/supabase-js').createClient<any>
  >;

  const { data: rows } = await admin
    .from('effect_reports')
    .select('report_data')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(5);

  const matchedRow =
    rows?.find(
      (r: { report_data: EffectReportData }) =>
        r.report_data?.quarterLabel === period
    ) ?? rows?.[0];

  const rd = matchedRow?.report_data as EffectReportData | undefined;

  const businessName = rd?.businessName ?? 'Your Business';
  const quarterLabel = rd?.quarterLabel ?? period;

  // Headline: highest impact metric available
  let headlineStat = '';
  let headlineLabel = '';

  if (
    rd?.proprietaryMetrics?.geoScore !== null &&
    rd?.proprietaryMetrics?.geoScore !== undefined
  ) {
    headlineStat = `${rd.proprietaryMetrics.geoScore}/100`;
    headlineLabel = 'GEO Score';
  } else if (rd?.achievementSummary?.postsPublished) {
    headlineStat = `${rd.achievementSummary.postsPublished}`;
    headlineLabel = 'Posts published';
  } else {
    headlineStat = quarterLabel;
    headlineLabel = 'Milestone reached';
  }

  const subtext = rd?.achievementSummary?.estimatedTotalReach
    ? `${rd.achievementSummary.estimatedTotalReach.toLocaleString('en-AU')} estimated views this quarter`
    : 'Powered by Synthex';

  return { businessName, quarterLabel, headlineStat, headlineLabel, subtext };
}

/**
 * Resolve the authenticated user's tenant.
 *
 * Returns `{ clientId }` on success or a `NextResponse` error (401/403) that
 * the caller must return as-is.
 */
async function resolveTenant(
  req: NextRequest
): Promise<{ clientId: string } | NextResponse> {
  const userId = await getUserIdFromRequestOrCookies(req);
  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  if (!user?.organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 403 }
    );
  }
  return { clientId: user.organizationId };
}

export async function GET(req: NextRequest): Promise<Response> {
  const tenant = await resolveTenant(req);
  if (tenant instanceof NextResponse) return tenant;

  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') ?? '';

  let card: CardData;
  try {
    // SECURITY: clientId comes from resolveTenant() — never from the query
    // string. We deliberately ignore any `?client_id=` param.
    card = await buildCardData(tenant.clientId, period);
  } catch {
    card = {
      businessName: 'Your Business',
      quarterLabel: period || 'This Quarter',
      headlineStat: 'Effect Report',
      headlineLabel: 'Ready',
      subtext: 'Powered by Synthex',
    };
  }

  const periodSlug = (card.quarterLabel || period)
    .replace(/\s+/g, '-')
    .toLowerCase();

  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        background: '#0f172a',
        padding: '80px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* Top accent bar */}
      <div
        style={{
          display: 'flex',
          width: '64px',
          height: '4px',
          background: '#f59e0b',
          borderRadius: '2px',
        }}
      />

      {/* Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#94a3b8',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          {card.quarterLabel}
        </div>
        <div style={{ fontSize: '30px', fontWeight: 700, color: '#ffffff' }}>
          {card.businessName}
        </div>
        <div
          style={{
            fontSize: '72px',
            fontWeight: 900,
            color: '#f59e0b',
            lineHeight: 1,
            letterSpacing: '-3px',
          }}
        >
          {card.headlineStat}
        </div>
        <div style={{ fontSize: '20px', fontWeight: 500, color: '#94a3b8' }}>
          {card.headlineLabel}
        </div>
        {card.subtext && (
          <div style={{ fontSize: '16px', color: '#64748b' }}>
            {card.subtext}
          </div>
        )}
      </div>

      {/* Watermark */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#475569',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          Powered by Synthex
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 1200,
      headers: {
        'Content-Disposition': `inline; filename="synthex-effect-report-${periodSlug}.png"`,
        'Cache-Control': 'private, max-age=3600',
      },
    }
  );
}
