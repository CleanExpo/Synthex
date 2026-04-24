/**
 * POST /api/internal/deliver-monthly-geo-score-email
 *
 * Monthly GEO Score email delivery — called by the Edge Function cron on the 1st
 * of each month (08:00 AEDT / 21:00 UTC previous day).
 *
 * Algorithm:
 *   1. For each client with ≥2 client_geo_scores rows (current + prior month):
 *      a. current  = latest row
 *      b. prior    = most recent row older than 28 days
 *      c. delta    = current.score - prior.score
 *   2. delta ≥ +5  → send "improved" variant
 *      delta ≤ -5  → send "needs_attention" variant
 *      |delta| < 5 → skip (noise prevention)
 *   3. Fire GA4 Measurement Protocol event per email sent
 *
 * Requires env:
 *   CRON_SECRET                        — shared Bearer secret
 *   MONTHLY_GEO_SCORE_EMAIL_ENABLED    — must be "true"
 *   RESEND_API_KEY                     — Resend
 *   GA4_MEASUREMENT_ID                 — G-XXXXXXXX
 *   GA4_API_SECRET                     — GA4 Measurement Protocol secret
 *
 * @task SYN-658
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import prisma from '@/lib/prisma';
import {
  sendGeoScoreNotificationEmail,
  type GeoScoreTrendPoint,
  type GeoRecommendedAction,
} from '@/lib/email/geo-score-notification-email';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

// ── GA4 Measurement Protocol ──────────────────────────────────────────────────

async function fireGA4Event(
  clientId: string,
  eventName: string,
  params: Record<string, string | number>
): Promise<void> {
  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) return;

  await fetch(
    `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        events: [{ name: eventName, params }],
      }),
    }
  ).catch(() => {}); // non-fatal
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Feature flag
  if (process.env.MONTHLY_GEO_SCORE_EMAIL_ENABLED !== 'true') {
    return NextResponse.json({
      skipped: true,
      reason: 'feature flag disabled',
    });
  }

  // Auth
  const auth = verifyCronRequest(request, 'DELIVER_MONTHLY_GEO_SCORE_EMAIL');
  if (!auth.ok) return auth.response;

  const admin = getAdmin() as ReturnType<typeof createClient<any>>;
  const now = new Date();
  const priorCutoff = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000); // 28 days ago

  // Fetch all distinct client_ids that have at least one geo score row
  const { data: clientRows, error: clientErr } = await admin
    .from('client_geo_scores')
    .select('client_id')
    .order('client_id');

  if (clientErr) {
    console.error('[geo-email] Failed to fetch client list:', clientErr);
    return NextResponse.json(
      { error: 'DB error fetching clients' },
      { status: 500 }
    );
  }

  const clientIds = [
    ...new Set((clientRows ?? []).map((r: any) => r.client_id as string)),
  ];

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const clientId of clientIds) {
    try {
      // Current score — most recent row
      const { data: currentRows } = await admin
        .from('client_geo_scores')
        .select('score, trend_data, recommended_actions, computed_at')
        .eq('client_id', clientId)
        .order('computed_at', { ascending: false })
        .limit(1);

      const current = currentRows?.[0];
      if (!current) {
        skipped++;
        continue;
      }

      // Prior score — most recent row older than 28 days
      const { data: priorRows } = await admin
        .from('client_geo_scores')
        .select('score, computed_at')
        .eq('client_id', clientId)
        .lt('computed_at', priorCutoff.toISOString())
        .order('computed_at', { ascending: false })
        .limit(1);

      const prior = priorRows?.[0];
      if (!prior) {
        skipped++;
        continue;
      } // < 30 days of history

      const delta = Math.round(current.score - prior.score);

      // Noise gate: |delta| < 5 → skip
      if (Math.abs(delta) < 5) {
        skipped++;
        continue;
      }

      const variant = delta >= 5 ? 'improved' : 'needs_attention';

      // Resolve email address via Prisma
      const user = await prisma.user.findUnique({
        where: { id: clientId },
        select: { email: true, name: true },
      });

      if (!user?.email) {
        skipped++;
        continue;
      }

      const trendData: GeoScoreTrendPoint[] = Array.isArray(current.trend_data)
        ? current.trend_data
        : [];
      const recommendedActions: GeoRecommendedAction[] = Array.isArray(
        current.recommended_actions
      )
        ? current.recommended_actions
        : [];
      const businessName = user.name ?? 'Your business';

      const result = await sendGeoScoreNotificationEmail({
        to: user.email,
        businessName,
        variant,
        currentScore: Math.round(current.score),
        delta,
        trendData,
        recommendedActions,
      });

      if (result.success) {
        sent++;
        await fireGA4Event(clientId, 'geo_score_email_sent', {
          variant,
          score_delta: delta,
          current_score: Math.round(current.score),
        });
      } else {
        failed++;
        errors.push(`${clientId}: ${result.error}`);
      }
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${clientId}: ${msg}`);
    }
  }

  console.info(
    `[geo-email] done — sent:${sent} skipped:${skipped} failed:${failed}`
  );

  return NextResponse.json({
    sent,
    skipped,
    failed,
    ...(errors.length > 0 && { errors }),
  });
}
