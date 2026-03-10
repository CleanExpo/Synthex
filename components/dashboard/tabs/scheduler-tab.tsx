'use client';

/**
 * Scheduler Tab Component
 * Post scheduling and management
 */

import { Calendar, Plus } from '@/components/icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { glassStyles } from '@/components/ui/index';
import { cn } from '@/lib/utils';
import { AnimatedCard } from '../animated-card';

export function SchedulerTab() {
  return (
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
            <div className="flex items-center justify-center p-4 sm:p-6 rounded-lg bg-white/5">
              <p className="text-xs sm:text-sm text-muted-foreground">No scheduled posts yet. Create your first post to get started.</p>
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
  );
}
