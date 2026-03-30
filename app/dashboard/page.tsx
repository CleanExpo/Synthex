'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import useSWR from 'swr';
import { toast } from 'sonner';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { useUser } from '@/hooks/use-user';
import { AlertTriangle, MessageSquare, RefreshCw } from '@/components/icons';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import FirstWinBanner from '@/components/notifications/FirstWinBanner';

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
    notifData?.notifications.find(n => n.type === 'first_win') ?? null;

  // Derive trial state from account creation date
  const trialDaysRemaining = user
    ? getTrialDaysRemaining(user.createdAt)
    : TRIAL_DAYS;

  // SYN-526: Show trial modal when ≤3 days remain (delayed so it doesn't block first paint)
  useEffect(() => {
    if (trialDaysRemaining <= 3 && trialDaysRemaining >= 0) {
      const t = setTimeout(() => setShowTrialModal(true), 2500);
      return () => clearTimeout(t);
    }
  }, [trialDaysRemaining]);

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
        {/* SYN-525: First Win Banner — shown above header on first win notification */}
        {firstWinNotif && (
          <FirstWinBanner
            notificationId={firstWinNotif.id}
            title={firstWinNotif.title}
            body={firstWinNotif.body}
            improvementPct={firstWinNotif.payload?.improvement_pct ?? 0}
          />
        )}

        <DashboardHeader
          showNotifications={showNotifications}
          onToggleNotifications={() =>
            setShowNotifications(!showNotifications)
          }
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
            <div className="grid gap-4 lg:grid-cols-2">
              <HealthScoreWidget />
              <VisibilityScoreWidget />
              <ContentOpportunitiesWidget />
              <RevenueProjectionWidget />
              <AuthorityScoreCard />
              <div className="lg:col-span-2">
                <BrandIQCard />
              </div>
            </div>

            {/* SYN-527: Brand IQ Score Card — unlocks on first win */}
            <BrandIQCard
              firstWinDetected={user?.first_win_detected ?? false}
            />

            <AICommandCentre />
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
