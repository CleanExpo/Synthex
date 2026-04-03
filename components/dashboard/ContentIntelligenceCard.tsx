'use client';

/**
 * ContentIntelligenceCard — SYN-633
 *
 * Dashboard widget showing the org's content intelligence profile:
 *   - Confidence level (how much we've learned about this org's audience)
 *   - Top-performing content topics with avg engagement rates
 *   - Improvement rate vs previous period (after 4 weeks of data)
 *
 * Three display states:
 *   1. No data       — org hasn't published enough posts yet (<= 0 postCount)
 *   2. Building      — < 30% confidence, show "we're learning" placeholder
 *   3. Personalised  — >= 30% confidence, show real insights
 *
 * Data: GET /api/dashboard/content-intelligence
 */

import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, Brain, BarChart2 } from '@/components/icons';
import { cn } from '@/lib/utils';

// ── Fetcher ───────────────────────────────────────────────────────────────────

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => r.json());

// ── Types ─────────────────────────────────────────────────────────────────────

interface TopicScore {
  topic: string;
  avgEngagementRate: number;
  postCount: number;
}

interface ContentIntelligencePayload {
  hasData: boolean;
  confidenceLevel: number;
  postCount: number;
  topTopics: TopicScore[];
  improvementRate: number | null;
  weekCount: number;
  industry: string;
}

interface ContentIntelligenceResponse {
  success: boolean;
  data: ContentIntelligencePayload;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConfidenceBar({ level }: { level: number }) {
  const pct = Math.round(level * 100);
  const colour =
    pct >= 70 ? 'bg-violet-500' : pct >= 40 ? 'bg-violet-400' : 'bg-violet-300/50';
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-[11px] text-white/50">Intelligence confidence</span>
        <span className="text-[11px] text-violet-300 font-medium">{pct}%</span>
      </div>
      <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', colour)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function TopicRow({ topic }: { topic: TopicScore }) {
  const pct = Math.round(topic.avgEngagementRate * 100);
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
        <span className="text-xs text-white/70 capitalize">
          {topic.topic.replace(/-/g, ' ')}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-white/40">{topic.postCount} posts</span>
        <span className="text-xs font-medium text-violet-300">{pct}% eng.</span>
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ContentIntelligenceSkeleton() {
  return (
    <Card variant="glass">
      <CardContent className="p-5 space-y-4 animate-pulse">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm bg-white/[0.04]" />
          <div className="h-3.5 w-36 bg-white/[0.04] rounded-sm" />
        </div>
        <div className="h-1.5 bg-white/[0.04] rounded-full" />
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-8 bg-white/[0.03] rounded-sm" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── No-data state ─────────────────────────────────────────────────────────────

function NoDataState() {
  return (
    <Card variant="glass">
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2 text-white/80 text-sm font-medium">
          <Brain className="w-4 h-4 text-violet-400" />
          Content Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="w-9 h-9 rounded-sm bg-violet-500/[0.06] border border-violet-500/20 flex items-center justify-center">
            <BarChart2 className="w-4 h-4 text-violet-400/60" />
          </div>
          <div>
            <p className="text-sm text-white/60 mb-1">No content data yet</p>
            <p className="text-xs text-white/35 leading-relaxed max-w-[220px]">
              Publish your first posts to start building personalised audience
              intelligence.
            </p>
          </div>
          <a
            href="/dashboard/content/drafts"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 rounded-sm transition-colors"
          >
            Create content
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Building state (<30% confidence) ─────────────────────────────────────────

function BuildingState({
  data,
}: {
  data: ContentIntelligencePayload;
}) {
  return (
    <Card variant="glass">
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2 text-white/80 text-sm font-medium">
          <Brain className="w-4 h-4 text-violet-400" />
          Content Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <ConfidenceBar level={data.confidenceLevel} />
        <div className="flex items-start gap-2.5 p-3 bg-violet-500/[0.05] border border-violet-500/20 rounded-sm">
          <Loader2 className="w-3.5 h-3.5 text-violet-400 mt-0.5 animate-spin flex-shrink-0" />
          <p className="text-xs text-white/50 leading-relaxed">
            Building your audience profile — we&apos;ve analysed{' '}
            <span className="text-white/70 font-medium">{data.postCount} posts</span>{' '}
            so far. Keep publishing and personalised insights will appear here within a
            few weeks.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ContentIntelligenceCard() {
  const { data: raw, isLoading } = useSWR<ContentIntelligenceResponse>(
    '/api/dashboard/content-intelligence',
    fetchJson,
    { refreshInterval: 300_000, dedupingInterval: 120_000 }
  );

  if (isLoading || !raw?.data) return <ContentIntelligenceSkeleton />;

  const data = raw.data;

  if (!data.hasData || data.postCount === 0) return <NoDataState />;

  if (data.confidenceLevel < 0.3) return <BuildingState data={data} />;

  const confidencePct = Math.round(data.confidenceLevel * 100);

  return (
    <Card variant="glass">
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center justify-between text-white/80 text-sm font-medium">
          <span className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-violet-400" />
            Content Intelligence
          </span>
          <span className="text-[10px] text-violet-300/70 font-normal">
            {confidencePct}% confidence
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        <ConfidenceBar level={data.confidenceLevel} />

        {/* Top topics */}
        {data.topTopics.length > 0 && (
          <div>
            <p className="text-[11px] text-white/40 uppercase tracking-widest mb-2">
              Top-performing topics
            </p>
            <div>
              {data.topTopics.map(topic => (
                <TopicRow key={topic.topic} topic={topic} />
              ))}
            </div>
          </div>
        )}

        {/* Improvement rate — only shown after 4 weeks of positive data */}
        {data.improvementRate !== null && (
          <div className="flex items-center gap-2.5 p-3 bg-emerald-500/[0.05] border border-emerald-500/20 rounded-sm">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <p className="text-xs text-white/60 leading-relaxed">
              Content performing{' '}
              <span className="text-emerald-300 font-semibold">
                {Math.round(data.improvementRate * 100)}% better
              </span>{' '}
              since Synthex started learning your audience.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-1.5 pt-0.5 border-t border-white/[0.04]">
          <span className="text-[10px] text-white/25">
            {data.weekCount} week{data.weekCount !== 1 ? 's' : ''} of data ·{' '}
            {data.industry} industry baseline
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
