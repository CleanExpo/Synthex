/**
 * POST /api/internal/deliver-win-notifications
 *
 * Daily batch job that:
 * 1. Finds posts published in the last 24h for each active organisation
 * 2. Checks if any post ranks in the top-10% of that org's 30-day engagement history
 * 3. Applies 14-day journey event throttle (should_deliver_journey_event RPC)
 * 4. Sends Win Notification email via Resend
 * 5. Inserts 'win_notification' record into client_journey_events
 *
 * Called by: supabase/functions/deliver-win-notifications (Deno cron proxy)
 * Auth:      CRON_SECRET bearer token
 * SYN-671
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { sendWinNotificationEmail } from '@/lib/email/win-notification-email';
import { verifyCronRequest } from '@/lib/auth/cron-auth';
import { stripHtmlToText } from '@/lib/sanitize';

// ── Config ────────────────────────────────────────────────────────────────────

/** Posts published within this window are eligible for win detection */
const LOOKBACK_HOURS = 24;

/**
 * Top-10% threshold: a post qualifies as a "win" when its engagement_rate
 * exceeds the 90th percentile of the client's last 30 posts.
 */
const WIN_PERCENTILE = 0.9;

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

interface RecentPost {
  id: string;
  content: string | null;
  published_at: string;
  engagement_rate: number | null;
  platform: string | null;
}

/**
 * Fetch posts published in the last LOOKBACK_HOURS for an organisation.
 */
async function fetchRecentPosts(organizationId: string): Promise<RecentPost[]> {
  const cutoff = new Date(
    Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await (
    getAdmin() as ReturnType<typeof createClient<any>>
  )
    .from('posts')
    .select('id, content, published_at, engagement_rate, platform')
    .eq('organization_id', organizationId)
    .gte('published_at', cutoff)
    .not('engagement_rate', 'is', null)
    .order('published_at', { ascending: false })
    .limit(20);

  if (error || !data) return [];
  return data as RecentPost[];
}

/**
 * Compute the 90th percentile engagement_rate from the last 30 published posts.
 * Returns null when fewer than 5 posts exist (insufficient baseline).
 */
async function compute90thPercentile(
  organizationId: string
): Promise<number | null> {
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await (
    getAdmin() as ReturnType<typeof createClient<any>>
  )
    .from('posts')
    .select('engagement_rate')
    .eq('organization_id', organizationId)
    .gte('published_at', thirtyDaysAgo)
    .not('engagement_rate', 'is', null)
    .order('engagement_rate', { ascending: true })
    .limit(30);

  if (error || !data || data.length < 5) return null;

  const rates: number[] = (data as { engagement_rate: number }[]).map(
    r => r.engagement_rate
  );
  const idx = Math.floor(rates.length * WIN_PERCENTILE);
  return rates[Math.min(idx, rates.length - 1)];
}

/**
 * Check the 14-day journey event throttle via Supabase RPC.
 */
async function canDeliver(clientId: string): Promise<boolean> {
  try {
    const { data, error } = await (
      getAdmin() as ReturnType<typeof createClient<any>>
    ).rpc('should_deliver_journey_event', {
      p_client_id: clientId,
      p_event_type: 'win_notification',
    });

    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

/**
 * Resolve the primary contact email for an organisation.
 * Uses org owner's email via Prisma (same pattern as journey email routes).
 */
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

/**
 * Build a plain-English post label from platform + published_at.
 * e.g. "your Instagram post from yesterday"
 */
function buildPostLabel(post: RecentPost): string {
  const platform = post.platform ?? 'content';
  const hoursAgo = Math.round(
    (Date.now() - new Date(post.published_at).getTime()) / (60 * 60 * 1000)
  );

  const when =
    hoursAgo <= 6
      ? 'a few hours ago'
      : hoursAgo <= 26
        ? 'yesterday'
        : `${Math.floor(hoursAgo / 24)} days ago`;

  return `your ${platform} post from ${when}`;
}

/**
 * Extract a 60-char excerpt from post content.
 */
function buildExcerpt(content: string | null): string {
  if (!content) return 'Your recent post';
  const stripped = stripHtmlToText(content);
  return stripped.length > 60 ? stripped.slice(0, 57) + '…' : stripped;
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Auth guard
  const auth = verifyCronRequest(req, 'DELIVER_WIN_NOTIFICATIONS');
  if (!auth.ok) return auth.response;

  // Fetch all active organisations (billing_status = 'active' on BusinessOwnership)
  const orgs = await prisma.organization.findMany({
    where: {
      businessOwners: { some: { billingStatus: 'active', isActive: true } },
    },
    select: { id: true, name: true },
  });

  let delivered = 0;
  let skippedNoWin = 0;
  let skippedThrottle = 0;
  let skippedNoEmail = 0;
  let errors = 0;

  for (const org of orgs) {
    try {
      // 1. Check throttle first (cheapest check)
      const deliverable = await canDeliver(org.id);
      if (!deliverable) {
        skippedThrottle++;
        continue;
      }

      // 2. Get 90th percentile baseline
      const p90 = await compute90thPercentile(org.id);
      if (p90 === null) {
        skippedNoWin++;
        continue; // Not enough post history
      }

      // 3. Find a qualifying post from the last 24h
      const recentPosts = await fetchRecentPosts(org.id);
      const winner = recentPosts.find(
        p => p.engagement_rate !== null && p.engagement_rate > p90
      );

      if (!winner) {
        skippedNoWin++;
        continue;
      }

      // 4. Resolve contact email
      const email = await resolveEmail(org.id);
      if (!email) {
        skippedNoEmail++;
        continue;
      }

      // 5. Send email
      const postLabel = buildPostLabel(winner);
      const postExcerpt = buildExcerpt(winner.content);
      const winDescription =
        'reached more locals than 9 out of 10 of your recent posts';

      const { success, error: emailError } = await sendWinNotificationEmail({
        to: email,
        businessName: org.name,
        postExcerpt,
        postLabel,
        winDescription,
        calendarUrl: `${APP_URL}/dashboard/calendar`,
      });

      if (!success) {
        console.error(
          `[deliver-win-notifications] Email failed for ${org.id}:`,
          emailError
        );
        errors++;
        continue;
      }

      // 6. Record journey event (prevents duplicate within 14 days)
      await (getAdmin() as ReturnType<typeof createClient<any>>)
        .from('client_journey_events')
        .insert({
          client_id: org.id,
          event_type: 'win_notification',
          delivered_at: new Date().toISOString(),
          metadata: {
            post_id: winner.id,
            engagement_rate: winner.engagement_rate,
            p90_baseline: p90,
            recipient: email,
          },
        });

      delivered++;
    } catch (err) {
      console.error(
        `[deliver-win-notifications] Unexpected error for org ${org.id}:`,
        err
      );
      errors++;
    }
  }

  return NextResponse.json({
    ok: true,
    orgs_evaluated: orgs.length,
    delivered,
    skipped_no_win: skippedNoWin,
    skipped_throttle: skippedThrottle,
    skipped_no_email: skippedNoEmail,
    errors,
  });
}
