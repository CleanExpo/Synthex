'use client';

/**
 * Dashboard Page
 * Main dashboard with tabs for overview, analytics, AI studio, team, and scheduler
 */

import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, MessageSquare, RefreshCw } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { glassStyles } from '@/components/ui/index';
import { cn } from '@/lib/utils';

import {
  DashboardStats,
  FetchError,
  formatTimeAgo,
  DashboardHeader,
  QuickStats,
  AnimatedCard,
  OverviewTab,
  AnalyticsTab,
  AIStudioTab,
  TeamTab,
  SchedulerTab,
} from '@/components/dashboard';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FetchError | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [showNotifications, setShowNotifications] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');

      const response = await fetch('/api/dashboard/stats', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
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
        trendingTopics: data.trendingTopics || ['#AI', '#SocialMedia', '#Marketing', '#Growth'],
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

  const handleReportError = useCallback(() => {
    const subject = encodeURIComponent('Dashboard Error Report - Synthex');
    const body = encodeURIComponent(
      `Error occurred at: ${error?.timestamp?.toISOString() || new Date().toISOString()}\n` +
        `Page: ${typeof window !== 'undefined' ? window.location.href : 'unknown'}\n` +
        `Error: ${error?.message || 'Unknown error'}\n` +
        `Error Code: ${error?.code || 'N/A'}\n\n` +
        `Please describe what you were doing when this error occurred:\n`
    );
    window.open(`mailto:support@synthex.ai?subject=${subject}&body=${body}`);
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

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
            <TabsList className={cn(
              "grid w-full grid-cols-3 sm:grid-cols-5 lg:w-fit h-auto p-1",
              glassStyles.base
            )}>
              <TabsTrigger value="overview" className="text-xs sm:text-sm py-2 sm:py-2.5 px-2 sm:px-4">Overview</TabsTrigger>
              <TabsTrigger value="analytics" className="text-xs sm:text-sm py-2 sm:py-2.5 px-2 sm:px-4">Analytics</TabsTrigger>
              <TabsTrigger value="ai-studio" className="text-xs sm:text-sm py-2 sm:py-2.5 px-2 sm:px-4">
                <span className="hidden sm:inline">AI Studio</span>
                <span className="sm:hidden">AI</span>
              </TabsTrigger>
              <TabsTrigger value="team" className="text-xs sm:text-sm py-2 sm:py-2.5 px-2 sm:px-4 col-span-1">Team</TabsTrigger>
              <TabsTrigger value="scheduler" className="text-xs sm:text-sm py-2 sm:py-2.5 px-2 sm:px-4 col-span-2 sm:col-span-1">Scheduler</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 sm:space-y-6">
              <OverviewTab stats={stats} />
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4 sm:space-y-6">
              <AnalyticsTab />
            </TabsContent>

            <TabsContent value="ai-studio" className="space-y-4 sm:space-y-6">
              <AIStudioTab />
            </TabsContent>

            <TabsContent value="team" className="space-y-4 sm:space-y-6">
              <TeamTab />
            </TabsContent>

            <TabsContent value="scheduler" className="space-y-4 sm:space-y-6">
              <SchedulerTab />
            </TabsContent>
          </Tabs>

          {/* Competitor Analysis */}
          <AnimatedCard delay={0.4}>
            <Card className={cn(glassStyles.base)}>
              <CardHeader className="pb-2 sm:pb-4">
                <CardTitle className="text-base sm:text-lg">Competitor Analysis</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Track your competitors (Phase 4B)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-24 sm:h-32 flex items-center justify-center text-xs sm:text-sm text-muted-foreground">
                  Competitor analysis integration in progress
                </div>
              </CardContent>
            </Card>
          </AnimatedCard>
        </main>
      </div>
    </ErrorBoundary>
  );
}
