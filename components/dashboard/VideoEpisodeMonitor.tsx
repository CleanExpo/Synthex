'use client';

/**
 * VideoEpisodeMonitor — components/dashboard/VideoEpisodeMonitor.tsx
 *
 * Episode monitoring widget for the autonomous video production system.
 * Shows series queue depth, recent episode statuses, quality scores,
 * and held-episode alerts.
 *
 * Fetches from GET /api/video/episodes
 */

import React from 'react';
import useSWR from 'swr';
import {
  Video,
  AlertTriangle,
  Check,
  Clock,
  RefreshCw,
  ExternalLink,
  Loader2,
} from '@/components/icons';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SeriesSummary {
  id: string;
  slug: string;
  name: string;
  seriesType: string;
  status: string;
  nextEpisodeNum: number;
  youtubePlaylistId: string | null;
  queueDepth: number;
  totalTopics: number;
}

interface EpisodeSummary {
  id: string;
  seriesId: string;
  episodeNumber: number;
  title: string;
  slug: string;
  status: string;
  humannessScore: number | null;
  geoTacticScore: number | null;
  slopScanPassed: boolean | null;
  youtubeUrl: string | null;
  blogPostUrl: string | null;
  errorMessage: string | null;
  publishedAt: string | null;
  createdAt: string;
  socialPostsCount: number;
}

interface EpisodesPayload {
  series: SeriesSummary[];
  episodes: EpisodeSummary[];
  summary: Record<string, number>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLOURS: Record<string, string> = {
  queued: 'text-white/50 border-white/10 bg-white/[0.02]',
  scripting: 'text-blue-400 border-blue-500/20 bg-blue-500/[0.05]',
  capturing: 'text-purple-400 border-purple-500/20 bg-purple-500/[0.05]',
  rendering: 'text-purple-400 border-purple-500/20 bg-purple-500/[0.05]',
  quality_check: 'text-yellow-400 border-yellow-500/20 bg-yellow-500/[0.05]',
  publishing: 'text-orange-400 border-orange-500/20 bg-orange-500/[0.05]',
  published: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/[0.05]',
  held: 'text-orange-400 border-orange-500/20 bg-orange-500/[0.05]',
  failed: 'text-red-400 border-red-500/20 bg-red-500/[0.05]',
};

const STATUS_LABELS: Record<string, string> = {
  queued: 'Queued',
  scripting: 'Scripting',
  capturing: 'Capturing',
  rendering: 'Rendering',
  quality_check: 'Quality Check',
  publishing: 'Publishing',
  published: 'Published',
  held: 'Held for Review',
  failed: 'Failed',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function QualityBadge({
  score,
  threshold,
  label,
}: {
  score: number | null;
  threshold: number;
  label: string;
}) {
  if (score === null) return null;
  const pass = score >= threshold;
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] border-[0.5px] ${
        pass
          ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/[0.05]'
          : 'text-red-400 border-red-500/20 bg-red-500/[0.05]'
      }`}
      title={`${label}: ${Math.round(score)}`}
    >
      {pass ? '✓' : '✗'} {label} {Math.round(score)}
    </span>
  );
}

function SeriesCard({
  series,
  episodeCount,
}: {
  series: SeriesSummary;
  episodeCount: number;
}) {
  const isBTS = series.seriesType === 'bts';

  return (
    <div className="p-4 rounded-sm border-[0.5px] border-white/[0.06] bg-white/[0.02]">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-sm flex items-center justify-center border-[0.5px] ${
              isBTS
                ? 'bg-blue-500/10 border-blue-500/20'
                : 'bg-cyan-500/10 border-cyan-500/20'
            }`}
          >
            <Video
              className={`w-4 h-4 ${isBTS ? 'text-blue-400' : 'text-cyan-400'}`}
            />
          </div>
          <div>
            <p className="text-white text-sm font-medium leading-tight">
              {series.name}
            </p>
            <p className="text-white/40 text-[10px] uppercase tracking-wide mt-0.5">
              {isBTS ? 'Behind the Scenes' : 'SMB Client Benefits'}
            </p>
          </div>
        </div>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-sm border-[0.5px] uppercase tracking-wide ${
            series.status === 'active'
              ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/[0.05]'
              : 'text-white/40 border-white/10'
          }`}
        >
          {series.status}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/[0.04]">
        <div className="text-center">
          <p className="text-white font-light text-lg">
            {series.nextEpisodeNum - 1}
          </p>
          <p className="text-white/40 text-[10px] uppercase tracking-wide">
            Episodes
          </p>
        </div>
        <div className="text-center">
          <p className="text-white font-light text-lg">{series.queueDepth}</p>
          <p className="text-white/40 text-[10px] uppercase tracking-wide">
            Queued
          </p>
        </div>
        <div className="text-center">
          <p className="text-white font-light text-lg">{episodeCount}</p>
          <p className="text-white/40 text-[10px] uppercase tracking-wide">
            This Run
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => r.json());

export function VideoEpisodeMonitor() {
  const { data, error, isLoading, mutate } = useSWR<EpisodesPayload>(
    '/api/video/episodes',
    fetchJson,
    { refreshInterval: 60_000 } // Poll every minute
  );

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-4 w-32 bg-white/[0.05] rounded-sm" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(i => (
            <div
              key={i}
              className="h-32 border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm"
            />
          ))}
        </div>
        <div className="h-64 border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 rounded-sm border-[0.5px] border-red-500/20 bg-red-500/[0.04] flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
        <p className="text-red-400/80 text-sm">
          Failed to load episode data.{' '}
          <button
            onClick={() => mutate()}
            className="underline hover:text-red-400 transition-colors"
          >
            Retry
          </button>
        </p>
      </div>
    );
  }

  const { series, episodes, summary } = data;
  const heldEpisodes = episodes.filter(ep => ep.status === 'held');
  const seriesById: Record<string, SeriesSummary> = {};
  for (const s of series) seriesById[s.id] = s;

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/50 mb-1 block">
            Autonomous System
          </span>
          <h2 className="text-xl font-light tracking-tight text-white flex items-center gap-2">
            <Video className="w-5 h-5 text-cyan-400" />
            Episode Monitor
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {/* Summary badges */}
          {summary.published > 0 && (
            <span className="text-[11px] text-emerald-400 border-[0.5px] border-emerald-500/20 bg-emerald-500/[0.05] px-2 py-0.5 rounded-sm">
              {summary.published} published
            </span>
          )}
          {(summary.held ?? 0) > 0 && (
            <span className="text-[11px] text-orange-400 border-[0.5px] border-orange-500/20 bg-orange-500/[0.05] px-2 py-0.5 rounded-sm">
              {summary.held} held
            </span>
          )}
          <button
            onClick={() => mutate()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border-[0.5px] border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white hover:bg-white/[0.04] transition-colors text-xs"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>
      </div>

      {/* Held-episodes alert */}
      {heldEpisodes.length > 0 && (
        <div className="p-4 rounded-sm border-[0.5px] border-orange-500/20 bg-orange-500/[0.04]">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            <p className="text-orange-400 text-sm font-medium">
              {heldEpisodes.length} episode
              {heldEpisodes.length !== 1 ? 's' : ''} held for manual review
            </p>
          </div>
          <div className="space-y-1.5">
            {heldEpisodes.slice(0, 3).map(ep => (
              <p key={ep.id} className="text-orange-400/70 text-xs pl-6">
                Ep {ep.episodeNumber}: {ep.title}
                {ep.errorMessage && (
                  <span className="ml-2 text-orange-400/50">
                    — {ep.errorMessage.substring(0, 80)}
                  </span>
                )}
              </p>
            ))}
            {heldEpisodes.length > 3 && (
              <p className="text-orange-400/50 text-xs pl-6">
                + {heldEpisodes.length - 3} more
              </p>
            )}
          </div>
        </div>
      )}

      {/* Series cards */}
      {series.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {series.map(s => (
            <SeriesCard
              key={s.id}
              series={s}
              episodeCount={episodes.filter(e => e.seriesId === s.id).length}
            />
          ))}
        </div>
      ) : (
        <div className="p-6 rounded-sm border-[0.5px] border-white/[0.06] bg-white/[0.01] text-center">
          <Video className="w-8 h-8 text-white/20 mx-auto mb-2" />
          <p className="text-white/40 text-sm">
            No series configured yet. Run the topic seeder to initialise the BTS
            and CLIENT series.
          </p>
        </div>
      )}

      {/* Recent episodes table */}
      {episodes.length > 0 && (
        <div>
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-3">
            Recent Episodes
          </h3>
          <div className="rounded-sm border-[0.5px] border-white/[0.06] overflow-hidden">
            <div className="divide-y divide-white/[0.04]">
              {episodes.slice(0, 15).map(ep => {
                const s = seriesById[ep.seriesId];
                const statusClass =
                  STATUS_COLOURS[ep.status] ??
                  'text-white/40 border-white/10 bg-white/[0.02]';
                const isActive = [
                  'scripting',
                  'capturing',
                  'rendering',
                  'quality_check',
                  'publishing',
                ].includes(ep.status);

                return (
                  <div
                    key={ep.id}
                    className="px-4 py-3 bg-white/[0.01] hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Left: title + series */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white/30 text-xs font-mono tabular-nums">
                            Ep {ep.episodeNumber}
                          </span>
                          {s && (
                            <span className="text-[10px] text-white/30 uppercase tracking-wide">
                              {s.seriesType === 'bts' ? 'BTS' : 'CLIENT'}
                            </span>
                          )}
                        </div>
                        <p className="text-white text-sm truncate">
                          {ep.title}
                        </p>

                        {/* Quality badges */}
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <QualityBadge
                            score={ep.humannessScore}
                            threshold={70}
                            label="H"
                          />
                          <QualityBadge
                            score={ep.geoTacticScore}
                            threshold={50}
                            label="GEO"
                          />
                          {ep.slopScanPassed !== null && (
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] border-[0.5px] ${
                                ep.slopScanPassed
                                  ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/[0.05]'
                                  : 'text-red-400 border-red-500/20 bg-red-500/[0.05]'
                              }`}
                            >
                              {ep.slopScanPassed ? '✓' : '✗'} Slop
                            </span>
                          )}
                          {ep.socialPostsCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] border-[0.5px] text-cyan-400 border-cyan-500/20 bg-cyan-500/[0.05]">
                              {ep.socialPostsCount} social
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: status + links + time */}
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] border-[0.5px] ${statusClass}`}
                        >
                          {isActive && (
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          )}
                          {ep.status === 'published' && (
                            <Check className="w-2.5 h-2.5" />
                          )}
                          {STATUS_LABELS[ep.status] ?? ep.status}
                        </span>

                        <div className="flex items-center gap-2">
                          {ep.youtubeUrl && (
                            <a
                              href={ep.youtubeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-red-400/70 hover:text-red-400 transition-colors"
                              title="Watch on YouTube"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <span className="text-white/30 text-[10px]">
                            <Clock className="w-2.5 h-2.5 inline mr-0.5 opacity-50" />
                            {relativeTime(ep.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Error message */}
                    {ep.errorMessage && (
                      <p className="mt-1.5 text-[11px] text-orange-400/60 pl-0 border-t border-white/[0.04] pt-1.5">
                        {ep.errorMessage.substring(0, 120)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {episodes.length === 0 && series.length > 0 && (
        <div className="p-6 rounded-sm border-[0.5px] border-white/[0.06] bg-white/[0.01] text-center">
          <Clock className="w-8 h-8 text-white/20 mx-auto mb-2" />
          <p className="text-white/40 text-sm">
            No episodes produced yet. The cron runs Tue + Thu at 6 AM AEST.
          </p>
        </div>
      )}
    </div>
  );
}
