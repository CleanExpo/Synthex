'use client';

/**
 * ScheduleHealth Component
 *
 * Dashboard widget showing publishing pipeline health metrics:
 * - 7-day success rate (large percentage, colour-coded)
 * - Published / Failed / Retrying counts
 * - Average publish delay
 * - Next scheduled post countdown
 * - Top failure reasons with count badges
 *
 * Data source: GET /api/scheduler/stats
 */

import useSWR from 'swr';
import {
  CheckCircle,
  AlertCircle,
  Clock,
  RotateCcw,
  TrendingUp,
} from '@/components/icons';

// =============================================================================
// Types
// =============================================================================

interface ScheduleHealthStats {
  last7Days: {
    total: number;
    published: number;
    failed: number;
    retrying: number;
    successRate: number;
  };
  averageDelayMinutes: number;
  failureReasons: Array<{ reason: string; count: number }>;
  nextScheduled: {
    count: number;
    nextAt: string | null;
  };
  retryQueue: {
    count: number;
  };
}

// =============================================================================
// SWR Fetcher
// =============================================================================

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

// =============================================================================
// Helpers
// =============================================================================

function getSuccessRateColour(rate: number): string {
  if (rate >= 90) return 'text-emerald-400';
  if (rate >= 70) return 'text-amber-400';
  return 'text-red-400';
}

function getSuccessRateBg(rate: number): string {
  if (rate >= 90) return 'bg-emerald-500/10 border-emerald-500/20';
  if (rate >= 70) return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'No posts scheduled';
  const diff = new Date(dateStr).getTime() - Date.now();

  if (diff <= 0) return 'Publishing now';

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `in ${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `in ${hours}h ${remainingMinutes}m`;
  }
  return `in ${remainingMinutes}m`;
}

// =============================================================================
// Component
// =============================================================================

export function ScheduleHealth() {
  const { data: stats, isLoading, error } = useSWR<ScheduleHealthStats>(
    '/api/scheduler/stats',
    fetchJson,
    { revalidateOnFocus: false, refreshInterval: 60_000 }
  );

  if (isLoading) {
    return (
      <div className="rounded-xl border border-white/10 bg-gray-900/50 backdrop-blur-sm p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-40 bg-white/10 rounded" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="h-20 bg-white/5 rounded-lg" />
            <div className="h-20 bg-white/5 rounded-lg" />
            <div className="h-20 bg-white/5 rounded-lg" />
            <div className="h-20 bg-white/5 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return null; // Silently hide if stats unavailable
  }

  const { last7Days, averageDelayMinutes, failureReasons, nextScheduled, retryQueue } = stats;
  const hasActivity = last7Days.total > 0 || last7Days.published > 0 || last7Days.failed > 0;

  return (
    <div className="rounded-xl border border-white/10 bg-gray-900/50 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">Schedule Health</h3>
        </div>
        <span className="text-xs text-gray-500">Last 7 days</span>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-6">
          {/* Primary metric: success rate */}
          <div
            className={`flex flex-col items-center justify-center p-6 rounded-xl border ${getSuccessRateBg(
              last7Days.successRate
            )}`}
          >
            <span
              className={`text-4xl font-bold tabular-nums ${getSuccessRateColour(
                last7Days.successRate
              )}`}
            >
              {hasActivity ? `${last7Days.successRate}%` : '—'}
            </span>
            <span className="text-xs text-gray-400 mt-1">Success Rate</span>
          </div>

          {/* Secondary metrics grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Published */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Published</p>
                <p className="text-lg font-semibold text-white tabular-nums">
                  {last7Days.published}
                </p>
              </div>
            </div>

            {/* Failed */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertCircle className="h-4 w-4 text-red-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Failed</p>
                <p
                  className={`text-lg font-semibold tabular-nums ${
                    last7Days.failed > 0 ? 'text-red-400' : 'text-white'
                  }`}
                >
                  {last7Days.failed}
                </p>
              </div>
            </div>

            {/* Average Delay */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <Clock className="h-4 w-4 text-cyan-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Avg Delay</p>
                <p className="text-lg font-semibold text-white tabular-nums">
                  {averageDelayMinutes > 0 ? `${averageDelayMinutes}m` : '0m'}
                </p>
              </div>
            </div>

            {/* Next Up / Retry Queue */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
              <div className="p-2 rounded-lg bg-purple-500/10">
                {retryQueue.count > 0 ? (
                  <RotateCcw className="h-4 w-4 text-amber-400" />
                ) : (
                  <Clock className="h-4 w-4 text-purple-400" />
                )}
              </div>
              <div>
                {retryQueue.count > 0 ? (
                  <>
                    <p className="text-xs text-gray-500">Retrying</p>
                    <p className="text-lg font-semibold text-amber-400 tabular-nums">
                      {retryQueue.count}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-gray-500">Next Up</p>
                    <p className="text-sm font-medium text-white">
                      {formatRelativeTime(nextScheduled.nextAt)}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Failure reasons (only if any failures) */}
        {failureReasons.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-xs text-gray-500 mb-2">Top Failure Reasons</p>
            <div className="space-y-1.5">
              {failureReasons.slice(0, 3).map((fr, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-red-500/[0.03] border border-red-500/10"
                >
                  <span className="text-xs text-red-300 truncate max-w-[80%]">
                    {fr.reason}
                  </span>
                  <span className="text-xs font-medium text-red-400 bg-red-500/20 px-2 py-0.5 rounded-full ml-2 flex-shrink-0">
                    {fr.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
