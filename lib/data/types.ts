/**
 * Client Data Access Layer — Shared Types
 * SYN-687: Unified ClientContext for AI prompt injection and dashboard summaries.
 */

// ── Availability discriminant ─────────────────────────────────────────────────

export type UnavailableSummary = {
  available: false;
  reason: 'timeout' | 'error';
  error?: string;
};

// ── Per-domain summary shapes ─────────────────────────────────────────────────

export interface PostsSummary {
  available: true;
  totalPosts: number;
  last30Days: number;
  last7Days: number;
  topPerformingTopic: string | null;
  avgEngagementRate: number;
  publishedVsDraft: { published: number; draft: number };
  platformBreakdown: Record<string, number>;
}

export type CalendarSummary =
  | {
      available: true;
      upcomingPosts: number;
      overdueCount: number;
      nextScheduledDate: string | null;
    }
  | UnavailableSummary;

export type ReviewsSummary =
  | {
      available: true;
      totalReviews: number;
      avgRating: number;
      last30Days: number;
      responseRate: number;
    }
  | UnavailableSummary;

export type AuthoritySummary =
  | {
      available: true;
      latestScore: number | null;
      trend: 'up' | 'down' | 'stable' | null;
    }
  | UnavailableSummary;

export type SeasonalSummary =
  | {
      available: true;
      activeSignals: number;
      upcomingEvents: string[];
    }
  | UnavailableSummary;

export type GEOSummary =
  | {
      available: true;
      score: number | null;
      band: string | null;
    }
  | UnavailableSummary;

export type JourneySummary =
  | {
      available: true;
      currentStage: string | null;
      daysSinceOnboarding: number | null;
    }
  | UnavailableSummary;

export type HealthSummary =
  | {
      available: true;
      overallScore: number | null;
      weekStart: string | null;
    }
  | UnavailableSummary;

export type DigestSummary =
  | {
      available: true;
      lastDelivered: string | null;
      totalDelivered: number;
    }
  | UnavailableSummary;

export type NotificationsSummary =
  | {
      available: true;
      unreadCount: number;
      lastNotificationAt: string | null;
    }
  | UnavailableSummary;

// ── Top-level aggregation ─────────────────────────────────────────────────────

export interface ClientProfile {
  clientId: string;
  organizationName: string | null;
  industry: string | null;
  postsSummary: PostsSummary | UnavailableSummary;
}

export interface ClientContext {
  clientId: string;
  profile: ClientProfile;
  posts: PostsSummary | UnavailableSummary;
  calendar: CalendarSummary;
  reviews: ReviewsSummary;
  authority: AuthoritySummary;
  seasonal: SeasonalSummary;
  geo: GEOSummary;
  journey: JourneySummary;
  health: HealthSummary;
  digest: DigestSummary;
  notifications: NotificationsSummary;
  /** ISO timestamp — when the context was assembled */
  retrievedAt: string;
}

// ── Detail / pagination types ─────────────────────────────────────────────────

export type ClientDataDomain =
  | 'posts'
  | 'calendar'
  | 'reviews'
  | 'authority'
  | 'seasonal'
  | 'geo'
  | 'journey'
  | 'health'
  | 'digest'
  | 'notifications';

export interface DetailOptions {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  dateFrom?: string;
  dateTo?: string;
}

export interface DetailResult<T = unknown> {
  domain: ClientDataDomain;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
