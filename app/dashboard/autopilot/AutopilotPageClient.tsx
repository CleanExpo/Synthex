'use client';

/**
 * Autopilot Dashboard Client
 *
 * Wires the 5 orphaned autopilot API routes into a usable UI:
 *   - /api/autopilot/stats        GET  — stats bar
 *   - /api/autopilot/config       GET  — config panel read
 *   - /api/autopilot/config       PATCH — config panel write
 *   - /api/autopilot/runs         GET  — paginated runs table
 *   - /api/autopilot/runs/[runId] GET  — run detail sheet
 *   - /api/autopilot/preview      POST — next-action preview card
 *
 * @task UNI-1652
 */

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import {
  BarChart3,
  CheckCircle,
  ChevronRight,
  Clock,
  Cpu,
  Eye,
  Loader2,
  Play,
  RefreshCw,
  Settings2,
  Sparkles,
  XCircle,
  Zap,
} from '@/components/icons';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

// ─── Fetcher (Synthex standard: credentials: 'include') ─────────────────────

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => r.json());

// ─── Types ───────────────────────────────────────────────────────────────────

interface AutopilotStats {
  totalRuns: number;
  totalPostsGenerated: number;
  avgScore: number;
  successRate: number;
  lastRun: {
    id: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    postsGenerated: number;
    avgScore: number | null;
    durationMs: number | null;
  } | null;
  config: {
    enabled: boolean;
    status: string;
    nextRunAt: string | null;
    lastRunAt: string | null;
    enabledPlatforms: string[];
  };
}

interface AutopilotConfig {
  enabled: boolean;
  status: string;
  postsPerDayPerPlatform: number;
  planningHorizonDays: number;
  minScoreThreshold: number;
  autoApproveThreshold: number;
  contentMix: Record<string, number>;
  enableABTesting: boolean;
  enableTrendContent: boolean;
  enableRepurposing: boolean;
  enabledPlatforms: string[];
  lastRunAt: string | null;
  nextRunAt: string | null;
}

interface AutopilotRun {
  id: string;
  runType: string;
  status: string;
  postsGenerated: number;
  postsScheduled: number;
  postsDrafted: number;
  postsRejected: number;
  avgScore: number | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  postIds: string[];
}

interface RunDetail {
  run: AutopilotRun;
  posts: Array<{
    id: string;
    content: string;
    platform: string;
    status: string;
    scheduledAt: string | null;
  }>;
}

interface PreviewSlot {
  platform: string;
  date: string;
  theme: string;
  reason: string;
}

interface AutopilotPreview {
  preview: boolean;
  platforms: string[];
  horizonDays: number;
  postsPerDayPerPlatform: number;
  totalExistingPosts: number;
  slotsToGenerate: number;
  slots: PreviewSlot[];
  message?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDuration(ms: number | null): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    running: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    failed: 'text-red-400 bg-red-500/10 border-red-500/20',
    pending: 'text-slate-400 bg-white/[0.04] border-white/10',
    idle: 'text-slate-400 bg-white/[0.04] border-white/10',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-medium border tracking-wide uppercase',
        map[status] ?? 'text-slate-400 bg-white/[0.04] border-white/10'
      )}
    >
      {status}
    </span>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: AutopilotStats }) {
  const tiles = [
    {
      label: 'Total Runs',
      value: stats.totalRuns.toLocaleString(),
      icon: Play,
    },
    {
      label: 'Success Rate',
      value: `${stats.successRate}%`,
      icon: CheckCircle,
    },
    {
      label: 'Posts Generated',
      value: stats.totalPostsGenerated.toLocaleString(),
      icon: Sparkles,
    },
    {
      label: 'Avg Score',
      value: stats.avgScore > 0 ? `${stats.avgScore}` : '—',
      icon: BarChart3,
    },
    {
      label: 'Last Run',
      value: formatRelative(stats.lastRun?.startedAt ?? null),
      icon: Clock,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {tiles.map(({ label, value, icon: Icon }) => (
        <div
          key={label}
          className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Icon className="w-3.5 h-3.5 text-white/30" />
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/40">
              {label}
            </span>
          </div>
          <p className="text-2xl font-light text-white">{value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Config Panel ─────────────────────────────────────────────────────────────

function ConfigPanel({
  config,
  onSave,
  isSaving,
}: {
  config: AutopilotConfig;
  onSave: (patch: Partial<AutopilotConfig>) => Promise<void>;
  isSaving: boolean;
}) {
  const [enabled, setEnabled] = useState(config.enabled);
  const [postsPerDay, setPostsPerDay] = useState(config.postsPerDayPerPlatform);
  const [horizonDays, setHorizonDays] = useState(config.planningHorizonDays);

  const isDirty =
    enabled !== config.enabled ||
    postsPerDay !== config.postsPerDayPerPlatform ||
    horizonDays !== config.planningHorizonDays;

  return (
    <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Settings2 className="w-4 h-4 text-white/40" />
        <h2 className="text-sm font-light text-white">Configuration</h2>
        {config.enabledPlatforms.length === 0 && (
          <span className="ml-auto text-[10px] text-amber-400/70 bg-amber-500/[0.06] border border-amber-500/20 px-2 py-0.5 rounded-sm">
            No platforms enabled
          </span>
        )}
      </div>

      <div className="space-y-4">
        {/* Enable / disable toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white/70">Autopilot enabled</p>
            <p className="text-[10px] text-white/30 mt-0.5">
              Automatically generate and schedule content
            </p>
          </div>
          <button
            onClick={() => setEnabled(v => !v)}
            aria-pressed={enabled}
            className={cn(
              'relative w-10 h-5 rounded-full transition-colors flex-shrink-0',
              enabled ? 'bg-amber-500/70' : 'bg-white/10'
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all',
                enabled ? 'left-[calc(100%-18px)]' : 'left-0.5'
              )}
            />
          </button>
        </div>

        {/* Posts per day */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.15em] text-white/40 mb-1.5">
              Posts / Day / Platform
            </label>
            <input
              type="number"
              min={1}
              max={5}
              value={postsPerDay}
              onChange={e =>
                setPostsPerDay(Math.max(1, Math.min(5, Number(e.target.value))))
              }
              className="w-full px-3 py-2 text-xs bg-white/[0.03] border-[0.5px] border-white/[0.08] text-white rounded-sm focus:outline-none focus:border-amber-500/40"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.15em] text-white/40 mb-1.5">
              Planning Horizon (days)
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={horizonDays}
              onChange={e =>
                setHorizonDays(
                  Math.max(1, Math.min(30, Number(e.target.value)))
                )
              }
              className="w-full px-3 py-2 text-xs bg-white/[0.03] border-[0.5px] border-white/[0.08] text-white rounded-sm focus:outline-none focus:border-amber-500/40"
            />
          </div>
        </div>

        {/* Next run info */}
        {config.nextRunAt && (
          <p className="text-[10px] text-white/30">
            Next run:{' '}
            {new Date(config.nextRunAt).toLocaleString('en-AU', {
              dateStyle: 'short',
              timeStyle: 'short',
            })}
          </p>
        )}

        {isDirty && (
          <button
            onClick={() =>
              onSave({
                enabled,
                postsPerDayPerPlatform: postsPerDay,
                planningHorizonDays: horizonDays,
              })
            }
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-[#050508] text-xs font-semibold rounded-sm transition-colors disabled:opacity-60"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            {isSaving ? 'Saving…' : 'Save Changes'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Preview Card ─────────────────────────────────────────────────────────────

function PreviewCard({ orgHasPlatforms }: { orgHasPlatforms: boolean }) {
  const [preview, setPreview] = useState<AutopilotPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPreview = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/autopilot/preview', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horizonDays: 7, postsPerDayPerPlatform: 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Preview failed');
      setPreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-white/40" />
          <h2 className="text-sm font-light text-white">Next Action Preview</h2>
        </div>
        <button
          onClick={fetchPreview}
          disabled={isLoading || !orgHasPlatforms}
          title={
            !orgHasPlatforms
              ? 'Enable platforms in Config first'
              : 'Generate preview'
          }
          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-white/50 border-[0.5px] border-white/[0.08] hover:text-white/70 hover:border-white/[0.15] rounded-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          {isLoading ? 'Generating…' : 'Generate Preview'}
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400/70 bg-red-500/[0.06] border border-red-500/20 px-3 py-2 rounded-sm">
          {error}
        </p>
      )}

      {!preview && !error && !isLoading && (
        <p className="text-xs text-white/30 py-4 text-center">
          {orgHasPlatforms
            ? 'Click "Generate Preview" to see what autopilot would create next.'
            : 'Enable at least one platform in Config to use autopilot.'}
        </p>
      )}

      {preview && (
        <div className="space-y-3">
          <div className="flex items-center gap-4 text-[10px] text-white/40">
            <span>
              {preview.slotsToGenerate} slots over {preview.horizonDays} days
            </span>
            <span>{preview.platforms.join(', ')}</span>
          </div>

          {preview.message && (
            <p className="text-xs text-amber-400/70">{preview.message}</p>
          )}

          <div className="space-y-1 max-h-52 overflow-y-auto scrollbar-thin">
            {preview.slots.slice(0, 20).map((slot, i) => (
              <div
                key={i}
                className="flex items-start gap-3 py-2 px-3 bg-white/[0.02] rounded-sm border-[0.5px] border-white/[0.04]"
              >
                <span className="text-[10px] text-white/30 w-16 flex-shrink-0 mt-0.5">
                  {new Date(slot.date).toLocaleDateString('en-AU', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-white/60 capitalize">
                      {slot.platform}
                    </span>
                    <span className="text-[10px] text-amber-400/60 bg-amber-500/[0.06] px-1.5 py-0.5 rounded-sm">
                      {slot.theme}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/30 mt-0.5 truncate">
                    {slot.reason}
                  </p>
                </div>
              </div>
            ))}
            {preview.slots.length > 20 && (
              <p className="text-[10px] text-white/30 text-center pt-1">
                +{preview.slots.length - 20} more slots
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Run Detail Sheet ─────────────────────────────────────────────────────────

function RunDetailSheet({
  runId,
  open,
  onClose,
}: {
  runId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { data, isLoading } = useSWR<RunDetail>(
    open && runId ? `/api/autopilot/runs/${runId}` : null,
    fetchJson
  );

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="bg-[#0a0a12] border-white/[0.06] text-white w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="border-b border-white/[0.06] pb-4 mb-4">
          <SheetTitle className="text-sm font-light text-white">
            Run Detail
          </SheetTitle>
        </SheetHeader>

        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-white/30" />
          </div>
        )}

        {data && (
          <div className="space-y-5">
            {/* Run summary */}
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Status', <StatusBadge key="s" status={data.run.status} />],
                ['Type', data.run.runType],
                ['Posts Generated', data.run.postsGenerated],
                ['Posts Scheduled', data.run.postsScheduled],
                ['Posts Drafted', data.run.postsDrafted],
                ['Posts Rejected', data.run.postsRejected],
                [
                  'Avg Score',
                  data.run.avgScore != null
                    ? `${Math.round(data.run.avgScore)}`
                    : '—',
                ],
                ['Duration', formatDuration(data.run.durationMs)],
                ['Started', formatRelative(data.run.startedAt)],
                [
                  'Completed',
                  data.run.completedAt
                    ? formatRelative(data.run.completedAt)
                    : '—',
                ],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="bg-white/[0.02] rounded-sm px-3 py-2"
                >
                  <p className="text-[10px] text-white/30 mb-0.5">{label}</p>
                  <div className="text-xs text-white/70">{value}</div>
                </div>
              ))}
            </div>

            {data.run.errorMessage && (
              <div className="px-3 py-2 bg-red-500/[0.06] border border-red-500/20 rounded-sm">
                <p className="text-[10px] text-red-400/70 font-medium mb-1">
                  Error
                </p>
                <p className="text-xs text-red-400/60 font-mono break-all">
                  {data.run.errorMessage}
                </p>
              </div>
            )}

            {/* Associated posts */}
            {data.posts.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-white/40 mb-2">
                  Posts ({data.posts.length})
                </p>
                <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-thin">
                  {data.posts.map(post => (
                    <div
                      key={post.id}
                      className="px-3 py-2 bg-white/[0.02] rounded-sm border-[0.5px] border-white/[0.04]"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] text-white/50 capitalize">
                          {post.platform}
                        </span>
                        <StatusBadge status={post.status} />
                      </div>
                      <p className="text-[10px] text-white/40 line-clamp-2">
                        {post.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Runs Table ───────────────────────────────────────────────────────────────

function RunsTable({ onSelectRun }: { onSelectRun: (runId: string) => void }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, mutate } = useSWR<{
    runs: AutopilotRun[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>(`/api/autopilot/runs?page=${page}&limit=15`, fetchJson);

  return (
    <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-white/40" />
          <h2 className="text-sm font-light text-white">Run History</h2>
          {data && (
            <span className="text-[10px] text-white/30 bg-white/[0.04] px-2 py-0.5 rounded-sm">
              {data.pagination.total} total
            </span>
          )}
        </div>
        <button
          onClick={() => mutate()}
          className="text-white/40 hover:text-white/70 transition-colors"
          aria-label="Refresh runs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-white/30" />
        </div>
      )}

      {data && data.runs.length === 0 && (
        <div className="py-12 text-center">
          <Play className="w-6 h-6 text-white/20 mx-auto mb-3" />
          <p className="text-sm text-white/30 font-light">No runs yet</p>
          <p className="text-xs text-white/20 mt-1">
            Enable autopilot to start generating content automatically
          </p>
        </div>
      )}

      {data && data.runs.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {[
                    'Status',
                    'Type',
                    'Posts',
                    'Score',
                    'Duration',
                    'Started',
                    '',
                  ].map(h => (
                    <th
                      key={h}
                      className="text-left text-[10px] uppercase tracking-[0.15em] text-white/30 px-4 py-2.5 font-normal"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.runs.map(run => (
                  <tr
                    key={run.id}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-4 py-3 text-white/50 capitalize">
                      {run.runType}
                    </td>
                    <td className="px-4 py-3 text-white/60">
                      {run.postsGenerated}
                    </td>
                    <td className="px-4 py-3 text-white/60">
                      {run.avgScore != null ? Math.round(run.avgScore) : '—'}
                    </td>
                    <td className="px-4 py-3 text-white/40">
                      {formatDuration(run.durationMs)}
                    </td>
                    <td className="px-4 py-3 text-white/40">
                      {formatRelative(run.startedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onSelectRun(run.id)}
                        className="flex items-center gap-1 text-white/30 hover:text-white/60 transition-colors"
                        aria-label="View run detail"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.04]">
              <span className="text-[10px] text-white/30">
                Page {data.pagination.page} of {data.pagination.totalPages}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-[10px] text-white/40 border-[0.5px] border-white/[0.08] rounded-sm hover:text-white/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <button
                  onClick={() =>
                    setPage(p => Math.min(data.pagination.totalPages, p + 1))
                  }
                  disabled={page === data.pagination.totalPages}
                  className="px-3 py-1.5 text-[10px] text-white/40 border-[0.5px] border-white/[0.08] rounded-sm hover:text-white/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AutopilotPageClient() {
  const { data: stats, isLoading: statsLoading } = useSWR<AutopilotStats>(
    '/api/autopilot/stats',
    fetchJson
  );
  const {
    data: config,
    isLoading: configLoading,
    mutate: mutateConfig,
  } = useSWR<AutopilotConfig>('/api/autopilot/config', fetchJson);

  const [isSaving, setIsSaving] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const handleSaveConfig = useCallback(
    async (patch: Partial<AutopilotConfig>) => {
      setIsSaving(true);
      try {
        const res = await fetch('/api/autopilot/config', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? 'Save failed');
        }
        await mutateConfig();
      } catch (e) {
        // Surface error to user via browser alert — simple and adequate
        // for an admin-level settings page
        alert(e instanceof Error ? e.message : 'Failed to save config');
      } finally {
        setIsSaving(false);
      }
    },
    [mutateConfig]
  );

  const isLoading = statsLoading || configLoading;
  const orgHasPlatforms =
    (config?.enabledPlatforms?.length ?? 0) > 0 ||
    (stats?.config?.enabledPlatforms?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/50 mb-2 block">
              AI Agents
            </span>
            <h1 className="text-3xl sm:text-4xl font-extralight tracking-tight text-white">
              Autopilot
            </h1>
            <p className="mt-1.5 text-sm text-white/40 leading-relaxed">
              Autonomous content generation and scheduling
            </p>
          </div>

          {/* Live status indicator */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {stats?.config.enabled ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-xs text-emerald-400/70">Active</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-white/20" />
                <span className="text-xs text-white/30">Inactive</span>
              </>
            )}
          </div>
        </div>
        <div className="mt-5 h-px bg-white/[0.06]" />
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-white/30" />
        </div>
      )}

      {!isLoading && stats && config && (
        <>
          {/* 1. Stats Bar */}
          <StatsBar stats={stats} />

          {/* 2 + 3. Config + Preview side-by-side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ConfigPanel
              config={config}
              onSave={handleSaveConfig}
              isSaving={isSaving}
            />
            <PreviewCard orgHasPlatforms={orgHasPlatforms} />
          </div>

          {/* 4. Runs Table */}
          <RunsTable onSelectRun={setSelectedRunId} />

          {/* 5. Run Detail Sheet */}
          <RunDetailSheet
            runId={selectedRunId}
            open={selectedRunId !== null}
            onClose={() => setSelectedRunId(null)}
          />
        </>
      )}
    </div>
  );
}
