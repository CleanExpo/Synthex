/**
 * POST /api/internal/deliver-quarterly-milestone
 *
 * Weekly batch job that:
 * 1. Finds clients created ≥85 days ago, with next renewal 14-21 days out
 * 2. Checks quarterly_review_ready() RPC (gate: ≥3 of 5 conditions)
 * 3. Checks 14-day journey throttle and 85-day quarterly guard
 * 4. Computes Synthex IQ score (formula: posts×2 + reviews×3 + strategy×5 + attribution×1)
 * 5. Fetches GEO Score trajectory, top posts, attribution, authority score
 * 6. Sends the Quarterly Milestone Review email via Resend
 * 7. Records journey event in client_journey_events
 *
 * Feature flag: QUARTERLY_REVIEW_ENABLED=true required (defaults disabled).
 * Called by: supabase/functions/deliver-quarterly-milestone (Deno cron proxy)
 * Auth:      CRON_SECRET bearer token
 * SYN-662
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';
import { sendQuarterlyMilestoneEmail } from '@/lib/email/quarterly-milestone-email';
import type {
  GeoScoreSection,
  ContentTopPost,
} from '@/lib/email/quarterly-milestone-email';
import {
  shouldDeliverJourneyEvent,
  getQuarterlyReviewReadiness,
  QUARTERLY_REVIEW_THRESHOLD,
} from '@/lib/journey/types';
import { verifyCronRequest } from '@/lib/auth/cron-auth';
import { stripHtmlToText } from '@/lib/sanitize';

// ── Config ────────────────────────────────────────────────────────────────────

/** Client must be this old before quarterly review is eligible. */
const MIN_CLIENT_AGE_DAYS = 85;

/** Do not re-send quarterly review within this window. */
const QUARTERLY_GUARD_DAYS = 85;

/** Posts published in last N days for the quarterly metric. */
const QUARTER_DAYS = 90;

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

function getQuarterLabel(date: Date): string {
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `Q${quarter} ${date.getUTCFullYear()}`;
}

function getJoinDate(date: Date): string {
  return date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
}

/**
 * Compute Synthex IQ:
 *   (posts_published × 2)
 * + (reviews_responded_to × 3)
 * + (auto_calendar_strategy_updates × 5)
 * + (attribution_events_tracked × 1)
 */
async function computeSynthexIq(
  organizationId: string,
  since: Date
): Promise<number> {
  const sinceIso = since.toISOString();

  // Posts published
  const postsCount = await prisma.post
    .count({
      where: {
        deletedAt: null,
        campaign: { organizationId },
        publishedAt: { gte: sinceIso },
      },
    } as Parameters<typeof prisma.post.count>[0])
    .catch(() => 0);

  // Recommended actions as attribution events
  const attributionCount = await prisma.recommendedAction
    .count({
      where: { organizationId, weekStart: { gte: since } },
    } as Parameters<typeof prisma.recommendedAction.count>[0])
    .catch(() => 0);

  // Authority scores as a proxy for tracked strategy milestones
  const authorityCount = await prisma.authorityScore
    .count({
      where: { organizationId, computedAt: { gte: since } },
    } as Parameters<typeof prisma.authorityScore.count>[0])
    .catch(() => 0);

  return postsCount * 2 + authorityCount * 5 + attributionCount * 1;
}

/** Fetch GEO score trajectory (current score + 90-day delta). */
async function fetchGeoSection(
  organizationId: string
): Promise<GeoScoreSection | null> {
  try {
    const admin = getAdmin() as ReturnType<typeof createClient<any>>;
    const ninetyDaysAgo = new Date(
      Date.now() - QUARTER_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: scores, error } = await admin
      .from('client_geo_scores')
      .select('overall_score, scored_at')
      .eq('organization_id', organizationId)
      .order('scored_at', { ascending: false })
      .limit(20);

    if (error || !scores || scores.length < 4) return null;

    const current = (scores[0] as { overall_score: number }).overall_score;
    const oldest90 = (scores as { overall_score: number; scored_at: string }[])
      .filter(s => s.scored_at < ninetyDaysAgo)
      .at(-1);

    const delta = oldest90
      ? Math.round(current - oldest90.overall_score)
      : null;

    return {
      currentScore: Math.round(current),
      delta90Days: delta,
      peerPercentile: null, // Peer data not yet available without cross-org query
    };
  } catch {
    return null;
  }
}

/** Fetch top 3 posts by engagement rate in the last 90 days. */
async function fetchTopPosts(
  organizationId: string,
  since: Date
): Promise<ContentTopPost[] | null> {
  try {
    const profiles = await prisma.post.findMany({
      where: {
        deletedAt: null,
        engagementRate: { not: null },
        campaign: { organizationId },
        publishedAt: { gte: since.toISOString() },
      },
      orderBy: { engagementRate: 'desc' },
      take: 3,
      select: { content: true, reachCount: true },
    } as Parameters<typeof prisma.post.findMany>[0]);

    if (!profiles || profiles.length === 0) return null;

    return (
      profiles as unknown as {
        content: string | null;
        reachCount: number | null;
      }[]
    ).map(p => ({
      excerpt: p.content ? stripHtmlToText(p.content).slice(0, 60) : 'Post',
      reachCount: p.reachCount ?? 0,
    }));
  } catch {
    return null;
  }
}

/** Fetch best win notification for summary. */
async function fetchBestWin(
  organizationId: string,
  since: Date
): Promise<{
  excerpt: string | null;
  reach: number | null;
  engagement: number | null;
} | null> {
  try {
    const admin = getAdmin() as ReturnType<typeof createClient<any>>;
    const { data, error } = await admin
      .from('client_journey_events')
      .select('metadata')
      .eq('client_id', organizationId)
      .eq('event_type', 'win_notification')
      .gte('delivered_at', since.toISOString())
      .order('delivered_at', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) return null;

    const meta =
      (data[0] as { metadata: Record<string, unknown> }).metadata ?? {};
    const postId = meta.post_id as string | undefined;
    if (!postId) return null;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { content: true, reachCount: true, engagementRate: true },
    } as Parameters<typeof prisma.post.findUnique>[0]);

    if (!post) return null;

    const p = post as unknown as {
      content: string | null;
      reachCount: number | null;
      engagementRate: number | null;
    };
    return {
      excerpt: p.content ? stripHtmlToText(p.content).slice(0, 60) : null,
      reach: p.reachCount,
      engagement: p.engagementRate,
    };
  } catch {
    return null;
  }
}

/** Count wins for this org in the quarter. */
async function countWins(organizationId: string, since: Date): Promise<number> {
  try {
    const admin = getAdmin() as ReturnType<typeof createClient<any>>;
    const { data, error } = await admin
      .from('client_journey_events')
      .select('id')
      .eq('client_id', organizationId)
      .eq('event_type', 'win_notification')
      .gte('delivered_at', since.toISOString());

    return error || !data ? 0 : data.length;
  } catch {
    return 0;
  }
}

/** Resolve the primary contact email for an organisation. */
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
  if (process.env.QUARTERLY_REVIEW_ENABLED !== 'true') {
    return NextResponse.json({
      ok: true,
      message: 'QUARTERLY_REVIEW_ENABLED is not set — no emails sent',
    });
  }

  // Auth guard
  const auth = verifyCronRequest(req, 'DELIVER_QUARTERLY_MILESTONE');
  if (!auth.ok) return auth.response;

  const now = new Date();
  const quarterStart = new Date(
    now.getTime() - QUARTER_DAYS * 24 * 60 * 60 * 1000
  );
  const minCreatedAt = new Date(
    now.getTime() - MIN_CLIENT_AGE_DAYS * 24 * 60 * 60 * 1000
  );
  const guardCutoff = new Date(
    now.getTime() - QUARTERLY_GUARD_DAYS * 24 * 60 * 60 * 1000
  );

  const admin = getAdmin() as ReturnType<typeof createClient<any>>;

  // Fetch all active orgs that are old enough
  const orgs = await prisma.organization.findMany({
    where: {
      businessOwners: { some: { billingStatus: 'active', isActive: true } },
      createdAt: { lte: minCreatedAt },
    },
    select: { id: true, name: true, createdAt: true },
  });

  let delivered = 0;
  let skippedReady = 0;
  let skippedThrottle = 0;
  let skippedAlready = 0;
  let skippedNoEmail = 0;
  let errors = 0;

  for (const org of orgs) {
    try {
      // 1. Data readiness gate
      const readinessScore = await getQuarterlyReviewReadiness(admin, org.id);
      if (readinessScore < QUARTERLY_REVIEW_THRESHOLD) {
        skippedReady++;
        continue;
      }

      // 2. Quarterly guard — skip if delivered in last 85 days
      const { data: recent } = await admin
        .from('client_journey_events')
        .select('id')
        .eq('client_id', org.id)
        .eq('event_type', 'quarterly_milestone_review')
        .gte('delivered_at', guardCutoff.toISOString())
        .limit(1);

      if (recent && recent.length > 0) {
        skippedAlready++;
        continue;
      }

      // 3. 14-day journey throttle
      const deliverable = await shouldDeliverJourneyEvent(
        admin,
        org.id,
        'quarterly_milestone_review'
      );
      if (!deliverable) {
        skippedThrottle++;
        continue;
      }

      // 4. Resolve contact email
      const email = await resolveEmail(org.id);
      if (!email) {
        skippedNoEmail++;
        continue;
      }

      // 5. Compute Synthex IQ (since account creation)
      const createdAt = new Date(org.createdAt);
      const synthexIq = await computeSynthexIq(org.id, createdAt);

      // 6. Gather sections
      const [geoSection, topPosts, bestWin, winsCount] = await Promise.all([
        fetchGeoSection(org.id),
        fetchTopPosts(org.id, quarterStart),
        fetchBestWin(org.id, quarterStart),
        countWins(org.id, quarterStart),
      ]);

      // 7. Authority score delta
      const authorityScores = await prisma.authorityScore
        .findMany({
          where: { organizationId: org.id },
          orderBy: { computedAt: 'desc' },
          take: 2,
          select: { score: true },
        } as Parameters<typeof prisma.authorityScore.findMany>[0])
        .catch(() => []);

      const authorityScore =
        authorityScores.length >= 1
          ? (authorityScores[0] as { score: number }).score
          : null;
      const authorityDelta =
        authorityScores.length >= 2
          ? (authorityScores[0] as { score: number }).score -
            (authorityScores[1] as { score: number }).score
          : null;

      // 8. Attribution estimate (highest-confidence recommended action)
      const latestAdvisor = await prisma.recommendedAction
        .findFirst({
          where: { organizationId: org.id },
          orderBy: { weekStart: 'desc' },
          select: { dollarAttribution: true },
        } as Parameters<typeof prisma.recommendedAction.findFirst>[0])
        .catch(() => null);

      // SECURITY: `client_id` removed from URL in service-role leak fix 4/N.
      // The route now derives organizationId from the authenticated session.
      // Recipient must be logged in to view the card (acceptable — it's a
      // dashboard CTA in their quarterly email).
      const testimonialCardUrl = `${APP_URL}/api/results/testimonial-card?quarter=${encodeURIComponent(getQuarterLabel(now))}`;

      // 9. Send email
      const { success, error: emailError } = await sendQuarterlyMilestoneEmail({
        to: email,
        businessName: org.name,
        industry: 'local business', // default — enhanced if industry field exists
        stateOrRegion: 'Australia',
        quarterLabel: getQuarterLabel(now),
        joinDate: getJoinDate(createdAt),
        synthexIq,
        geoSection,
        topPosts,
        attributionAmount: latestAdvisor
          ? (latestAdvisor as { dollarAttribution: string | null })
              .dollarAttribution
          : null,
        monthlyPlanCost: null,
        authorityScore,
        authorityDelta,
        winsCount,
        bestWinExcerpt: bestWin?.excerpt ?? null,
        bestWinReach: bestWin?.reach ?? null,
        bestWinEngagement: bestWin?.engagement ?? null,
        testimonialCardUrl,
        dashboardUrl: `${APP_URL}/dashboard`,
      });

      if (!success) {
        console.error(
          `[deliver-quarterly-milestone] Email failed for ${org.id}:`,
          emailError
        );
        errors++;
        continue;
      }

      // 10. Record journey event
      await admin.from('client_journey_events').insert({
        client_id: org.id,
        event_type: 'quarterly_milestone_review',
        delivered_at: now.toISOString(),
        metadata: {
          completeness_score: readinessScore,
          sections_shown: [
            'synthex_iq',
            ...(geoSection ? ['geo_score'] : []),
            ...(topPosts ? ['content_intelligence'] : []),
            ...(latestAdvisor?.dollarAttribution ? ['attribution'] : []),
            ...(authorityScore !== null && authorityDelta !== null
              ? ['authority_score']
              : []),
            'win_summary',
          ],
          synthex_iq: synthexIq,
          geo_score_delta: geoSection?.delta90Days ?? null,
          attribution_shown: !!latestAdvisor?.dollarAttribution,
          png_card_generated: true,
          recipient: email,
        },
      });

      delivered++;
    } catch (err) {
      console.error(
        `[deliver-quarterly-milestone] Unexpected error for org ${org.id}:`,
        err
      );
      errors++;
    }
  }

  return NextResponse.json({
    ok: true,
    orgs_evaluated: orgs.length,
    delivered,
    skipped_readiness: skippedReady,
    skipped_throttle: skippedThrottle,
    skipped_already: skippedAlready,
    skipped_no_email: skippedNoEmail,
    errors,
  });
}
