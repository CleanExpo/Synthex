'use client';

/**
 * Content Performance Dashboard
 *
 * @description AI-powered analysis of what content works and why,
 * with patterns, insights, and top/low performer comparison.
 */

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useContentPerformance } from '@/hooks/useContentPerformance';

// Dynamic imports for heavy chart/AI components
const PerformanceOverview = dynamic(() => import('@/components/performance/PerformanceOverview').then(m => ({ default: m.PerformanceOverview })), { ssr: false });
const AIInsightsPanel = dynamic(() => import('@/components/performance/AIInsightsPanel').then(m => ({ default: m.AIInsightsPanel })), { ssr: false });
const PatternCharts = dynamic(() => import('@/components/performance/PatternCharts').then(m => ({ default: m.PatternCharts })), { ssr: false });
const TopPostsGrid = dynamic(() => import('@/components/performance/TopPostsGrid').then(m => ({ default: m.TopPostsGrid })), { ssr: false });
import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RefreshCw,
  Loader2,
  AlertTriangle,
  Sparkles,
} from '@/components/icons';

export default function ContentPerformancePage() {
  const [platform, setPlatform] = useState<string>('all');
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  const { data, isLoading, error, refetch } = useContentPerformance({
    platform,
    period,
    includeAI: true,
  });

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader
          title="Content Performance"
          description="AI-powered analysis of what content works"
        />
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            <div>
              <h3 className="text-lg font-semibold text-white">Failed to load performance data</h3>
              <p className="text-red-400">{error}</p>
            </div>
          </div>
          <Button onClick={handleRefresh} variant="outline" className="mt-4">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const emptyData = !data || data.summary.totalPosts === 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader
          title="Content Performance"
          description="AI-powered analysis of what content works and why"
        />
        <div className="flex items-center gap-3">
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="w-[140px] bg-gray-900/50 border-white/10">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="twitter">Twitter</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="tiktok">TikTok</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => setPeriod(v as '7d' | '30d' | '90d')}>
            <SelectTrigger className="w-[100px] bg-gray-900/50 border-white/10">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
              <SelectItem value="90d">90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
            className="border-white/10"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {emptyData && !isLoading && (
        <div className="bg-gray-900/30 border border-white/10 rounded-xl p-12 text-center">
          <Sparkles className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Performance Data Yet</h3>
          <p className="text-gray-400 max-w-md mx-auto">
            Connect your social platforms and publish some posts to see AI-powered
            insights about what content performs best.
          </p>
        </div>
      )}

      {/* Stats Row */}
      {(!emptyData || isLoading) && (
        <PerformanceOverview
          summary={data?.summary || { totalPosts: 0, avgEngagement: 0, topPerforming: [], lowPerforming: [] }}
          isLoading={isLoading}
        />
      )}

      {/* AI Insights */}
      {(!emptyData || isLoading) && (
        <AIInsightsPanel
          insights={data?.insights || []}
          isLoading={isLoading}
        />
      )}

      {/* Pattern Charts */}
      {(!emptyData || isLoading) && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Performance Patterns</h3>
          <PatternCharts
            patterns={data?.patterns || { bestDays: [], bestHours: [], bestLength: { min: 0, max: 0, avgEngagement: 0 }, topHashtags: [] }}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Top/Low Posts */}
      {(!emptyData || isLoading) && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Post Analysis</h3>
          <TopPostsGrid
            topPerforming={data?.summary.topPerforming || []}
            lowPerforming={data?.summary.lowPerforming || []}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Content Types (if available) */}
      {data?.contentTypes && data.contentTypes.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Content Types</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {data.contentTypes.map((ct) => (
              <div
                key={ct.type}
                className="bg-gray-900/30 border border-white/10 rounded-xl p-4 text-center"
              >
                <p className="text-lg font-bold text-white capitalize">{ct.type}</p>
                <p className="text-sm text-gray-400">{ct.count} posts</p>
                <p className="text-xs text-emerald-400 mt-1">{ct.avgEngagement}% avg</p>
                <p className={`text-xs mt-1 ${
                  ct.trend === 'up' ? 'text-emerald-400' : ct.trend === 'down' ? 'text-red-400' : 'text-gray-500'
                }`}>
                  {ct.trend === 'up' ? '↑ Trending' : ct.trend === 'down' ? '↓ Declining' : '— Stable'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
