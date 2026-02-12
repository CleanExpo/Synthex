'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  BarChart3,
  Users,
  Zap,
  TrendingUp,
  Calendar,
  MessageSquare,
  Share2,
  Target,
  Bell,
  Plus,
  RefreshCw,
  AlertTriangle
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBoundary, InlineErrorFallback } from '@/components/ui/error-boundary';
import { glassStyles, animationVariants } from '@/components/ui/index';
import { fetchDashboardStats, QuickStatsData, invalidateDashboardCache } from '@/lib/api/dashboard';
import { useUser } from '@/hooks/use-user';
import { cn } from '@/lib/utils';

// Helper function to format timestamps
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

// Animation wrapper component
const AnimatedCard = ({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => (
  <motion.div
    initial={animationVariants.cardEntrance.initial}
    animate={animationVariants.cardEntrance.animate}
    transition={{ ...animationVariants.cardEntrance.transition, delay }}
    className={className}
  >
    {children}
  </motion.div>
);

interface DashboardStats {
  totalPosts: number;
  scheduledPosts: number;
  engagementRate: number;
  followers: number;
  trendingTopics: string[];
  recentActivity: Array<{
    id: string;
    type: 'post' | 'engagement' | 'milestone';
    message: string;
    timestamp: string;
  }>;
}

interface FetchError {
  message: string;
  code?: string;
  timestamp: Date;
}

export default function DashboardPage() {
  const router = useRouter();
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

      // Get token from localStorage or session
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');

      const response = await fetch('/api/dashboard/stats', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch dashboard stats (${response.status})`);
      }

      const data = await response.json();

      // Map API response to DashboardStats interface
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

      // Set explicit error state instead of silently falling back
      setError({
        message: errorMessage,
        code: err instanceof Error && 'code' in err ? String((err as Error & { code?: string }).code) : undefined,
        timestamp: new Date(),
      });

      // Don't set fallback data - show error state instead
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

  // Explicit error state - show user-friendly error UI instead of silent fallback
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
            {/* Error Details */}
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
            {/* Primary action: Retry */}
            <Button
              onClick={handleRetry}
              disabled={isRetrying}
              className="w-full sm:flex-1 bg-red-500/30 hover:bg-red-500/40 text-red-100 border border-red-500/40 hover:border-red-500/60"
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', isRetrying && 'animate-spin')} />
              {isRetrying ? 'Retrying...' : 'Try Again'}
            </Button>

            {/* Secondary action: Report */}
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
        // Log to console for debugging
        console.error('[Dashboard ErrorBoundary] Caught error:', err);
        console.error('[Dashboard ErrorBoundary] Component stack:', errorInfo.componentStack);
        // In production, this would also send to Sentry/LogRocket
      }}
      showReportButton={true}
      showHomeButton={true}
      homeUrl="/"
    >
    <div className="min-h-screen bg-background">
      {/* Header - Mobile Optimized */}
      <header className={cn(
        "sticky top-0 z-40 border-b border-white/10",
        glassStyles.solid
      )}>
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold gradient-text-premium truncate">
                Dashboard
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1 sm:line-clamp-none">
                Welcome back! Here's what's happening with your social media.
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              <Button
                variant="outline"
                size="icon"
                className={cn(glassStyles.button, "relative h-9 w-9 sm:h-10 sm:w-10")}
                onClick={() => setShowNotifications(!showNotifications)}
                aria-label="Toggle notifications"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-cyan-500 animate-pulse" />
              </Button>
              <Button
                className={cn(glassStyles.buttonPrimary, "gap-1 sm:gap-2 text-sm sm:text-base px-3 sm:px-4")}
                onClick={() => router.push('/dashboard/content')}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden xs:inline sm:inline">New Post</span>
                <span className="xs:hidden sm:hidden">Post</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Mobile Optimized */}
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Quick Stats - Mobile Optimized */}
        <AnimatedCard delay={0}>
          <Card className={cn(glassStyles.base, glassStyles.hover)}>
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="text-base sm:text-lg">Quick Stats</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Real-time performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                <div className="p-3 sm:p-4 rounded-lg bg-white/5 touch-manipulation">
                  <div className="text-lg sm:text-2xl font-bold">{stats?.totalPosts || 0}</div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">Total Posts</div>
                </div>
                <div className="p-3 sm:p-4 rounded-lg bg-white/5 touch-manipulation">
                  <div className="text-lg sm:text-2xl font-bold">{stats?.engagementRate || 0}%</div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">Engagement</div>
                </div>
                <div className="p-3 sm:p-4 rounded-lg bg-white/5 touch-manipulation">
                  <div className="text-lg sm:text-2xl font-bold">{stats?.followers?.toLocaleString() || '0'}</div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">Followers</div>
                </div>
                <div className="p-3 sm:p-4 rounded-lg bg-white/5 touch-manipulation">
                  <div className="text-lg sm:text-2xl font-bold">{stats?.scheduledPosts || 0}</div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">Scheduled</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </AnimatedCard>

        {/* Main Dashboard Tabs - Mobile Optimized */}
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

          {/* Overview Tab - Mobile Optimized */}
          <TabsContent value="overview" className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Main Stats Cards */}
              <AnimatedCard delay={0.1} className="lg:col-span-2">
                <Card className={cn(glassStyles.base, glassStyles.hover)}>
                  <CardHeader className="pb-2 sm:pb-4">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-500" />
                      Performance Overview
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      Track your social media performance across all platforms
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                      <StatCard
                        icon={<Share2 className="h-4 w-4 sm:h-5 sm:w-5" />}
                        label="Total Posts"
                        value={stats?.totalPosts || 0}
                        trend="+12%"
                        trendUp={true}
                      />
                      <StatCard
                        icon={<Calendar className="h-4 w-4 sm:h-5 sm:w-5" />}
                        label="Scheduled"
                        value={stats?.scheduledPosts || 0}
                        trend="+5"
                        trendUp={true}
                      />
                      <StatCard
                        icon={<TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />}
                        label="Engagement"
                        value={`${stats?.engagementRate || 0}%`}
                        trend="+0.8%"
                        trendUp={true}
                      />
                      <StatCard
                        icon={<Users className="h-4 w-4 sm:h-5 sm:w-5" />}
                        label="Followers"
                        value={stats?.followers?.toLocaleString() || '0'}
                        trend="+2.4%"
                        trendUp={true}
                      />
                    </div>
                  </CardContent>
                </Card>
              </AnimatedCard>

              {/* Trending Topics */}
              <AnimatedCard delay={0.2}>
                <Card className={cn(glassStyles.base, glassStyles.hover)}>
                  <CardHeader className="pb-2 sm:pb-4">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />
                      Trending Topics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {stats?.trendingTopics?.map((topic, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className={cn(
                            "cursor-pointer transition-all hover:scale-105 text-xs sm:text-sm py-1 px-2 sm:py-1.5 sm:px-3",
                            glassStyles.button
                          )}
                        >
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </AnimatedCard>
            </div>

            {/* Recent Activity - Mobile Optimized */}
            <AnimatedCard delay={0.3}>
              <Card className={cn(glassStyles.base, glassStyles.hover)}>
                <CardHeader className="pb-2 sm:pb-4">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-500" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 sm:space-y-4">
                    {stats?.recentActivity?.map((activity, index) => (
                      <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * index }}
                        className="flex items-start sm:items-center justify-between p-2 sm:p-3 rounded-lg hover:bg-white/5 transition-colors touch-manipulation gap-2"
                      >
                        <div className="flex items-start sm:items-center gap-2 sm:gap-3 min-w-0 flex-1">
                          <div className={cn(
                            "h-2 w-2 rounded-full mt-1.5 sm:mt-0 flex-shrink-0",
                            activity.type === 'post' && "bg-cyan-500",
                            activity.type === 'engagement' && "bg-cyan-500",
                            activity.type === 'milestone' && "bg-amber-500"
                          )} />
                          <span className="text-xs sm:text-sm line-clamp-2 sm:line-clamp-1">{activity.message}</span>
                        </div>
                        <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                          {activity.timestamp}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </AnimatedCard>
          </TabsContent>

          {/* Analytics Tab - Mobile Optimized */}
          <TabsContent value="analytics" className="space-y-4 sm:space-y-6">
            <AnimatedCard delay={0.1}>
              <Card className={cn(glassStyles.base, glassStyles.hover)}>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 sm:pb-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-500" />
                      Real-Time Analytics
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      Live performance metrics across all platforms
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.reload()}
                    className={cn(glassStyles.button, "w-full sm:w-auto")}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                    {/* Engagement Chart Placeholder */}
                    <div className="md:col-span-2 space-y-4 order-2 md:order-1">
                      <div className="h-48 sm:h-64 rounded-lg bg-white/5 flex items-center justify-center">
                        <div className="text-center px-4">
                          <BarChart3 className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-4 text-cyan-500/50" />
                          <p className="text-sm sm:text-base text-muted-foreground">Engagement Over Time</p>
                          <p className="text-xs sm:text-sm text-muted-foreground/60">Chart visualization connected to backend</p>
                        </div>
                      </div>
                    </div>

                    {/* Platform Breakdown */}
                    <div className="space-y-3 sm:space-y-4 order-1 md:order-2">
                      <h4 className="font-medium text-sm sm:text-base">Platform Breakdown</h4>
                      {['Twitter', 'Instagram', 'LinkedIn', 'YouTube'].map((platform, i) => (
                        <div key={platform} className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-white/5 touch-manipulation">
                          <span className="text-xs sm:text-sm">{platform}</span>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 sm:h-2 w-16 sm:w-24 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full bg-cyan-500"
                                style={{ width: `${[65, 45, 30, 25][i]}%` }}
                              />
                            </div>
                            <span className="text-[10px] sm:text-xs text-muted-foreground w-6 text-right">{[65, 45, 30, 25][i]}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </AnimatedCard>
          </TabsContent>

          {/* AI Studio Tab - Mobile Optimized */}
          <TabsContent value="ai-studio" className="space-y-4 sm:space-y-6">
            <AnimatedCard delay={0.1}>
              <Card className={cn(glassStyles.base, glassStyles.hover)}>
                <CardHeader className="pb-2 sm:pb-4">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />
                    AI Content Studio
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Generate viral content with AI-powered tools
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-6">
                  {/* Quick Actions */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
                    {[
                      { icon: <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />, title: 'Generate Post', desc: 'Create engaging social posts' },
                      { icon: <Target className="h-4 w-4 sm:h-5 sm:w-5" />, title: 'Hashtag Ideas', desc: 'Find trending hashtags' },
                      { icon: <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />, title: 'Content Calendar', desc: 'Plan your content strategy' },
                    ].map((action, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        className={cn(glassStyles.button, "h-auto py-3 sm:py-4 flex flex-row sm:flex-col items-center gap-2 sm:gap-2 justify-start sm:justify-center touch-manipulation")}
                      >
                        {action.icon}
                        <div className="text-left sm:text-center">
                          <span className="font-medium text-sm sm:text-base block">{action.title}</span>
                          <span className="text-[10px] sm:text-xs text-muted-foreground">{action.desc}</span>
                        </div>
                      </Button>
                    ))}
                  </div>

                  {/* Recent AI Generations */}
                  <div>
                    <h4 className="font-medium mb-3 sm:mb-4 text-sm sm:text-base">Recent AI Generations</h4>
                    <div className="space-y-2 sm:space-y-3">
                      {[
                        { type: 'Post', content: '10 tips for growing your audience...', time: '2 min ago' },
                        { type: 'Hashtags', content: '#SocialMedia #Growth #Marketing', time: '15 min ago' },
                        { type: 'Caption', content: 'New product launch announcement...', time: '1 hour ago' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-start sm:items-center justify-between p-2 sm:p-3 rounded-lg bg-white/5 gap-2 touch-manipulation">
                          <div className="flex items-start sm:items-center gap-2 sm:gap-3 min-w-0 flex-1">
                            <Badge variant="outline" className="text-[10px] sm:text-xs flex-shrink-0">{item.type}</Badge>
                            <span className="text-xs sm:text-sm truncate">{item.content}</span>
                          </div>
                          <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">{item.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </AnimatedCard>
          </TabsContent>

          {/* Team Tab - Mobile Optimized */}
          <TabsContent value="team" className="space-y-4 sm:space-y-6">
            <AnimatedCard delay={0.1}>
              <Card className={cn(glassStyles.base, glassStyles.hover)}>
                <CardHeader className="pb-2 sm:pb-4">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-500" />
                    Team Collaboration
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Manage your team and collaborate on content
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-6">
                  {/* Team Members */}
                  <div>
                    <h4 className="font-medium mb-3 sm:mb-4 text-sm sm:text-base">Team Members</h4>
                    <div className="space-y-2 sm:space-y-3">
                      {[
                        { name: 'John Doe', role: 'Admin', status: 'online' },
                        { name: 'Jane Smith', role: 'Editor', status: 'online' },
                        { name: 'Mike Johnson', role: 'Viewer', status: 'offline' },
                      ].map((member, i) => (
                        <div key={i} className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-white/5 touch-manipulation">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs sm:text-sm font-medium">{member.name.charAt(0)}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-medium truncate">{member.name}</p>
                              <p className="text-[10px] sm:text-xs text-muted-foreground">{member.role}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                            <div className={cn(
                              "h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full",
                              member.status === 'online' ? "bg-emerald-500" : "bg-gray-500"
                            )} />
                            <span className="text-[10px] sm:text-xs text-muted-foreground capitalize">{member.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pending Invites */}
                  <div>
                    <h4 className="font-medium mb-3 sm:mb-4 text-sm sm:text-base">Pending Invites</h4>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-0 p-2 sm:p-3 rounded-lg bg-white/5">
                      <span className="text-xs sm:text-sm text-muted-foreground">No pending invites</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className={cn(glassStyles.button, "w-full sm:w-auto text-xs sm:text-sm")}
                        onClick={() => router.push('/dashboard/team')}
                      >
                        Invite Member
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </AnimatedCard>
          </TabsContent>

          {/* Scheduler Tab - Mobile Optimized */}
          <TabsContent value="scheduler" className="space-y-4 sm:space-y-6">
            <AnimatedCard delay={0.1}>
              <Card className={cn(glassStyles.base, glassStyles.hover)}>
                <CardHeader className="pb-2 sm:pb-4">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-500" />
                    Post Scheduler
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Schedule and manage your upcoming posts
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-6">
                  {/* Upcoming Posts */}
                  <div>
                    <h4 className="font-medium mb-3 sm:mb-4 text-sm sm:text-base">Upcoming Posts</h4>
                    <div className="space-y-2 sm:space-y-3">
                      {[
                        { platform: 'Twitter', content: 'Product launch announcement', time: 'Today, 2:00 PM', status: 'scheduled' },
                        { platform: 'Instagram', content: 'Behind the scenes photo', time: 'Tomorrow, 10:00 AM', status: 'scheduled' },
                        { platform: 'LinkedIn', content: 'Industry insights article', time: 'Feb 3, 9:00 AM', status: 'draft' },
                      ].map((post, i) => (
                        <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-3 rounded-lg bg-white/5 gap-2 sm:gap-3 touch-manipulation">
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <Badge variant="outline" className="text-[10px] sm:text-xs flex-shrink-0">{post.platform}</Badge>
                            <span className="text-xs sm:text-sm truncate">{post.content}</span>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 flex-shrink-0">
                            <span className="text-[10px] sm:text-xs text-muted-foreground">{post.time}</span>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-[10px] sm:text-xs",
                                post.status === 'scheduled' ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
                              )}
                            >
                              {post.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Schedule New Post Button */}
                  <Button className={cn(glassStyles.buttonPrimary, "w-full text-sm sm:text-base py-2.5 sm:py-3")}>
                    <Plus className="h-4 w-4 mr-2" />
                    Schedule New Post
                  </Button>
                </CardContent>
              </Card>
            </AnimatedCard>
          </TabsContent>
        </Tabs>

        {/* Competitor Analysis - Mobile Optimized */}
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

// Stat Card Component - Mobile Optimized
function StatCard({
  icon,
  label,
  value,
  trend,
  trendUp
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend: string;
  trendUp: boolean;
}) {
  return (
    <div className="p-2 sm:p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors touch-manipulation">
      <div className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground mb-1 sm:mb-2">
        {icon}
        <span className="text-[10px] sm:text-xs truncate">{label}</span>
      </div>
      <div className="text-lg sm:text-2xl font-bold">{value}</div>
      <div className={cn(
        "text-[10px] sm:text-xs mt-0.5 sm:mt-1",
        trendUp ? "text-emerald-500" : "text-rose-500"
      )}>
        {trendUp ? "↑" : "↓"} {trend}
      </div>
    </div>
  );
}
