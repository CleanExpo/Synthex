'use client';

/**
 * AutonomousPostLog — SYN-551 Trust Architecture Layer
 *
 * Paginated, filterable log of every auto-publish action Synthex has taken.
 * Reads from GET /api/activity/autonomous with cursor-based pagination.
 * Includes inline Pause/Resume button.
 */

import { useState, useCallback } from 'react';
import useSWRInfinite from 'swr/infinite';
import {
  CheckCircle2,
  XCircle,
  Clock,
  PauseCircle,
  Loader2,
  RefreshCw,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PauseButton } from './PauseButton';
import { cn } from '@/lib/utils';

// ── Types ───────────────────────────────────────────────────────────────────

interface LogEntry {
  id: string;
  action: string;
  platform: string;
  timestamp: string;
  scheduledAt: string;
  publishedAt: string | null;
  error: string | null;
  attempts: number;
  slotId: string;
  weekStart: string | null;
}

interface AutonomousResponse {
  log: LogEntry[];
  nextCursor: string | null;
  hasMore: boolean;
  orgState: {
    autoPublishPaused: boolean;
    calendarMode: string;
  };
}

// ── Fetch helpers ────────────────────────────────────────────────────────────

const fetchJson = (url: string): Promise<AutonomousResponse> =>
  fetch(url, { credentials: 'include' }).then(r => {
    if (!r.ok) throw new Error('Failed to load activity log');
    return r.json();
  });

function getKey(
  pageIndex: number,
  previousPageData: AutonomousResponse | null,
  status: string
): string | null {
  if (previousPageData && !previousPageData.hasMore) return null;
  const cursor = previousPageData?.nextCursor;
  const base = `/api/activity/autonomous?limit=50&status=${status}`;
  return cursor ? `${base}&cursor=${encodeURIComponent(cursor)}` : base;
}

// ── Action display config ────────────────────────────────────────────────────

const ACTION_CONFIG: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    iconClass: string;
  }
> = {
  published: {
    icon: CheckCircle2,
    label: 'Published',
    variant: 'default',
    iconClass: 'text-green-400',
  },
  failed: {
    icon: XCircle,
    label: 'Failed',
    variant: 'destructive',
    iconClass: 'text-red-400',
  },
  scheduled: {
    icon: Clock,
    label: 'Scheduled',
    variant: 'secondary',
    iconClass: 'text-blue-400',
  },
  paused: {
    icon: PauseCircle,
    label: 'Held',
    variant: 'outline',
    iconClass: 'text-amber-400',
  },
  publishing: {
    icon: Loader2,
    label: 'Publishing',
    variant: 'secondary',
    iconClass: 'text-cyan-400 animate-spin',
  },
};

// ── Component ────────────────────────────────────────────────────────────────

export function AutonomousPostLog() {
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<AutonomousResponse>(
      (pageIndex, prev) => getKey(pageIndex, prev, statusFilter),
      fetchJson,
      { revalidateFirstPage: false }
    );

  const allEntries = data?.flatMap(page => page.log) ?? [];
  const hasMore = data?.[data.length - 1]?.hasMore ?? false;
  const isPaused = data?.[0]?.orgState?.autoPublishPaused ?? false;

  const loadMore = useCallback(() => setSize(size + 1), [size, setSize]);

  const handleFilterChange = useCallback(
    (val: string) => {
      setStatusFilter(val);
      mutate();
    },
    [mutate]
  );

  return (
    <div className="space-y-4">
      {/* ── Header row ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Autonomous Post Log</h2>
          {isPaused && (
            <Badge
              variant="outline"
              className="text-amber-500 border-amber-500 text-[10px]"
            >
              Paused
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={handleFilterChange}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="pending">Scheduled</SelectItem>
              <SelectItem value="held">Held</SelectItem>
            </SelectContent>
          </Select>

          <PauseButton />
        </div>
      </div>

      {/* ── Log entries ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading activity log…</span>
        </div>
      ) : allEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <Activity className="h-8 w-8 opacity-30" />
          <p className="text-sm">No activity yet</p>
          <p className="text-xs">
            Posts will appear here once auto-publishing is active.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card divide-y divide-border">
          {allEntries.map(entry => (
            <LogRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      {/* ── Load more ───────────────────────────────────────────────────── */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={loadMore}
            disabled={isValidating}
            className="gap-1.5 text-xs"
          >
            {isValidating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

// ── LogRow ────────────────────────────────────────────────────────────────────

function LogRow({ entry }: { entry: LogEntry }) {
  const config = ACTION_CONFIG[entry.action] ?? ACTION_CONFIG['scheduled'];
  const Icon = config.icon;

  const ts = new Date(entry.timestamp);
  const dateLabel = ts.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeLabel = ts.toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
      <Icon
        className={cn('h-4 w-4 mt-0.5 shrink-0', config.iconClass)}
        aria-hidden
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium capitalize">{config.label}</span>
          <Badge variant="outline" className="text-[10px] capitalize">
            {entry.platform}
          </Badge>
          {entry.attempts > 1 && (
            <span className="text-[10px] text-muted-foreground">
              {entry.attempts} attempts
            </span>
          )}
        </div>

        {entry.error && (
          <p
            className="text-xs text-red-400 mt-0.5 truncate"
            title={entry.error}
          >
            {entry.error}
          </p>
        )}
      </div>

      <div className="text-right shrink-0">
        <p className="text-xs text-muted-foreground">{dateLabel}</p>
        <p className="text-xs text-muted-foreground">{timeLabel}</p>
      </div>
    </div>
  );
}
