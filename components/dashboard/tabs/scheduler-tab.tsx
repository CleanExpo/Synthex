'use client';

/**
 * Scheduler Tab Component
 * Post scheduling and management
 */

import { Calendar, Plus } from '@/components/icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { glassStyles } from '@/components/ui/index';
import { cn } from '@/lib/utils';
import { AnimatedCard } from '../animated-card';
import { mockScheduledPosts } from '../dashboard-config';

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
            <div className="space-y-2 sm:space-y-3">
              {mockScheduledPosts.map((post, i) => (
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
  );
}
