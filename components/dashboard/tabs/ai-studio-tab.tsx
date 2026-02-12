'use client';

/**
 * AI Studio Tab Component
 * AI content generation tools and recent generations
 */

import { Zap, MessageSquare, Target, Calendar } from '@/components/icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { glassStyles } from '@/components/ui/index';
import { cn } from '@/lib/utils';
import { AnimatedCard } from '../animated-card';
import { mockAIGenerations, aiQuickActions } from '../dashboard-config';

const actionIcons = [
  <MessageSquare key="msg" className="h-4 w-4 sm:h-5 sm:w-5" />,
  <Target key="target" className="h-4 w-4 sm:h-5 sm:w-5" />,
  <Calendar key="cal" className="h-4 w-4 sm:h-5 sm:w-5" />,
];

export function AIStudioTab() {
  return (
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
            {aiQuickActions.map((action, i) => (
              <Button
                key={i}
                variant="outline"
                className={cn(glassStyles.button, "h-auto py-3 sm:py-4 flex flex-row sm:flex-col items-center gap-2 sm:gap-2 justify-start sm:justify-center touch-manipulation")}
              >
                {actionIcons[i]}
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
              {mockAIGenerations.map((item, i) => (
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
  );
}
