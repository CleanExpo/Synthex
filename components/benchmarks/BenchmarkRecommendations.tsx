'use client';

/**
 * Benchmark Recommendations
 *
 * @description Displays insights and actionable recommendations
 * from benchmark analysis.
 */

import { Lightbulb, ArrowRight, Info, Zap } from '@/components/icons';
import { cn } from '@/lib/utils';

interface BenchmarkRecommendationsProps {
  insights: string[];
  recommendations: string[];
  isLoading?: boolean;
  className?: string;
}

function InsightItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3 text-sm">
      <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
      <span className="text-gray-300">{text}</span>
    </li>
  );
}

function RecommendationItem({
  text,
  index,
}: {
  text: string;
  index: number;
}) {
  // Determine impact level based on recommendation type
  const isHighImpact =
    text.toLowerCase().includes('engagement') ||
    text.toLowerCase().includes('frequency') ||
    text.toLowerCase().includes('boost');

  return (
    <li className="flex items-start gap-3 p-3 bg-white/5 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium flex-shrink-0">
        {index + 1}
      </div>
      <div className="flex-1">
        <p className="text-sm text-gray-300">{text}</p>
        <div className="flex items-center gap-2 mt-2">
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded',
              isHighImpact
                ? 'bg-orange-500/10 text-orange-400'
                : 'bg-blue-500/10 text-blue-400'
            )}
          >
            {isHighImpact ? 'High Impact' : 'Medium Impact'}
          </span>
        </div>
      </div>
      <ArrowRight className="w-4 h-4 text-gray-500 flex-shrink-0 mt-1" />
    </li>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Insights skeleton */}
      <div className="bg-gray-900/50 border border-white/10 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-cyan-500/10 rounded-lg animate-pulse" />
          <div className="w-24 h-5 bg-white/5 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-4 h-4 bg-white/5 rounded animate-pulse mt-0.5" />
              <div className="flex-1 h-4 bg-white/5 rounded animate-pulse" style={{ width: `${90 - i * 10}%` }} />
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations skeleton */}
      <div className="bg-gray-900/50 border border-white/10 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-emerald-500/10 rounded-lg animate-pulse" />
          <div className="w-32 h-5 bg-white/5 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-3 bg-white/5 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-white/10 rounded-full animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/5 rounded animate-pulse" />
                  <div className="w-20 h-5 bg-white/5 rounded animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BenchmarkRecommendations({
  insights,
  recommendations,
  isLoading,
  className,
}: BenchmarkRecommendationsProps) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const hasData = insights.length > 0 || recommendations.length > 0;

  if (!hasData) {
    return (
      <div className={cn('bg-gray-900/50 border border-white/10 rounded-xl p-8 text-center', className)}>
        <Lightbulb className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-white mb-1">No Recommendations Yet</h3>
        <p className="text-gray-500 text-sm">
          Publish more content to receive personalized recommendations.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-1 lg:grid-cols-2 gap-6', className)}>
      {/* Key Insights */}
      <div className="bg-gray-900/50 border border-white/10 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-cyan-500/10 rounded-lg">
            <Lightbulb className="w-4 h-4 text-cyan-400" />
          </div>
          <h3 className="font-medium text-white">Key Insights</h3>
        </div>

        {insights.length > 0 ? (
          <ul className="space-y-3">
            {insights.map((insight, i) => (
              <InsightItem key={i} text={insight} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No insights available</p>
        )}
      </div>

      {/* Recommendations */}
      <div className="bg-gray-900/50 border border-white/10 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <h3 className="font-medium text-white">Recommendations</h3>
        </div>

        {recommendations.length > 0 ? (
          <ul className="space-y-3">
            {recommendations.map((rec, i) => (
              <RecommendationItem key={i} text={rec} index={i} />
            ))}
          </ul>
        ) : (
          <div className="p-4 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
            <p className="text-sm text-emerald-400">
              Great job! Your metrics are performing well. Keep up the good work!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default BenchmarkRecommendations;
