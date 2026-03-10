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
      const data = await res.json();

      if (data.success) {
        setWorkflows(data.workflows || []);
        setReadiness(data.readiness || null);
        setError(null);
      } else {
        setError(data.error || 'Failed to load video system status');
      }
    } catch {
      setError('Failed to connect to video API');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const startProduction = async (workflowId: string, skipUpload: boolean = false) => {
    setProducing(workflowId);
    setError(null);

    try {
      const res = await fetch('/api/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ workflow: workflowId, skipUpload }),
      });

      const data = await res.json();

      if (data.success) {
        setResults((prev) => [data.production, ...prev]);
      } else {
        setError(data.error || 'Production failed');
      }
    } catch {
      setError('Failed to start video production');
    } finally {
      setProducing(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Video Production</h1>
            <p className="text-gray-400 mt-1">Loading video system...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-xl bg-white/5 animate-pulse" />
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
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Video className="w-6 h-6 text-cyan-400" />
            Video Production
          </h1>
          <p className="text-gray-400 mt-1">
            Produce marketing videos from real dashboard workflows
          </p>
        </div>
        <button
          onClick={fetchStatus}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
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
          className={`p-4 rounded-xl border flex items-start gap-3 ${
            readiness.ready
              ? 'bg-emerald-500/10 border-emerald-500/20'
              : 'bg-amber-500/10 border-amber-500/20'
          }`}
        >
          {readiness.ready ? (
            <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p className={`font-medium ${readiness.ready ? 'text-emerald-400' : 'text-amber-400'}`}>
              {readiness.ready ? 'System Ready' : 'Partial Configuration'}
            </p>
            {readiness.issues.length > 0 && (
              <ul className="mt-1 space-y-1">
                {readiness.issues.map((issue, i) => (
                  <li key={i} className="text-amber-400/80 text-sm flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-amber-400" />
                    {issue}
                  </li>
                ))}
              </ul>
            )}
            {!readiness.ready && (
              <p className="text-amber-400/60 text-xs mt-2">
                You can still produce videos locally with &quot;Skip Upload&quot;
              </p>
            )}
          </div>
        </div>
      )}

      {/* Workflows Grid */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Available Workflows</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map((workflow) => {
            const IconComponent = WORKFLOW_ICONS[workflow.id] || Video;
            const isProducing = producing === workflow.id;

            return (
              <div
                key={workflow.id}
                className="p-5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-cyan-500/30 transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                    <IconComponent className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    ~{workflow.duration}s
                  </div>
                </div>

                <h3 className="text-white font-medium mb-1">{workflow.name}</h3>
                <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                  {workflow.description}
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => startProduction(workflow.id, false)}
                    disabled={isProducing || !!producing}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
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
                      className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
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
      </div>

      {/* Production Results */}
      {results.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Production History</h2>
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
                    <p className="text-white font-medium">{result.workflowName}</p>
                    {result.error ? (
                      <p className="text-red-400/80 text-sm">{result.error}</p>
                    ) : (
                      <p className="text-gray-400 text-sm">
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
          <h3 className="text-gray-400 font-medium mb-1">No productions yet</h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            Select a workflow above to produce a marketing video. The pipeline captures real
            dashboard interactions, processes the video, and optionally uploads to YouTube.
          </p>
        </div>
      )}
    </div>
  );
}
