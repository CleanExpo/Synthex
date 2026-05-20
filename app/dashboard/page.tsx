'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import useSWR from 'swr';
import { toast } from 'sonner';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { useUser } from '@/hooks/use-user';
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  ListTodo,
  MessageSquare,
  RefreshCw,
  Shield,
} from '@/components/icons';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { FirstWinBanner } from '@/components/notifications/FirstWinBanner';

import {
  DashboardStats,
  FetchError,
  formatTimeAgo,
  DashboardHeader,
  AnimatedCard,
  GetStartedChecklist,
  ContentSuggestionsWidget,
  FirstWeekWidget,
} from '@/components/dashboard';
import { WelcomeCard } from '@/components/dashboard/WelcomeCard';
import { AutopilotBanner } from '@/components/dashboard/AutopilotBanner';
import { AllBusinessesDashboard } from '@/components/business/AllBusinessesDashboard';
// SYN-599: Team engagement card — self-hides when no team members (solo-user safe)
import { TeamCard } from '@/components/team/TeamCard';

// AI Command Centre — replaces returning-user widget soup (Phase 132)
const AICommandCentre = dynamic(
  () =>
    import('@/components/command-centre').then(m => ({
      default: m.AICommandCentre,
    })),
  { ssr: false }
);

const HealthScoreWidget = dynamic(
  () =>
    import('@/components/dashboard/HealthScoreWidget').then(m => ({
      default: m.HealthScoreWidget,
    })),
  { ssr: false }
);

const VisibilityScoreWidget = dynamic(
  () =>
    import('@/components/dashboard/VisibilityScoreWidget').then(m => ({
      default: m.VisibilityScoreWidget,
    })),
  { ssr: false }
);

const ContentOpportunitiesWidget = dynamic(
  () =>
    import('@/components/dashboard/ContentOpportunitiesWidget').then(m => ({
      default: m.ContentOpportunitiesWidget,
    })),
  { ssr: false }
);

const RevenueProjectionWidget = dynamic(
  () =>
    import('@/components/dashboard/RevenueProjectionWidget').then(m => ({
      default: m.RevenueProjectionWidget,
    })),
  { ssr: false }
);

const BrandIQCard = dynamic(
  () =>
    import('@/components/dashboard/BrandIQCard').then(m => ({
      default: m.BrandIQCard,
    })),
  { ssr: false }
);

const AuthorityScoreCard = dynamic(
  () =>
    import('@/components/authority/AuthorityScoreCard').then(m => ({
      default: m.AuthorityScoreCard,
    })),
  { ssr: false }
);

// SYN-633: Content Intelligence Card — audience learning loop insights
const ContentIntelligenceCard = dynamic(
  () =>
    import('@/components/dashboard/ContentIntelligenceCard').then(m => ({
      default: m.ContentIntelligenceCard,
    })),
  { ssr: false }
);

// SYN-526: Win-anchored trial-end conversion modal
const TrialEndModal = dynamic(
  () => import('@/components/trial/TrialEndModal'),
  { ssr: false }
);

// ─── Notification + trial helpers ──────────────────────────────────────────

interface ClientNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  payload: {
    improvement_pct?: number;
    metric?: string;
    actual_value?: number;
    detected_at?: string;
  } | null;
  created_at: string;
}

interface NotificationsResponse {
  notifications: ClientNotification[];
}

async function fetchNotifications(url: string): Promise<NotificationsResponse> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) return { notifications: [] };
  return res.json() as Promise<NotificationsResponse>;
}

const TRIAL_DAYS = 14;

const commandEntryCards = [
  {
    icon: ListTodo,
    title: 'Brief',
    copy: 'Shape the idea, audience, offer, assets and approval state.',
    href: '/dashboard/creative-suite',
    action: 'Start brief',
  },
  {
    icon: BrainCircuit,
    title: 'Build',
    copy: 'Generate drafts, media directions, research and launch options.',
    href: '/dashboard',
    action: 'Open center',
  },
  {
    icon: Shield,
    title: 'Approve',
    copy: 'Clear evidence, brand, licensing, spend and publishing gates.',
    href: '/dashboard/approvals',
    action: 'Review gates',
  },
];

function getTrialDaysRemaining(createdAt: string): number {
  const trialEnd = new Date(createdAt);
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);
  const msRemaining = trialEnd.getTime() - Date.now();
  return Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FetchError | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showTrialModal, setShowTrialModal] = useState(false);

  // SYN-525/526/527: Current user for first_win_detected + conversion_copy_variant
  const { user } = useUser();

  const {
    isOwner,
    activeOrganizationId,
    isLoading: businessLoading,
  } = useActiveBusiness();
  const isAllBusinessesMode =
    isOwner && activeOrganizationId === null && !businessLoading;

  // SYN-525: Fetch unread notifications for first-win banner
  const { data: notifData } = useSWR<NotificationsResponse>(
    '/api/notifications',
    fetchNotifications,
    { revalidateOnFocus: false }
  );

  const firstWinNotif =
    notifData?.notifications?.find(n => n.type === 'first_win') ?? null;

  // Derive trial state from account creation date
  const trialDaysRemaining = user
    ? getTrialDaysRemaining(user.createdAt)
    : TRIAL_DAYS;

  // SYN-526: Show trial modal when ≤3 days remain (delayed so it doesn't block first paint)
  // 2026-05-01 (SYN-847): Disabled by default per CEO directive — Synthex is currently
  // internal SaaS, no external billing/trial. Admin + internal users were seeing
  // "TRIAL ENDS IN 0 DAYS" on every dashboard load. Set NEXT_PUBLIC_TRIAL_MODAL_ENABLED=true
  // when external paid plans are reintroduced.
  const trialModalEnabled =
    process.env.NEXT_PUBLIC_TRIAL_MODAL_ENABLED === 'true';
  const userPreferences = user?.preferences as
    | { userType?: string }
    | undefined;
  const isAdminUser = userPreferences?.userType === 'admin';

  useEffect(() => {
    if (!trialModalEnabled) return undefined;
    if (isAdminUser) return undefined;
    if (trialDaysRemaining <= 3 && trialDaysRemaining >= 0) {
      const t = setTimeout(() => setShowTrialModal(true), 2500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [trialDaysRemaining, trialModalEnabled, isAdminUser]);

  // Build TrialWinData from first-win notification payload
  const trialWinData = firstWinNotif?.payload
    ? {
        metricLabel: firstWinNotif.payload.metric ?? 'impressions',
        actualValue: firstWinNotif.payload.actual_value ?? 0,
        improvementPct: firstWinNotif.payload.improvement_pct ?? 0,
        postDay: firstWinNotif.payload.detected_at
          ? new Date(firstWinNotif.payload.detected_at).toLocaleDateString(
              'en-AU',
              { weekday: 'long' }
            )
          : 'recent',
      }
    : null;

  const fetchDashboardData = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      const legacyToken =
        typeof window !== 'undefined'
          ? localStorage.getItem('auth_token') ||
            sessionStorage.getItem('auth_token') ||
            localStorage.getItem('token')
          : null;

      const response = await fetch('/api/dashboard/stats', {
        credentials: 'include',
        headers: legacyToken ? { Authorization: `Bearer ${legacyToken}` } : {},
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            `Failed to fetch dashboard stats (${response.status})`
        );
      }

      const data = await response.json();

      const dashboardStats: DashboardStats = {
        totalPosts: data.stats?.totalPosts || 0,
        scheduledPosts: data.stats?.scheduledPosts || 0,
        engagementRate: parseFloat(data.stats?.avgEngagementRate || '0'),
        followers: data.stats?.totalFollowers || 0,
        connectedPlatforms: data.stats?.connectedPlatforms || 0,
        activeCampaigns: data.stats?.activeCampaigns || 0,
        trendingTopics: data.trendingTopics || [],
        recentActivity: (data.recentActivity || []).map(
          (
            activity: {
              platform: string;
              action: string;
              time: string;
              engagement?: number;
            },
            index: number
          ) => ({
            id: String(index + 1),
            type:
              activity.engagement && activity.engagement > 100
                ? 'engagement'
                : ('post' as const),
            message: `${activity.action} on ${activity.platform}`,
            timestamp: formatTimeAgo(new Date(activity.time)),
          })
        ),
      };

      setStats(dashboardStats);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'An unexpected error occurred';
      logger.error('[Dashboard] Error fetching data:', err);
      setError({
        message: errorMessage,
        code:
          err instanceof Error && 'code' in err
            ? String((err as Error & { code?: string }).code)
            : undefined,
        timestamp: new Date(),
      });
      setStats(null);
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  }, []);

  const handleRetry = useCallback(() => {
    setIsRetrying(true);
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleReportError = useCallback(async () => {
    const details = [
      `Time: ${error?.timestamp?.toISOString() || new Date().toISOString()}`,
      `Page: ${typeof window !== 'undefined' ? window.location.href : 'unknown'}`,
      `Error: ${error?.message || 'Unknown error'}`,
      `Code: ${error?.code || 'N/A'}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(details);
      toast.info(
        'Error details copied. Contact support@synthex.social if this persists.',
        {
          duration: 6000,
          action: {
            label: 'Help Centre',
            onClick: () => {
              window.location.href = '/dashboard/help';
            },
          },
        }
      );
    } catch {
      toast.info('Contact support@synthex.social if this persists.', {
        duration: 6000,
        action: {
          label: 'Help Centre',
          onClick: () => {
            window.location.href = '/dashboard/help';
          },
        },
      });
    }
  }, [error]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        {/* Header skeleton */}
        <div className="space-y-2 mb-6">
          <div className="h-2 w-24 bg-white/[0.04] rounded-sm" />
          <div className="h-9 w-56 bg-white/[0.06] rounded-sm" />
          <div className="h-3 w-72 bg-white/[0.03] rounded-sm mt-2" />
          <div className="h-px bg-white/[0.06] mt-5" />
        </div>
        {/* Stats strip skeleton */}
        <div className="border-[0.5px] border-white/[0.06] rounded-sm grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-white/[0.06]">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="px-5 py-4 space-y-2">
              <div className="h-7 w-16 bg-white/[0.05] rounded-sm" />
              <div className="h-2 w-20 bg-white/[0.03] rounded-sm" />
            </div>
          ))}
        </div>
        {/* Content skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-64 bg-white/[0.03] border-[0.5px] border-white/[0.06] rounded-sm" />
          <div className="h-64 bg-white/[0.03] border-[0.5px] border-white/[0.06] rounded-sm" />
        </div>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <div className="max-w-md w-full border-[0.5px] border-red-500/20 bg-red-500/[0.04] rounded-sm p-8">
          {/* Error icon */}
          <div className="w-12 h-12 flex items-center justify-center border-[0.5px] border-red-500/20 bg-red-500/10 rounded-sm mb-6 mx-auto">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>

          <h2 className="text-lg font-light text-white text-center mb-2">
            Dashboard unavailable
          </h2>
          <p className="text-sm text-white/40 text-center mb-6 leading-relaxed">
            We couldn&apos;t load your dashboard data. This is usually
            temporary.
          </p>

          {/* Error detail */}
          <details className="mb-6">
            <summary className="cursor-pointer text-xs text-white/50 hover:text-white/50 transition-colors">
              Show error detail
            </summary>
            <div className="mt-3 p-3 bg-black/20 border-[0.5px] border-white/[0.06] rounded-sm overflow-auto max-h-28">
              <code className="text-[10px] text-red-300/70 font-mono whitespace-pre-wrap break-all">
                {error.message}
                {error.code && `\nCode: ${error.code}`}
                {`\nTime: ${error.timestamp.toLocaleString('en-AU')}`}
              </code>
            </div>
          </details>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-medium tracking-wide rounded-sm transition-colors',
                'bg-red-500/20 hover:bg-red-500/30 text-red-300 border-[0.5px] border-red-500/20',
                isRetrying && 'opacity-60 cursor-not-allowed'
              )}
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', isRetrying && 'animate-spin')}
              />
              {isRetrying ? 'Retrying…' : 'Try Again'}
            </button>
            <button
              onClick={handleReportError}
              className="flex items-center gap-2 px-4 py-2.5 text-xs text-white/40 hover:text-white/60 border-[0.5px] border-white/[0.08] hover:border-white/[0.15] rounded-sm transition-colors bg-white/[0.02]"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Report
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isNewUser =
    stats !== null &&
    stats.totalPosts === 0 &&
    stats.followers === 0 &&
    stats.scheduledPosts === 0;

  return (
    <ErrorBoundary
      fallbackTitle="Dashboard Error"
      fallbackDescription="Something went wrong rendering the dashboard. Please refresh."
      onError={(err, errorInfo) => {
        logger.error('[Dashboard ErrorBoundary]', err);
        logger.error(
          '[Dashboard ErrorBoundary] Stack:',
          errorInfo.componentStack
        );
      }}
      showReportButton
      showHomeButton
      homeUrl="/"
    >
      <div className="space-y-6">
        {/* SYN-525: First Win Banner — self-contained, fetches its own notification data */}
        <FirstWinBanner />

        <DashboardHeader
          showNotifications={showNotifications}
          onToggleNotifications={() => setShowNotifications(!showNotifications)}
          isNewUser={isNewUser}
        />

        {/* First-run Autopilot onboarding banner */}
        {!isAllBusinessesMode && (
          <AutopilotBanner
            hasNoPlatforms={stats !== null && stats.connectedPlatforms === 0}
            autopilotInactive={isNewUser}
          />
        )}

        {/* All-businesses mode */}
        {isAllBusinessesMode ? (
          <AllBusinessesDashboard />
        ) : isNewUser ? (
          /* ── New user flow ───────────────────────────────────────────── */
          <div className="space-y-4">
            {/* Single-focus first-run card — shown only when user has no content and no platform connections */}
            {stats.totalPosts === 0 && stats.connectedPlatforms === 0 && (
              <div className="rounded-sm border-[0.5px] border-white/[0.08] bg-[#0a0a12] p-8 text-center max-w-lg mx-auto mt-2">
                <div className="h-10 w-10 flex items-center justify-center border-[0.5px] border-amber-500/20 bg-amber-500/[0.06] rounded-sm mx-auto mb-4">
                  <span className="text-amber-400 text-lg">✨</span>
                </div>
                <h2 className="text-lg font-light text-white mb-2">
                  Create your first post in 2 minutes
                </h2>
                <p className="text-sm text-white/40 mb-6 leading-relaxed">
                  Synthex uses your brand voice to generate posts for all 9
                  platforms instantly.
                </p>
                <a
                  href="/dashboard/content/drafts"
                  className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-[#050508] font-medium text-sm py-2.5 px-6 rounded-sm transition-colors"
                >
                  Create First Post
                  <span aria-hidden="true">→</span>
                </a>
                <p className="mt-3 text-xs text-white/60">
                  or{' '}
                  <a
                    href="/dashboard/integrations"
                    className="text-amber-500/70 hover:text-amber-500/90 transition-colors"
                  >
                    connect a platform first
                  </a>
                </p>
              </div>
            )}
            <WelcomeCard
              connectedPlatforms={stats.connectedPlatforms}
              totalPosts={stats.totalPosts}
              scheduledPosts={stats.scheduledPosts}
            />
            <AnimatedCard delay={0.1}>
              <GetStartedChecklist />
            </AnimatedCard>
            <FirstWeekWidget />
            <ContentSuggestionsWidget />
          </div>
        ) : (
          /* ── Returning user flow — AI Command Centre ────────────────────── */
          <>
            <section className="rounded-md border-[0.5px] border-white/[0.08] bg-[#0a0a12] p-5">
              <div className="flex flex-col gap-4 border-b border-white/[0.06] pb-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-400/80">
                    Command center
                  </p>
                  <h2 className="mt-2 text-2xl font-light tracking-tight text-white">
                    Brief, build, approve.
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="/dashboard/creative-suite"
                    className="inline-flex items-center rounded-sm bg-amber-500 px-4 py-2 text-xs font-medium text-[#050508] transition-colors hover:bg-amber-400"
                  >
                    Create campaign
                  </a>
                  <a
                    href="/dashboard/approvals"
                    className="inline-flex items-center rounded-sm border-[0.5px] border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
                  >
                    Review approvals
                  </a>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {commandEntryCards.map(card => {
                  const Icon = card.icon;
                  return (
                    <a
                      key={card.title}
                      href={card.href}
                      className="group border-[0.5px] border-white/[0.08] bg-white/[0.02] p-4 transition-colors hover:border-amber-500/20 hover:bg-white/[0.04]"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <Icon className="h-5 w-5 text-amber-400" />
                        <span className="text-[10px] uppercase tracking-[0.16em] text-white/30 transition-colors group-hover:text-amber-300/80">
                          {card.action}
                        </span>
                      </div>
                      <h3 className="text-sm font-medium text-white">
                        {card.title}
                      </h3>
                      <p className="mt-2 text-xs leading-5 text-white/45">
                        {card.copy}
                      </p>
                    </a>
                  );
                })}
              </div>
            </section>

            <AICommandCentre />

            <section className="space-y-4">
              <div className="flex flex-col gap-2 border-t border-white/[0.06] pt-5 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/35">
                    Signal cards
                  </p>
                  <h2 className="mt-2 text-xl font-light tracking-tight text-white">
                    Read the business signals after the command work.
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  <span>
                    Reports support decisions. They do not replace them.
                  </span>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <HealthScoreWidget />
                <VisibilityScoreWidget />
                <ContentOpportunitiesWidget />
                <RevenueProjectionWidget />
                <AuthorityScoreCard />
                {/* SYN-633: Content Intelligence Card — audience learning loop insights */}
                <ContentIntelligenceCard />
                {/* SYN-527: Brand IQ Score Card — self-contained, fetches own data */}
                <div className="lg:col-span-2">
                  <BrandIQCard />
                </div>
                {/* SYN-599: Team card — renders null when no members, zero solo impact */}
                <div className="lg:col-span-2">
                  <TeamCard />
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      {/* SYN-526: Trial End Modal — shows when ≤3 trial days remain */}
      {showTrialModal && (
        <TrialEndModal
          variant={user?.conversion_copy_variant ?? 'control'}
          winData={trialWinData}
          daysRemaining={trialDaysRemaining}
          onSubscribe={() => {
            window.location.href = '/dashboard/billing?ref=trial_modal';
          }}
          onDismiss={() => setShowTrialModal(false)}
        />
      )}
    </ErrorBoundary>
  );
}
