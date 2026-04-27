'use client';

/**
 * Video Production Dashboard
 *
 * @description Manage and produce marketing videos using the SYNTHEX video pipeline.
 * Supports workflow selection, readiness checks, and production monitoring.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Video,
  Play,
  Check,
  AlertTriangle,
  Loader2,
  Clock,
  FileText,
  BarChart3,
  Calendar,
  TrendingUp,
  Zap,
  RefreshCw,
} from '@/components/icons';
import { ApiKeyGate } from '@/components/api-key-gate/ApiKeyGate';
import { VideoEpisodeMonitor } from '@/components/dashboard/VideoEpisodeMonitor';

interface WorkflowInfo {
  id: string;
  name: string;
  description: string;
  duration: number;
}

interface ReadinessStatus {
  ready: boolean;
  issues: string[];
}

interface ProductionResult {
  workflowName: string;
  rawVideoPath: string;
  processedVideoPath: string;
  thumbnailPath: string | null;
  youtubeResult: {
    videoId: string;
    videoUrl: string;
    embedUrl: string;
    thumbnailUrl: string;
  } | null;
  error: string | null;
}

const WORKFLOW_ICONS: Record<string, React.ElementType> = {
  platformOverview: Zap,
  contentGenerator: FileText,
  analyticsDashboard: BarChart3,
  smartScheduler: Calendar,
  viralPatterns: TrendingUp,
};

export default function VideoProductionPage() {
  const [workflows, setWorkflows] = useState<WorkflowInfo[]>([]);
  const [readiness, setReadiness] = useState<ReadinessStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [producing, setProducing] = useState<string | null>(null);
  const [results, setResults] = useState<ProductionResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/video', { credentials: 'include' });
      // SYN-732 Phase 2: previously trusted data.success on a 500 response —
      // a server error with malformed JSON would leave error=undefined and
      // the UI in a stuck "loaded but empty" state.
      if (!res.ok) {
        throw new Error(`Video status load failed (${res.status})`);
      }
      const data = await res.json();

      if (data.success) {
        setWorkflows(data.workflows || []);
        setReadiness(data.readiness || null);
        setError(null);
      } else {
        setError(data.error || 'Failed to load video system status');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to connect to video API'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const startProduction = async (
    workflowId: string,
    skipUpload: boolean = false
  ) => {
    setProducing(workflowId);
    setError(null);

    try {
      const res = await fetch('/api/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ workflow: workflowId, skipUpload }),
      });

      // SYN-732 Phase 2: same pattern as fetchStatus — don't trust
      // data.success on a non-OK response.
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errBody.error ?? `Production failed (${res.status})`);
      }

      const data = await res.json();

      if (data.success) {
        setResults(prev => [data.production, ...prev]);
      } else {
        setError(data.error || 'Production failed');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to start video production'
      );
    } finally {
      setProducing(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="mb-6">
          <div className="h-3 w-24 bg-white/[0.05] rounded-sm mb-3" />
          <div className="h-8 w-48 bg-white/[0.05] rounded-sm" />
          <div className="h-px bg-white/[0.06] mt-5" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="h-48 border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/50 mb-2 block">
            Production
          </span>
          <h1 className="text-3xl sm:text-4xl font-extralight tracking-tight text-white flex items-center gap-2">
            <Video className="w-7 h-7 text-orange-400" />
            Video Production
          </h1>
          <p className="mt-1.5 text-sm text-white/40 leading-relaxed">
            Produce marketing videos from real dashboard workflows
          </p>
        </div>
        <button
          onClick={fetchStatus}
          className="flex items-center gap-2 px-4 py-2 rounded-sm border-[0.5px] border-white/[0.06] bg-white/[0.02] text-white/40 hover:bg-white/[0.04] hover:text-white transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-sm border-[0.5px] border-red-500/20 bg-red-500/[0.05] flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-medium">Error</p>
            <p className="text-red-400/80 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Readiness Status */}
      {readiness && (
        <div
          className={`p-4 rounded-sm border-[0.5px] flex items-start gap-3 ${
            readiness.ready
              ? 'bg-emerald-500/[0.06] border-emerald-500/20'
              : 'bg-orange-500/[0.06] border-orange-500/20'
          }`}
        >
          {readiness.ready ? (
            <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p
              className={`font-medium ${readiness.ready ? 'text-emerald-400' : 'text-orange-400'}`}
            >
              {readiness.ready ? 'System Ready' : 'Partial Configuration'}
            </p>
            {readiness.issues.length > 0 && (
              <ul className="mt-1 space-y-1">
                {readiness.issues.map((issue, i) => (
                  <li
                    key={i}
                    className="text-orange-400/80 text-sm flex items-center gap-1"
                  >
                    <span className="w-1 h-1 rounded-full bg-orange-400" />
                    {issue}
                  </li>
                ))}
              </ul>
            )}
            {!readiness.ready && (
              <p className="text-orange-400/60 text-xs mt-2">
                You can still produce videos locally with &quot;Skip
                Upload&quot;
              </p>
            )}
          </div>
        </div>
      )}

      {/* Workflows Grid */}
      <div>
        <h2 className="text-sm uppercase tracking-[0.2em] text-white/40 mb-4">
          Available Workflows
        </h2>
        <ApiKeyGate provider="elevenlabs" featureName="Video Production">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map(workflow => {
              const IconComponent = WORKFLOW_ICONS[workflow.id] || Video;
              const isProducing = producing === workflow.id;

              return (
                <div
                  key={workflow.id}
                  className="p-5 rounded-sm border-[0.5px] border-white/[0.06] bg-white/[0.02] hover:border-orange-500/30 transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-sm bg-orange-500/10 border-[0.5px] border-orange-500/20 flex items-center justify-center">
                      <IconComponent className="w-5 h-5 text-orange-400" />
                    </div>
                    <div className="flex items-center gap-1 text-xs text-white/50">
                      <Clock className="w-3 h-3" />~{workflow.duration}s
                    </div>
                  </div>

                  <h3 className="text-white font-medium mb-1">
                    {workflow.name}
                  </h3>
                  <p className="text-white/40 text-sm mb-4 line-clamp-2">
                    {workflow.description}
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => startProduction(workflow.id, false)}
                      disabled={isProducing || !!producing}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-sm bg-orange-500/20 border-[0.5px] border-orange-500/30 text-orange-400 hover:bg-orange-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      {isProducing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Producing...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          Produce
                        </>
                      )}
                    </button>
                    {readiness && !readiness.ready && (
                      <button
                        onClick={() => startProduction(workflow.id, true)}
                        disabled={isProducing || !!producing}
                        className="flex items-center justify-center gap-1 px-3 py-2 rounded-sm bg-white/[0.02] border-[0.5px] border-white/[0.06] text-white/40 hover:bg-white/[0.04] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                        title="Produce locally without uploading to YouTube"
                      >
                        Local Only
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ApiKeyGate>
      </div>

      {/* Production Results */}
      {results.length > 0 && (
        <div>
          <h2 className="text-sm uppercase tracking-[0.2em] text-white/40 mb-4">
            Production History
          </h2>
          <div className="space-y-3">
            {results.map((result, i) => (
              <div
                key={i}
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  result.error
                    ? 'bg-red-500/5 border-red-500/20'
                    : 'bg-white/[0.03] border-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  {result.error ? (
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  ) : (
                    <Check className="w-5 h-5 text-emerald-400" />
                  )}
                  <div>
                    <p className="text-white font-medium">
                      {result.workflowName}
                    </p>
                    {result.error ? (
                      <p className="text-red-400/80 text-sm">{result.error}</p>
                    ) : (
                      <p className="text-gray-300 text-sm">
                        {result.processedVideoPath || 'Processing complete'}
                      </p>
                    )}
                  </div>
                </div>

                {result.youtubeResult && (
                  <a
                    href={result.youtubeResult.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors text-sm"
                  >
                    <Play className="w-3 h-3" />
                    Watch on YouTube
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State Info */}
      {results.length === 0 && !loading && (
        <div className="text-center py-12 rounded-xl bg-white/[0.02] border border-white/5">
          <Video className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <h3 className="text-gray-300 font-medium mb-1">No productions yet</h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            Select a workflow above to produce a marketing video. The pipeline
            captures real dashboard interactions, processes the video, and
            optionally uploads to YouTube.
          </p>
        </div>
      )}

      {/* Divider */}
      <div className="h-px bg-white/[0.06] my-2" />

      {/* Autonomous Episode Monitor */}
      <VideoEpisodeMonitor />
    </div>
  );
}
