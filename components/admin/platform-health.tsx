'use client';

/**
 * Platform Health Component
 *
 * Displays job queue statistics and subscription metrics.
 * Data sources:
 *   - /api/admin/jobs (SWR) — queue stats, dead-letter jobs
 *   - /api/admin/platform-stats (SWR) — user + subscription counts
 *
 * Actions:
 *   - "Retry Failed Jobs" → POST /api/admin/jobs { action: 'retry-all-dead' }
 */

import useSWR from 'swr';
import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw,
  Users,
  CreditCard,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  DollarSign,
} from '@/components/icons';

// =============================================================================
// Types
// =============================================================================

interface QueueStat {
  name: string;
  pending: number;
  active: number;
  completed: number;
  failed: number;
  dead: number;
}

interface JobsApiResponse {
  success: boolean;
  data?: {
    stats?: QueueStat[];
    recentDeadLetterJobs?: unknown[];
    recentPendingJobs?: unknown[];
  };
}

interface PlatformStatsApiResponse {
  success: boolean;
  data?: {
    totalUsers: number;
    activeSubscriptions: number;
    trialingSubscriptions: number;
    cancelledSubscriptions: number;
    freeUsers: number;
    mrr: number;
    mrrDetails?: {
      stripeMrr: number;
      estimatedMrr: number;
      currency: string;
      stripeActiveCount: number;
      calculatedAt: string;
    };
  };
}

// =============================================================================
// Fetcher
// =============================================================================

function fetchJson(url: string) {
  return fetch(url, { credentials: 'include' }).then((r) => r.json());
}

// =============================================================================
// Component
// =============================================================================

export function PlatformHealth() {
  const [isRetrying, setIsRetrying] = useState(false);

  const {
    data: jobsData,
    isLoading: jobsLoading,
    mutate: mutateJobs,
  } = useSWR<JobsApiResponse>('/api/admin/jobs', fetchJson, {
    refreshInterval: 30_000, // auto-refresh every 30 s
  });

  const { data: platformData, isLoading: platformLoading } =
    useSWR<PlatformStatsApiResponse>('/api/admin/platform-stats', fetchJson, {
      refreshInterval: 60_000,
    });

  const queueStats: QueueStat[] = jobsData?.data?.stats ?? [];
  const deadJobCount = jobsData?.data?.recentDeadLetterJobs?.length ?? 0;
  const platform = platformData?.data;

  // ---------------------------------------------------------------------------
  // Retry all failed jobs
  // ---------------------------------------------------------------------------

  const handleRetryAllDead = async () => {
    setIsRetrying(true);
    try {
      const res = await fetch('/api/admin/jobs', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry-all-dead' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Retry failed');
      toast.success(json.message ?? 'Failed jobs queued for retry');
      mutateJobs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to retry jobs');
    } finally {
      setIsRetrying(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function StatCard({
    label,
    value,
    icon: Icon,
    iconClass = 'text-cyan-400',
    description,
  }: {
    label: string;
    value: string | number;
    icon: React.ComponentType<{ className?: string }>;
    iconClass?: string;
    description?: string;
  }) {
    return (
      <Card variant="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Icon className={`w-4 h-4 ${iconClass}`} />
            {label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-white">{value}</p>
          {description && <p className="text-xs text-gray-400 mt-1">{description}</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Subscription Metrics                                                */}
      {/* ------------------------------------------------------------------ */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Subscription Metrics</CardTitle>
          <CardDescription>Live counts from the database</CardDescription>
        </CardHeader>
        <CardContent>
          {platformLoading ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <StatCard
                label="Total Users"
                value={platform?.totalUsers ?? 0}
                icon={Users}
                description="All registered accounts"
              />
              <StatCard
                label="Active Subscriptions"
                value={platform?.activeSubscriptions ?? 0}
                icon={CreditCard}
                iconClass="text-green-400"
                description="Paying subscribers"
              />
              <StatCard
                label="Trialling"
                value={platform?.trialingSubscriptions ?? 0}
                icon={Clock}
                iconClass="text-yellow-400"
                description="In free trial"
              />
              <StatCard
                label="Free Users"
                value={platform?.freeUsers ?? 0}
                icon={Users}
                iconClass="text-gray-400"
                description="No active subscription"
              />
              <StatCard
                label="Monthly Revenue"
                value={`$${(platform?.mrr ?? 0).toLocaleString('en-AU', { minimumFractionDigits: 0 })} AUD`}
                icon={DollarSign}
                iconClass="text-emerald-400"
                description={
                  platform?.mrrDetails?.stripeMrr
                    ? `From Stripe (${platform.mrrDetails.stripeActiveCount} subs)`
                    : 'Estimated from plan prices'
                }
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Job Queue Stats                                                      */}
      {/* ------------------------------------------------------------------ */}
      <Card variant="glass">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Job Queue Health</CardTitle>
            <CardDescription>
              Background job status — refreshes every 30 seconds
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {deadJobCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRetryAllDead}
                disabled={isRetrying}
                className="text-red-400 hover:text-red-300 border border-red-500/30"
              >
                {isRetrying ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <AlertTriangle className="w-4 h-4 mr-2" />
                )}
                Retry {deadJobCount} Failed Job{deadJobCount !== 1 ? 's' : ''}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => mutateJobs()}
              className="text-gray-400 hover:text-white"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {jobsLoading ? (
            <p className="text-gray-400 text-sm">Loading job stats...</p>
          ) : queueStats.length === 0 ? (
            <p className="text-gray-400 text-sm">
              No queue data available. Jobs may not be running.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 px-3 text-gray-400 font-medium">Queue</th>
                    <th className="text-right py-2 px-3 text-gray-400 font-medium">
                      <Clock className="w-3 h-3 inline mr-1 text-yellow-400" />
                      Pending
                    </th>
                    <th className="text-right py-2 px-3 text-gray-400 font-medium">
                      <Activity className="w-3 h-3 inline mr-1 text-blue-400" />
                      Active
                    </th>
                    <th className="text-right py-2 px-3 text-gray-400 font-medium">
                      <CheckCircle className="w-3 h-3 inline mr-1 text-green-400" />
                      Completed
                    </th>
                    <th className="text-right py-2 px-3 text-gray-400 font-medium">
                      <XCircle className="w-3 h-3 inline mr-1 text-red-400" />
                      Failed
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {queueStats.map((q) => (
                    <tr
                      key={q.name}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="py-2 px-3 text-white font-medium">
                        {q.name}
                        {q.dead > 0 && (
                          <Badge className="ml-2 bg-red-500/20 text-red-400 text-xs">
                            {q.dead} dead
                          </Badge>
                        )}
                      </td>
                      <td className="text-right py-2 px-3 text-yellow-300">{q.pending}</td>
                      <td className="text-right py-2 px-3 text-blue-300">{q.active}</td>
                      <td className="text-right py-2 px-3 text-green-300">{q.completed}</td>
                      <td className="text-right py-2 px-3 text-red-300">{q.failed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
