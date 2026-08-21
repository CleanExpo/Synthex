'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import useSWR from 'swr';
import { toast } from 'sonner';
import Link from 'next/link';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { useUser } from '@/hooks/use-user';
import { AlertTriangle, MessageSquare, RefreshCw } from '@/components/icons';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

import {
  DashboardStats,
  FetchError,
  formatTimeAgo,
} from '@/components/dashboard';
import { AllBusinessesDashboard } from '@/components/business/AllBusinessesDashboard';
import { DashboardNewUserHome } from '@/components/dashboard/DashboardNewUserHome';
import { DashboardAtmosphere } from '@/components/dashboard/DashboardAtmosphere';

// AI Command Centre — available under Mission Control "classic" toggle
const AICommandCentre = dynamic(
  () =>
    import('@/components/command-centre').then(m => ({
      default: m.AICommandCentre,
    })),
  { ssr: false }
);

const MissionControlHome = dynamic(
  () =>
    import('@/components/mission-control').then(m => ({
      default: m.MissionControlHome,
    })),
  { ssr: false }
);

import { DashboardPerformancePulse } from '@/components/dashboard/DashboardPerformancePulse';

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

function formatErrorTimestamp(error: FetchError | null): string {
  const timestamp =
    error?.timestamp instanceof Date ? error.timestamp : new Date();

  return timestamp.toLocaleString('en-AU');
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

  // activeOrganizationId is a dep of fetchDashboardData so the top stats strip
  // (posts/followers/engagement/campaigns) refetches on brand switch. The
  // /api/dashboard/stats route resolves the org server-side from the session
  // cookie that switchBusiness updates, so no URL change is needed — re-running
  // the request is enough to pull the now-active org's numbers.
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
    // activeOrganizationId intentionally a dep: refetch stats when the active
    // brand changes so the stats strip never shows the prior org's numbers.
    // It is not read in this callback body (the /api/dashboard/stats route resolves
    // the org server-side from the session cookie); it's here solely so the callback
    // identity changes on switch, which re-runs the effect below and refetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrganizationId]);

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
      <div className="space-y-8 animate-pulse">
        <div className="h-9 w-32 bg-white/4 rounded-sm" />
        <div className="h-14 bg-white/3 border-[0.5px] border-white/6 rounded-sm" />
        <div className="h-72 bg-white/3 border-[0.5px] border-white/6 rounded-sm" />
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <div className="max-w-md w-full border-[0.5px] border-red-500/20 bg-red-500/4 rounded-sm p-8">
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
            <div className="mt-3 p-3 bg-black/20 border-[0.5px] border-white/6 rounded-sm overflow-auto max-h-28">
              <code className="text-xs text-red-300/70 font-mono whitespace-pre-wrap break-all">
                {error.message}
                {error.code && `\nCode: ${error.code}`}
                {`\nTime: ${formatErrorTimestamp(error)}`}
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
              className="flex items-center gap-2 px-4 py-2.5 text-xs text-white/40 hover:text-white/60 border-[0.5px] border-white/8 hover:border-white/15 rounded-sm transition-colors bg-white/2"
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
      <div className="space-y-8">
        {isAllBusinessesMode ? (
          <DashboardAtmosphere className="mx-auto max-w-6xl">
            <AllBusinessesDashboard />
          </DashboardAtmosphere>
        ) : isNewUser ? (
          <DashboardNewUserHome />
        ) : (
          <>
            <h1 className="sr-only">Mission Control</h1>
            <MissionControlHome
              legacyCommandCentre={<AICommandCentre />}
              insights={
                <>
                  <DashboardPerformancePulse />
                  <div className="grid gap-4 lg:grid-cols-2">
                    <HealthScoreWidget />
                    <VisibilityScoreWidget />
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <Link
                      href="/dashboard/analytics"
                      className="text-orange-400/80 transition-colors hover:text-orange-400"
                    >
                      Analytics
                    </Link>
                    <Link
                      href="/dashboard/marketing-lab"
                      className="text-white/35 transition-colors hover:text-white/60"
                    >
                      Marketing Lab
                    </Link>
                  </div>
                </>
              }
            />
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
