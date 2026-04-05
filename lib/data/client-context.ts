/**
 * Client Data Access Layer — ClientContext
 * SYN-687: Unified data access layer for AI prompt injection and dashboard use.
 *
 * Key design decisions:
 * - All 12 domain queries fire in parallel via Promise.allSettled.
 * - Each query has an individual 3 s hard timeout.
 * - Any timeout or error produces { available: false } — never throws.
 * - toPromptContext serialises to plain text within a configurable token budget.
 * - getClientDetail provides paginated raw access to any domain.
 */

import { prisma } from '@/lib/prisma';
import type {
  ClientContext,
  ClientDataDomain,
  ClientProfile,
  DetailOptions,
  DetailResult,
  PostsSummary,
  CalendarSummary,
  ReviewsSummary,
  AuthoritySummary,
  SeasonalSummary,
  GEOSummary,
  JourneySummary,
  HealthSummary,
  DigestSummary,
  NotificationsSummary,
  UnavailableSummary,
} from './types';

// ── Timeout helper ────────────────────────────────────────────────────────────

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms)
    ),
  ]);
}

const QUERY_TIMEOUT_MS = 3000;

function unavailable(err: unknown): UnavailableSummary {
  const msg = err instanceof Error ? err.message : String(err);
  const reason: 'timeout' | 'error' = msg === 'timeout' ? 'timeout' : 'error';
  return { available: false, reason, error: msg };
}

// ── Domain query helpers ──────────────────────────────────────────────────────

async function queryPosts(
  clientId: string
): Promise<PostsSummary | UnavailableSummary> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // CalendarPost is the primary content entity for org-scoped posts
  const [all, last30, last7] = await Promise.all([
    prisma.calendarPost.findMany({
      where: { organizationId: clientId },
      select: {
        status: true,
        platforms: true,
        analytics: true,
        title: true,
        createdAt: true,
      },
    }),
    prisma.calendarPost.count({
      where: {
        organizationId: clientId,
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.calendarPost.count({
      where: {
        organizationId: clientId,
        createdAt: { gte: sevenDaysAgo },
      },
    }),
  ]);

  const published = all.filter(p => p.status === 'published').length;
  const draft = all.filter(p => p.status === 'draft').length;

  // Platform breakdown
  const platformBreakdown: Record<string, number> = {};
  for (const p of all) {
    for (const platform of p.platforms) {
      platformBreakdown[platform] = (platformBreakdown[platform] ?? 0) + 1;
    }
  }

  // Avg engagement rate from analytics JSON field (best-effort)
  let totalEngagement = 0;
  let engagementCount = 0;
  for (const p of all) {
    const analytics = p.analytics as Record<string, unknown> | null;
    if (analytics && typeof analytics['engagementRate'] === 'number') {
      totalEngagement += analytics['engagementRate'];
      engagementCount++;
    }
  }
  const avgEngagementRate =
    engagementCount > 0 ? totalEngagement / engagementCount : 0;

  // Top performing topic — most common word in title (naïve heuristic)
  const titleWords: Record<string, number> = {};
  for (const p of all) {
    const words = (p.title ?? '')
      .toLowerCase()
      .split(/\W+/)
      .filter(w => w.length > 4);
    for (const w of words) {
      titleWords[w] = (titleWords[w] ?? 0) + 1;
    }
  }
  const topPerformingTopic =
    Object.entries(titleWords).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    available: true,
    totalPosts: all.length,
    last30Days: last30,
    last7Days: last7,
    topPerformingTopic,
    avgEngagementRate,
    publishedVsDraft: { published, draft },
    platformBreakdown,
  };
}

async function queryCalendar(clientId: string): Promise<CalendarSummary> {
  const now = new Date();

  const [upcoming, overdue] = await Promise.all([
    prisma.calendarPost.count({
      where: {
        organizationId: clientId,
        status: { in: ['draft', 'scheduled'] },
        scheduledFor: { gt: now },
      },
    }),
    prisma.calendarPost.count({
      where: {
        organizationId: clientId,
        status: { in: ['draft', 'scheduled'] },
        scheduledFor: { lt: now },
      },
    }),
  ]);

  const nextPost = await prisma.calendarPost.findFirst({
    where: {
      organizationId: clientId,
      status: { in: ['draft', 'scheduled'] },
      scheduledFor: { gt: now },
    },
    orderBy: { scheduledFor: 'asc' },
    select: { scheduledFor: true },
  });

  return {
    available: true,
    upcomingPosts: upcoming,
    overdueCount: overdue,
    nextScheduledDate: nextPost?.scheduledFor?.toISOString() ?? null,
  };
}

async function queryReviews(clientId: string): Promise<ReviewsSummary> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [all, last30] = await Promise.all([
    prisma.gBPReview.findMany({
      where: { organizationId: clientId },
      select: { rating: true, replyText: true, createdAt: true },
    }),
    prisma.gBPReview.count({
      where: {
        organizationId: clientId,
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
  ]);

  const totalReviews = all.length;
  const avgRating =
    totalReviews > 0
      ? all.reduce((sum, r) => sum + r.rating, 0) / totalReviews
      : 0;
  const replied = all.filter(r => r.replyText != null).length;
  const responseRate = totalReviews > 0 ? replied / totalReviews : 0;

  return {
    available: true,
    totalReviews,
    avgRating: Math.round(avgRating * 10) / 10,
    last30Days: last30,
    responseRate: Math.round(responseRate * 100) / 100,
  };
}

async function queryAuthority(clientId: string): Promise<AuthoritySummary> {
  const latest = await prisma.authorityScore.findFirst({
    where: { organizationId: clientId },
    orderBy: { computedAt: 'desc' },
    select: { score: true, computedAt: true },
  });

  if (!latest) {
    return { available: true, latestScore: null, trend: null };
  }

  // Get previous score to compute trend
  const previous = await prisma.authorityScore.findFirst({
    where: {
      organizationId: clientId,
      computedAt: { lt: latest.computedAt },
    },
    orderBy: { computedAt: 'desc' },
    select: { score: true },
  });

  let trend: 'up' | 'down' | 'stable' | null = null;
  if (previous) {
    if (latest.score > previous.score) trend = 'up';
    else if (latest.score < previous.score) trend = 'down';
    else trend = 'stable';
  }

  return {
    available: true,
    latestScore: latest.score,
    trend,
  };
}

async function querySeasonal(clientId: string): Promise<SeasonalSummary> {
  // Get org details for industry + state filtering
  const org = await prisma.organization.findUnique({
    where: { id: clientId },
    select: { industry: true },
  });

  const now = new Date();
  const industry = org?.industry ?? null;

  // Query signals relevant to this org's industry
  const signals = await prisma.seasonalSignal.findMany({
    where: {
      ...(industry ? { industrySlug: industry } : {}),
      windowEnd: { gte: now },
      dismissals: {
        none: { organizationId: clientId },
      },
    },
    orderBy: { windowStart: 'asc' },
    take: 10,
    select: { opportunityLabel: true, windowStart: true, windowEnd: true },
  });

  const activeSignals = signals.filter(
    s => s.windowStart <= now && s.windowEnd >= now
  ).length;

  const upcomingEvents = signals
    .filter(s => s.windowStart > now)
    .map(s => s.opportunityLabel)
    .slice(0, 5);

  return {
    available: true,
    activeSignals,
    upcomingEvents,
  };
}

async function queryGEO(clientId: string): Promise<GEOSummary> {
  // GEOAnalysis is user-scoped. Resolve the primary user for this org first.
  const org = await prisma.organization.findUnique({
    where: { id: clientId },
    select: { users: { take: 1, select: { id: true } } },
  });

  const userId = org?.users?.[0]?.id;
  if (!userId) {
    return { available: true, score: null, band: null };
  }

  const latest = await prisma.gEOAnalysis.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { overallScore: true },
  });

  if (!latest) {
    return { available: true, score: null, band: null };
  }

  const score = latest.overallScore;
  let band: string;
  if (score >= 80) band = 'excellent';
  else if (score >= 60) band = 'good';
  else if (score >= 40) band = 'fair';
  else band = 'needs-work';

  return { available: true, score, band };
}

async function queryJourney(clientId: string): Promise<JourneySummary> {
  // OnboardingProgress holds current stage and completion timestamps
  const progress = await prisma.onboardingProgress.findFirst({
    where: { organizationId: clientId },
    orderBy: { createdAt: 'desc' },
    select: { currentStage: true, createdAt: true, completedAt: true },
  });

  if (!progress) {
    return { available: true, currentStage: null, daysSinceOnboarding: null };
  }

  const anchor = progress.completedAt ?? progress.createdAt;
  const daysSinceOnboarding = Math.floor(
    (Date.now() - anchor.getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    available: true,
    currentStage: progress.currentStage,
    daysSinceOnboarding,
  };
}

async function queryHealth(clientId: string): Promise<HealthSummary> {
  const latest = await prisma.clientHealthScore.findFirst({
    where: { organizationId: clientId },
    orderBy: { weekStart: 'desc' },
    select: { overallScore: true, weekStart: true },
  });

  if (!latest) {
    return { available: true, overallScore: null, weekStart: null };
  }

  return {
    available: true,
    overallScore: latest.overallScore,
    weekStart: latest.weekStart.toISOString(),
  };
}

async function queryDigest(clientId: string): Promise<DigestSummary> {
  // AIWeeklyDigest is user-scoped. Resolve via org users.
  const org = await prisma.organization.findUnique({
    where: { id: clientId },
    select: { users: { take: 1, select: { id: true } } },
  });

  const userId = org?.users?.[0]?.id;
  if (!userId) {
    return { available: true, lastDelivered: null, totalDelivered: 0 };
  }

  const [total, latest] = await Promise.all([
    prisma.aIWeeklyDigest.count({ where: { userId, emailSent: true } }),
    prisma.aIWeeklyDigest.findFirst({
      where: { userId, emailSent: true },
      orderBy: { emailSentAt: 'desc' },
      select: { emailSentAt: true },
    }),
  ]);

  return {
    available: true,
    lastDelivered: latest?.emailSentAt?.toISOString() ?? null,
    totalDelivered: total,
  };
}

async function queryNotifications(
  clientId: string
): Promise<NotificationsSummary> {
  // Notification is user-scoped. Resolve via org users.
  const org = await prisma.organization.findUnique({
    where: { id: clientId },
    select: { users: { take: 1, select: { id: true } } },
  });

  const userId = org?.users?.[0]?.id;
  if (!userId) {
    return { available: true, unreadCount: 0, lastNotificationAt: null };
  }

  const [unreadCount, latest] = await Promise.all([
    prisma.notification.count({ where: { userId, read: false } }),
    prisma.notification.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);

  return {
    available: true,
    unreadCount,
    lastNotificationAt: latest?.createdAt?.toISOString() ?? null,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Assemble a full ClientContext for the given organisation ID.
 * All 12 queries run in parallel with a 3 s per-query timeout.
 * Failed queries return { available: false } — this function never throws.
 */
export async function getClientContext(
  clientId: string
): Promise<ClientContext> {
  const [
    postsResult,
    calendarResult,
    reviewsResult,
    authorityResult,
    seasonalResult,
    geoResult,
    journeyResult,
    healthResult,
    digestResult,
    notificationsResult,
    orgResult,
  ] = await Promise.allSettled([
    withTimeout(queryPosts(clientId), QUERY_TIMEOUT_MS),
    withTimeout(queryCalendar(clientId), QUERY_TIMEOUT_MS),
    withTimeout(queryReviews(clientId), QUERY_TIMEOUT_MS),
    withTimeout(queryAuthority(clientId), QUERY_TIMEOUT_MS),
    withTimeout(querySeasonal(clientId), QUERY_TIMEOUT_MS),
    withTimeout(queryGEO(clientId), QUERY_TIMEOUT_MS),
    withTimeout(queryJourney(clientId), QUERY_TIMEOUT_MS),
    withTimeout(queryHealth(clientId), QUERY_TIMEOUT_MS),
    withTimeout(queryDigest(clientId), QUERY_TIMEOUT_MS),
    withTimeout(queryNotifications(clientId), QUERY_TIMEOUT_MS),
    withTimeout(
      prisma.organization.findUnique({
        where: { id: clientId },
        select: { name: true, industry: true },
      }),
      QUERY_TIMEOUT_MS
    ),
  ]);

  const posts =
    postsResult.status === 'fulfilled'
      ? postsResult.value
      : unavailable(postsResult.reason);

  const calendar =
    calendarResult.status === 'fulfilled'
      ? calendarResult.value
      : unavailable(calendarResult.reason);

  const reviews =
    reviewsResult.status === 'fulfilled'
      ? reviewsResult.value
      : unavailable(reviewsResult.reason);

  const authority =
    authorityResult.status === 'fulfilled'
      ? authorityResult.value
      : unavailable(authorityResult.reason);

  const seasonal =
    seasonalResult.status === 'fulfilled'
      ? seasonalResult.value
      : unavailable(seasonalResult.reason);

  const geo =
    geoResult.status === 'fulfilled'
      ? geoResult.value
      : unavailable(geoResult.reason);

  const journey =
    journeyResult.status === 'fulfilled'
      ? journeyResult.value
      : unavailable(journeyResult.reason);

  const health =
    healthResult.status === 'fulfilled'
      ? healthResult.value
      : unavailable(healthResult.reason);

  const digest =
    digestResult.status === 'fulfilled'
      ? digestResult.value
      : unavailable(digestResult.reason);

  const notifications =
    notificationsResult.status === 'fulfilled'
      ? notificationsResult.value
      : unavailable(notificationsResult.reason);

  const orgData = orgResult.status === 'fulfilled' ? orgResult.value : null;

  const profile: ClientProfile = {
    clientId,
    organizationName: orgData?.name ?? null,
    industry: orgData?.industry ?? null,
    postsSummary: posts,
  };

  return {
    clientId,
    profile,
    posts,
    calendar,
    reviews,
    authority,
    seasonal,
    geo,
    journey,
    health,
    digest,
    notifications,
    retrievedAt: new Date().toISOString(),
  };
}

// ── Prompt serialisation ──────────────────────────────────────────────────────

/**
 * Serialise a ClientContext to a compact text string suitable for AI prompt injection.
 * Priority order: profile → posts → reviews → authority → seasonal → geo → health → journey → digest → notifications.
 * Sections are omitted (from lowest priority) when the budget is exceeded.
 *
 * Token budget defaults to 2000 tokens (estimated at ~4 chars/token).
 */
export function toPromptContext(ctx: ClientContext, maxTokens = 2000): string {
  const charBudget = maxTokens * 4;

  const sections: string[] = [];

  function tryAppend(text: string): boolean {
    const current = sections.join('\n');
    if (current.length + text.length + 1 > charBudget) return false;
    sections.push(text);
    return true;
  }

  // Profile
  tryAppend(
    `CLIENT: ${ctx.profile.organizationName ?? ctx.clientId}` +
      (ctx.profile.industry ? ` | Industry: ${ctx.profile.industry}` : '') +
      ` | Retrieved: ${ctx.retrievedAt}`
  );

  // Posts
  if (ctx.posts.available) {
    const p = ctx.posts;
    tryAppend(
      `POSTS: total=${p.totalPosts} last30d=${p.last30Days} last7d=${p.last7Days}` +
        ` published=${p.publishedVsDraft.published} draft=${p.publishedVsDraft.draft}` +
        ` avgEngagement=${p.avgEngagementRate.toFixed(2)}%` +
        (p.topPerformingTopic ? ` topTopic=${p.topPerformingTopic}` : '') +
        ` platforms=${JSON.stringify(p.platformBreakdown)}`
    );
  }

  // Reviews
  if (ctx.reviews.available) {
    const r = ctx.reviews;
    tryAppend(
      `REVIEWS: total=${r.totalReviews} avgRating=${r.avgRating}★` +
        ` last30d=${r.last30Days} responseRate=${(r.responseRate * 100).toFixed(0)}%`
    );
  }

  // Authority
  if (ctx.authority.available) {
    const a = ctx.authority;
    tryAppend(
      `AUTHORITY SCORE: ${a.latestScore ?? 'n/a'}` +
        (a.trend ? ` trend=${a.trend}` : '')
    );
  }

  // Seasonal
  if (ctx.seasonal.available) {
    const s = ctx.seasonal;
    tryAppend(
      `SEASONAL: activeSignals=${s.activeSignals}` +
        (s.upcomingEvents.length > 0
          ? ` upcoming=[${s.upcomingEvents.join(', ')}]`
          : '')
    );
  }

  // GEO
  if (ctx.geo.available) {
    const g = ctx.geo;
    tryAppend(
      `GEO SCORE: ${g.score ?? 'n/a'}` + (g.band ? ` band=${g.band}` : '')
    );
  }

  // Health
  if (ctx.health.available) {
    const h = ctx.health;
    tryAppend(
      `HEALTH SCORE: ${h.overallScore ?? 'n/a'}` +
        (h.weekStart ? ` weekStart=${h.weekStart}` : '')
    );
  }

  // Journey
  if (ctx.journey.available) {
    const j = ctx.journey;
    tryAppend(
      `JOURNEY: stage=${j.currentStage ?? 'unknown'}` +
        (j.daysSinceOnboarding != null
          ? ` daysSinceOnboarding=${j.daysSinceOnboarding}`
          : '')
    );
  }

  // Digest
  if (ctx.digest.available) {
    const d = ctx.digest;
    tryAppend(
      `DIGEST: totalDelivered=${d.totalDelivered}` +
        (d.lastDelivered ? ` lastDelivered=${d.lastDelivered}` : '')
    );
  }

  // Notifications
  if (ctx.notifications.available) {
    const n = ctx.notifications;
    tryAppend(`NOTIFICATIONS: unread=${n.unreadCount}`);
  }

  // Calendar (lowest priority)
  if (ctx.calendar.available) {
    const c = ctx.calendar;
    tryAppend(
      `CALENDAR: upcoming=${c.upcomingPosts} overdue=${c.overdueCount}` +
        (c.nextScheduledDate ? ` next=${c.nextScheduledDate}` : '')
    );
  }

  return sections.join('\n');
}

// ── Paginated detail access ───────────────────────────────────────────────────

/**
 * Return raw paginated records for a single domain.
 * Useful for drill-down views or exporting data to reports.
 */
export async function getClientDetail<T = unknown>(
  clientId: string,
  domain: ClientDataDomain,
  options: DetailOptions = {}
): Promise<DetailResult<T>> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
  const skip = (page - 1) * pageSize;

  const dateFilter =
    options.dateFrom || options.dateTo
      ? {
          createdAt: {
            ...(options.dateFrom ? { gte: new Date(options.dateFrom) } : {}),
            ...(options.dateTo ? { lte: new Date(options.dateTo) } : {}),
          },
        }
      : {};

  let data: unknown[] = [];
  let total = 0;

  switch (domain) {
    case 'posts': {
      const where = { organizationId: clientId, ...dateFilter };
      [data, total] = await Promise.all([
        prisma.calendarPost.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: options.sortDir === 'asc' ? 'asc' : 'desc' },
        }),
        prisma.calendarPost.count({ where }),
      ]);
      break;
    }

    case 'calendar': {
      const where = { organizationId: clientId, ...dateFilter };
      [data, total] = await Promise.all([
        prisma.calendarPost.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { scheduledFor: options.sortDir === 'asc' ? 'asc' : 'desc' },
        }),
        prisma.calendarPost.count({ where }),
      ]);
      break;
    }

    case 'reviews': {
      const where = { organizationId: clientId, ...dateFilter };
      [data, total] = await Promise.all([
        prisma.gBPReview.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { reviewTime: options.sortDir === 'asc' ? 'asc' : 'desc' },
        }),
        prisma.gBPReview.count({ where }),
      ]);
      break;
    }

    case 'authority': {
      const where = { organizationId: clientId };
      [data, total] = await Promise.all([
        prisma.authorityScore.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { computedAt: options.sortDir === 'asc' ? 'asc' : 'desc' },
        }),
        prisma.authorityScore.count({ where }),
      ]);
      break;
    }

    case 'seasonal': {
      [data, total] = await Promise.all([
        prisma.seasonalSignal.findMany({
          where: {
            dismissals: { none: { organizationId: clientId } },
            ...dateFilter,
          },
          skip,
          take: pageSize,
          orderBy: { windowStart: options.sortDir === 'asc' ? 'asc' : 'desc' },
        }),
        prisma.seasonalSignal.count({
          where: { dismissals: { none: { organizationId: clientId } } },
        }),
      ]);
      break;
    }

    case 'health': {
      const where = { organizationId: clientId };
      [data, total] = await Promise.all([
        prisma.clientHealthScore.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { weekStart: options.sortDir === 'asc' ? 'asc' : 'desc' },
        }),
        prisma.clientHealthScore.count({ where }),
      ]);
      break;
    }

    case 'journey': {
      const where = { organizationId: clientId };
      [data, total] = await Promise.all([
        prisma.onboardingProgress.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: options.sortDir === 'asc' ? 'asc' : 'desc' },
        }),
        prisma.onboardingProgress.count({ where }),
      ]);
      break;
    }

    case 'geo': {
      // GEOAnalysis is user-scoped — resolve users for this org first
      const org = await prisma.organization.findUnique({
        where: { id: clientId },
        select: { users: { select: { id: true } } },
      });
      const userIds = org?.users.map(u => u.id) ?? [];
      const where = { userId: { in: userIds } };
      [data, total] = await Promise.all([
        prisma.gEOAnalysis.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: options.sortDir === 'asc' ? 'asc' : 'desc' },
        }),
        prisma.gEOAnalysis.count({ where }),
      ]);
      break;
    }

    case 'digest': {
      const org = await prisma.organization.findUnique({
        where: { id: clientId },
        select: { users: { select: { id: true } } },
      });
      const userIds = org?.users.map(u => u.id) ?? [];
      const where = { userId: { in: userIds } };
      [data, total] = await Promise.all([
        prisma.aIWeeklyDigest.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { weekStart: options.sortDir === 'asc' ? 'asc' : 'desc' },
        }),
        prisma.aIWeeklyDigest.count({ where }),
      ]);
      break;
    }

    case 'notifications': {
      const org = await prisma.organization.findUnique({
        where: { id: clientId },
        select: { users: { select: { id: true } } },
      });
      const userIds = org?.users.map(u => u.id) ?? [];
      const where = { userId: { in: userIds } };
      [data, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: options.sortDir === 'asc' ? 'asc' : 'desc' },
        }),
        prisma.notification.count({ where }),
      ]);
      break;
    }
  }

  return {
    domain,
    data: data as T[],
    total,
    page,
    pageSize,
  };
}
