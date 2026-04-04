'use client';

/**
 * PauseButton — SYN-551 Trust Architecture Layer
 *
 * Persistent 1-tap pause control for auto-publishing. When clicked, immediately
 * sets auto_publish_paused = true on the organisation. All pending auto-publish
 * actions are halted until resumed.
 *
 * Reads current pause state via SWR. Mutates via PATCH /api/calendar/pause.
 */

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { PauseCircle, PlayCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => r.json());

interface OrgState {
  autoPublishPaused: boolean;
  calendarMode: string;
}

export function PauseButton({ className }: { className?: string }) {
  const [optimisticPaused, setOptimisticPaused] = useState<boolean | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  // Reads the current org pause state from the autonomous log endpoint
  const { data, mutate } = useSWR<{ orgState: OrgState }>(
    '/api/activity/autonomous?limit=1',
    fetchJson,
    { refreshInterval: 30_000 }
  );

  const serverPaused = data?.orgState?.autoPublishPaused ?? false;
  const calendarMode = data?.orgState?.calendarMode ?? 'shadow';
  const isPaused = optimisticPaused ?? serverPaused;

  // All hooks must be called before any conditional returns
  const toggle = useCallback(async () => {
    const next = !isPaused;
    setOptimisticPaused(next);
    setLoading(true);

    try {
      const res = await fetch('/api/calendar/pause', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused: next }),
      });

      if (!res.ok) throw new Error('Failed to toggle pause');

      await mutate();
    } catch {
      // Revert optimistic update on error
      setOptimisticPaused(null);
    } finally {
      setLoading(false);
    }
  }, [isPaused, mutate]);

  // Only show when in live mode — shadow mode doesn't auto-publish
  if (calendarMode === 'shadow') return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isPaused ? 'default' : 'outline'}
            size="sm"
            onClick={toggle}
            disabled={loading}
            aria-label={isPaused ? 'Resume auto-posting' : 'Pause auto-posting'}
            className={cn(
              'gap-1.5 font-medium transition-colors',
              isPaused
                ? 'bg-amber-500 text-white hover:bg-amber-600 border-amber-500'
                : 'text-muted-foreground hover:text-foreground',
              className
            )}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isPaused ? (
              <PlayCircle className="h-3.5 w-3.5" />
            ) : (
              <PauseCircle className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">
              {isPaused ? 'Resume Auto-Posting' : 'Pause Auto-Posting'}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {isPaused
            ? 'Auto-posting is paused. Nothing will go out until you resume.'
            : 'Pause all scheduled auto-posts immediately.'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
