'use client';

/**
 * Algorithm Sentinel Dashboard (Phase 97)
 *
 * 3 tabs:
 *  - Health    — SiteHealthCard + MetricTrendChart (clicks + position)
 *  - Alerts    — AlertFeed with severity filter + acknowledge controls
 *  - Algorithm — AlgorithmUpdateTimeline with date range filter
 *
 * URL: /dashboard/sentinel?tab=health|alerts|algorithm
 *
 * @module app/dashboard/sentinel/page
 */

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShieldExclamation, BarChart3, Bell } from '@/components/icons';
import { SiteHealthCard } from '@/components/sentinel/SiteHealthCard';
import { AlertFeed } from '@/components/sentinel/AlertFeed';
import { AlgorithmUpdateTimeline } from '@/components/sentinel/AlgorithmUpdateTimeline';
import { MetricTrendChart } from '@/components/sentinel/MetricTrendChart';
import { useUser } from '@/hooks/use-user';

// ─── Types ────────────────────────────────────────────────────────────────────

type SentinelTab = 'health' | 'alerts' | 'algorithm';
const VALID_TABS: SentinelTab[] = ['health', 'alerts', 'algorithm'];

// ─── SWR fetcher ──────────────────────────────────────────────────────────────

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => {
    if (!r.ok) throw new Error('Fetch failed');
    return r.json();
  });

// ─── Severity filter options ──────────────────────────────────────────────────

type SeverityFilter = 'all' | 'critical' | 'warning' | 'info';

const SEVERITY_OPTIONS: { value: SeverityFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' },
];

const DAY_RANGE_OPTIONS = [
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
  { value: 365, label: 'Last year' },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SentinelPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawTab = searchParams.get('tab') ?? 'health';
  const activeTab: SentinelTab = VALID_TABS.includes(rawTab as SentinelTab)
    ? (rawTab as SentinelTab)
    : 'health';

  const { user } = useUser();

  // Alert controls
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');

  // Algorithm timeline controls
  const [dayRange, setDayRange] = useState(90);

  const changeTab = useCallback(
    (tab: SentinelTab) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', tab);
      router.push(`/dashboard/sentinel?${params.toString()}`);
    },
    [router, searchParams]
  );

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data: statusData, isLoading: statusLoading, mutate: mutateStatus } = useSWR(
    '/api/sentinel/status',
    fetchJson,
    { refreshInterval: 60000 } // Refresh every minute
  );

  const alertUrl =
    severityFilter === 'all'
      ? '/api/sentinel/alerts?acknowledged=false&limit=50'
      : `/api/sentinel/alerts?severity=${severityFilter}&acknowledged=false&limit=50`;

  const { data: alertsData, isLoading: alertsLoading, mutate: mutateAlerts } = useSWR(
    alertUrl,
    fetchJson
  );

  const { data: updatesData, isLoading: updatesLoading } = useSWR(
    `/api/sentinel/updates?days=${dayRange}`,
    fetchJson
  );

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleCheckNow = useCallback(async () => {
    await fetch('/api/sentinel/check', {
      method: 'POST',
      credentials: 'include',
    });
    await mutate('/api/sentinel/status');
    await mutateStatus();
  }, [mutateStatus]);

  const handleAcknowledge = useCallback(
    async (id: string) => {
      await fetch(`/api/sentinel/alerts/${id}/acknowledge`, {
        method: 'POST',
        credentials: 'include',
      });
      await mutateAlerts();
      await mutateStatus();
    },
    [mutateAlerts, mutateStatus]
  );

  const handleMarkAllRead = useCallback(async () => {
    const alerts = alertsData?.alerts ?? [];
    await Promise.all(
      alerts.map((a: { id: string; acknowledged: boolean }) =>
        !a.acknowledged
          ? fetch(`/api/sentinel/alerts/${a.id}/acknowledge`, {
              method: 'POST',
              credentials: 'include',
            })
          : Promise.resolve()
      )
    );
    await mutateAlerts();
    await mutateStatus();
  }, [alertsData, mutateAlerts, mutateStatus]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const status = statusData ?? {};
  const alerts = alertsData?.alerts ?? [];
  const updates = updatesData?.updates ?? [];
  const history: Array<{ date: string; avgPosition: number; totalClicks: number; totalImpressions: number }> =
    status.history ?? [];

  const unreadCount = status.unacknowledgedAlerts ?? 0;
  const criticalCount = status.criticalAlerts ?? 0;

  const clicksData = history.map((h) => ({ date: h.date, value: h.totalClicks }));
  const positionData = history.map((h) => ({ date: h.date, value: h.avgPosition }));

  const snapshotHistory = history.map((h) => ({ date: h.date, totalClicks: h.totalClicks }));

  return (
    <div className="min-h-screen bg-[#0f1117] text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Page Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
            <ShieldExclamation className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Algorithm Sentinel</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Autonomous site health monitoring and algorithm impact detection
            </p>
          </div>

          {/* Critical badge */}
          {criticalCount > 0 && (
            <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-300 text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              {criticalCount} critical {criticalCount === 1 ? 'alert' : 'alerts'}
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => changeTab(v as SentinelTab)}>
          <TabsList className="mb-6">
            <TabsTrigger value="health" className="flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              Health
            </TabsTrigger>
            <TabsTrigger value="alerts" className="flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5" />
              Alerts
              {unreadCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-red-500/80 text-white font-bold">
                  {unreadCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="algorithm" className="flex items-center gap-1.5">
              <ShieldExclamation className="w-3.5 h-3.5" />
              Algorithm Updates
            </TabsTrigger>
          </TabsList>

          {/* ── Health Tab ── */}
          <TabsContent value="health" className="space-y-6">
            <SiteHealthCard
              siteUrl={status.siteUrl ?? null}
              healthScore={status.healthScore ?? null}
              lastChecked={status.lastChecked ?? null}
              snapshot={status.snapshot ?? null}
              onCheckNow={handleCheckNow}
            />

            {history.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <MetricTrendChart
                  data={clicksData}
                  label="Total Clicks (28-day)"
                  colour="#22d3ee"
                />
                <MetricTrendChart
                  data={positionData}
                  label="Average Position (lower is better)"
                  colour="#a78bfa"
                  invertY
                />
              </div>
            )}

            {history.length === 0 && !statusLoading && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-gray-500 text-sm">
                Run your first health check to see metric trends here.
              </div>
            )}
          </TabsContent>

          {/* ── Alerts Tab ── */}
          <TabsContent value="alerts" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Severity filter */}
              <div className="flex items-center gap-1.5">
                {SEVERITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSeverityFilter(opt.value)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                      severityFilter === opt.value
                        ? 'bg-cyan-500/30 text-cyan-300'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Mark all read */}
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
                >
                  Mark all read ({unreadCount})
                </button>
              )}
            </div>

            <AlertFeed
              alerts={alerts}
              onAcknowledge={handleAcknowledge}
              loading={alertsLoading}
            />
          </TabsContent>

          {/* ── Algorithm Tab ── */}
          <TabsContent value="algorithm" className="space-y-4">
            <div className="flex items-center gap-2">
              {DAY_RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDayRange(opt.value)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    dayRange === opt.value
                      ? 'bg-cyan-500/30 text-cyan-300'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <AlgorithmUpdateTimeline
                updates={updates}
                snapshots={snapshotHistory}
                loading={updatesLoading}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
