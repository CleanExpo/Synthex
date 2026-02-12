'use client';

/**
 * Dashboard Header Component
 * Main header with notifications and actions
 */

import { useRouter } from 'next/navigation';
import { Bell, Plus } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { glassStyles } from '@/components/ui/index';
import { cn } from '@/lib/utils';

interface DashboardHeaderProps {
  showNotifications: boolean;
  onToggleNotifications: () => void;
}

export function DashboardHeader({ showNotifications, onToggleNotifications }: DashboardHeaderProps) {
  const router = useRouter();

  return (
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
              Welcome back! Here&apos;s what&apos;s happening with your social media.
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <Button
              variant="outline"
              size="icon"
              className={cn(glassStyles.button, "relative h-9 w-9 sm:h-10 sm:w-10")}
              onClick={onToggleNotifications}
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
  );
}
