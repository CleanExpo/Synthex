'use client';

/**
 * AI Insights Panel
 *
 * @description Displays AI-generated performance insights with impact badges.
 */

import { useState } from 'react';
import {
  Sparkles,
  Lightbulb,
  FileText,
  Clock,
  Hash,
  AlignLeft,
  ChevronDown,
  ChevronUp,
} from '@/components/icons';
import { cn } from '@/lib/utils';
import type { PerformanceInsight } from '@/lib/ai/content-performance-analyzer';

interface AIInsightsPanelProps {
  insights: PerformanceInsight[];
  isLoading?: boolean;
  className?: string;
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  topic: Lightbulb,
  format: FileText,
  timing: Clock,
  hashtag: Hash,
  length: AlignLeft,
};

const IMPACT_STYLES: Record<string, { bg: string; border: string; text: string; glow?: string }> = {
  high: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    text: 'text-cyan-400',
    glow: 'shadow-cyan-500/20',
  },
  medium: {
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
    text: 'text-violet-400',
  },
  low: {
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30',
    text: 'text-gray-400',
  },
};

interface InsightCardProps {
  insight: PerformanceInsight;
}

function InsightCard({ insight }: InsightCardProps) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TYPE_ICONS[insight.type] || Lightbulb;
  const impactStyle = IMPACT_STYLES[insight.impact] || IMPACT_STYLES.low;

  return (
    <div
      className={cn(
        'border rounded-xl p-4 transition-all',
        impactStyle.border,
        insight.impact === 'high' && 'shadow-lg',
        impactStyle.glow
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className={cn('p-2 rounded-lg', impactStyle.bg)}>
          <Icon className={cn('w-4 h-4', impactStyle.text)} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-white">{insight.title}</h4>
            <span
              className={cn(
                'px-2 py-0.5 text-xs font-medium rounded-full capitalize',
                impactStyle.bg,
                impactStyle.text
              )}
            >
              {insight.impact}
            </span>
          </div>
          <p className="text-sm text-gray-400">{insight.description}</p>
        </div>
      </div>

      {/* Recommendation */}
      <div className="bg-white/5 rounded-lg p-3 mb-3">
        <p className="text-sm text-white">
          <span className="text-emerald-400 font-medium">Recommendation: </span>
          {insight.recommendation}
        </p>
      </div>

      {/* Evidence (collapsible) */}
      {insight.evidence && insight.evidence.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-400 transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3 h-3" />
                Hide evidence
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                Show evidence ({insight.evidence.length})
              </>
            )}
          </button>
          {expanded && (
            <ul className="mt-2 space-y-1">
              {insight.evidence.map((item, idx) => (
                <li key={idx} className="text-xs text-gray-400 flex items-start gap-2">
                  <span className="text-gray-600">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="border border-white/10 rounded-xl p-4 animate-pulse">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-white/5 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="w-48 h-4 bg-white/5 rounded" />
              <div className="w-full h-3 bg-white/5 rounded" />
            </div>
          </div>
          <div className="h-12 bg-white/5 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function AIInsightsPanel({
  insights,
  isLoading,
  className,
}: AIInsightsPanelProps) {
  if (isLoading) {
    return (
      <div className={cn('bg-gray-900/30 border border-white/10 rounded-xl p-4', className)}>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-semibold text-white">AI Insights</h3>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  if (!insights || insights.length === 0) {
    return (
      <div className={cn('bg-gray-900/30 border border-white/10 rounded-xl p-6', className)}>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-semibold text-white">AI Insights</h3>
        </div>
        <div className="text-center py-8">
          <Sparkles className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Not enough data for AI insights</p>
          <p className="text-sm text-gray-500 mt-1">
            Create more posts to unlock personalized recommendations
          </p>
        </div>
      </div>
    );
  }

  // Sort by impact: high first, then medium, then low
  const sortedInsights = [...insights].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.impact] - order[b.impact];
  });

  return (
    <div className={cn('bg-gray-900/30 border border-white/10 rounded-xl p-4', className)}>
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-cyan-400" />
        <h3 className="text-lg font-semibold text-white">AI Insights</h3>
        <span className="text-xs text-gray-500">({insights.length} recommendations)</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sortedInsights.map((insight, idx) => (
          <InsightCard key={`${insight.type}-${idx}`} insight={insight} />
        ))}
      </div>
    </div>
  );
}

export default AIInsightsPanel;
