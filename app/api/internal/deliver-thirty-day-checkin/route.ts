/**
 * POST /api/internal/deliver-thirty-day-checkin
 *
 * Daily batch job that:
 * 1. Finds active organisations with created_at in the 28–45 day window
 * 2. Checks the 14-day journey event throttle (should_deliver_journey_event RPC)
 * 3. Fetches GEO Score from client_geo_scores (conditional section)
 * 4. Counts win_notification events (conditional section)
 * 5. Sends the 30-Day Check-In email via Resend (adaptive subject line)
 * 6. Records the journey event in client_journey_events
 *
 * Hard cutoff: orgs at day 46+ receive a skipped record (no email).
 * Feature flag: THIRTY_DAY_CHECKIN_ENABLED=false disables sending (defaults off).
 *
 * Called by: supabase/functions/deliver-thirty-day-checkin (Deno cron proxy)
 * Auth:      CRON_SECRET bearer token
 * SYN-661
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';
import {
  sendThirtyDayCheckinEmail,
  getSubjectVariant,
} from '@/lib/email/thirty-day-checkin-email';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

// ── Config ────────────────────────────────────────────────────────────────────

/** Organisations with created_at in this window receive the 30-day check-in. */
const WINDOW_MIN_DAYS = 28;
const WINDOW_MAX_DAYS = 45;

/** Day 46+ → write skipped record, no email. */
const HARD_CUTOFF_DAYS = 46;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthex.social';

// ── Supabase admin singleton ──────────────────────────────────────────────────

let _admin: SupabaseClient | null = null;

function getAdmin(): SupabaseClient {
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

/** Fetch the latest GEO Score for a client (null if no data). */
async function fetchGeoScore(organizationId: string): Promise<number | null> {
  try {
    const { data, error } = await (
      getAdmin() as ReturnType<typeof createClient<any>>
    )
      .from('client_geo_scores')
      .select('overall_score')
      .eq('organization_id', organizationId)
      .order('scored_at', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) return null;
    const score = (data[0] as { overall_score: number | null }).overall_score;
    return typeof score === 'number' ? Math.round(score) : null;
  } catch {
    return null;
  }
}

/** Count win_notification events for a client before a given date. */
async function fetchWinsCount(
  organizationId: string,
  beforeDate: Date
): Promise<number> {
  try {
    const { data, error } = await (
      getAdmin() as ReturnType<typeof createClient<any>>
    )
      .from('client_journey_events')
      .select('id')
      .eq('client_id', organizationId)
      .eq('event_type', 'win_notification')
      .lt('delivered_at', beforeDate.toISOString());

    if (error || !data) return 0;
    return data.length;
  } catch {
    return 0;
  }
}

/** Check the 14-day journey event throttle via Supabase RPC. */
async function canDeliver(
  clientId: string,
  eventType: string
): Promise<boolean> {
  try {
    const { data, error } = await (
      getAdmin() as ReturnType<typeof createClient<any>>
    ).rpc('should_deliver_journey_event', {
      p_client_id: clientId,
      p_event_type: eventType,
    });

    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

/** Check whether this org has already received a thirty_day_check_in event. */
async function alreadyDelivered(organizationId: string): Promise<boolean> {
  try {
    const { data, error } = await (
      getAdmin() as ReturnType<typeof createClient<any>>
    )
      .from('client_journey_events')
      .select('id')
      .eq('client_id', organizationId)
      .eq('event_type', 'thirty_day_check_in')
      .limit(1);

    return !error && Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

/** Write a skipped record when the org has passed the day-46 hard cutoff. */
async function writeSkippedRecord(
  organizationId: string,
  actualDay: number
): Promise<void> {
  try {
    await (getAdmin() as ReturnType<typeof createClient<any>>)
      .from('client_journey_events')
      .insert({
        client_id: organizationId,
        event_type: 'thirty_day_check_in',
        delivered_at: new Date().toISOString(),
        metadata: {
          skipped: true,
          reason: 'throttle_cutoff',
          actual_day: actualDay,
        },
      });
  } catch (err) {
    console.error(
      '[deliver-thirty-day-checkin] Failed to write skipped record:',
      err
    );
  }
}

/** Resolve the primary contact email for an organisation via Prisma. */
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
  // Feature flag guard (copy approval gate — defaults off)
  if (process.env.THIRTY_DAY_CHECKIN_ENABLED !== 'true') {
    return NextResponse.json({
      ok: true,
      message: 'THIRTY_DAY_CHECKIN_ENABLED is not set — no emails sent',
    });
  }

  // Auth guard
  const auth = verifyCronRequest(req, 'DELIVER_THIRTY_DAY_CHECKIN');
  if (!auth.ok) return auth.response;

  const now = new Date();

  // Window: orgs created 28–45 days ago are candidates
  const minCreatedAt = new Date(
    now.getTime() - WINDOW_MAX_DAYS * 24 * 60 * 60 * 1000
  );
  const maxCreatedAt = new Date(
    now.getTime() - WINDOW_MIN_DAYS * 24 * 60 * 60 * 1000
  );
  // Hard cutoff: orgs created 46+ days ago are overdue → write skipped
  const cutoffDate = new Date(
    now.getTime() - HARD_CUTOFF_DAYS * 24 * 60 * 60 * 1000
  );

  // Fetch eligible orgs: active, created in window OR past cutoff (to write skipped records)
  const orgs = await prisma.organization.findMany({
    where: {
      businessOwners: { some: { billingStatus: 'active', isActive: true } },
      createdAt: { gte: cutoffDate }, // only look back HARD_CUTOFF_DAYS max
    },
    select: { id: true, name: true, createdAt: true },
  });

  let delivered = 0;
  let skippedThrottle = 0;
  let skippedAlready = 0;
  let skippedCutoff = 0;
  let skippedNoEmail = 0;
  let errors = 0;

  for (const org of orgs) {
    try {
      const createdAt = new Date(org.createdAt);
      const ageMs = now.getTime() - createdAt.getTime();
      const actualDay = Math.floor(ageMs / (24 * 60 * 60 * 1000));

      // Skip if already delivered
      if (await alreadyDelivered(org.id)) {
        skippedAlready++;
        continue;
      }

      // Hard cutoff: org is past day 45 without having received check-in → write skipped
      if (actualDay >= HARD_CUTOFF_DAYS) {
        await writeSkippedRecord(org.id, actualDay);
        skippedCutoff++;
        continue;
      }

      // Only send to orgs in the 28–45 day window
      if (actualDay < WINDOW_MIN_DAYS) continue;

      // 14-day throttle check
      const deliverable = await canDeliver(org.id, 'thirty_day_check_in');
      if (!deliverable) {
        skippedThrottle++;
        continue;
      }

      // Resolve contact email
      const email = await resolveEmail(org.id);
      if (!email) {
        skippedNoEmail++;
        continue;
      }

      // Fetch conditional data
      const geoScore = await fetchGeoScore(org.id);
      const winsCount = await fetchWinsCount(org.id, now);

      // Send email
      const variant = getSubjectVariant(actualDay);
      const { success, error: emailError } = await sendThirtyDayCheckinEmail({
        to: email,
        businessName: org.name,
        actualSendDay: actualDay,
        geoScore,
        winsCount,
        dashboardUrl: `${APP_URL}/dashboard`,
        calendarUrl: `${APP_URL}/dashboard/calendar`,
      });

      if (!success) {
        console.error(
          `[deliver-thirty-day-checkin] Email failed for ${org.id}:`,
          emailError
        );
        errors++;
        continue;
      }

      // Record journey event
      await (getAdmin() as ReturnType<typeof createClient<any>>)
        .from('client_journey_events')
        .insert({
          client_id: org.id,
          event_type: 'thirty_day_check_in',
          delivered_at: now.toISOString(),
          metadata: {
            actual_send_day: actualDay,
            subject_line_variant: variant,
            geo_score_shown: geoScore !== null,
            geo_score_value: geoScore,
            wins_count: winsCount,
            recipient: email,
          },
        });

      delivered++;
    } catch (err) {
      console.error(
        `[deliver-thirty-day-checkin] Unexpected error for org ${org.id}:`,
        err
      );
      errors++;
    }
  }

  return NextResponse.json({
    ok: true,
    orgs_evaluated: orgs.length,
    delivered,
    skipped_already: skippedAlready,
    skipped_throttle: skippedThrottle,
    skipped_cutoff: skippedCutoff,
    skipped_no_email: skippedNoEmail,
    errors,
  });
}
