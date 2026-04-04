'use client';

/**
 * Sentiment Analysis Dashboard
 *
 * @description Visualises sentiment trends, emotion breakdowns,
 * and platform-level sentiment data from the analytics API.
 * Uses SWR for data fetching (the existing useSentimentAnalysis
 * hook is imperative, so we fetch directly via SWR here).
 *
 * Linear: UNI-1611
 */

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { fetchJson } from '@/lib/fetcher';
import { DashboardSkeleton } from '@/components/skeletons';
import { APIErrorCard } from '@/components/error-states';
import { TrendingUp, BarChart3, Smile, Frown, Heart } from '@/components/icons';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// ============================================================================
// TYPES
// ============================================================================

interface SentimentTrendsData {
  period: {
    start: string;
    end: string;
    days: number;
  };
  overall: {
    total: number;
    positive: number;
    neutral: number;
    negative: number;
    mixed: number;
    avgScore: number;
    avgConfidence: number;
  };
  trends: Array<{
    date: string;
    count: number;
    positive: number;
    neutral: number;
    negative: number;
    mixed: number;
    avgScore: number;
  }>;
  topEmotions: Array<{
    emotion: string;
    count: number;
    percentage: number;
  }>;
  platformBreakdown: Record<
    string,
    {
      count: number;
      avgScore: number;
      positive: number;
      negative: number;
    }
  >;
  insights: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CHART_COLOURS = {
  positive: '#22c55e',
  neutral: '#eab308',
  negative: '#ef4444',
  mixed: '#8b5cf6',
} as const;

const PIE_COLOURS = [
  CHART_COLOURS.positive,
  CHART_COLOURS.neutral,
  CHART_COLOURS.negative,
  CHART_COLOURS.mixed,
];

const PLATFORM_OPTIONS = [
  { value: '', label: 'All Platforms' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
] as const;

const DATE_RANGE_OPTIONS = [
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
] as const;

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default function SentimentPage() {
  const [platform, setPlatform] = useState('');
  const [days, setDays] = useState(30);

  // Build SWR key from filters
  const swrKey = useMemo(() => {
    const params = new URLSearchParams();
    params.set('days', String(days));
    if (platform) params.set('platform', platform);
    return `/api/analytics/sentiment?${params.toString()}`;
  }, [days, platform]);

  const { data, error, isLoading, mutate } = useSWR<SentimentTrendsData>(
    swrKey,
    fetchJson,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    }
  );

  // Derived data for charts
  const pieData = useMemo(() => {
    if (!data?.overall) return [];
    return [
      { name: 'Positive', value: data.overall.positive },
      { name: 'Neutral', value: data.overall.neutral },
      { name: 'Negative', value: data.overall.negative },
      { name: 'Mixed', value: data.overall.mixed },
    ].filter(d => d.value > 0);
  }, [data?.overall]);

  const topEmotion = useMemo(() => {
    if (!data?.topEmotions || data.topEmotions.length === 0) return null;
    return data.topEmotions[0];
  }, [data?.topEmotions]);

  const positivePercentage = useMemo(() => {
    if (!data?.overall || data.overall.total === 0) return 0;
    return Math.round((data.overall.positive / data.overall.total) * 100);
  }, [data?.overall]);

  const negativePercentage = useMemo(() => {
    if (!data?.overall || data.overall.total === 0) return 0;
    return Math.round((data.overall.negative / data.overall.total) * 100);
  }, [data?.overall]);

  // ---- Loading state ----
  if (isLoading && !data) {
    return <DashboardSkeleton />;
  }

  // ---- Error state ----
  if (error && !data) {
    return (
      <div className="p-6">
        <APIErrorCard
          title="Sentiment Data Error"
          message={
            error?.message ||
            'Failed to load sentiment analytics. Please try again.'
          }
          onRetry={() => mutate()}
        />
      </div>
    );
  }

  // ---- Empty state ----
  if (!data || data.overall.total === 0) {
    return (
      <div className="space-y-6">
        <SentimentHeader
          platform={platform}
          onPlatformChange={setPlatform}
          days={days}
          onDaysChange={setDays}
        />
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-12 text-center">
          <Smile className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-base font-light text-white mb-2">
            No sentiment data yet
          </h3>
          <p className="text-sm text-white/40 max-w-md mx-auto">
            Generate content to start tracking sentiment. Sentiment analysis
            runs automatically when you create or analyse posts.
          </p>
        </div>
      </div>
    );
  }

  // ---- Main content ----
  return (
    <div className="space-y-6">
      {/* Header */}
      <SentimentHeader
        platform={platform}
        onPlatformChange={setPlatform}
        days={days}
        onDaysChange={setDays}
      />

      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard
          label="Total Analysed"
          value={data.overall.total.toLocaleString()}
          icon={<BarChart3 className="h-4 w-4 text-white/30" />}
        />
        <StatCard
          label="Average Score"
          value={data.overall.avgScore.toString()}
          icon={<TrendingUp className="h-4 w-4 text-white/30" />}
        />
        <StatCard
          label="Positive"
          value={`${positivePercentage}%`}
          valueColour="text-green-400"
          icon={<Smile className="h-4 w-4 text-green-400/60" />}
        />
        <StatCard
          label="Negative"
          value={`${negativePercentage}%`}
          valueColour="text-red-400"
          icon={<Frown className="h-4 w-4 text-red-400/60" />}
        />
        <StatCard
          label="Top Emotion"
          value={topEmotion ? capitalise(topEmotion.emotion) : '\u2014'}
          icon={<Heart className="h-4 w-4 text-white/30" />}
        />
      </div>

      {/* Trend Chart + Distribution Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Line Chart — 2 cols */}
        <div className="lg:col-span-2 border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
          <h2 className="text-sm font-light text-white/60 mb-4">
            Sentiment Trend
          </h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trends}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.04)"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
                  tickFormatter={formatDate}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111',
                    border: '0.5px solid rgba(255,255,255,0.06)',
                    borderRadius: '2px',
                    fontSize: '12px',
                  }}
                  labelFormatter={formatDate}
                />
                <Legend
                  wrapperStyle={{
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.4)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="positive"
                  stroke={CHART_COLOURS.positive}
                  strokeWidth={2}
                  dot={false}
                  name="Positive"
                />
                <Line
                  type="monotone"
                  dataKey="neutral"
                  stroke={CHART_COLOURS.neutral}
                  strokeWidth={2}
                  dot={false}
                  name="Neutral"
                />
                <Line
                  type="monotone"
                  dataKey="negative"
                  stroke={CHART_COLOURS.negative}
                  strokeWidth={2}
                  dot={false}
                  name="Negative"
                />
                <Line
                  type="monotone"
                  dataKey="mixed"
                  stroke={CHART_COLOURS.mixed}
                  strokeWidth={1.5}
                  dot={false}
                  strokeDasharray="4 2"
                  name="Mixed"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sentiment Distribution Pie — 1 col */}
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
          <h2 className="text-sm font-light text-white/60 mb-4">
            Distribution
          </h2>
          <div className="h-72 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  dataKey="value"
                  nameKey="name"
                  paddingAngle={2}
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={PIE_COLOURS[index % PIE_COLOURS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111',
                    border: '0.5px solid rgba(255,255,255,0.06)',
                    borderRadius: '2px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number, name: string) => [
                    `${value} (${data.overall.total > 0 ? Math.round((value / data.overall.total) * 100) : 0}%)`,
                    name,
                  ]}
                />
                <Legend
                  wrapperStyle={{
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.4)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Emotions + Platform Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Emotions */}
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
          <h2 className="text-sm font-light text-white/60 mb-4">
            Top Emotions Detected
          </h2>
          {data.topEmotions.length === 0 ? (
            <p className="text-sm text-white/30 py-4">
              No emotion data available
            </p>
          ) : (
            <div className="space-y-3">
              {data.topEmotions.map(emotion => {
                const barWidth = Math.max(emotion.percentage, 2);
                return (
                  <div key={emotion.emotion}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-white/70">
                        {capitalise(emotion.emotion)}
                      </span>
                      <span className="text-xs text-white/40">
                        {emotion.count} ({emotion.percentage}%)
                      </span>
                    </div>
                    <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500/60 rounded-full transition-all"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Platform Breakdown */}
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
          <h2 className="text-sm font-light text-white/60 mb-4">
            Platform Breakdown
          </h2>
          {Object.keys(data.platformBreakdown).length === 0 ? (
            <p className="text-sm text-white/30 py-4">
              No platform data available
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(data.platformBreakdown).map(
                ([platformName, stats]) => (
                  <div
                    key={platformName}
                    className="border-[0.5px] border-white/[0.06] bg-white/[0.02] rounded-sm p-3"
                  >
                    <h3 className="text-sm text-white/80 font-medium mb-2">
                      {capitalise(platformName)}
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-white/30">Analysed</span>
                        <p className="text-white/70">{stats.count}</p>
                      </div>
                      <div>
                        <span className="text-white/30">Avg Score</span>
                        <p className="text-white/70">{stats.avgScore}</p>
                      </div>
                      <div>
                        <span className="text-white/30">Positive</span>
                        <p className="text-green-400/80">{stats.positive}</p>
                      </div>
                      <div>
                        <span className="text-white/30">Negative</span>
                        <p className="text-red-400/80">{stats.negative}</p>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI Insights */}
      {data.insights.length > 0 && (
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
          <h2 className="text-sm font-light text-white/60 mb-4">
            AI-Generated Insights
          </h2>
          <ul className="space-y-2">
            {data.insights.map((insight, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-white/50"
              >
                <span className="mt-1.5 h-1 w-1 rounded-full bg-amber-500/60 shrink-0" />
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function SentimentHeader({
  platform,
  onPlatformChange,
  days,
  onDaysChange,
}: {
  platform: string;
  onPlatformChange: (v: string) => void;
  days: number;
  onDaysChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <span className="text-[10px] uppercase tracking-[0.3em] text-white/25 mb-2 block">
          Analytics
        </span>
        <h1 className="text-3xl sm:text-4xl font-extralight tracking-tight text-white">
          Sentiment Analysis
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={platform}
          onChange={e => onPlatformChange(e.target.value)}
          className="rounded-sm bg-white/[0.02] border-[0.5px] border-white/[0.06] text-white/60 px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50"
        >
          {PLATFORM_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={days}
          onChange={e => onDaysChange(Number(e.target.value))}
          className="rounded-sm bg-white/[0.02] border-[0.5px] border-white/[0.06] text-white/60 px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50"
        >
          {DATE_RANGE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  valueColour = 'text-white',
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  valueColour?: string;
}) {
  return (
    <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/30">{label}</span>
        {icon}
      </div>
      <span className={`text-xl font-light ${valueColour}`}>{value}</span>
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function capitalise(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' });
}
