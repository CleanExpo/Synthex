'use client';

/**
 * Quick Stats Component
 * Real-time performance metrics grid
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { glassStyles } from '@/components/ui/index';
import { cn } from '@/lib/utils';
import { AnimatedCard } from './animated-card';
import type { DashboardStats } from './types';

interface QuickStatsProps {
  stats: DashboardStats | null;
}

export function QuickStats({ stats }: QuickStatsProps) {
  return (
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
  );
}
