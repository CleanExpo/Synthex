'use client';

/**
 * Overview Tab Component
 * Main dashboard overview with stats, trending topics, and activity
 */

import { motion } from 'framer-motion';
import { BarChart3, Share2, Calendar, TrendingUp, Users, Zap, MessageSquare } from '@/components/icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { glassStyles } from '@/components/ui/index';
import { cn } from '@/lib/utils';
import { AnimatedCard } from '../animated-card';
import { StatCard } from '../stat-card';
import type { DashboardStats } from '../types';

interface OverviewTabProps {
  stats: DashboardStats | null;
}

export function OverviewTab({ stats }: OverviewTabProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
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

      {/* Recent Activity */}
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
    </div>
  );
}
