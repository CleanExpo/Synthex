'use client';

import useSWR from 'swr';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Brain,
  Zap,
  AlertCircle,
  Loader2,
  TrendingUp,
} from '@/components/icons';

// --- Types ---
interface ResearchRun {
  id: string;
  runType: 'daily_trends' | 'weekly_deep';
  status: 'running' | 'completed' | 'failed';
  platforms: string[];
  insightsCount: number;
  promptsUpdated: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

interface TrendInsight {
  id: string;
  platform: string;
  category: string;
  insight: string;
  confidence: number;
  dataPoints: number;
  createdAt: string;
}

interface RunsResponse {
  runs: ResearchRun[];
}

interface InsightsResponse {
  insights: TrendInsight[];
  total: number;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json() as Promise<T>;
}

// --- Component ---
export function AutoResearchWidget({ className }: { className?: string }) {
  const [triggering, setTriggering] = useState(false);

  const {
    data: runsData,
    isLoading: runsLoading,
    mutate: mutateRuns,
  } = useSWR<RunsResponse>('/api/auto-research', fetchJson, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  });

  const { data: insightsData, isLoading: insightsLoading } =
    useSWR<InsightsResponse>('/api/auto-research/insights?limit=3', fetchJson, {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    });

  const latestRun = runsData?.runs?.[0];
  const insights = insightsData?.insights ?? [];
  const isLoading = runsLoading || insightsLoading;

  const handleRunResearch = async () => {
    setTriggering(true);
    try {
      const res = await fetch('/api/auto-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'daily_trends' }),
      });
      if (!res.ok) throw new Error('Failed to trigger');
      toast.success('Research run queued — results in ~5 minutes');
      mutateRuns();
    } catch {
      toast.error('Failed to start research run');
    } finally {
      setTriggering(false);
    }
  };

  // Status badge helper
  const statusBadge = (status: string) => {
    if (status === 'completed')
      return (
        <span className="text-xs px-2 py-0.5 rounded-sm bg-emerald-500/20 text-emerald-400">
          completed
        </span>
      );
    if (status === 'running')
      return (
        <span className="text-xs px-2 py-0.5 rounded-sm bg-orange-500/20 text-orange-400 flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          running
        </span>
      );
    if (status === 'failed')
      return (
        <span className="text-xs px-2 py-0.5 rounded-sm bg-red-500/20 text-red-400">
          failed
        </span>
      );
    return null;
  };

  // Category colour
  const categoryColour = (cat: string) => {
    const map: Record<string, string> = {
      hook: 'bg-orange-500/20 text-orange-400',
      visual_style: 'bg-orange-500/20 text-orange-400',
      hashtag: 'bg-blue-500/20 text-blue-400',
      topic: 'bg-orange-500/20 text-orange-400',
      format: 'bg-orange-500/20 text-orange-400',
      cta: 'bg-emerald-500/20 text-emerald-400',
    };
    return map[cat] ?? 'bg-white/10 text-white/50';
  };

  if (isLoading) {
    return (
      <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-5 animate-pulse">
        <div className="h-4 w-32 bg-white/[0.06] rounded-sm mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-3 bg-white/[0.04] rounded-sm" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-5 space-y-4 ${className ?? ''}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-orange-400" />
          <span className="text-sm font-medium text-white/80">
            Auto-Research
          </span>
        </div>
        <button
          onClick={handleRunResearch}
          disabled={triggering || latestRun?.status === 'running'}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border-[0.5px] border-orange-500/20 rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Zap className="h-3 w-3" />
          {triggering ? 'Queuing…' : 'Run Now'}
        </button>
      </div>

      {/* Last run info */}
      {latestRun ? (
        <div className="flex items-center gap-3 text-xs text-white/40">
          {statusBadge(latestRun.status)}
          <span>
            {new Date(latestRun.startedAt).toLocaleString('en-AU', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          <span className="text-white/50">·</span>
          <span>{latestRun.insightsCount} insights</span>
        </div>
      ) : (
        <p className="text-xs text-white/50">
          No runs yet — trigger your first research run
        </p>
      )}

      {/* Top 3 insights */}
      {insights.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] text-white/50 uppercase tracking-wide">
            Latest Trends
          </p>
          {insights.map(insight => (
            <div key={insight.id} className="flex gap-2 items-start">
              <TrendingUp className="h-3 w-3 text-orange-400/60 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/70 leading-relaxed truncate">
                  {insight.insight}
                </p>
                <div className="flex gap-1.5 mt-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-white/[0.06] text-white/40">
                    {insight.platform}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-sm ${categoryColour(insight.category)}`}
                  >
                    {insight.category}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-white/50">
          <AlertCircle className="h-3.5 w-3.5 text-white/50" />
          <span>No insights yet — run a research cycle to start learning</span>
        </div>
      )}
    </div>
  );
}
