'use client';

/**
 * Benchmark Reports Dashboard
 *
 * @description Compare your social media performance to industry standards
 * with percentile rankings, platform-specific comparisons, and recommendations.
 */

import { useState, useCallback } from 'react';
import { useBenchmarks } from '@/hooks/useBenchmarks';
import { BenchmarkOverview } from '@/components/benchmarks/BenchmarkOverview';
import { PlatformBenchmarkCard, PlatformBenchmarkCardSkeleton } from '@/components/benchmarks/PlatformBenchmarkCard';
import { BenchmarkRecommendations } from '@/components/benchmarks/BenchmarkRecommendations';
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
  Target,
} from '@/components/icons';

export default function BenchmarkReportsPage() {
  const [platform, setPlatform] = useState<string>('all');
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  const { data, isLoading, error, refetch } = useBenchmarks({
    platform,
    period,
  });

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader
          title="Benchmark Reports"
          description="Compare your performance to industry standards"
        />
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            <div>
              <h3 className="text-lg font-semibold text-white">Failed to load benchmark data</h3>
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

  const emptyData = !data || data.byPlatform.length === 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader
          title="Benchmark Reports"
          description="See how your performance compares to industry standards"
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
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="pinterest">Pinterest</SelectItem>
              <SelectItem value="reddit">Reddit</SelectItem>
              <SelectItem value="threads">Threads</SelectItem>
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
          <Target className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Benchmark Data Yet</h3>
          <p className="text-gray-400 max-w-md mx-auto">
            Connect your social platforms and publish some posts to see how your
            performance compares to industry benchmarks.
          </p>
        </div>
      )}

      {/* Overview Section */}
      {(!emptyData || isLoading) && (
        <BenchmarkOverview
          report={data || null}
          platformsAnalyzed={data?.meta?.platformsAnalyzed || 0}
          postsAnalyzed={data?.meta?.postsAnalyzed || 0}
          isLoading={isLoading}
        />
      )}

      {/* Platform Cards Grid */}
      {(!emptyData || isLoading) && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Platform Breakdown</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <PlatformBenchmarkCardSkeleton key={i} />
              ))
            ) : (
              data?.byPlatform.map((platformReport) => (
                <PlatformBenchmarkCard
                  key={platformReport.platform}
                  report={platformReport}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Recommendations Section */}
      {(!emptyData || isLoading) && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Insights & Actions</h3>
          <BenchmarkRecommendations
            insights={data?.insights || []}
            recommendations={data?.recommendations || []}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Info footer */}
      {!isLoading && !emptyData && (
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <p className="text-xs text-gray-500">
            Benchmarks are based on industry averages across millions of social media accounts.
            Data is updated periodically to reflect current standards.
            {data?.generatedAt && (
              <span className="ml-2">
                Last updated: {new Date(data.generatedAt).toLocaleString()}
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
