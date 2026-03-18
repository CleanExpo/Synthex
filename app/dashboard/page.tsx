'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import {
  AlertTriangle,
  MessageSquare,
  RefreshCw,
  Link2,
} from '@/components/icons';
import Link from 'next/link';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { cn } from '@/lib/utils';

import {
  DashboardStats,
  FetchError,
  formatTimeAgo,
  DashboardHeader,
  QuickStats,
  AnimatedCard,
  OverviewTab,
  GetStartedChecklist,
  GamificationWidget,
  ContentSuggestionsWidget,
  FirstWeekWidget,
} from '@/components/dashboard';
import { WelcomeCard } from '@/components/dashboard/WelcomeCard';
import { InsightsWidget } from '@/components/insights/InsightsWidget';
import { AllBusinessesDashboard } from '@/components/business/AllBusinessesDashboard';
import { SystemPulsePanel } from '@/components/dashboard/SystemPulsePanel';
import { UniteHubWidget } from '@/components/dashboard/UniteHubWidget';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FetchError | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const {
    isOwner,
    activeOrganizationId,
    isLoading: businessLoading,
  } = useActiveBusiness();
  const isAllBusinessesMode =
    isOwner && activeOrganizationId === null && !businessLoading;

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
      console.error('[Dashboard] Error fetching data:', err);
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

  // ── Loading state ──────────────────────────────────────────────────────────
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

  // ── Error state ────────────────────────────────────────────────────────────
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
            <summary className="cursor-pointer text-xs text-white/30 hover:text-white/50 transition-colors">
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

  const showOnboarding =
    stats !== null && (stats.connectedPlatforms === 0 || isNewUser);

  return (
    <ErrorBoundary
      fallbackTitle="Dashboard Error"
      fallbackDescription="Something went wrong rendering the dashboard. Please refresh."
      onError={(err, errorInfo) => {
        console.error('[Dashboard ErrorBoundary]', err);
        console.error(
          '[Dashboard ErrorBoundary] Stack:',
          errorInfo.componentStack
        );
      }}
      showReportButton
      showHomeButton
      homeUrl="/"
    >
      <div className="space-y-6">
        <DashboardHeader
          showNotifications={showNotifications}
          onToggleNotifications={() => setShowNotifications(!showNotifications)}
          isNewUser={isNewUser}
        />

        {/* All-businesses mode */}
        {isAllBusinessesMode ? (
          <AllBusinessesDashboard />
        ) : isNewUser ? (
          /* ── New user flow ──────────────────────────────────────────────── */
          <div className="space-y-4">
            <WelcomeCard
              connectedPlatforms={stats.connectedPlatforms}
              totalPosts={stats.totalPosts}
              scheduledPosts={stats.scheduledPosts}
            />
            <AnimatedCard delay={0.1}>
              <GetStartedChecklist
                hasConnections={stats.connectedPlatforms > 0}
                hasCampaigns={stats.scheduledPosts > 0}
                hasContent={stats.totalPosts > 0}
              />
            </AnimatedCard>
            <FirstWeekWidget />
            <ContentSuggestionsWidget />
          </div>
        ) : (
          /* ── Returning user flow ────────────────────────────────────────── */
          <div className="space-y-4">
            {/* Zero-platform banner — auto-dismisses once a platform is connected */}
            {stats && stats.connectedPlatforms === 0 && (
              <div className="flex items-center justify-between px-5 py-3.5 border-[0.5px] border-cyan-500/20 bg-cyan-500/[0.04] rounded-sm">
                <div className="flex items-center gap-3">
                  <Link2 className="h-4 w-4 text-cyan-400 shrink-0" />
                  <p className="text-sm text-white/70">
                    Connect your first platform to see real data in your
                    dashboard.
                  </p>
                </div>
                <Link
                  href="/dashboard/platforms"
                  className="shrink-0 ml-4 px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-[#0a1628] text-xs font-semibold tracking-wide rounded-sm transition-colors"
                >
                  Connect now
                </Link>
              </div>
            )}

            {/* Stats data strip */}
            <QuickStats stats={stats} />

            {/* Onboarding checklist (if incomplete) */}
            {showOnboarding && (
              <AnimatedCard delay={0.1}>
                <GetStartedChecklist
                  hasConnections={stats.connectedPlatforms > 0}
                  hasCampaigns={stats.scheduledPosts > 0}
                  hasContent={stats.totalPosts > 0}
                />
              </AnimatedCard>
            )}

            {/* First week content */}
            <FirstWeekWidget />

            {/* Main overview */}
            <OverviewTab stats={stats} />

            {/* AI Insights */}
            <InsightsWidget />

            {/* System health */}
            <SystemPulsePanel />

            {/* Unite-Group hub */}
            <UniteHubWidget />

            {/* Gamification + content suggestions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <GamificationWidget />
              <ContentSuggestionsWidget />
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
