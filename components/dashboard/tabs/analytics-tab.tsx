'use client';

/**
 * Analytics Tab Component
 * Real-time analytics with platform breakdown
 */

import { TrendingUp, BarChart3, RefreshCw } from '@/components/icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { glassStyles } from '@/components/ui/index';
import { cn } from '@/lib/utils';
import { AnimatedCard } from '../animated-card';

export function AnalyticsTab() {
  return (
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
              <div className="flex items-center justify-center p-4 sm:p-6 rounded-lg bg-white/5">
                <p className="text-xs sm:text-sm text-muted-foreground">No platform data yet. Connect your accounts to see analytics.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </AnimatedCard>
  );
}
