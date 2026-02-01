'use client';

import { useEffect, useState } from 'react';
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
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { glassStyles, animationVariants } from '@/components/ui/index';
// Phase 4B: Dashboard Integration - Components ready for connection
// import { QuickStats } from '@/components/QuickStats';
// import RealTimeAnalytics from '@/components/RealTimeAnalytics';
// import AIContentStudio from '@/components/AIContentStudio';
// import { CollaborationTools } from '@/components/CollaborationTools';
// import PostScheduler from '@/components/PostScheduler';
// import { CompetitorAnalysis } from '@/components/CompetitorAnalysis';
import { cn } from '@/lib/utils';

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

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    // Simulate fetching dashboard data
    const fetchDashboardData = async () => {
      try {
        // In production, this would call the actual API
        // const response = await fetch('/api/dashboard/stats');
        // const data = await response.json();
        
        // Simulated data for now
        const mockData: DashboardStats = {
          totalPosts: 156,
          scheduledPosts: 23,
          engagementRate: 4.8,
          followers: 12543,
          trendingTopics: ['#AI', '#SocialMedia', '#Marketing', '#Automation'],
          recentActivity: [
            { id: '1', type: 'post', message: 'Published post on Twitter', timestamp: '2 min ago' },
            { id: '2', type: 'engagement', message: 'Post reached 1K impressions', timestamp: '15 min ago' },
            { id: '3', type: 'milestone', message: 'Gained 100 new followers', timestamp: '1 hour ago' },
            { id: '4', type: 'post', message: 'Scheduled 5 posts for next week', timestamp: '2 hours ago' },
          ]
        };
        
        setStats(mockData);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className={cn(
        "sticky top-0 z-40 border-b border-white/10",
        glassStyles.solid
      )}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold gradient-text-premium">
                Dashboard
              </h1>
              <p className="text-sm text-muted-foreground">
                Welcome back! Here's what's happening with your social media.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                className={cn(glassStyles.button, "relative")}
              >
                <Bell className="h-4 w-4" />
                <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-violet-500 animate-pulse" />
              </Button>
              <Button 
                className={cn(glassStyles.buttonPrimary, "gap-2")}
              >
                <Plus className="h-4 w-4" />
                New Post
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Quick Stats Placeholder - Phase 4B: Integrate QuickStats component */}
        <AnimatedCard delay={0}>
          <Card className={cn(glassStyles.base, glassStyles.hover)}>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
              <CardDescription>Real-time performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-white/5">
                  <div className="text-2xl font-bold">{stats?.totalPosts || 0}</div>
                  <div className="text-xs text-muted-foreground">Total Posts</div>
                </div>
                <div className="p-4 rounded-lg bg-white/5">
                  <div className="text-2xl font-bold">{stats?.engagementRate || 0}%</div>
                  <div className="text-xs text-muted-foreground">Engagement</div>
                </div>
                <div className="p-4 rounded-lg bg-white/5">
                  <div className="text-2xl font-bold">{stats?.followers?.toLocaleString() || '0'}</div>
                  <div className="text-xs text-muted-foreground">Followers</div>
                </div>
                <div className="p-4 rounded-lg bg-white/5">
                  <div className="text-2xl font-bold">{stats?.scheduledPosts || 0}</div>
                  <div className="text-xs text-muted-foreground">Scheduled</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </AnimatedCard>

        {/* Main Dashboard Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className={cn(
            "grid w-full grid-cols-2 md:grid-cols-5 lg:w-fit",
            glassStyles.base
          )}>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="ai-studio">AI Studio</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="scheduler">Scheduler</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Stats Cards */}
              <AnimatedCard delay={0.1} className="lg:col-span-2">
                <Card className={cn(glassStyles.base, glassStyles.hover)}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-violet-500" />
                      Performance Overview
                    </CardTitle>
                    <CardDescription>
                      Track your social media performance across all platforms
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <StatCard
                        icon={<Share2 className="h-5 w-5" />}
                        label="Total Posts"
                        value={stats?.totalPosts || 0}
                        trend="+12%"
                        trendUp={true}
                      />
                      <StatCard
                        icon={<Calendar className="h-5 w-5" />}
                        label="Scheduled"
                        value={stats?.scheduledPosts || 0}
                        trend="+5"
                        trendUp={true}
                      />
                      <StatCard
                        icon={<TrendingUp className="h-5 w-5" />}
                        label="Engagement"
                        value={`${stats?.engagementRate || 0}%`}
                        trend="+0.8%"
                        trendUp={true}
                      />
                      <StatCard
                        icon={<Users className="h-5 w-5" />}
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
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-amber-500" />
                      Trending Topics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {stats?.trendingTopics?.map((topic, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className={cn(
                            "cursor-pointer transition-all hover:scale-105",
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

            {/* Recent Activity */}
            <AnimatedCard delay={0.3}>
              <Card className={cn(glassStyles.base, glassStyles.hover)}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-cyan-500" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {stats?.recentActivity?.map((activity, index) => (
                      <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * index }}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "h-2 w-2 rounded-full",
                            activity.type === 'post' && "bg-violet-500",
                            activity.type === 'engagement' && "bg-cyan-500",
                            activity.type === 'milestone' && "bg-amber-500"
                          )} />
                          <span className="text-sm">{activity.message}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {activity.timestamp}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </AnimatedCard>
          </TabsContent>

          {/* Analytics Tab - Phase 4B: Integrate RealTimeAnalytics */}
          <TabsContent value="analytics">
            <Card className={cn(glassStyles.base)}>
              <CardHeader>
                <CardTitle>Analytics</CardTitle>
                <CardDescription>Detailed analytics coming in Phase 4B</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Real-time analytics integration in progress
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Studio Tab - Phase 4B: Integrate AIContentStudio */}
          <TabsContent value="ai-studio">
            <Card className={cn(glassStyles.base)}>
              <CardHeader>
                <CardTitle>AI Studio</CardTitle>
                <CardDescription>AI content generation coming in Phase 4B</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  AI Studio integration in progress
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Team Tab - Phase 4B: Integrate CollaborationTools */}
          <TabsContent value="team">
            <Card className={cn(glassStyles.base)}>
              <CardHeader>
                <CardTitle>Team Collaboration</CardTitle>
                <CardDescription>Team features coming in Phase 4B</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Team collaboration integration in progress
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Scheduler Tab - Phase 4B: Integrate PostScheduler */}
          <TabsContent value="scheduler">
            <Card className={cn(glassStyles.base)}>
              <CardHeader>
                <CardTitle>Post Scheduler</CardTitle>
                <CardDescription>Advanced scheduling coming in Phase 4B</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Post scheduler integration in progress
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Competitor Analysis - Phase 4B: Integrate CompetitorAnalysis */}
        <AnimatedCard delay={0.4}>
          <Card className={cn(glassStyles.base)}>
            <CardHeader>
              <CardTitle>Competitor Analysis</CardTitle>
              <CardDescription>Track your competitors (Phase 4B)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-32 flex items-center justify-center text-muted-foreground">
                Competitor analysis integration in progress
              </div>
            </CardContent>
          </Card>
        </AnimatedCard>
      </main>
    </div>
  );
}

// Stat Card Component
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
    <div className="p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className={cn(
        "text-xs mt-1",
        trendUp ? "text-emerald-500" : "text-rose-500"
      )}>
        {trendUp ? "↑" : "↓"} {trend}
      </div>
    </div>
  );
}
