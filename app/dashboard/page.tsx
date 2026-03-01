'use client';

/**
 * Dashboard Page
 * Main dashboard with overview, quick stats, and onboarding guidance for new users.
 */

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, MessageSquare, RefreshCw } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
} from '@/components/dashboard';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FetchError | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      // Auth token is stored as httpOnly cookie 'auth-token' (set by OAuth callback
      // and unified-login). We MUST use credentials: 'include' so the browser sends it.
      // Legacy: also check localStorage for backward compatibility with older sessions.
      const legacyToken = typeof window !== 'undefined'
        ? localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || localStorage.getItem('token')
        : null;

      const response = await fetch('/api/dashboard/stats', {
        credentials: 'include', // CRITICAL: sends httpOnly auth-token cookie
        headers: legacyToken ? { 'Authorization': `Bearer ${legacyToken}` } : {},
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch dashboard stats (${response.status})`);
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
        recentActivity: (data.recentActivity || []).map((activity: { platform: string; action: string; time: string; engagement?: number }, index: number) => ({
          id: String(index + 1),
          type: activity.engagement && activity.engagement > 100 ? 'engagement' : 'post' as const,
          message: `${activity.action} on ${activity.platform}`,
          timestamp: formatTimeAgo(new Date(activity.time)),
        })),
      };

      setStats(dashboardStats);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      console.error('[Dashboard] Error fetching data:', err);

      setError({
        message: errorMessage,
        code: err instanceof Error && 'code' in err ? String((err as Error & { code?: string }).code) : undefined,
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
      toast.info('Error details copied to clipboard. If this persists, contact support@synthex.social or visit the Help Center.', {
        duration: 6000,
        action: {
          label: 'Help Center',
          onClick: () => { window.location.href = '/dashboard/help'; },
        },
      });
    } catch {
      toast.info('If this persists, contact support@synthex.social or visit the Help Center.', {
        duration: 6000,
        action: {
          label: 'Help Center',
          onClick: () => { window.location.href = '/dashboard/help'; },
        },
      });
    }
  }, [error]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background p-3 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-8 sm:h-10 w-40 sm:w-64" />
          <Skeleton className="h-8 sm:h-10 w-20 sm:w-32" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 sm:h-32" />
          ))}
        </div>
        <Skeleton className="h-64 sm:h-96" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-lg w-full bg-gradient-to-br from-red-500/10 to-rose-500/10 backdrop-blur-xl border border-red-500/20 shadow-[0_0_0_1px_rgba(239,68,68,0.05)_inset,0_4px_24px_rgba(239,68,68,0.1)]">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-red-400" />
            </div>
            <CardTitle className="text-lg sm:text-xl text-red-100">
              Unable to Load Dashboard
            </CardTitle>
            <CardDescription className="text-sm text-red-200/70 mt-2">
              We couldn&apos;t fetch your dashboard data. This might be a temporary issue.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <details className="group">
              <summary className="cursor-pointer text-xs sm:text-sm text-red-200/60 hover:text-red-200/80 transition-colors">
                Show technical details
              </summary>
              <div className="mt-3 p-3 rounded-lg bg-black/20 overflow-auto max-h-32">
                <code className="text-xs text-red-200/80 whitespace-pre-wrap break-all">
                  {error.message}
                  {error.code && `\nCode: ${error.code}`}
                  {`\nTime: ${error.timestamp.toLocaleString()}`}
                </code>
              </div>
            </details>
          </CardContent>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 p-6 pt-2">
            <Button
              onClick={handleRetry}
              disabled={isRetrying}
              className="w-full sm:flex-1 bg-red-500/30 hover:bg-red-500/40 text-red-100 border border-red-500/40 hover:border-red-500/60"
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', isRetrying && 'animate-spin')} />
              {isRetrying ? 'Retrying...' : 'Try Again'}
            </Button>

            <Button
              variant="outline"
              onClick={handleReportError}
              className="w-full sm:w-auto bg-white/[0.05] backdrop-blur-md border border-white/[0.1] hover:bg-white/[0.1] text-red-200/80"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Report Issue
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Detect "new user" state: all key metrics are zero
  const isNewUser = stats !== null
    && stats.totalPosts === 0
    && stats.followers === 0
    && stats.scheduledPosts === 0;

  return (
    <ErrorBoundary
      fallbackTitle="Dashboard Error"
      fallbackDescription="Something went wrong while rendering the dashboard. Please try refreshing the page."
      onError={(err, errorInfo) => {
        console.error('[Dashboard ErrorBoundary] Caught error:', err);
        console.error('[Dashboard ErrorBoundary] Component stack:', errorInfo.componentStack);
      }}
      showReportButton={true}
      showHomeButton={true}
      homeUrl="/"
    >
      <div className="min-h-screen bg-background">
        <DashboardHeader
          showNotifications={showNotifications}
          onToggleNotifications={() => setShowNotifications(!showNotifications)}
        />

        <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
          <QuickStats stats={stats} />

          {/* Get Started checklist for new users */}
          {isNewUser && (
            <AnimatedCard delay={0.1}>
              <GetStartedChecklist
                hasConnections={stats.connectedPlatforms > 0}
                hasCampaigns={stats.scheduledPosts > 0}
                hasContent={stats.totalPosts > 0}
              />
            </AnimatedCard>
          )}

          {/* Dashboard Overview -- single clean view */}
          <div className="space-y-4 sm:space-y-6">
            <OverviewTab stats={stats} />
          </div>

          {/* Other dashboard features are now accessible from the sidebar navigation:
              - Analytics: /dashboard/analytics
              - AI Studio: /dashboard/ai-chat
              - Team: /dashboard/team
              - Scheduler: /dashboard/schedule
          */}

        </main>
      </div>
    </ErrorBoundary>
  );
}
