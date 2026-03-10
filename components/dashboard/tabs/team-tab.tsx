'use client';

/**
 * Team Tab Component
 * Team collaboration and member management
 */

import { useRouter } from 'next/navigation';
import { Users } from '@/components/icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { glassStyles } from '@/components/ui/index';
import { cn } from '@/lib/utils';
import { AnimatedCard } from '../animated-card';

export function TeamTab() {
  const router = useRouter();

  return (
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
            <div className="flex items-center justify-center p-4 sm:p-6 rounded-lg bg-white/5">
              <p className="text-xs sm:text-sm text-muted-foreground">No team members yet. Visit the Team page to invite members.</p>
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
  );
}
